#!/usr/bin/env python3
"""
scripts/backfill_macro_indices_naver.py

Backfills historical macro indices (WTI, Gold, Silver, USD/KRW, US10Y, KR10Y)
using Naver Finance official daily closing prices across all daily briefing payloads
from 2026-08-28 to 2026-09-21.
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path
from typing import Any
import requests

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

REPO_ROOT = Path(__file__).resolve().parent.parent

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
}

US_MARKET_HOLIDAYS_2026 = {
    "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25",
    "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
}


def compact_number(val: Any) -> float:
    try:
        return float(str(val).replace(",", "").strip())
    except (ValueError, TypeError):
        return 0.0


def fetch_naver_history(category: str, reuters_code: str) -> dict[str, dict[str, Any]]:
    url = f"https://m.stock.naver.com/front-api/marketIndex/prices?category={category}&reutersCode={reuters_code}&page=1&pageSize=30"
    resp = requests.get(url, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    items = data.get("result", [])
    history: dict[str, dict[str, Any]] = {}
    for item in items:
        dt = str(item.get("localTradedAt", ""))[:10]
        cp = compact_number(item.get("closePrice"))
        ratio = compact_number(item.get("fluctuationsRatio"))
        fluc = compact_number(item.get("fluctuations"))
        history[dt] = {
            "close": cp,
            "change_pct": ratio,
            "change_points": fluc,
            "date": dt,
        }
    return history


def fetch_naver_direct_bond(code: str) -> dict[str, Any] | None:
    url = f"https://api.stock.naver.com/marketindex/bond/{code}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            return {
                "close": compact_number(data.get("closePrice")),
                "change_points": compact_number(data.get("fluctuations")),
                "date": str(data.get("localTradedAt", ""))[:10],
            }
    except Exception as e:
        logging.warning(f"Direct bond API failed for {code}: {e}")
    return None


def get_best_match_on_or_before(history: dict[str, dict[str, Any]], target_date: str) -> dict[str, Any] | None:
    sorted_dates = sorted([d for d in history.keys() if d <= target_date], reverse=True)
    if sorted_dates:
        return history[sorted_dates[0]]
    return None


def main():
    logging.info("Fetching Naver official historical datasets (30 days)...")
    wti_hist = fetch_naver_history("energy", "CLcv1")
    gold_hist = fetch_naver_history("metals", "GCcv1")
    silver_hist = fetch_naver_history("metals", "SIcv1")
    fx_hist = fetch_naver_history("exchange", "FX_USDKRW")
    us10y_hist = fetch_naver_history("bond", "US10YT=RR")
    kr10y_hist = fetch_naver_history("bond", "KR10YT=RR")

    # Direct bond for 9/21 override if exact match
    us10y_direct = fetch_naver_direct_bond("US10YT=RR")
    kr10y_direct = fetch_naver_direct_bond("KR10YT=RR")

    data_dir = REPO_ROOT / "data"
    payload_files = sorted(data_dir.glob("briefing_payload_*.json"))

    comparison_records = []

    for pf in payload_files:
        if pf.name == "briefing_payload_latest.json":
            continue

        with pf.open("r", encoding="utf-8") as f:
            content = json.load(f)

        briefing = content.get("briefing", content)
        as_of_date = briefing.get("asOfDate")
        if not as_of_date:
            continue

        indices = briefing.get("marketIndices", [])
        modified = False

        for idx in indices:
            code = idx.get("code")
            old_close = idx.get("close")
            old_change = idx.get("change_pct")

            new_val = None
            is_us_market = code in ("CLF", "GC", "SI", "DGS10")
            is_closed = (as_of_date in US_MARKET_HOLIDAYS_2026) if is_us_market else False

            if code == "CLF":
                m = get_best_match_on_or_before(wti_hist, as_of_date)
                if m:
                    new_val = (m["close"], m["change_pct"], m["change_points"], m["date"])
            elif code == "GC":
                m = get_best_match_on_or_before(gold_hist, as_of_date)
                if m:
                    new_val = (m["close"], m["change_pct"], m["change_points"], m["date"])
            elif code == "SI":
                m = get_best_match_on_or_before(silver_hist, as_of_date)
                if m:
                    new_val = (m["close"], m["change_pct"], m["change_points"], m["date"])
            elif code == "USDKRW":
                m = get_best_match_on_or_before(fx_hist, as_of_date)
                if m:
                    new_val = (m["close"], m["change_pct"], m["change_points"], m["date"])
            elif code == "KR10Y":
                if as_of_date == "2026-09-21" and kr10y_direct and kr10y_direct["date"] == "2026-09-21":
                    new_val = (kr10y_direct["close"], kr10y_direct["change_points"], kr10y_direct["change_points"], "2026-09-21")
                else:
                    m = get_best_match_on_or_before(kr10y_hist, as_of_date)
                    if m:
                        new_val = (m["close"], m["change_points"], m["change_points"], m["date"])
            elif code == "DGS10":
                if as_of_date == "2026-09-21" and us10y_direct and us10y_direct["date"] == "2026-09-21":
                    new_val = (us10y_direct["close"], us10y_direct["change_points"], us10y_direct["change_points"], "2026-09-21")
                else:
                    m = get_best_match_on_or_before(us10y_hist, as_of_date)
                    if m:
                        new_val = (m["close"], m["change_points"], m["change_points"], m["date"])

            if new_val:
                new_close, new_change, new_pts, actual_date = new_val
                if actual_date < as_of_date:
                    is_closed = True

                idx["close"] = new_close
                idx["change_pct"] = new_change
                idx["change_points"] = new_pts
                idx["as_of_date"] = actual_date
                idx["is_closed"] = is_closed
                modified = True

                comparison_records.append({
                    "date": as_of_date,
                    "code": code,
                    "label": idx.get("label", code),
                    "old_close": old_close,
                    "old_change": old_change,
                    "new_close": new_close,
                    "new_change": new_change,
                })

        if modified:
            with pf.open("w", encoding="utf-8") as f:
                json.dump(content, f, ensure_ascii=False, indent=2)
            logging.info(f"Updated {pf.name} with Naver official closing prices.")

    # Also synchronize briefing_payload_latest.json
    latest_file = data_dir / "briefing_payload_latest.json"
    if latest_file.exists():
        with latest_file.open("r", encoding="utf-8") as f:
            latest_content = json.load(f)
        latest_briefing = latest_content.get("briefing", latest_content)
        latest_date = latest_briefing.get("asOfDate")
        # Match from corresponding date payload
        matching_file = data_dir / f"briefing_payload_{latest_date}.json"
        if matching_file.exists():
            with matching_file.open("r", encoding="utf-8") as f:
                match_content = json.load(f)
            match_briefing = match_content.get("briefing", match_content)
            latest_briefing["marketIndices"] = match_briefing["marketIndices"]
            with latest_file.open("w", encoding="utf-8") as f:
                json.dump(latest_content, f, ensure_ascii=False, indent=2)
            logging.info(f"Synchronized briefing_payload_latest.json with {matching_file.name}")

    # Output Markdown comparison table
    print("\n" + "=" * 110)
    print("📋 [Backfill Comparison Report: Yahoo Finance vs Naver Official Closing Prices (SSOT)]")
    print("=" * 110)
    print(f"| {'Date':<10} | {'Indicator':<12} | {'Yahoo Before (Close / Chg)':<30} | {'Naver After SSOT (Close / Chg)':<32} | {'Change / Diff':<16} |")
    print(f"|{'-'*12}|{'-'*14}|{'-'*32}|{'-'*34}|{'-'*18}|")

    for rec in comparison_records:
        old_s = f"{rec['old_close']} ({rec['old_change']:+.2f}%)" if rec['old_close'] is not None else "N/A"
        new_s = f"{rec['new_close']} ({rec['new_change']:+.2f}%)"
        diff_close = round(rec['new_close'] - (rec['old_close'] or 0), 2)
        diff_s = f"Δ {diff_close:+g}"
        print(f"| {rec['date']:<10} | {rec['label']:<12} | {old_s:<30} | {new_s:<32} | {diff_s:<16} |")
    print("=" * 110 + "\n")


if __name__ == "__main__":
    main()
