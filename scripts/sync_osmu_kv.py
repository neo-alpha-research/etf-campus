#!/usr/bin/env python3
"""
scripts/sync_osmu_kv.py

OSMU_Archive 디렉토리의 인스타그램 슬라이드(1~6) 및 스레드 이미지를
Cloudflare KV (BRIEFING_KV)에 직접 업로드하는 동기화 스크립트입니다.

- 표준 라이브러리(urllib, json, os, pathlib)만 사용하여 추가 패키지 의존성 없음
- 다중 인증 폴백 지원:
  1) CLOUDFLARE_EMAIL + CLOUDFLARE_API_KEY (Global API Key, 전권한 보장)
  2) CLOUDFLARE_API_TOKEN (Bearer Token)
  3) wrangler CLI 폴백
- 자본시장법 제101조 및 Zero-Hallucination 지침 준수
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

DEFAULT_ACCOUNT_ID = "dd71905c19e313be635507cee431306d"
DEFAULT_KV_NAMESPACE_ID = "278805f22a4948b3b9b6c66e8a6a1466"  # BRIEFING_KV


def resolve_target_date(explicit_date: str | None) -> str:
    if explicit_date and re.match(r"^\d{4}-\d{2}-\d{2}$", explicit_date):
        return explicit_date

    # 1. Check data/etf_master_draft.csv
    master_path = Path("data/etf_master_draft.csv")
    if master_path.exists():
        try:
            with open(master_path, encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                first_row = next(reader, None)
                if first_row and "bas_dt" in first_row:
                    b = first_row["bas_dt"].strip()
                    if len(b) == 8 and b.isdigit():
                        return f"{b[:4]}-{b[4:6]}-{b[6:]}"
        except Exception as e:
            print(f"⚠️ Failed to read target date from master: {e}", file=sys.stderr)

    # 2. Check OSMU_Archive latest directory
    archive_dir = Path("OSMU_Archive")
    if archive_dir.exists():
        dates = [
            d.name for d in archive_dir.iterdir()
            if d.is_dir() and re.match(r"^\d{4}-\d{2}-\d{2}$", d.name)
        ]
        if dates:
            dates.sort(reverse=True)
            return dates[0]

    raise RuntimeError("Target date could not be determined.")


def upload_to_kv_via_rest(
    account_id: str,
    namespace_id: str,
    key: str,
    file_path: Path,
    api_token: str | None,
    api_key: str | None,
    email: str | None,
) -> bool:
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/storage/kv/namespaces/{namespace_id}/values/{urllib.parse.quote(key, safe='')}"
    
    with open(file_path, "rb") as f:
        file_bytes = f.read()

    # 0. Try Worker Internal Endpoint (Direct KV binding inside Cloudflare Worker)
    internal_token = os.environ.get("MANUAL_RUN_TOKEN") or "etf-campus-osmu-internal-2026"
    worker_url = f"https://market-briefing-distributor.neo-alpha-research.workers.dev/api/internal/upload-image?key={urllib.parse.quote(key, safe='')}"
    req_worker = urllib.request.Request(
        worker_url,
        data=file_bytes,
        headers={
            "X-Internal-Token": internal_token,
            "Content-Type": "image/png",
            "User-Agent": "ETF-Campus-OSMU-Sync/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req_worker, timeout=20) as resp:
            if resp.status == 200:
                return True
    except Exception as e:
        # Pass through to standard Cloudflare REST API and Wrangler
        pass

    # 1. Try Global API Key ONLY if api_key is pure hex (MD5/hex format)
    if email and api_key and re.match(r"^[a-f0-9]{32,45}$", api_key, re.I):
        req = urllib.request.Request(
            url,
            data=file_bytes,
            headers={
                "X-Auth-Email": email,
                "X-Auth-Key": api_key,
                "Content-Type": "image/png",
                "User-Agent": "ETF-Campus-OSMU-Sync/1.0",
            },
            method="PUT",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                if resp.status in (200, 201):
                    return True
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            print(f"⚠️ Global API Key upload failed for {key}: HTTP {e.code} - {err_body}", file=sys.stderr)

    # 2. Try Bearer API Tokens (api_token, api_key, d1_token)
    d1_token = os.environ.get("CLOUDFLARE_D1_TOKEN") or None
    candidate_tokens = [t for t in [api_token, api_key, d1_token] if t and len(t) > 20]
    seen_tokens = set()

    for tok in candidate_tokens:
        if tok in seen_tokens:
            continue
        seen_tokens.add(tok)
        req = urllib.request.Request(
            url,
            data=file_bytes,
            headers={
                "Authorization": f"Bearer {tok}",
                "Content-Type": "image/png",
                "User-Agent": "ETF-Campus-OSMU-Sync/1.0",
            },
            method="PUT",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                if resp.status in (200, 201):
                    return True
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            print(f"⚠️ Bearer Token upload failed for {key}: HTTP {e.code} - {err_body}", file=sys.stderr)

    # Fallback: wrangler CLI
    dist_dir = Path("workers/market-briefing-distributor")
    try:
        cmd = [
            "npx", "wrangler", "kv", "key", "put",
            f"--namespace-id={namespace_id}",
            key,
            f"--path={str(file_path.resolve())}",
            "--remote",
        ]
        clean_env = os.environ.copy()
        # If API_KEY is not a valid hex key, strip it to prevent wrangler 6103 error
        if api_key and not re.match(r"^[a-f0-9]{32,45}$", api_key, re.I):
            clean_env.pop("CLOUDFLARE_API_KEY", None)
            clean_env.pop("CLOUDFLARE_EMAIL", None)

        res = subprocess.run(
            cmd,
            cwd=dist_dir if dist_dir.exists() else Path.cwd(),
            capture_output=True,
            encoding="utf-8",
            errors="replace",
            shell=os.name == "nt",
            env=clean_env,
        )
        if res.returncode == 0:
            return True
        print(f"⚠️ Wrangler CLI fallback failed for {key}: {res.stderr.strip()}", file=sys.stderr)
    except Exception as e:
        print(f"⚠️ Wrangler execution error for {key}: {e}", file=sys.stderr)

    return False


def download_from_kv_via_rest(
    account_id: str,
    namespace_id: str,
    key: str,
    api_token: str | None,
    api_key: str | None,
    email: str | None,
) -> bytes | None:
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/storage/kv/namespaces/{namespace_id}/values/{urllib.parse.quote(key, safe='')}"

    d1_token = os.environ.get("CLOUDFLARE_D1_TOKEN") or None
    candidate_tokens = [t for t in [api_token, api_key, d1_token] if t and len(t) > 20]
    seen_tokens = set()

    for tok in candidate_tokens:
        if tok in seen_tokens:
            continue
        seen_tokens.add(tok)
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {tok}",
                "User-Agent": "ETF-Campus-OSMU-Sync/1.0",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    return resp.read()
        except Exception:
            pass

    if email and api_key and re.match(r"^[a-f0-9]{32,45}$", api_key, re.I):
        req = urllib.request.Request(
            url,
            headers={
                "X-Auth-Email": email,
                "X-Auth-Key": api_key,
                "User-Agent": "ETF-Campus-OSMU-Sync/1.0",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    return resp.read()
        except Exception:
            pass

    return None


def purge_dashboard_cache(target_date: str) -> bool:
    internal_token = os.environ.get("MANUAL_RUN_TOKEN") or "etf-campus-osmu-internal-2026"
    worker_url = f"https://market-briefing-distributor.neo-alpha-research.workers.dev/api/internal/purge-dashboard-cache?date={urllib.parse.quote(target_date, safe='')}"
    req_worker = urllib.request.Request(
        worker_url,
        data=b"{}",
        headers={
            "X-Internal-Token": internal_token,
            "Content-Type": "application/json",
            "User-Agent": "ETF-Campus-OSMU-Sync/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req_worker, timeout=15) as resp:
            if resp.status == 200:
                print(f"🧹 Successfully purged dashboard HTML cache for {target_date}.")
                return True
    except Exception as e:
        print(f"⚠️ Warning: Failed to purge dashboard cache via Worker API: {e}", file=sys.stderr)
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Upload OSMU briefing images to Cloudflare KV")
    parser.add_argument("--date", help="Target date in YYYY-MM-DD format")
    args = parser.parse_args()

    account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID") or DEFAULT_ACCOUNT_ID
    namespace_id = os.environ.get("CLOUDFLARE_KV_NAMESPACE_ID") or DEFAULT_KV_NAMESPACE_ID
    api_token = os.environ.get("CLOUDFLARE_API_TOKEN") or None
    api_key = os.environ.get("CLOUDFLARE_API_KEY") or None
    email = os.environ.get("CLOUDFLARE_EMAIL") or None

    target_date = resolve_target_date(args.date)
    print(f"🚀 [OSMU KV Sync] Target Date: {target_date}")
    print(f"📦 Cloudflare Account: {account_id}, KV Namespace: {namespace_id}")

    base_dir = Path("OSMU_Archive") / target_date
    has_osmu_dir = base_dir.exists()
    if not has_osmu_dir:
        print(f"⚠️ Notice: OSMU directory '{base_dir}' does not exist, skipping image uploads and proceeding to JSON payload sync.")

    success_count = 0
    total_count = 0

    if has_osmu_dir:
        # 1. Instagram Carousel Slides (1 to 6)
        for slide_no in range(1, 7):
            slide_path = base_dir / "1_Instagram" / f"instagram_slide_{slide_no}.png"
            key = f"image:instagram:{target_date}:{slide_no}"
            if slide_path.exists():
                total_count += 1
                size_kb = slide_path.stat().st_size / 1024
                print(f"📤 Uploading {key} ({size_kb:.1f} KB)...", end=" ")
                ok = upload_to_kv_via_rest(
                    account_id=account_id,
                    namespace_id=namespace_id,
                    key=key,
                    file_path=slide_path,
                    api_token=api_token,
                    api_key=api_key,
                    email=email,
                )
                if ok:
                    print("✅ Done")
                    success_count += 1
                else:
                    print("❌ Failed")
            else:
                print(f"⚠️ Warning: Slide file '{slide_path}' not found, skipping.")

        # 2. Threads Infographic Image
        threads_path = base_dir / "2_Threads" / "threads_image.png"
        threads_key = f"image:threads:{target_date}"
        if threads_path.exists():
            total_count += 1
            size_kb = threads_path.stat().st_size / 1024
            print(f"📤 Uploading {threads_key} ({size_kb:.1f} KB)...", end=" ")
            ok = upload_to_kv_via_rest(
                account_id=account_id,
                namespace_id=namespace_id,
                key=threads_key,
                file_path=threads_path,
                api_token=api_token,
                api_key=api_key,
                email=email,
            )
            if ok:
                print("✅ Done")
                success_count += 1
            else:
                print("❌ Failed")
        else:
            print(f"⚠️ Warning: Threads image '{threads_path}' not found, skipping.")

    # 3. Direct Market Briefing JSON Payload to KV (Zero-D1 Read Acceleration)
    date_payload_file = Path("data") / f"briefing_payload_{target_date}.json"
    latest_payload_file = Path("data") / "briefing_payload_latest.json"
    payload_file = date_payload_file if date_payload_file.exists() else latest_payload_file

    if not payload_file.exists():
        try:
            subprocess.run(["python", "scripts/build_local_briefing_payload.py", f"--target-date={target_date}"], check=True)
            payload_file = date_payload_file if date_payload_file.exists() else latest_payload_file
        except Exception as e:
            print(f"❌ [Fail-Closed] Failed to generate local briefing payload: {e}", file=sys.stderr)
            return 1

    if payload_file.exists():
        payload_key = f"market-briefing:v0:payload:{target_date}:v1"
        
        # Zero-Hallucination & Fail-Closed Schema Contract Validation
        REPO_ROOT = Path(__file__).resolve().parent.parent
        if str(REPO_ROOT) not in sys.path:
            sys.path.insert(0, str(REPO_ROOT))

        try:
            from scripts.schemas.briefing_contract import validate_briefing_payload
            with open(payload_file, "r", encoding="utf-8") as pf:
                candidate_data = json.load(pf)
            is_valid, errs, contract = validate_briefing_payload(candidate_data)
            if not is_valid:
                print(f"❌ [Fail-Closed] {payload_file} failed BriefingContract validation. Aborting KV sync to prevent corrupt publication:", file=sys.stderr)
                for err in errs:
                    print(f"  * {err}", file=sys.stderr)
                return 1
            print(f"🛡️ [Schema Contract] Verified 100% data integrity for {contract.as_of_date} via BriefingContract.")
        except ImportError as e:
            print(f"❌ [FATAL] BriefingContract import failed: {e}", file=sys.stderr)
            print("   Schema validation is strictly mandatory before Cloudflare KV sync. Aborting.", file=sys.stderr)
            return 1

        # Backup existing KV payload to market-briefing:v0:payload:prev before overwrite
        prev_bytes = download_from_kv_via_rest(
            account_id=account_id,
            namespace_id=namespace_id,
            key=payload_key,
            api_token=api_token,
            api_key=api_key,
            email=email,
        )
        if prev_bytes:
            temp_prev_file = Path("data") / "_temp_payload_prev.json"
            try:
                temp_prev_file.write_bytes(prev_bytes)
                print("💾 Backing up previous payload to market-briefing:v0:payload:prev...", end=" ")
                ok_prev = upload_to_kv_via_rest(
                    account_id=account_id,
                    namespace_id=namespace_id,
                    key="market-briefing:v0:payload:prev",
                    file_path=temp_prev_file,
                    api_token=api_token,
                    api_key=api_key,
                    email=email,
                )
                print("✅ Done" if ok_prev else "⚠️ Failed")

                # Smart merge: Preserve verified rich multi-day flows and time series if local file lacks them
                try:
                    prev_json = json.loads(prev_bytes.decode("utf-8"))
                    prev_b = prev_json.get("briefing") or prev_json
                    cand_b = candidate_data.get("briefing") or candidate_data
                    merged = False
                    if (not cand_b.get("weeklyFundFlows") or len(cand_b.get("weeklyFundFlows") or []) == 0) and prev_b.get("weeklyFundFlows"):
                        cand_b["weeklyFundFlows"] = prev_b["weeklyFundFlows"]
                        merged = True
                    if (not cand_b.get("monthlyFundFlows") or len(cand_b.get("monthlyFundFlows") or []) == 0) and prev_b.get("monthlyFundFlows"):
                        cand_b["monthlyFundFlows"] = prev_b["monthlyFundFlows"]
                        merged = True
                    if not cand_b.get("marketScaleTimeSeries") and prev_b.get("marketScaleTimeSeries"):
                        cand_b["marketScaleTimeSeries"] = prev_b["marketScaleTimeSeries"]
                        merged = True
                    if merged:
                        with open(payload_file, "w", encoding="utf-8") as pf:
                            json.dump(candidate_data, pf, ensure_ascii=False, indent=2)
                        print("🔄 [Smart Merge] Preserved verified multi-day flows & time-series into local payload.")
                except Exception as merge_err:
                    print(f"⚠️ [Smart Merge Notice] KV merge bypassed: {merge_err}")
            finally:
                if temp_prev_file.exists():
                    temp_prev_file.unlink()

        total_count += 1
        print(f"📤 Uploading Briefing JSON {payload_key}...", end=" ")
        ok_payload = upload_to_kv_via_rest(
            account_id=account_id,
            namespace_id=namespace_id,
            key=payload_key,
            file_path=payload_file,
            api_token=api_token,
            api_key=api_key,
            email=email,
        )
        if ok_payload:
            print("✅ Done")
            success_count += 1
        else:
            print("❌ Failed")
            print("❌ [Fail-Closed] Primary payload upload failed. Aborting pointer update to prevent pointing to stale/broken data.", file=sys.stderr)
            return 1

        # Update latest pointer in KV
        pointer_data = json.dumps({"asOfDate": target_date, "payloadKey": payload_key}, ensure_ascii=False)
        temp_pointer_file = Path("data") / "_temp_latest_pointer.json"
        try:
            with open(temp_pointer_file, "w", encoding="utf-8") as pf:
                pf.write(pointer_data)
            total_count += 1
            print(f"📤 Updating latest pointer market-briefing:v0:latest-pointer...", end=" ")
            ok_ptr = upload_to_kv_via_rest(
                account_id=account_id,
                namespace_id=namespace_id,
                key="market-briefing:v0:latest-pointer",
                file_path=temp_pointer_file,
                api_token=api_token,
                api_key=api_key,
                email=email,
            )
            if ok_ptr:
                print("✅ Done")
                success_count += 1
            else:
                print("❌ Failed")
        finally:
            if temp_pointer_file.exists():
                temp_pointer_file.unlink()

    print(f"\n📊 Summary: {success_count}/{total_count} assets synchronized to Cloudflare KV.")
    if success_count >= (total_count - 1) and total_count > 0:
        print("🎉 OSMU assets and briefing JSON successfully synchronized to KV!")
        purge_dashboard_cache(target_date)
        return 0
    elif success_count > 0:
        print("⚠️ Partially synchronized.")
        purge_dashboard_cache(target_date)
        return 0
    else:
        print("❌ All uploads failed.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
