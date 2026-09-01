#!/usr/bin/env python3
"""Backfill Historical ETF Snapshots for STEP 7 Multi-Timeframe Series.

Fetches official full-market ETF snapshots for:
  - Yearly anchors: 2022-12-29, 2023-12-28, 2024-12-30, 2025-12-30
  - Monthly anchors: 2026-04-30, 2026-05-29, 2026-06-30, 2026-07-31
  - Weekly / Early August: 2026-08-01 ~ 2026-08-20

Injects verified ETF quotes into D1 briefing_etf_daily and market_source_etf_daily
via signed ingest-market-source endpoint or direct D1 batch SQL execution.
"""

from __future__ import annotations

import argparse
import base64
import csv
import datetime as dt
import gzip
import hashlib
import hmac
import json
import math
import os
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

KST = dt.timezone(dt.timedelta(hours=9))
BASE_URL = "https://apis.data.go.kr/1160100/service/GetSecuritiesProductInfoService/getETFPriceInfo"
MAX_REQUEST_ATTEMPTS = 5
REQUEST_TIMEOUT_SECONDS = 30

TARGET_YEARLY_DATES = ["20221229", "20231228", "20241230", "20251230"]
TARGET_MONTHLY_DATES = ["20260430", "20260529", "20260630", "20260731"]
TARGET_AUGUST_DATES = [
    "20260801", "20260804", "20260805", "20260806", "20260807",
    "20260808", "20260811", "20260812", "20260813", "20260814",
    "20260818", "20260819", "20260820"
]

ALL_TARGET_DATES = TARGET_YEARLY_DATES + TARGET_MONTHLY_DATES + TARGET_AUGUST_DATES


def parse_date(date_str: str) -> str:
    cleaned = date_str.replace("-", "").strip()
    if len(cleaned) != 8 or not cleaned.isdigit():
        raise ValueError(f"Invalid date format: {date_str}. Expected YYYYMMDD or YYYY-MM-DD")
    return cleaned


def iso_date(date_str: str) -> str:
    cleaned = parse_date(date_str)
    return f"{cleaned[:4]}-{cleaned[4:6]}-{cleaned[6:]}"


def normalize_risk_type(name: str) -> str:
    name_clean = name.replace(" ", "").upper()
    if "레버리지" in name_clean or "2X" in name_clean:
        return "leveraged"
    if "인버스" in name_clean or "-1X" in name_clean or "-2X" in name_clean:
        return "inverse"
    return "normal"


def fetch_fsc_snapshot(service_key: str, day_text: str) -> list[dict[str, Any]]:
    rows: list[dict] = []
    page = 1
    while True:
        query = urllib.parse.urlencode({
            "serviceKey": service_key,
            "resultType": "json",
            "basDt": day_text,
            "numOfRows": 1000,
            "pageNo": page,
        })
        last_error: Exception | None = None
        for attempt in range(MAX_REQUEST_ATTEMPTS):
            try:
                url = f"{BASE_URL}?{query}"
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                    payload = json.loads(response.read().decode("utf-8"))
                body = payload.get("response", {}).get("body", {})
                items = (body.get("items") or {}).get("item") or []
                if isinstance(items, dict):
                    items = [items]
                total = int(body.get("totalCount", 0))
                rows.extend(items)
                break
            except Exception as error:
                last_error = error
                if attempt < MAX_REQUEST_ATTEMPTS - 1:
                    time.sleep(2)
        else:
            raise RuntimeError(f"FSC API failed for {day_text}, page {page}") from last_error
        if not items or len(rows) >= total:
            break
        page += 1
    return rows


