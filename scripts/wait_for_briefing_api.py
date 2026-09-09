#!/usr/bin/env python3
"""
scripts/wait_for_briefing_api.py

Cloudflare Pages 마켓 브리핑 API(/api/briefings/latest)가
당일 기준일(asOfDate) 데이터를 서빙할 때까지 대기(polling)하는 스크립트입니다.
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
    print(f"🔍 [API Waiter] Waiting for /api/briefings/latest to serve asOfDate: {target_date}")

    max_attempts = 20
    delay_seconds = 10

    for attempt in range(1, max_attempts + 1):
        try:
            url = f"https://etf-campus.pages.dev/api/briefings/latest?_t={time.time()}"
            req = urllib.request.Request(url, headers={"User-Agent": "ETF-Campus-Waiter/1.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                as_of = (
                    data.get("briefing", {}).get("asOfDate")
                    or data.get("asOfDate")
                    or ""
                ).replace("-", "").strip()

                if as_of == target_date:
                    print(f"✅ [API Waiter] Confirmed! API is serving target date {target_date}.")
                    return 0

                print(f"⏳ [API Waiter] Attempt {attempt}/{max_attempts}: Latest is {as_of} (expected {target_date}). Retrying in {delay_seconds}s...")
        except Exception as e:
            print(f"⚠️ [API Waiter] Attempt {attempt}/{max_attempts} request error: {e}")

        time.sleep(delay_seconds)

    print(f"⚠️ [API Waiter] Timeout waiting for target date {target_date}. Proceeding with best-effort.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
