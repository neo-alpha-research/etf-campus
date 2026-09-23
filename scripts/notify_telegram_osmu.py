#!/usr/bin/env python3
"""
scripts/notify_telegram_osmu.py

OSMU(One Source Multi Use) 아카이브 생성 완료 시,
최신 마켓 브리핑 핵심 요약 텍스트와 그래픽 카드 이미지를
지정된 텔레그램(채널 또는 채팅방)으로 자동 발송하는 스크립트입니다.

- 자본시장법 제101조 및 Zero-Hallucination 지침 준수
- TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 미설정 시 Graceful Skip (종료 코드 0)
- 표준 라이브러리(urllib, json, pathlib 등)만 사용하여 추가 패키지 의존성 없음
"""

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

REQUEST_TIMEOUT_SECONDS = 25
BRIEFING_WEB_URL = "https://etf-campus.pages.dev/briefing"
DISTRIBUTOR_DASHBOARD_URL = "https://market-briefing-distributor.neo-alpha-research.workers.dev/preview"


def find_latest_osmu_dir(base_dir: Path) -> Path | None:
    if not base_dir.exists():
        return None
    date_dirs = [
        d for d in base_dir.iterdir()
        if d.is_dir() and re.match(r"^\d{4}-\d{2}-\d{2}$", d.name)
    ]
    if not date_dirs:
        return None
    date_dirs.sort(key=lambda d: d.name, reverse=True)
    return date_dirs[0]


