#!/usr/bin/env python3
"""Build complete ETF distribution summaries for all 1,160+ ETFs.

Calculates key derived metrics:
  - paymentCycle: '월 분배', '분기 분배', '반기 분배', '연 분배', '수시 분배', '신규 상장', '미지급'
  - ttmAmountKrw: Trailing 12-month cumulative cash distributions per share
  - ttmDividendYieldPct: TTM Yield = (ttmAmountKrw / etf_close) * 100
  - isTr: Total Return flag (auto-reinvesting dividends)
  - records: Full historical records list sorted descending
"""

from __future__ import annotations

import csv
import json
import logging
import os
import re
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "distributions"
EVENTS_CSV = DATA_DIR / "etf_distribution_events.csv"
CANDIDATES_CSV = DATA_DIR / "etf_distribution_event_candidates.csv"
MANUAL_CSV = DATA_DIR / "manual_verified_distribution_events.csv"
MASTER_CSV = ROOT / "data" / "etf_master_draft.csv"
OUTPUT_JSON = DATA_DIR / "etf_distribution_summaries.json"

MAX_RECORDS_PER_TICKER = 36


def get_base_date() -> date:
    """Return the latest market base date from master draft, fallback to today."""
    if MASTER_CSV.exists():
        with MASTER_CSV.open(encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            dates = [parse_date(row.get("bas_dt")) for row in reader]
            valid_dates = [d for d in dates if d is not None]
            if valid_dates:
                return max(valid_dates)
    return date.today()


def parse_amount(raw: object) -> Optional[int]:
    if raw is None:
        return None
    val_str = str(raw).replace(",", "").strip()
    if not val_str:
        return None
    try:
        num = float(val_str)
        if num <= 0:
            return None
        return int(round(num))
    except ValueError:
        return None


def parse_float(raw: object) -> Optional[float]:
    if raw is None:
        return None
    val_str = str(raw).replace(",", "").strip()
    if not val_str:
        return None
    try:
        num = float(val_str)
        return round(num, 4)
    except ValueError:
        return None


def parse_date(raw: object) -> Optional[date]:
    if not raw:
        return None
    clean = str(raw).replace("-", "").replace(".", "").replace("/", "").strip()
    if len(clean) == 8 and clean.isdigit():
        try:
            return datetime.strptime(clean, "%Y%m%d").date()
        except ValueError:
            return None
    return None


def format_date(d: Optional[date]) -> Optional[str]:
    return d.strftime("%Y-%m-%d") if d else None


def is_tr_etf(name: str) -> bool:
    name_upper = name.upper()
    if "(TR)" in name_upper or " TR" in name_upper or "TR " in name_upper or name_upper.endswith("TR"):
        return True
    return False


def load_master_etfs() -> List[Dict[str, object]]:
    etfs = []
    if not MASTER_CSV.exists():
        logging.error(f"Master file not found: {MASTER_CSV}")
        return etfs

    with MASTER_CSV.open(encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            ticker = str(row.get("ticker", "")).strip().zfill(6)
            name = str(row.get("name", "")).strip()
            if not ticker or not name:
                continue

            close_val = parse_amount(row.get("close")) or 0
            listing_dt = parse_date(row.get("listing_date") or row.get("first_traded_date"))

            etfs.append({
                "ticker": ticker,
                "name": name,
                "close": close_val,
                "listing_date": listing_dt,
                "is_tr": is_tr_etf(name),
            })
    return etfs


def load_all_events() -> Dict[str, List[Dict[str, object]]]:
    grouped: Dict[str, Dict[str, Dict[str, object]]] = defaultdict(dict)

    # 1. Primary: SEIBro events
    if EVENTS_CSV.exists():
        with EVENTS_CSV.open(encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                ticker = str(row.get("ticker", "")).strip().zfill(6)
                amount = parse_amount(row.get("distribution_per_share_krw"))
                rec_dt = parse_date(row.get("record_date") or row.get("ex_date"))
                ex_dt = parse_date(row.get("ex_date") or row.get("record_date"))
                pay_dt = parse_date(row.get("pay_date"))
                yield_pct = parse_float(row.get("dividend_yield_pct"))

                if not ticker or amount is None or not (rec_dt or ex_dt):
                    continue

                event_key = format_date(rec_dt or ex_dt) or ""
                grouped[ticker][event_key] = {
                    "eventId": str(row.get("event_id") or f"seibro:{ticker}:{event_key}"),
                    "sourceId": str(row.get("source_id") or "seibro:etf_div_stat"),
                    "sourceOwner": str(row.get("source_owner") or "한국예탁결제원(SEIBro)"),
                    "amountKrw": amount,
                    "exDate": format_date(ex_dt),
                    "recordDate": format_date(rec_dt),
                    "payDate": format_date(pay_dt),
                    "distributionType": str(row.get("distribution_type") or "ordinary_cash"),
                    "dividendYieldPct": yield_pct,
                    "displayStatus": "official_seibro_krx",
                    "displayLabel": "예탁원(SEIBro) 공시 기반",
                    "updatedAt": str(row.get("updated_at") or "2026-09-01T00:00:00Z"),
                }

    # 2. Merge candidate/manual notices if missing
    for file_path in [CANDIDATES_CSV, MANUAL_CSV]:
        if file_path.exists():
            with file_path.open(encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    ticker = str(row.get("ticker", "")).strip().zfill(6)
                    amount = parse_amount(row.get("distribution_per_share_krw"))
                    rec_dt = parse_date(row.get("record_date") or row.get("issuer_ex_date") or row.get("ex_date"))
                    ex_dt = parse_date(row.get("issuer_ex_date") or row.get("ex_date") or row.get("record_date"))
                    pay_dt = parse_date(row.get("pay_date"))

                    if not ticker or amount is None or not (rec_dt or ex_dt):
                        continue

                    event_key = format_date(rec_dt or ex_dt) or ""
                    if event_key not in grouped[ticker]:
                        grouped[ticker][event_key] = {
                            "eventId": str(row.get("candidate_id") or row.get("event_id") or f"notice:{ticker}:{event_key}"),
                            "sourceId": str(row.get("source_id") or "issuer:notice"),
                            "sourceOwner": str(row.get("source_owner") or "운용사 공식 자료"),
                            "amountKrw": amount,
                            "exDate": format_date(ex_dt),
                            "recordDate": format_date(rec_dt),
                            "payDate": format_date(pay_dt),
                            "distributionType": str(row.get("distribution_type") or "ordinary_cash"),
                            "dividendYieldPct": None,
                            "displayStatus": "issuer_notice",
                            "displayLabel": "운용사 공식 공지 기반",
                            "updatedAt": str(row.get("updated_at") or "2026-09-01T00:00:00Z"),
                        }

    # Flatten dictionaries to sorted lists
    result: Dict[str, List[Dict[str, object]]] = {}
    for ticker, event_map in grouped.items():
        events_list = list(event_map.values())
        events_list.sort(
            key=lambda x: str(x.get("recordDate") or x.get("exDate") or ""),
            reverse=True,
        )
        result[ticker] = events_list
    return result


def determine_payment_cycle(
    is_tr: bool,
    listing_date: Optional[date],
    records: List[Dict[str, object]],
    ttm_records: List[Dict[str, object]],
    base_date: date,
) -> str:
    if is_tr:
        return "TR (재투자)"

    # New listing (< 180 days from base date)
    if listing_date and (base_date - listing_date).days < 180 and len(ttm_records) <= 1:
        return "신규 상장"

    if len(records) == 0:
        return "미지급"

    ttm_count = len(ttm_records)
    if ttm_count >= 9:
        return "월 분배"
    elif 3 <= ttm_count <= 5:
        return "분기 분배"
    elif ttm_count == 2:
        return "반기 분배"
    elif ttm_count == 1:
        return "연 분배"
    elif ttm_count > 0:
        return "수시 분배"
    else:
        # If no payments in last 12M but had past payments
        return "미지급"


def main() -> None:
    base_date = get_base_date()
    one_year_ago = base_date - timedelta(days=365)
    logging.info(f"Using base date {base_date} (TTM window: {one_year_ago} ~ {base_date})")

    etf_master = load_master_etfs()
    logging.info(f"Loaded {len(etf_master)} ETFs from master draft.")

    events_by_ticker = load_all_events()
    logging.info(f"Loaded distribution events for {len(events_by_ticker)} tickers.")

    summaries = []
    generated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    for etf in etf_master:
        ticker = str(etf["ticker"])
        name = str(etf["name"])
        close_price = int(etf["close"])
        listing_date = etf["listing_date"]
        is_tr = bool(etf["is_tr"])

        records = events_by_ticker.get(ticker, [])
        visible_records = records[:MAX_RECORDS_PER_TICKER]

        # Calculate TTM (trailing 12-month) distributions
        ttm_records = []
        ttm_amount = 0
        for rec in records:
            rec_dt = parse_date(rec.get("recordDate") or rec.get("exDate"))
            if rec_dt and rec_dt >= one_year_ago:
                ttm_records.append(rec)
                amt = int(rec.get("amountKrw") or 0)
                ttm_amount += amt

        # TTM dividend yield
        if close_price > 0 and ttm_amount > 0:
            ttm_yield = round((ttm_amount / close_price) * 100, 2)
        else:
            ttm_yield = None

        payment_cycle = determine_payment_cycle(is_tr, listing_date, records, ttm_records, base_date)

        has_seibro = any(r.get("displayStatus") == "official_seibro_krx" for r in visible_records)
        has_issuer = any(r.get("displayStatus") == "issuer_notice" for r in visible_records)

        if has_seibro and has_issuer:
            source_status = "mixed_official_sources"
            source_label = "예탁원 및 공시 기반"
        elif has_seibro:
            source_status = "official_seibro_krx"
            source_label = "예탁원(SEIBro) 공시 기반"
        elif has_issuer:
            source_status = "issuer_notice"
            source_label = "운용사 공식 공지 기반"
        else:
            source_status = "official_seibro_krx"
            source_label = "예탁원(SEIBro) 공시 기반"

        latest_event = visible_records[0] if visible_records else None
        updated_at = max(
            (str(r.get("updatedAt") or "") for r in visible_records),
            default="2026-09-01T00:00:00Z",
        )

        summaries.append({
            "ticker": ticker,
            "sourceStatus": source_status,
            "sourceLabel": source_label,
            "latest": latest_event,
            "records": visible_records,
            "eventCount": len(records),
            "paymentCycle": payment_cycle,
            "ttmAmountKrw": ttm_amount if ttm_amount > 0 else None,
            "ttmDividendYieldPct": ttm_yield,
            "isTr": is_tr,
            "updatedAt": updated_at,
        })

    payload = {
        "schemaVersion": 2,
        "generatedAt": generated_at,
        "source": "SEIBro / KRX official distribution ledger",
        "summaryCount": len(summaries),
        "summaries": summaries,
    }

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    temp_file = OUTPUT_JSON.with_suffix(".tmp")
    temp_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temp_file, OUTPUT_JSON)

    logging.info(f"Successfully generated {len(summaries)} ETF distribution summaries to {OUTPUT_JSON}")
    print(json.dumps({
        "output": str(OUTPUT_JSON.relative_to(ROOT)),
        "summary_count": len(summaries),
        "with_records_count": sum(1 for s in summaries if s["eventCount"] > 0),
        "monthly_count": sum(1 for s in summaries if s["paymentCycle"] == "월 분배"),
        "quarterly_count": sum(1 for s in summaries if s["paymentCycle"] == "분기 분배"),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