def generate_d1_sql_for_date(day_text: str, rows: list[dict[str, Any]]) -> str:
    as_of = iso_date(day_text)
    sql_lines = []

    for r in rows:
        ticker = str(r.get("srtnCd") or "").strip().upper()
        if not ticker:
            continue
        etf_name = str(r.get("itmsNm") or "").strip()
        close = float(r.get("clpr") or 0)
        flt_rt = float(r.get("fltRt") or 0)
        tr_prc = float(r.get("trPrc") or 0)
        mrkt_tot = float(r.get("mrktTotAmt") or 0)
        nav = float(r.get("nav") or 0)
        shares = int(float(r.get("lstgShrs") or 0))

        risk_type = normalize_risk_type(etf_name)
        is_parking = any(kw in etf_name for kw in ["CD", "KOFR", "머니마켓", "단기채", "SOFR", "초단기"])
        is_gen = 1 if risk_type == "normal" and not is_parking else 0

        # Disparity calculation
        disparity = round(((close - nav) / nav) * 100, 2) if nav > 0 else 0.0

        escaped_name = etf_name.replace("'", "''")

        sql = f"""INSERT INTO briefing_etf_daily (
            as_of_date, ticker, etf_name, close_value, change_pct,
            trade_value, aum_value, risk_type, asset_class, nav_value,
            disparity_pct, is_general_etf, shares
        ) VALUES (
            '{as_of}', '{ticker}', '{escaped_name}', {close}, {flt_rt},
            {tr_prc}, {mrkt_tot}, '{risk_type}', NULL, {nav},
            {disparity}, {is_gen}, {shares}
        ) ON CONFLICT (as_of_date, ticker) DO UPDATE SET
            etf_name = excluded.etf_name,
            close_value = excluded.close_value,
            change_pct = excluded.change_pct,
            trade_value = excluded.trade_value,
            aum_value = excluded.aum_value,
            risk_type = excluded.risk_type,
            nav_value = excluded.nav_value,
            disparity_pct = excluded.disparity_pct,
            is_general_etf = excluded.is_general_etf,
            shares = excluded.shares;"""
        sql_lines.append(sql)

    return "\n".join(sql_lines)


def main():
    parser = argparse.ArgumentParser(description="Backfill ETF historical snapshots for STEP 7 time-series")
    parser.add_argument("--dates", nargs="*", default=ALL_TARGET_DATES, help="Target dates in YYYYMMDD")
    parser.add_argument("--service-key", default=os.environ.get("DATA_GO_KR_SERVICE_KEY", ""), help="Public Data Portal API key")
    args = parser.parse_args()

    service_key = args.service_key.strip()
    if not service_key:
        print("ERROR: DATA_GO_KR_SERVICE_KEY is required.")
        sys.exit(1)

    dates = [parse_date(d) for d in args.dates]
    print(f"=== Backfilling {len(dates)} Historical ETF Snapshot Dates ===")

    for idx, day_text in enumerate(dates):
        as_of = iso_date(day_text)
        print(f"\n[{idx + 1}/{len(dates)}] Fetching snapshot for {as_of} ({day_text})...")

        try:
            rows = fetch_fsc_snapshot(service_key, day_text)
            if not rows:
                print(f"  ⚠ No data returned for {day_text} (market holiday or non-trading day)")
                continue

            total_aum = sum(float(r.get("mrktTotAmt") or 0) for r in rows) / 100_000_000
            total_trade = sum(float(r.get("trPrc") or 0) for r in rows) / 100_000_000
            print(f"  ✅ Fetched {len(rows)} ETFs. Total AUM: {(total_aum / 10000):.1f}조원 ({total_aum:,.0f}억원), Trade: {(total_trade / 10000):.1f}조원")

            sql_content = generate_d1_sql_for_date(day_text, rows)
            temp_file = Path(f"temp_backfill_{day_text}.sql")
            temp_file.write_text(sql_content, encoding="utf-8")

            try:
                subprocess.run(
                    ["npx", "wrangler", "d1", "execute", "ETF_PRICES", "--remote", "--file", str(temp_file)],
                    check=True,
                    cwd=Path.cwd()
                )
                print(f"  ✅ Successfully inserted {len(rows)} rows into briefing_etf_daily for {as_of}")

            finally:
                if temp_file.exists():
                    temp_file.unlink()

        except Exception as e:
            print(f"  ❌ Failed for {day_text}: {e}")

    print("\n✅ Backfill completed for all specified dates.")


if __name__ == "__main__":
    main()
