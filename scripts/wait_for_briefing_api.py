#!/usr/bin/env python3
"""
scripts/wait_for_briefing_api.py

Cloudflare Pages 마켓 브리핑 API 또는 로컬 정본 페이로드가
당일 기준일(asOfDate) 데이터를 서빙하고 Pydantic v2 BriefingContract를
100% 만족할 때까지 대기(polling) 및 무결성 검증하는 스크립트입니다.
"""

from __future__ import annotations

import csv
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.schemas.briefing_contract import validate_briefing_payload


def resolve_expected_date(target_arg: str | None = None) -> str:
    if target_arg and target_arg.strip():
        cleaned = target_arg.strip().replace("-", "")
        if len(cleaned) == 8 and cleaned.isdigit():
            return cleaned

    master_file = Path("data/etf_master_draft.csv")
    if master_file.exists():
        try:
            with open(master_file, encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                first_row = next(reader, None)
                if first_row and "bas_dt" in first_row:
                    return first_row["bas_dt"].strip().replace("-", "")
        except Exception as e:
            print(f"⚠️ Error reading {master_file}: {e}", file=sys.stderr)

    return time.strftime("%Y%m%d")


def main() -> int:
    target_arg = sys.argv[1] if len(sys.argv) > 1 else None
    target_date = resolve_expected_date(target_arg)
    formatted_date = f"{target_date[:4]}-{target_date[4:6]}-{target_date[6:]}" if len(target_date) == 8 else target_date
    print(f"🔍 [API Waiter] Waiting for market briefing data to serve asOfDate: {formatted_date} ({target_date})")

    # 1. Primary Check: Local Repository Canonical Payload (Strict Contract Validation)
    payload_date_file = Path(f"data/briefing_payload_{formatted_date}.json")
    payload_latest_file = Path("data/briefing_payload_latest.json")

    for pf in (payload_date_file, payload_latest_file):
        if pf.exists():
            try:
                with open(pf, "r", encoding="utf-8") as f:
                    data = json.load(f)
                raw = data.get("briefing") or data
                as_of = (raw.get("asOfDate") or raw.get("as_of_date") or "").replace("-", "").strip()
                if as_of == target_date:
                    is_valid, errs, contract = validate_briefing_payload(raw)
                    if is_valid and contract is not None:
                        print(f"⚡ [API Waiter] Local repository data is READY & VALIDATED for {formatted_date} ({pf.name})!")
                        print(f"  - 스마트머니 상위 유입: {contract.top_inflows[0].name} ({contract.top_inflows[0].net_flow / 1e8:+.1f}억원)")
                        print("✅ [API Waiter] Fast-pass authorized (Zero-D1 Dependency, 0s delay).")
                        return 0
                    else:
                        print(f"⚠️ [API Waiter] Local payload {pf.name} failed contract validation:", file=sys.stderr)
                        for err in errs:
                            print(f"    * {err}", file=sys.stderr)
            except Exception as e:
                print(f"⚠️ [API Waiter] Error verifying local {pf}: {e}", file=sys.stderr)

    # 2. Polling Remote API endpoints if local verified data was not ready
    max_attempts = 3
    delay_seconds = 5

    worker_url = f"https://market-briefing-distributor.neo-alpha-research.workers.dev/api/briefings/latest?date={formatted_date}&_t={time.time()}"
    pages_url = f"https://etf-campus.pages.dev/api/briefings/latest?_t={time.time()}"

    for attempt in range(1, max_attempts + 1):
        # 2a. Distributor Worker endpoint
        try:
            req = urllib.request.Request(worker_url, headers={"User-Agent": "ETF-Campus-Waiter/1.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                raw = data.get("briefing") or data
                as_of = (raw.get("asOfDate") or raw.get("as_of_date") or "").replace("-", "").strip()

                if as_of == target_date:
                    is_valid, errs, contract = validate_briefing_payload(raw)
                    if is_valid and contract is not None:
                        print(f"✅ [API Waiter] Confirmed & validated via Distributor Worker! Target date {formatted_date}.")
                        return 0
                    else:
                        print(f"⚠️ [API Waiter] Worker briefing for {formatted_date} failed contract:", file=sys.stderr)
                        for err in errs:
                            print(f"    * {err}", file=sys.stderr)
        except Exception:
            pass

        # 2b. Pages endpoint
        try:
            req = urllib.request.Request(pages_url, headers={"User-Agent": "ETF-Campus-Waiter/1.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                raw = data.get("briefing") or data
                as_of = (raw.get("asOfDate") or raw.get("as_of_date") or "").replace("-", "").strip()

                if as_of == target_date:
                    is_valid, errs, contract = validate_briefing_payload(raw)
                    if is_valid and contract is not None:
                        print(f"✅ [API Waiter] Confirmed & validated via Pages! Target date {formatted_date}.")
                        return 0
                    else:
                        print(f"⚠️ [API Waiter] Pages briefing for {formatted_date} failed contract:", file=sys.stderr)
                        for err in errs:
                            print(f"    * {err}", file=sys.stderr)
                else:
                    print(f"⏳ [API Waiter] Attempt {attempt}/{max_attempts}: Latest is {as_of} (expected {target_date}). Retrying in {delay_seconds}s...")
        except Exception as e:
            print(f"⚠️ [API Waiter] Attempt {attempt}/{max_attempts} request error: {e}")

        time.sleep(delay_seconds)

    print(f"❌ [API Waiter] Error: Timeout or validation failure for target date {formatted_date} across local and remote channels.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
