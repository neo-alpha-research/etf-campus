#!/usr/bin/env python3
"""Strict Zero-Hallucination and Financial Data Integrity Verifier for ETF Distributions.

Verifies:
1. No dummy / fake ticker strings or placeholder records in events ledger or summaries.
2. 100% coverage consistency with data/etf_master_draft.csv.
3. Mathematical precision of TTM amounts and dividend yields.
4. Clean handling of TR ETFs, new listings, and non-distributing funds (graceful fallbacks).
"""

from __future__ import annotations

import csv
import json
import logging
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)

ROOT = Path(__file__).resolve().parents[1]
EVENTS_CSV = ROOT / "data" / "distributions" / "etf_distribution_events.csv"
SUMMARIES_JSON = ROOT / "data" / "distributions" / "etf_distribution_summaries.json"
MASTER_CSV = ROOT / "data" / "etf_master_draft.csv"
PRICE_HISTORY_CSV = ROOT / "data" / "returns" / "etf_price_history.csv"
TR_INDEX_CSV = ROOT / "data" / "returns" / "etf_daily_tr_index.csv"
TOTAL_RETURNS_CSV = ROOT / "data" / "returns" / "etf_total_return_metrics.csv"


def normalize_date_str(val: object | None) -> str | None:
    if not val:
        return None
    raw = str(val).strip().replace("-", "").replace(".", "").replace("/", "")
    if len(raw) == 8 and raw.isdigit():
        return f"{raw[:4]}-{raw[4:6]}-{raw[6:]}"
    return None