def send_telegram_photo(bot_token: str, chat_id: str, photo_path: Path, caption: str) -> bool:
    boundary = f"----TelegramBoundary{uuid.uuid4().hex}"
    filename = photo_path.name

    with open(photo_path, "rb") as f:
        file_bytes = f.read()

    body = bytearray()

    # chat_id
    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(f'Content-Disposition: form-data; name="chat_id"\r\n\r\n{chat_id}\r\n'.encode("utf-8"))

    # caption (Telegram photo caption max 1024 characters)
    if caption:
        safe_caption = caption[:1024]
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(f'Content-Disposition: form-data; name="caption"\r\n\r\n{safe_caption}\r\n'.encode("utf-8"))

    # photo file
    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(f'Content-Disposition: form-data; name="photo"; filename="{filename}"\r\n'.encode("utf-8"))
    body.extend(b"Content-Type: image/png\r\n\r\n")
    body.extend(file_bytes)
    body.extend(b"\r\n")

    # end boundary
    body.extend(f"--{boundary}--\r\n".encode("utf-8"))

    url = f"https://api.telegram.org/bot{bot_token}/sendPhoto"
    req = urllib.request.Request(
        url,
        data=bytes(body),
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "User-Agent": "ETF-Campus-OSMU/1.0",
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            return bool(res_data.get("ok"))
    except Exception as e:
        print(f"⚠️ Telegram sendPhoto failed: {type(e).__name__} - {e}", file=sys.stderr)
        return False


def send_telegram_message(bot_token: str, chat_id: str, text: str) -> bool:
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = json.dumps({
        "chat_id": chat_id,
        "text": text,
        "disable_web_page_preview": False,
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "ETF-Campus-OSMU/1.0",
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            return bool(res_data.get("ok"))
    except Exception as e:
        print(f"⚠️ Telegram sendMessage failed: {type(e).__name__} - {e}", file=sys.stderr)
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Send Telegram OSMU notification or failure alert")
    parser.add_argument("--failure", action="store_true", help="Send pipeline failure/stoppage alert")
    parser.add_argument("--reason", default="마켓 브리핑 파이프라인이 중단되었습니다.", help="Failure reason")
    parser.add_argument("--date", help="Target date in YYYY-MM-DD")
    args = parser.parse_args()

    bot_token = (os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip()
    chat_id = (os.environ.get("TELEGRAM_CHAT_ID") or "").strip()

    if not bot_token or not chat_id:
        print("ℹ️ TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID가 설정되지 않았습니다. 텔레그램 알림을 건너뜁니다.")
        return 0

    base_archive = Path("OSMU_Archive")
    latest_dir = find_latest_osmu_dir(base_archive)
    as_of_date = args.date or (latest_dir.name if latest_dir else "")
    if not as_of_date:
        master_file = Path("data/etf_master_draft.csv")
        if master_file.exists():
            try:
                import csv
                with open(master_file, encoding="utf-8-sig") as f:
                    row = next(csv.DictReader(f), None)
                    if row and "bas_dt" in row:
                        raw = row["bas_dt"].replace("-", "")
                        as_of_date = f"{raw[:4]}-{raw[4:6]}-{raw[6:]}"
            except Exception:
                pass
    if not as_of_date:
        as_of_date = "알 수 없음"

    dashboard_token = os.environ.get("MANUAL_RUN_TOKEN") or "etf-campus-osmu-internal-2026"
    dashboard_link = f"{DISTRIBUTOR_DASHBOARD_URL}?date={as_of_date}&token={dashboard_token}"
    run_id = os.environ.get("GITHUB_RUN_ID", "")
    repo = os.environ.get("GITHUB_REPOSITORY", "neo-alpha-research/etf-campus")
    run_url = f"https://github.com/{repo}/actions/runs/{run_id}" if run_id else ""

    # 1. Pipeline Failure / Stoppage Alert
    if args.failure:
        print(f"🚨 [Telegram Alert] 파이프라인 중단 경보 발송 중: {args.reason}")
        # Check for quarantined tickers in v2 price series manifest
        manifest_path = Path("public/data/series/v2/manifest.json")
        quarantined_items = []
        if manifest_path.exists():
            try:
                with open(manifest_path, "r", encoding="utf-8") as f:
                    m = json.load(f)
                for tk, val in m.get("tickers", {}).items():
                    if isinstance(val, dict) and val.get("status") == "quarantined":
                        quarantined_items.append((tk, val.get("reason", "무결성 위반"), val.get("as_of", "")))
            except Exception:
                pass

        # Check for OSMU channel publish errors (including Meta token expiration)
        osmu_error_data = None
        osmu_candidates = []
        if latest_dir:
            osmu_candidates.append(latest_dir / "osmu_publish_error.json")
        osmu_candidates.append(Path("OSMU_Archive") / as_of_date / "osmu_publish_error.json")
        for cand in osmu_candidates:
            if cand.exists():
                try:
                    osmu_error_data = json.loads(cand.read_text(encoding="utf-8"))
                    break
                except Exception:
                    pass

        if osmu_error_data and osmu_error_data.get("has_token_expired"):
            failed_threads = osmu_error_data.get("results", {}).get("threads", {})
            err_detail = failed_threads.get("error", "OAuthException 60-day limit reached")
            msg = (
                f"🚨 [ETF CAMPUS 긴급 경보] Meta Threads 60일 토큰 만료 (배포 차단)\n\n"
                f"• 기준일자: {as_of_date}\n"
                f"• 원인: Meta Threads Long-lived Access Token의 60일 유효기간이 만료되었습니다.\n"
                f"• 상세 에러: {err_detail}\n\n"
                f"👉 긴급 조치: Meta 개발자 센터에서 User Token 재발급 후 Cloudflare Secrets(THREADS_ACCESS_TOKEN) 업데이트 필요\n\n"
                f"👉 관리 대시보드:\n{dashboard_link}\n"
            )
        elif osmu_error_data:
            failed_channels = [ch for ch, res in osmu_error_data.get("results", {}).items() if not res.get("success")]
            channel_str = ", ".join(failed_channels) if failed_channels else "알 수 없음"
            msg = (
                f"🚨 [ETF CAMPUS 경보] OSMU 채널 자동 배포 실패\n\n"
                f"• 기준일자: {as_of_date}\n"
                f"• 실패 채널: {channel_str}\n"
                f"• 중단 사유: {args.reason}\n\n"
                f"👉 관리 대시보드:\n{dashboard_link}\n"
            )
        elif quarantined_items:
            q_lines = "\n".join([f"  • {tk}: {reason} (기준일 {as_of})" for tk, reason, as_of in quarantined_items])
            msg = (
                f"🚨 [ETF CAMPUS 경보] 가격 시계열 무결성 격리(Quarantine) 차단\n\n"
                f"• 기준일자: {as_of_date}\n"
                f"• 중단 사유: {args.reason}\n"
                f"• 격리 종목 (총 {len(quarantined_items)}건):\n{q_lines}\n\n"
                f"👉 필수 조치: data/corporate_actions/etf_corporate_actions.csv 원장 항목 등록 필요\n\n"
                f"👉 관리 대시보드:\n{dashboard_link}\n"
            )
        else:
            msg = (
                f"🚨 [ETF CAMPUS 경보] 마켓 브리핑 파이프라인 중단\n\n"
                f"• 기준일자: {as_of_date}\n"
                f"• 중단 사유: {args.reason}\n"
                f"• 조치 필요: 비정상 데이터 또는 인프라 에러로 인해 안전 모드로 정지되었습니다.\n\n"
                f"👉 관리 대시보드:\n{dashboard_link}\n"
            )
        if run_url:
            msg += f"\n🔗 GitHub Actions 상세 로그:\n{run_url}\n"

        sent = send_telegram_message(bot_token, chat_id, msg)
        if sent:
            print("✅ 텔레그램 중단 경보 발송 완료.")
        else:
            print("⚠️ 텔레그램 중단 경보 발송 실패.", file=sys.stderr)
        return 0

    # 2. Pipeline Success / Published Notification
    if not latest_dir:
        print("ℹ️ 전송할 OSMU 아카이브 디렉토리를 찾을 수 없습니다. 건너뜁니다.")
        return 0

    print(f"📢 최신 OSMU 아카이브 확인: 기준일 {as_of_date}")

    threads_script_file = latest_dir / "2_Threads" / "threads_script.txt"
    threads_image_file = latest_dir / "2_Threads" / "threads_image.png"

    summary_content = ""
    if threads_script_file.exists():
        summary_content = threads_script_file.read_text(encoding="utf-8").strip().lstrip("\ufeff")

    from datetime import datetime, timezone, timedelta
    kst = timezone(timedelta(hours=9))
    now_kst = datetime.now(kst).date()

    # Load holidays
    holidays_file = Path("data/market_holidays.txt")
    holidays = set()
    if holidays_file.exists():
        for line in holidays_file.read_text(encoding="utf-8").splitlines():
            clean = line.split("#", 1)[0].strip()
            if len(clean) == 8 and clean.isdigit():
                holidays.add(clean)

    def find_next_trading_day(start_date, h_set: set[str]) -> tuple:
        cur = start_date + timedelta(days=1)
        korean_weekdays = ["월", "화", "수", "목", "금", "토", "일"]
        while True:
            ymd = cur.strftime("%Y%m%d")
            if cur.weekday() < 5 and ymd not in h_set:
                day_str = cur.strftime("%Y-%m-%d")
                w_str = korean_weekdays[cur.weekday()]
                return cur, f"{day_str} ({w_str})"
            cur += timedelta(days=1)

    # Check osmu_publish_status.json
    status_file = None
    status_data = {}
    candidate_status_paths = []
    if latest_dir:
        candidate_status_paths.append(latest_dir / "osmu_publish_status.json")
    candidate_status_paths.append(Path("OSMU_Archive") / as_of_date / "osmu_publish_status.json")

    for p in candidate_status_paths:
        if p.exists():
            try:
                status_data = json.loads(p.read_text(encoding="utf-8"))
                status_file = p
                break
            except Exception:
                pass

    is_weekend = (now_kst.weekday() >= 5)
    is_holiday = (now_kst.strftime("%Y%m%d") in holidays)
    is_standby = (status_data.get("status") == "standby") or is_weekend or is_holiday

    _, next_trading_str = find_next_trading_day(now_kst, holidays)
    next_pub_date = status_data.get("next_publish_date") or next_trading_str

    if is_standby and status_data.get("status") != "published":
        reason_label = "추석 연휴" if "0924" in now_kst.strftime("%Y%m%d") or "0925" in now_kst.strftime("%Y%m%d") else ("주말" if is_weekend else "공휴일")
        header = f"✨ [ETF CAMPUS] 마켓 브리핑 & OSMU 준비 완료 ({as_of_date})\n"
        status_text = (
            f"연휴/휴장 기간 중 독자 소셜 피드 노이즈 방지를 위해 3대 채널 배포는 보류(Standby)되었습니다.\n\n"
            f"• 🌐 웹페이지 마켓 브리핑: 최신 데이터 반영 완료\n"
            f"• 📦 OSMU 에셋(스레드/인스타/뉴스레터): KV 적재 완료\n"
            f"• ⏰ 3대 채널 자동 발행 예정: {next_pub_date} 아침 07:30 KST\n"
            f"  (운영 대시보드에서 검토 후 '즉시 발송' 가능)\n"
        )
    else:
        header = f"🎉 [ETF CAMPUS] 마켓 브리핑 3대 채널 자동 발행 완료 ({as_of_date})\n"
        status_text = (
            f"{as_of_date} 마켓 브리핑 및 OSMU 에셋이 3대 채널에 자동 배포되었습니다.\n\n"
            "• 🧵 스레드(@neo.alphareader): 발행 완료\n"
            "• 📸 인스타그램(@neo.alphareader): 6장 캐러셀 발행 완료\n"
            "• 📧 뉴스레터: 배포 완료\n"
        )

    links = (
        f"👉 실시간 배포 대시보드:\n{dashboard_link}\n\n"
        f"🌐 ETF Campus 웹 브리핑:\n{BRIEFING_WEB_URL}"
    )

    if summary_content:
        full_message = f"{header}\n{status_text}\n[마켓 브리핑 핵심 요약]\n{summary_content}\n\n{links}"
    else:
        full_message = f"{header}\n{status_text}\n{links}"

    photo_sent = False
    if threads_image_file.exists():
        print(f"🖼️ 그래픽 카드 이미지 발견: {threads_image_file} ({threads_image_file.stat().st_size:,} bytes)")
        if len(full_message) <= 1024:
            photo_sent = send_telegram_photo(bot_token, chat_id, threads_image_file, full_message)
        else:
            if is_standby and status_data.get("status") != "published":
                short_caption = f"✨ [ETF CAMPUS] {as_of_date} 마켓 브리핑 & OSMU 준비 완료\n\n• {next_pub_date} 아침 07:30 KST 자동 발행 예정\n\n👉 대시보드:\n{dashboard_link}"
            else:
                short_caption = f"🎉 [ETF CAMPUS] {as_of_date} 마켓 브리핑 자동 발행 완료\n\n• 3대 채널(스레드/인스타/뉴스레터) 배포 성공\n\n👉 대시보드:\n{dashboard_link}"
            photo_sent = send_telegram_photo(bot_token, chat_id, threads_image_file, short_caption)
            if photo_sent:
                send_telegram_message(bot_token, chat_id, full_message)

    if not photo_sent:
        print("📝 텍스트 전용 메시지 발송 시도...")
        text_sent = send_telegram_message(bot_token, chat_id, full_message)
        if text_sent:
            print("✅ 텔레그램 텍스트 알림 발송 완료.")
        else:
            print("⚠️ 텔레그램 메시지 발송 실패.")
    else:
        print("✅ 텔레그램 이미지 카드 및 브리핑 알림 발송 완료.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
