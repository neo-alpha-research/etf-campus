#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Syncs nominal total expense ratio (fund fee) for newly listed or unlisted ETFs

from Naver Mobile Stock Integration API (FnGuide-refined KRX official source).
Writes atomic updates to data/fees/etf_fee_registry.json.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
FEE_REGISTRY_PATH = REPO_ROOT / "data/fees/etf_fee_registry.json"
MASTER_PATH = REPO_ROOT / "data/etf_master_draft.csv"


def fetch_naver_fund_fee(ticker: str) -> float | None:
    """Fetch nominal total fee percentage for a ticker via Naver Mobile API."""
    url = f"https://m.stock.naver.com/api/stock/{ticker}/integration"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            total_infos = data.get("totalInfos", [])
            for info in total_infos:
                if info.get("code") == "fundPay":
                    val_str = info.get("value", "")
                    clean_str = re.sub(r"[^\d.]", "", val_str)
                    if clean_str:
                        return float(clean_str)
    except Exception as e:
        print(f"[{ticker}] Warning: Naver API fetch failed: {e}", file=sys.stderr)
    return None


def resolve_issuer(name: str) -> str:
    """Resolve brand/issuer prefix from ETF name."""
    brand_map = {
        "KODEX": "삼성자산운용",
        "TIGER": "미래에셋자산운용",
        "ACE": "한국투자신탁운용",
        "RISE": "KB자산운용",
        "KBSTAR": "KB자산운용",
        "SOL": "신한자산운용",
        "PLUS": "한화자산운용",
        "ARIRANG": "한화자산운용",
        "KOACT": "삼성액티브자산운용",
        "TIME": "타임폴리오자산운용",
        "TIMEFOLIO": "타임폴리오자산운용",
        "WOORI": "우리자산운용",
        "WON": "우리자산운용",
        "HANARO": "NH-Amundi자산운용",
        "KIWOOM": "키움투자자산운용",
        "HERO": "키움투자자산운용",
        "UNICORN": "현대자산운용",
        "MIDAS": "마이더스에셋자산운용",
        "마이티": "DB자산운용",
        "1Q": "하나자산운용",
        "FOCUS": "DB자산운용",
    }
    for brand, issuer in brand_map.items():
        if name.upper().startswith(brand.upper()):
            return issuer
    return "기타운용사"


def sync_new_listing_fees(target_tickers: list[str] | None = None) -> int:
    """Sync fees for target tickers or all missing tickers in etf_fee_registry.json."""
    if not MASTER_PATH.exists():
        print(f"[ERROR] Master file not found: {MASTER_PATH}", file=sys.stderr)
        return 1

    with MASTER_PATH.open("r", encoding="utf-8-sig", newline="") as f:
        master_rows = {r["ticker"].strip().upper(): r for r in csv.DictReader(f) if r.get("ticker")}

    existing_fees: list[dict] = []
    if FEE_REGISTRY_PATH.exists():
        with FEE_REGISTRY_PATH.open("r", encoding="utf-8") as f:
            existing_fees = json.load(f)

    fee_map = {item["ticker"].strip().upper(): item for item in existing_fees if item.get("ticker")}

    # Determine tickers needing fee sync
    if target_tickers:
        missing_tickers = [t.strip().upper() for t in target_tickers if t.strip().upper() in master_rows]
    else:
        missing_tickers = [
            tk for tk, r in master_rows.items()
            if tk not in fee_map or fee_map[tk].get("total_fee_pct") is None
        ]

    if not missing_tickers:
        print("[OK] All ETFs in master have total fee registered in etf_fee_registry.json.")
        return 0

    print(f"[INFO] Found {len(missing_tickers)} ETFs needing fee synchronization: {missing_tickers}")
    today_str = datetime.now(ZoneInfo("Asia/Seoul")).date().isoformat()
    updated_count = 0

    for tk in missing_tickers:
        master_row = master_rows[tk]
        name = master_row.get("name", "")
        isin = master_row.get("isin_cd", "")
        issuer = resolve_issuer(name)

        fee = fetch_naver_fund_fee(tk)
        if fee is not None:
            record = fee_map.get(tk)
            if record:
                record["total_fee_pct"] = fee
                record["verified_at"] = today_str
                record["verification_status"] = "official_single_source"
                record["primary_source_type"] = "naver_fnguide_official"
                record["primary_source_url"] = f"https://m.stock.naver.com/item/main/{tk}"
                record["source_note"] = (
                    f"에프앤가이드(FnGuide) 정제 한국거래소 신규상장 약관 총보수 {fee}% 연동"
                )
            else:
                record = {
                    "ticker": tk,
                    "isin": isin,
                    "name": name,
                    "issuer": issuer,
                    "fund_standard_code": "",
                    "legal_fund_name": "",
                    "total_fee_pct": fee,
                    "ter_pct": None,
                    "other_cost_pct": None,
                    "trading_cost_pct": None,
                    "effective_date": None,
                    "verified_at": today_str,
                    "verification_status": "official_single_source",
                    "primary_source_type": "naver_fnguide_official",
                    "primary_source_url": f"https://m.stock.naver.com/item/main/{tk}",
                    "dart_receipt_no": None,
                    "secondary_source_url": None,
                    "source_note": (
                        f"에프앤가이드(FnGuide) 정제 한국거래소 신규상장 약관 총보수 {fee}% 연동"
                    ),
                }
                fee_map[tk] = record

            print(f"  -> [{tk}] {name}: total_fee_pct = {fee}% successfully registered.")
            updated_count += 1
        else:
            print(f"  -> [{tk}] {name}: Fee not available yet via official API.")
        time.sleep(0.3)

    if updated_count > 0:
        # Sort and atomic write
        sorted_fees = sorted(fee_map.values(), key=lambda x: x.get("ticker", ""))
        tmp_path = FEE_REGISTRY_PATH.with_suffix(".tmp")
        with tmp_path.open("w", encoding="utf-8", newline="\n") as f:
            json.dump(sorted_fees, f, ensure_ascii=False, indent=2)
            f.write("\n")
        os.replace(tmp_path, FEE_REGISTRY_PATH)
        print(f"[SUCCESS] Updated {updated_count} fees. Total records in registry: {len(sorted_fees)}")
    else:
        print("[INFO] No fees updated.")

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--tickers",
        nargs="*",
        help="Specific tickers to sync (e.g. 0234N0 0229F0)",
    )
    args = parser.parse_args()
    return sync_new_listing_fees(args.tickers)


if __name__ == "__main__":
    sys.exit(main())