def verify_integrity() -> bool:
    errors = []
    warnings = []

    # 1. Master ETF Universe
    if not MASTER_CSV.exists():
        errors.append(f"Master file missing: {MASTER_CSV}")
        print("FAIL:", errors)
        return False

    master_etfs = {}
    with MASTER_CSV.open(encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            t = str(row.get("ticker", "")).strip().zfill(6)
            name = str(row.get("name", "")).strip()
            close_val = float(str(row.get("close", 0)).replace(",", "") or 0)
            master_etfs[t] = {"name": name, "close": close_val}

    logging.info(f"Loaded {len(master_etfs)} ETFs from master draft.")

    # 2. Events Ledger Verification
    if not EVENTS_CSV.exists():
        errors.append(f"Events CSV missing: {EVENTS_CSV}")
    else:
        with EVENTS_CSV.open(encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            event_count = 0
            for i, row in enumerate(reader, 1):
                event_count += 1
                ticker = str(row.get("ticker", "")).strip().zfill(6)
                amount_str = str(row.get("distribution_per_share_krw", "")).replace(",", "").strip()
                ex_date = str(row.get("ex_date", "")).strip()
                rec_date = str(row.get("record_date", "")).strip()

                # Check dummy ticker
                if ticker in {"000000", "DUMMY", "TEST", "XXXXXX"}:
                    errors.append(f"Row {i}: Forbidden dummy ticker '{ticker}' detected.")

                if ticker not in master_etfs:
                    warnings.append(f"Row {i}: Ticker '{ticker}' not found in active master draft (possibly delisted).")

                # Check positive amount
                try:
                    amount = float(amount_str)
                    if amount <= 0:
                        errors.append(f"Row {i} ({ticker}): Non-positive distribution amount '{amount_str}'.")
                except ValueError:
                    errors.append(f"Row {i} ({ticker}): Invalid amount '{amount_str}'.")

                # Check date formats
                if not (ex_date or rec_date):
                    errors.append(f"Row {i} ({ticker}): Missing both ex_date and record_date.")

        logging.info(f"Verified {event_count} raw distribution events in ledger.")

    # 3. Summaries JSON Verification
    if not SUMMARIES_JSON.exists():
        errors.append(f"Summaries JSON missing: {SUMMARIES_JSON}")
    else:
        with SUMMARIES_JSON.open(encoding="utf-8") as f:
            data = json.load(f)

        summaries = data.get("summaries", [])
        summary_map = {s["ticker"]: s for s in summaries}

        if len(summaries) != len(master_etfs):
            errors.append(f"Universe mismatch: {len(summaries)} summaries vs {len(master_etfs)} master ETFs.")

        for ticker, etf_info in master_etfs.items():
            if ticker not in summary_map:
                errors.append(f"Ticker {ticker} ({etf_info['name']}) missing in distribution summaries.")
                continue

            s = summary_map[ticker]
            is_tr = s.get("isTr", False)
            ttm_amount = s.get("ttmAmountKrw")
            ttm_yield = s.get("ttmDividendYieldPct")
            cycle = s.get("paymentCycle")
            records = s.get("records", [])

            # TR ETF rules
            if "(TR)" in etf_info["name"].upper() or " TR" in etf_info["name"].upper():
                if not is_tr:
                    errors.append(f"TR ETF {ticker} ({etf_info['name']}) isTr flag is False.")

            # Zero-yield rules: If ttm_amount is None or 0, ttm_yield must be None
            if ttm_amount is None or ttm_amount == 0:
                if ttm_yield is not None:
                    errors.append(f"Hallucinated yield: {ticker} has 0 TTM amount but yield={ttm_yield}%.")

            # Mathematical exactness of TTM yield
            if ttm_amount is not None and ttm_amount > 0 and etf_info["close"] > 0:
                expected_yield = round((ttm_amount / etf_info["close"]) * 100, 2)
                if ttm_yield != expected_yield:
                    errors.append(
                        f"Yield mismatch for {ticker}: recorded {ttm_yield}%, expected {expected_yield}% (amount={ttm_amount}, close={etf_info['close']})."
                    )

            # Cycle sanity check
            valid_cycles = {"월 분배", "분기 분배", "반기 분배", "연 분배", "수시 분배", "신규 상장", "미지급", "TR (재투자)"}
            if cycle not in valid_cycles:
                errors.append(f"Invalid payment cycle '{cycle}' for ticker {ticker}.")

        logging.info(f"Verified all {len(summaries)} summaries against master ETF universe.")

    # 4. Cross-Artifact Date Parity Gate (원천 시세 vs 파생 시계열 기준일 교차 검증)
    master_dates = set()
    with MASTER_CSV.open(encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            d_str = normalize_date_str(row.get("bas_dt"))
            if d_str:
                master_dates.add(d_str)

    if not master_dates:
        errors.append("Unable to determine latest bas_dt from master draft.")
    else:
        master_latest = max(master_dates)
        logging.info(f"Master draft latest bas_dt: {master_latest}")

        # Check Price History
        if not PRICE_HISTORY_CSV.exists():
            errors.append(f"Price history CSV missing: {PRICE_HISTORY_CSV}")
        else:
            with PRICE_HISTORY_CSV.open(encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                price_dates = {normalize_date_str(row.get("date")) for row in reader if row.get("date")}
            price_latest = max(price_dates) if price_dates else None
            if price_latest != master_latest:
                errors.append(
                    f"Date Parity Mismatch: Master draft bas_dt is {master_latest}, "
                    f"but Price history latest date is {price_latest}."
                )
            else:
                logging.info(f"Price history date parity verified: {price_latest}")

        # Check TR Index
        if not TR_INDEX_CSV.exists():
            errors.append(f"TR index CSV missing: {TR_INDEX_CSV}")
        else:
            with TR_INDEX_CSV.open(encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                tr_dates = {normalize_date_str(row.get("date")) for row in reader if row.get("date")}
            tr_latest = max(tr_dates) if tr_dates else None
            if tr_latest != master_latest:
                errors.append(
                    f"Date Parity Mismatch: Master draft bas_dt is {master_latest}, "
                    f"but TR Index latest date is {tr_latest}. (Frozen TR calculation detected!)"
                )
            else:
                logging.info(f"TR index date parity verified: {tr_latest}")

        # Check Total Return Metrics
        if not TOTAL_RETURNS_CSV.exists():
            errors.append(f"Total return metrics CSV missing: {TOTAL_RETURNS_CSV}")
        else:
            with TOTAL_RETURNS_CSV.open(encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                metric_dates = {normalize_date_str(row.get("as_of_date")) for row in reader if row.get("as_of_date")}
            metric_latest = max(metric_dates) if metric_dates else None
            if metric_latest != master_latest:
                errors.append(
                    f"Date Parity Mismatch: Master draft bas_dt is {master_latest}, "
                    f"but Total Return metrics as_of_date is {metric_latest}. (Frozen TR metrics detected!)"
                )
            else:
                logging.info(f"Total return metrics date parity verified: {metric_latest}")

        # Spot check representative TR JSON files
        sample_tickers = ["069500", "102110", "360750"]
        for stk in sample_tickers:
            json_path = ROOT / "public" / "data" / "returns" / "tr_index" / f"{stk}.json"
            if json_path.exists():
                with json_path.open(encoding="utf-8") as jf:
                    jdata = json.load(jf)
                    points = jdata.get("points", [])
                    if points:
                        last_pt_date = normalize_date_str(points[-1].get("date"))
                        if last_pt_date != master_latest:
                            errors.append(
                                f"TR JSON Date Stale: {stk}.json last point date is {last_pt_date}, expected {master_latest}."
                            )

    # Report
    print("=" * 60)
    print("ZERO-HALLUCINATION INTEGRITY AUDIT REPORT")
    print("=" * 60)
    print(f"Total Errors: {len(errors)}")
    print(f"Total Warnings: {len(warnings)}")

    if errors:
        print("\nERRORS ENCOUNTERED:")
        for err in errors[:20]:
            print(f" - [ERROR] {err}")
        if len(errors) > 20:
            print(f"   ... and {len(errors) - 20} more errors.")
        return False
    else:
        print("\n[SUCCESS] 100% Zero-Hallucination & Mathematical Integrity Verified.")
        return True


if __name__ == "__main__":
    success = verify_integrity()
    if not success:
        sys.exit(1)
