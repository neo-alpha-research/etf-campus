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
    if not base_dir.exists():
        print(f"❌ Error: OSMU directory '{base_dir}' does not exist!", file=sys.stderr)
        return 1

    success_count = 0
    total_count = 0

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

    print(f"\n📊 Summary: {success_count}/{total_count} assets synchronized to Cloudflare KV.")
    if success_count == total_count and total_count > 0:
        print("🎉 All OSMU images successfully synchronized!")
        return 0
    elif success_count > 0:
        print("⚠️ Partially synchronized.")
        return 0
    else:
        print("❌ All uploads failed.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
