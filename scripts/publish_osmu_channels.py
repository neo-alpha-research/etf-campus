#!/usr/bin/env python3
"""
scripts/publish_osmu_channels.py

3대 채널(스레드, 이메일 뉴스레터, 인스타그램 6장 캐러셀) 자동 배포 스크립트:
1. 마켓 브리핑 서킷브레이커 및 데이터 무결성 사전 점검
2. market-briefing-distributor API를 호출하여 원클릭 3대 채널 자동 발행
3. 배포 완료 후 대시보드 캐시 자동 퍼지
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

DISTRIBUTOR_HOST = "https://market-briefing-distributor.neo-alpha-research.workers.dev"


def resolve_target_date(target_arg: str | None = None) -> str:
    if target_arg and target_arg.strip():
        cleaned = target_arg.strip().replace("-", "")
        if len(cleaned) == 8 and cleaned.isdigit():
            return f"{cleaned[:4]}-{cleaned[4:6]}-{cleaned[6:]}"
        elif len(target_arg.strip()) == 10:
            return target_arg.strip()

    master_file = Path("data/etf_master_draft.csv")
    if master_file.exists():
        try:
            import csv
            with open(master_file, encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                first_row = next(reader, None)
                if first_row and "bas_dt" in first_row:
                    dt = first_row["bas_dt"].strip().replace("-", "")
                    if len(dt) == 8:
                        return f"{dt[:4]}-{dt[4:6]}-{dt[6:]}"
        except Exception:
            pass

    return time.strftime("%Y-%m-%d")


def check_briefing_safety(date_str: str) -> tuple[bool, str]:
    url = f"{DISTRIBUTOR_HOST}/api/briefings/latest?date={urllib.parse.quote(date_str, safe='')}&_t={time.time()}"
    req = urllib.request.Request(url, headers={"User-Agent": "ETF-Campus-OSMU-Publisher/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status != 200:
                return False, f"HTTP status {resp.status}"
            data = json.loads(resp.read().decode("utf-8"))
            as_of = (data.get("briefing", {}).get("asOfDate") or data.get("asOfDate") or "").strip()
            if as_of != date_str:
                return False, f"Briefing asOfDate '{as_of}' does not match target date '{date_str}'"
            return True, "Safe"
    except Exception as e:
        return False, f"Failed to query briefing API: {e}"


def post_worker(endpoint: str, date_str: str, token: str, extra_params: str = "") -> dict:
    url = f"{DISTRIBUTOR_HOST}{endpoint}?date={urllib.parse.quote(date_str, safe='')}&token={urllib.parse.quote(token, safe='')}{extra_params}"
    req = urllib.request.Request(
        url,
        data=b"{}",
        headers={
            "Authorization": f"Bearer {token}",
            "User-Agent": "ETF-Campus-OSMU-Publisher/1.0",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def send_newsletter_email(target_date: str, force: bool = False) -> tuple[bool, str]:
    smtp_user = os.environ.get("SMTP_USER", "").strip()
    smtp_pass = os.environ.get("SMTP_PASS", "").strip()
    recipient = os.environ.get("NEWSLETTER_TO_EMAIL", "").strip() or smtp_user

    if not smtp_user or not smtp_pass:
        return True, "SMTP credentials not provided in environment. Skipping email transmission."

    # Tier 3 Guard: Local transmission receipt
    receipt_dir = Path("OSMU_Archive") / target_date / "3_Newsletter"
    receipt_file = receipt_dir / "email_sent_receipt.json"
    if receipt_file.exists() and not force:
        try:
            receipt_data = json.loads(receipt_file.read_text(encoding="utf-8"))
            sent_at = receipt_data.get("sent_at", "earlier")
            return True, f"Email already transmitted at {sent_at} for {target_date}. Duplicate transmission skipped."
        except Exception:
            pass

    html_content = ""
    local_html = receipt_dir / "newsletter_responsive.html"
    if local_html.exists():
        try:
            html_content = local_html.read_text(encoding="utf-8")
        except Exception:
            pass

    if not html_content:
        url = f"{DISTRIBUTOR_HOST}/api/preview/newsletter?date={urllib.parse.quote(target_date, safe='')}"
        req = urllib.request.Request(url, headers={"User-Agent": "ETF-Campus-OSMU-Publisher/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                html_content = resp.read().decode("utf-8")
        except Exception as e:
            return False, f"Failed to fetch newsletter HTML: {e}"

    if not html_content:
        return False, "Newsletter HTML content is empty"

    import smtplib
    import ssl
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.utils import formataddr

    subject = f"[ETF Campus] {target_date} 마켓 브리핑 뉴스레터"
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = formataddr(("ETF Campus", smtp_user))
    msg["To"] = recipient

    plain_fallback = f"ETF Campus 마켓 브리핑 뉴스레터 ({target_date})\n웹 버전 보기: https://etf-campus.pages.dev/market-briefing"
    msg.attach(MIMEText(plain_fallback, "plain", "utf-8"))
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as server:
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, [recipient], msg.as_string())

        # Save transmission receipt
        try:
            receipt_dir.mkdir(parents=True, exist_ok=True)
            receipt_file.write_text(json.dumps({
                "target_date": target_date,
                "sent_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "recipient": recipient,
                "sender": smtp_user,
            }, indent=2), encoding="utf-8")
        except Exception:
            pass

        return True, f"Email sent successfully to {recipient}"
    except Exception as e:
        return False, f"SMTP transmission failed: {e}"


def purge_dashboard_cache(date_str: str, token: str) -> None:
    url = f"{DISTRIBUTOR_HOST}/api/internal/purge-dashboard-cache?date={urllib.parse.quote(date_str, safe='')}"
    req = urllib.request.Request(
        url,
        data=b"{}",
        headers={
            "X-Internal-Token": token,
            "User-Agent": "ETF-Campus-OSMU-Publisher/1.0",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                print(f"🧹 Dashboard cache successfully purged for {date_str}.")
    except Exception as e:
        print(f"⚠️ Warning: Cache purge error: {e}", file=sys.stderr)


def main() -> int:
    parser = argparse.ArgumentParser(description="Publish market briefing to Threads, Newsletter, and Instagram")
    parser.add_argument("--date", help="Target date in YYYY-MM-DD format")
    parser.add_argument("--token", help="Admin distribution token")
    parser.add_argument("--channels", default="all", help="Channels to publish: all, threads, newsletter, instagram")
    parser.add_argument("--check-only", action="store_true", help="Only check readiness without publishing")
    parser.add_argument("--force", action="store_true", help="Force republishing even on weekends/holidays or if already published")
    args = parser.parse_args()

    token = args.token or os.environ.get("MANUAL_RUN_TOKEN") or "etf-campus-osmu-internal-2026"
    target_date = resolve_target_date(args.date)

    print(f"🚀 [OSMU Auto-Publisher] Target Date: {target_date}")

    # Weekend & Korean Market Holiday Guard for Publish Day (KST)
    if not args.force:
        from datetime import datetime, timezone, timedelta
        kst = timezone(timedelta(hours=9))
        now_kst = datetime.now(kst).date()
        holidays_file = Path("data/market_holidays.txt")
        holidays = set()
        if holidays_file.exists():
            for line in holidays_file.read_text(encoding="utf-8").splitlines():
                clean = line.split("#", 1)[0].strip()
                if len(clean) == 8 and clean.isdigit():
                    holidays.add(clean)

        if now_kst.weekday() >= 5:
            print(f"🛑 [Weekend Guard] Today ({now_kst:%Y-%m-%d} KST) is a weekend. Korean markets are closed. Publishing is forbidden on weekends.")
            print("   (Automated pipeline skipped. Friday close will be published on Monday morning. Use --force to override)")
            return 0

        if now_kst.strftime("%Y%m%d") in holidays:
            print(f"🛑 [Holiday Guard] Today ({now_kst:%Y-%m-%d} KST) is a designated Korean market holiday. Markets are closed. Publishing is forbidden on holidays.")
            print("   (Automated pipeline skipped. Use --force to override)")
            return 0

    # 1. Check safety & readiness
    is_safe, reason = check_briefing_safety(target_date)
    if not is_safe:
        print(f"❌ [Safety Check Failed] {reason}", file=sys.stderr)
        return 1
    print(f"✅ [Safety Check Passed] Briefing for {target_date} is verified and ready.")

    if args.check_only:
        print("🔍 Check-only mode completed successfully.")
        return 0

    channels = [c.strip().lower() for c in args.channels.split(",")]
    publish_all = "all" in channels
    results = {}
    extra_param = "&force=true" if args.force else ""

    # 2. Threads (Strict Deduplication Guard)
    if publish_all or "threads" in channels:
        print(f"\n🧵 [1/3] Publishing to Threads (@neo.alphareader)...")
        try:
            res = post_worker("/api/publish/threads", target_date, token, extra_params=extra_param)
            post_id = res.get("publishedPostId") or "OK"
            err_msg = str(res.get("error", ""))
            if res.get("success"):
                print(f"   ✅ Threads Publish Success! (ID: {post_id})")
                results["threads"] = {"success": True, "id": post_id}
            elif res.get("publishedPostId") and ("이미 발행" in err_msg or "already" in err_msg.lower()):
                print(f"   ℹ️ Threads Already Published (ID: {post_id}). Duplicate publication skipped.")
                results["threads"] = {"success": True, "id": post_id, "already_published": True}
            else:
                print(f"   ❌ Threads Publish Failed: {err_msg}", file=sys.stderr)
                results["threads"] = {"success": False, "error": err_msg}
        except Exception as e:
            print(f"   ❌ Threads Request Exception: {e}", file=sys.stderr)
            results["threads"] = {"success": False, "error": str(e)}

    # 3. Newsletter (Strict Deduplication Guard & Real Email Transmission)
    if publish_all or "newsletter" in channels:
        print(f"\n📧 [2/3] Processing Newsletter distribution & email transmission...")
        try:
            res = post_worker("/api/publish/newsletter", target_date, token, extra_params=extra_param)
            if res.get("success"):
                if res.get("alreadyPublished") and not args.force:
                    print(f"   ℹ️ Newsletter Already Prepared for {target_date} (KV/D1). Duplicate distribution skipped.")
                    mail_ok, mail_msg = send_newsletter_email(target_date, force=False)
                    if "Duplicate" in mail_msg or "already transmitted" in mail_msg.lower():
                        print(f"   ℹ️ {mail_msg}")
                        results["newsletter"] = {"success": True, "already_published": True}
                    elif mail_ok:
                        print(f"   ✉️ {mail_msg}")
                        results["newsletter"] = {"success": True, "email_transmitted": True}
                    else:
                        print(f"   ⚠️ Newsletter Email Warning: {mail_msg}", file=sys.stderr)
                        results["newsletter"] = {"success": True, "already_published": True, "email_warning": mail_msg}
                else:
                    if res.get("alreadyPublished"):
                        print(f"   ⚠️ Force flag detected: Re-transmitting newsletter for {target_date}...")
                    else:
                        print(f"   ✅ Newsletter State: Prepared in KV/D1 successfully.")
                    
                    # Transmit actual email via SMTP if configured
                    mail_ok, mail_msg = send_newsletter_email(target_date, force=args.force)
                    if mail_ok:
                        print(f"   ✉️ {mail_msg}")
                        results["newsletter"] = {"success": True, "email_transmitted": True}
                    else:
                        print(f"   ⚠️ Newsletter Email Warning: {mail_msg}", file=sys.stderr)
                        results["newsletter"] = {"success": True, "email_transmitted": False, "email_warning": mail_msg}
            else:
                print(f"   ❌ Newsletter Failed: {res.get('error')}", file=sys.stderr)
                results["newsletter"] = {"success": False, "error": res.get("error")}
        except Exception as e:
            print(f"   ❌ Newsletter Request Exception: {e}", file=sys.stderr)
            results["newsletter"] = {"success": False, "error": str(e)}

    # 4. Instagram (Strict Deduplication Guard - No hardcoded force!)
    if publish_all or "instagram" in channels:
        print(f"\n📸 [3/3] Publishing 6-slide carousel to Instagram (@neo.alphareader)...")
        try:
            res = post_worker("/api/publish/instagram", target_date, token, extra_params=extra_param)
            post_id = res.get("publishedPostId") or "OK"
            err_msg = str(res.get("error", ""))
            if res.get("success"):
                print(f"   ✅ Instagram Carousel Publish Success! (ID: {post_id})")
                results["instagram"] = {"success": True, "id": post_id}
            elif res.get("publishedPostId") and ("이미 발행" in err_msg or "already" in err_msg.lower()):
                print(f"   ℹ️ Instagram Carousel Already Published (ID: {post_id}). Duplicate publication skipped.")
                results["instagram"] = {"success": True, "id": post_id, "already_published": True}
            else:
                print(f"   ❌ Instagram Publish Failed: {err_msg}", file=sys.stderr)
                results["instagram"] = {"success": False, "error": err_msg}
        except Exception as e:
            print(f"   ❌ Instagram Request Exception: {e}", file=sys.stderr)
            results["instagram"] = {"success": False, "error": str(e)}

    # 5. Purge dashboard cache
    purge_dashboard_cache(target_date, token)

    # Summary
    success_count = sum(1 for v in results.values() if v.get("success"))
    total_requested = len(results)
    print(f"\n📊 [Distribution Summary] {success_count}/{total_requested} channels published successfully.")

    if success_count == total_requested:
        print("🎉 All requested channels published without errors!")
        return 0
    else:
        print("⚠️ Some channels encountered issues. Check logs above.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
