#!/usr/bin/env python3
"""Collect official ETF distribution history from SEIBro (한국예탁결제원).

SEIBro provides comprehensive historical distribution data (Record Date, Pay Date,
Distribution Per Share, Yield, etc.) for all Korean-listed ETFs.
This script supports both full historical backfill and daily incremental updates.
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import os
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
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
MASTER_CSV = ROOT / "data" / "etf_master_draft.csv"
HOLIDAYS_TXT = ROOT / "data" / "market_holidays.txt"
REPORT_PATH = DATA_DIR / "reports" / "seibro_collection_latest.json"

SEIBRO_URL = "https://seibro.or.kr/websquare/engine/proworks/callServletService.jsp"
SEIBRO_REFERER = "https://seibro.or.kr/websquare/control.jsp?w2xPath=/IPORTAL/user/etf/BIP_CNTS06030V.xml&menuNo=179"
PAGE_SIZE = 30
KST = timezone(timedelta(hours=9))


def load_holidays() -> Set[date]:
    holidays: Set[date] = set()
    if HOLIDAYS_TXT.exists():
        with HOLIDAYS_TXT.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    try:
                        holidays.add(datetime.strptime(line, "%Y-%m-%d").date())
                    except ValueError:
                        pass
    return holidays


def is_trading_day(day: date, holidays: Set[date]) -> bool:
    if day.weekday() >= 5:  # Saturday or Sunday
        return False
    if day in holidays:
        return False
    return True


def get_previous_trading_day(day: date, holidays: Set[date]) -> date:
    cur = day - timedelta(days=1)
    while not is_trading_day(cur, holidays):
        cur -= timedelta(days=1)
    return cur


def load_isin_to_ticker_map() -> Tuple[Dict[str, str], Dict[str, str]]:
    """Return (isin -> ticker, ticker -> name) mappings from master draft."""
    isin_map: Dict[str, str] = {}
    name_map: Dict[str, str] = {}
    if not MASTER_CSV.exists():
        logging.error(f"Master file not found: {MASTER_CSV}")
        return isin_map, name_map

    with MASTER_CSV.open(encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            ticker = str(row.get("ticker", "")).strip().zfill(6)
            isin = str(row.get("isin_cd", "")).strip()
            name = str(row.get("name", "")).strip()
            if ticker and isin:
                isin_map[isin] = ticker
            if ticker and name:
                name_map[ticker] = name
    return isin_map, name_map


def fetch_seibro_page_count(from_date: str, to_date: str) -> int:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/xml; charset=UTF-8",
        "Referer": SEIBRO_REFERER,
    }

    xml_body = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<reqParam action="exerInfoDtramtPayStatPlistCnt" task="ksd.safe.bip.cnts.etf.process.EtfExerInfoPTask">'
        f'<fromRGT_STD_DT value="{from_date}"/>'
        f'<toRGT_STD_DT value="{to_date}"/>'
        '<isin value=""/>'
        '<etf_sort_cd value=""/>'
        '<etf_big_sort_cd value=""/>'
        '<mngco_custno value=""/>'
        '<RGT_RSN_DTAIL_SORT_CD value=""/>'
        '</reqParam>'
    )

    req = urllib.request.Request(SEIBRO_URL, data=xml_body.encode("utf-8"), headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=30) as res:
        content = res.read().decode("utf-8", errors="ignore")
        root = ET.fromstring(content)
        cnt_el = root.find(".//LIST_CNT")
        if cnt_el is not None and cnt_el.attrib.get("value"):
            return int(cnt_el.attrib["value"])
    return 0


def fetch_seibro_page(from_date: str, to_date: str, page_num: int) -> List[Dict[str, str]]:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/xml; charset=UTF-8",
        "Referer": SEIBRO_REFERER,
    }

    start_page = (page_num - 1) * PAGE_SIZE + 1
    end_page = page_num * PAGE_SIZE

    xml_body = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<reqParam action="exerInfoDtramtPayStatPlist" task="ksd.safe.bip.cnts.etf.process.EtfExerInfoPTask">'
        f'<START_PAGE value="{start_page}"/>'
        f'<END_PAGE value="{end_page}"/>'
        f'<fromRGT_STD_DT value="{from_date}"/>'
        f'<toRGT_STD_DT value="{to_date}"/>'
        '<isin value=""/>'
        '<etf_sort_cd value=""/>'
        '<etf_big_sort_cd value=""/>'
        '<mngco_custno value=""/>'
        '<RGT_RSN_DTAIL_SORT_CD value=""/>'
        '</reqParam>'
    )

    for attempt in range(3):
        try:
            req = urllib.request.Request(SEIBRO_URL, data=xml_body.encode("utf-8"), headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=30) as res:
                content = res.read().decode("utf-8", errors="ignore")
                root = ET.fromstring(content)
                items = []
                for res_el in root.findall(".//result"):
                    row = {c.tag: c.attrib.get("value", "").strip() for c in res_el}
                    items.append(row)
                return items
        except Exception as e:
            if attempt == 2:
                logging.warning(f"Failed page {page_num} on attempt {attempt + 1}: {e}")
                return []
            time.sleep(1.0 * (attempt + 1))
    return []


def parse_date_str(raw: str) -> Optional[str]:
    clean = (raw or "").replace("-", "").replace(".", "").replace("/", "").strip()
    if len(clean) == 8 and clean.isdigit():
        return f"{clean[:4]}-{clean[4:6]}-{clean[6:8]}"
    return None


def collect_seibro_records(from_date: str, to_date: str) -> List[Dict[str, object]]:
    total_count = fetch_seibro_page_count(from_date, to_date)
    logging.info(f"SEIBro reported {total_count} records between {from_date} and {to_date}")
    if total_count == 0:
        return []

    isin_map, name_map = load_isin_to_ticker_map()
    holidays = load_holidays()

    total_pages = (total_count + PAGE_SIZE - 1) // PAGE_SIZE
    logging.info(f"Fetching {total_pages} pages ({PAGE_SIZE} items/page)...")

    collected: List[Dict[str, object]] = []
    seen_keys: Set[Tuple[str, str]] = set()

    for p in range(1, total_pages + 1):
        items = fetch_seibro_page(from_date, to_date, p)
        for item in items:
            isin = item.get("ISIN", "")
            ticker = isin_map.get(isin)
            if not ticker:
                if len(isin) >= 9 and isin.startswith("KR7"):
                    candidate_ticker = isin[3:9]
                    if candidate_ticker in name_map:
                        ticker = candidate_ticker
            if not ticker:
                continue

            record_dt_raw = item.get("RGT_STD_DT", "")
            record_date = parse_date_str(record_dt_raw)
            if not record_date:
                continue

            pay_dt_raw = item.get("TH1_PAY_TERM_BEGIN_DT", "")
            pay_date = parse_date_str(pay_dt_raw)

            amount_str = item.get("ESTM_STDPRC", "").replace(",", "")
            try:
                amount_num = float(amount_str) if amount_str else 0.0
            except ValueError:
                amount_num = 0.0

            if amount_num <= 0:
                continue

            yield_str = item.get("BUNBE", "").replace(",", "")
            try:
                yield_num = round(float(yield_str), 4) if yield_str else None
            except ValueError:
                yield_num = None

            try:
                r_date_obj = datetime.strptime(record_date, "%Y-%m-%d").date()
                ex_date_obj = get_previous_trading_day(r_date_obj, holidays)
                ex_date = ex_date_obj.strftime("%Y-%m-%d")
            except Exception:
                ex_date = record_date

            dedup_key = (ticker, record_date)
            if dedup_key in seen_keys:
                continue
            seen_keys.add(dedup_key)

            dist_type_raw = item.get("RGT_RSN_DTAIL_NM", "")
            dist_type = "capital_return" if "자본" in dist_type_raw or "감자" in dist_type_raw else "ordinary_cash"

            event_id = f"seibro:{ticker}:{record_date.replace('-', '')}"
            collected.append({
                "event_id": event_id,
                "ticker": ticker,
                "ex_date": ex_date,
                "distribution_per_share_krw": int(amount_num) if amount_num.is_integer() else amount_num,
                "verification_status": "verified",
                "record_date": record_date,
                "pay_date": pay_date or "",
                "dividend_yield_pct": yield_num,
                "distribution_type": dist_type,
                "source_owner": "한국예탁결제원(SEIBro)",
            })

        if p % 10 == 0 or p == total_pages:
            logging.info(f"Progress: {p}/{total_pages} pages processed ({len(collected)} valid ETF events)")
        time.sleep(0.05)

    return collected


def merge_and_save_events(new_events: List[Dict[str, object]]) -> int:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    existing_events: Dict[Tuple[str, str], Dict[str, object]] = {}

    fieldnames = [
        "event_id",
        "ticker",
        "ex_date",
        "distribution_per_share_krw",
        "verification_status",
        "record_date",
        "pay_date",
        "dividend_yield_pct",
        "distribution_type",
        "source_owner",
    ]

    if EVENTS_CSV.exists():
        with EVENTS_CSV.open(encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                ticker = str(row.get("ticker", "")).strip().zfill(6)
                ex_date = str(row.get("ex_date", "")).strip()
                record_date = str(row.get("record_date", "")).strip() or ex_date
                if ticker and (ex_date or record_date):
                    key = (ticker, record_date or ex_date)
                    existing_events[key] = dict(row)

    logging.info(f"Loaded {len(existing_events)} existing events from {EVENTS_CSV}")

    added_count = 0
    updated_count = 0
    for evt in new_events:
        ticker = str(evt["ticker"]).strip().zfill(6)
        record_date = str(evt.get("record_date") or evt.get("ex_date"))
        key = (ticker, record_date)
        if key in existing_events:
            existing_events[key].update(evt)
            updated_count += 1
        else:
            existing_events[key] = evt
            added_count += 1

    all_sorted = sorted(
        existing_events.values(),
        key=lambda x: (str(x.get("ticker", "")), str(x.get("record_date") or x.get("ex_date") or "")),
        reverse=True,
    )
    all_sorted.sort(key=lambda x: str(x.get("ticker", "")))

    temp_csv = EVENTS_CSV.with_suffix(".tmp")
    with temp_csv.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(all_sorted)

    os.replace(temp_csv, EVENTS_CSV)
    logging.info(f"Saved total {len(all_sorted)} events (+{added_count} added, {updated_count} updated) to {EVENTS_CSV}")
    return len(all_sorted)


def main() -> None:
    parser = argparse.ArgumentParser(description="Collect ETF distribution events from SEIBro.")
    parser.add_argument("--full", action="store_true", help="Fetch full history (from 2023-01-01).")
    parser.add_argument("--days", type=int, default=90, help="Number of lookback days for incremental sync (default: 90).")
    args = parser.parse_args()

    today = date.today()
    to_date_str = today.strftime("%Y%m%d")

    if args.full:
        from_date_str = "20230101"
    else:
        from_date = today - timedelta(days=args.days)
        from_date_str = from_date.strftime("%Y%m%d")

    started_at = datetime.now(KST).isoformat()
    t0 = time.time()
    events = collect_seibro_records(from_date_str, to_date_str)
    total_saved = merge_and_save_events(events)
    duration = round(time.time() - t0, 2)

    report = {
        "run_id": datetime.now(KST).strftime("seibro-dist-%Y%m%d-%H%M%S"),
        "started_at_kst": started_at,
        "finished_at_kst": datetime.now(KST).isoformat(),
        "from_date": from_date_str,
        "to_date": to_date_str,
        "is_full": bool(args.full),
        "fetched_events": len(events),
        "total_events_in_ledger": total_saved,
        "duration_seconds": duration,
        "status": "success",
    }

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    temp_report = REPORT_PATH.with_suffix(".tmp")
    temp_report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temp_report, REPORT_PATH)

    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
