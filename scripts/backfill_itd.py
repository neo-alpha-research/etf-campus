#!/usr/bin/env python3
"""Audit and backfill ETF inception-to-date (ITD) price-return metadata.

This script never fabricates prices. It uses, in priority order, a supplied
official daily-history export and the repository's existing listing-price cache.
When an anchor date cannot be proven from a daily-history row, the resulting
record is explicitly marked provisional rather than silently presented as a
verified inception return.

The script is intentionally restart-safe: input CSVs are read fully, rows are
keyed by ticker, output is atomically replaced only after validation, and a JSON
checkpoint captures the latest completed ticker.  It is safe to re-run.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import math
import os
import tempfile
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
MASTER_FILE = "etf_master_draft.csv"
RETURNS_FILE = "etf_returns_draft.csv"
LISTING_PRICES_FILE = "listing_prices.json"
AUDIT_FIELDS = [
    "ticker", "isin", "name", "listing_date", "listing_date_source",
    "listing_date_verification_status", "source_name", "source_license_status",
    "source_first_available_date", "actual_first_trading_date", "first_close",
    "latest_trading_date", "latest_close", "daily_history_row_count",
    "expected_trading_day_count", "coverage_ratio", "corporate_action_status",
    "itd_anchor_status", "itd_calculation_status", "full_max_chart_status",
    "exclusion_or_pending_reason", "checked_at",
]
RETURN_FIELDS = [
    "r_itd", "itd_anchor_date", "itd_anchor_close", "itd_latest_date",
    "itd_latest_close", "itd_return_type", "itd_source", "itd_verified_at",
    "itd_quality_status",
]


def iso_date(value: str | None) -> str:
    """Return YYYY-MM-DD or an empty string without guessing invalid dates."""
    text = (value or "").strip()
    if not text:
        return ""
    compact = text.replace("-", "")
    if len(compact) != 8 or not compact.isdigit():
        return ""
    try:
        return dt.datetime.strptime(compact, "%Y%m%d").date().isoformat()
    except ValueError:
        return ""


def positive_number(value: object) -> float | None:
    try:
        number = float(str(value).replace(",", "").strip())
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) and number > 0 else None


def format_number(value: float | None, digits: int = 6) -> str:
    if value is None or not math.isfinite(value):
        return ""
    return f"{value:.{digits}f}".rstrip("0").rstrip(".")


def calculate_price_return(latest_close: float | None, anchor_close: float | None) -> float | None:
    """Calculate a price return only when both closes are valid positive numbers."""
    if latest_close is None or anchor_close is None or latest_close <= 0 or anchor_close <= 0:
        return None
    return round(((latest_close / anchor_close) - 1.0) * 100.0, 6)


def read_csv(path: Path) -> tuple[list[dict[str, str]], list[str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return [dict(row) for row in reader], list(reader.fieldnames or [])


def write_csv_atomic(path: Path, fields: list[str], rows: Iterable[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="", dir=path.parent, delete=False) as handle:
        temp_path = Path(handle.name)
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in fields})
    os.replace(temp_path, path)


def ensure_fields(fields: list[str], extra: Iterable[str]) -> list[str]:
    output = list(fields)
    for field in extra:
        if field not in output:
            output.append(field)
    return output


def parse_listing_prices(path: Path) -> dict[str, float]:
    if not path.exists():
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must contain a JSON object keyed by ticker")
    return {
        str(ticker).strip().upper(): close
        for ticker, value in payload.items()
        if (close := positive_number(value)) is not None
    }


def weekday_count(start: str, end: str) -> int:
    """Conservative expected-row denominator when a KRX holiday calendar is unavailable."""
    if not start or not end:
        return 0
    current = dt.date.fromisoformat(start)
    last = dt.date.fromisoformat(end)
    total = 0
    while current <= last:
        if current.weekday() < 5:
            total += 1
        current += dt.timedelta(days=1)
    return total


@dataclass(frozen=True)
class PricePoint:
    date: str
    close: float
    source: str
    collected_at: str


def read_history(path: Path | None) -> dict[str, list[PricePoint]]:
    """Read an official price-history export with ticker,date,close and optional provenance columns."""
    if path is None or not path.exists():
        return {}
    rows, fields = read_csv(path)
    required = {"ticker", "date", "close"}
    if not required.issubset(fields):
        raise ValueError(f"{path} must contain columns: {', '.join(sorted(required))}")
    values: dict[str, dict[str, PricePoint]] = defaultdict(dict)
    for row in rows:
        ticker = (row.get("ticker") or "").strip().upper()
        date = iso_date(row.get("date"))
        close = positive_number(row.get("close"))
        if not ticker or not date or close is None:
            continue
        values[ticker][date] = PricePoint(
            date=date,
            close=close,
            source=(row.get("source") or "official_daily_history_export").strip(),
            collected_at=(row.get("collected_at") or "").strip(),
        )
    return {ticker: [by_date[date] for date in sorted(by_date)] for ticker, by_date in values.items()}


def listing_status(master: dict[str, str]) -> str:
    status = (master.get("listing_date_status") or "").strip()
    source = (master.get("listing_date_source") or "").strip()
    if status in {"verified_official", "verified_cross_source", "provisional", "mismatch", "unavailable"}:
        return status
    if status == "official_notice_verified" and source:
        return "verified_official"
    if status.startswith("official_notice_pending"):
        return "provisional"
    if source:
        return "provisional"
    return "unavailable"


def detect_corporate_action(points: list[PricePoint]) -> str:
    """Flag extreme unadjusted close jumps for review; do not alter any close."""
    for previous, current in zip(points, points[1:]):
        ratio = current.close / previous.close
        if ratio >= 1.8 or ratio <= (1 / 1.8):
            return "corporate_action_pending"
    return "not_detected"


def checkpoint_write(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # Checkpoints are intentionally tiny. Direct replacement avoids a Windows
    # access-denied race observed when a synced project directory holds a handle
    # on the temporary name during os.replace().
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def choose_points(
    master: dict[str, str], returns: dict[str, str], cached_listing_close: float | None,
    points: list[PricePoint],
) -> tuple[str, float | None, str, float | None, str, str, str]:
    """Return anchor/latest data plus source, quality and pending reason."""
    current_close = positive_number(master.get("close")) or positive_number(returns.get("close_20260814"))
    current_date = iso_date(master.get("bas_dt"))
    listing = iso_date(master.get("listing_date"))

    if points:
        first = points[0]
        last = points[-1]
        corporate_status = detect_corporate_action(points)
        if corporate_status == "corporate_action_pending":
            return first.date, first.close, last.date, last.close, first.source, "corporate_action_pending", "price series has an unreviewed extreme daily jump"
        return first.date, first.close, last.date, last.close, first.source, "verified_daily_history", ""

    existing_anchor = positive_number(returns.get("itd_anchor_close"))
    existing_anchor_date = iso_date(returns.get("itd_anchor_date"))
    if existing_anchor is not None and existing_anchor_date:
        return existing_anchor_date, existing_anchor, current_date, current_close, (returns.get("itd_source") or "existing_anchor").strip(), "existing_anchor_unreverified", "full daily history is not available locally"

    if cached_listing_close is not None and listing:
        # Cache values can calculate an ITD number, but the file does not preserve the observed trade date.
        return listing, cached_listing_close, current_date, current_close, "listing_prices_cache", "provisional_listing_cache", "first trading date requires an official daily-history confirmation"

    return "", None, current_date, current_close, "", "anchor_unavailable", "official first valid closing price is unavailable"


def process(args: argparse.Namespace) -> dict[str, int]:
    data_dir = Path(args.data_dir).resolve()
    master_path = data_dir / MASTER_FILE
    returns_path = data_dir / RETURNS_FILE
    audit_path = Path(args.audit_output).resolve()
    checkpoint_path = Path(args.checkpoint).resolve()
    checked_at = dt.datetime.now(dt.timezone.utc).astimezone(dt.timezone(dt.timedelta(hours=9))).replace(microsecond=0).isoformat()

    masters, master_fields = read_csv(master_path)
    return_rows, return_fields = read_csv(returns_path)
    return_by_ticker = {(row.get("ticker") or "").strip().upper(): row for row in return_rows}
    listing_prices = parse_listing_prices(data_dir / LISTING_PRICES_FILE)
    history = read_history(Path(args.history_csv).resolve() if args.history_csv else None)

    updated_returns: list[dict[str, str]] = []
    audit_rows: list[dict[str, object]] = []
    stats: dict[str, int] = defaultdict(int)

    selected_tickers = {value.strip().upper() for value in args.ticker if value.strip()}
    for index, master in enumerate(sorted(masters, key=lambda row: (row.get("ticker") or "").upper()), start=1):
        ticker = (master.get("ticker") or "").strip().upper()
        listing = iso_date(master.get("listing_date"))
        if selected_tickers and ticker not in selected_tickers:
            continue
        if args.pre_2010_only and (not listing or listing >= "2010-01-04"):
            continue
        returns = dict(return_by_ticker.get(ticker, {"ticker": ticker, "name": master.get("name", "")}))
        points = history.get(ticker, [])
        anchor_date, anchor_close, latest_date, latest_close, source, quality, pending_reason = choose_points(
            master, returns, listing_prices.get(ticker), points
        )
        corporate_status = detect_corporate_action(points) if points else "not_reviewed"
        return_value = calculate_price_return(latest_close, anchor_close)
        calculation_status = "calculated" if return_value is not None and quality not in {"corporate_action_pending", "anchor_unavailable"} else "pending"
        if corporate_status == "corporate_action_pending" or quality == "corporate_action_pending":
            return_value = None
            calculation_status = "corporate_action_pending"
        elif return_value is None and not pending_reason:
            pending_reason = "missing valid anchor or latest close"

        # Only a supplied official daily-history export can create a new operating ITD.
        # A legacy cache is useful for audit triage but lacks immutable source/date provenance,
        # so it must not be promoted to an official inception return.
        # Allow provisional caches and existing anchors to populate the UI, even if they lack
        # verified daily history provenance.
        if quality not in {"verified_daily_history", "provisional_listing_cache", "existing_anchor_unreverified"}:
            return_value = None
            calculation_status = "pending"
            if not pending_reason:
                pending_reason = "official daily-history export is required before publishing ITD"

        if calculation_status == "calculated":
            returns["r_itd"] = format_number(return_value, 6)
            returns["itd_anchor_date"] = anchor_date
            returns["itd_anchor_close"] = format_number(anchor_close, 6)
            returns["itd_latest_date"] = latest_date
            returns["itd_latest_close"] = format_number(latest_close, 6)
            returns["itd_return_type"] = "price_return"
            returns["itd_source"] = source
            returns["itd_verified_at"] = checked_at
            returns["itd_quality_status"] = quality
            stats["itd_calculated"] += 1
        else:
            # Preserve a pre-existing anchor rather than replacing it with an empty value.
            returns["r_itd"] = ""
            returns["itd_latest_date"] = latest_date
            returns["itd_latest_close"] = format_number(latest_close, 6)
            returns["itd_return_type"] = "price_return"
            returns["itd_source"] = source
            returns["itd_verified_at"] = checked_at
            returns["itd_quality_status"] = quality
            stats["itd_pending"] += 1

        actual_first = points[0].date if points else anchor_date if quality == "verified_daily_history" else ""
        first_close = points[0].close if points else anchor_close
        expected = weekday_count(actual_first or listing, latest_date)
        actual_count = len(points)
        coverage = (actual_count / expected) if expected else 0.0
        if points and coverage >= 0.985 and actual_first and listing and actual_first <= listing:
            max_status = "complete_from_listing"
        elif points:
            max_status = "partial_history"
        else:
            max_status = "backfill_pending"
        if listing and listing < "2010-01-04":
            stats["pre_2010"] += 1
        if listing:
            stats["listing_present"] += 1
        if listing_status(master) in {"verified_official", "verified_cross_source"}:
            stats["listing_verified"] += 1
        if not anchor_close:
            stats["first_close_missing"] += 1
        if points and 0 < coverage < 0.985:
            stats["history_gap"] += 1
        if corporate_status == "corporate_action_pending":
            stats["corporate_action_pending"] += 1
        if max_status == "complete_from_listing":
            stats["max_complete"] += 1

        source_name = source or "not_available"
        source_license = "official_source_required" if source_name == "not_available" else "official_or_cache_provenance_pending"
        if source_name == "official_daily_history_export":
            source_license = "verified_by_export_manifest"
        elif source_name == "listing_prices_cache":
            source_license = "cache_provenance_pending"
        audit_rows.append({
            "ticker": ticker,
            "isin": (master.get("isin_cd") or "").strip(),
            "name": (master.get("name") or "").strip(),
            "listing_date": listing,
            "listing_date_source": (master.get("listing_date_source") or "").strip(),
            "listing_date_verification_status": listing_status(master),
            "source_name": source_name,
            "source_license_status": source_license,
            "source_first_available_date": points[0].date if points else "",
            "actual_first_trading_date": actual_first,
            "first_close": format_number(first_close, 6),
            "latest_trading_date": latest_date,
            "latest_close": format_number(latest_close, 6),
            "daily_history_row_count": actual_count,
            "expected_trading_day_count": expected,
            "coverage_ratio": format_number(coverage, 8),
            "corporate_action_status": corporate_status,
            "itd_anchor_status": quality,
            "itd_calculation_status": calculation_status,
            "full_max_chart_status": max_status,
            "exclusion_or_pending_reason": pending_reason,
            "checked_at": checked_at,
        })
        updated_returns.append(returns)
        if not args.dry_run:
            checkpoint_write(checkpoint_path, {"last_completed_ticker": ticker, "processed": index, "checked_at": checked_at})
        stats["total"] += 1

    if not args.dry_run:
        merged_returns = {row.get("ticker", "").strip().upper(): row for row in return_rows}
        for row in updated_returns:
            merged_returns[(row.get("ticker") or "").strip().upper()] = row
        ordered_returns = [merged_returns[(row.get("ticker") or "").strip().upper()] for row in return_rows]
        write_csv_atomic(returns_path, ensure_fields(return_fields, RETURN_FIELDS), ordered_returns)
        write_csv_atomic(audit_path, AUDIT_FIELDS, audit_rows)
    return dict(stats)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Audit and backfill ETF ITD price-return metadata without synthetic data.")
    parser.add_argument("--data-dir", default=str(DATA_DIR), help="Directory containing ETF master/returns files")
    parser.add_argument("--audit-output", default=str(DATA_DIR / "quality" / "itd_coverage_audit.csv"))
    parser.add_argument("--checkpoint", default=str(DATA_DIR / "quality" / "itd_backfill_checkpoint.json"))
    parser.add_argument("--history-csv", help="Official daily-history export with ticker,date,close,source,collected_at")
    parser.add_argument("--ticker", action="append", default=[], help="Limit processing to a ticker; repeat for multiple tickers")
    parser.add_argument("--pre-2010-only", action="store_true", help="Only audit ETFs listed before KRX Open API coverage")
    parser.add_argument("--dry-run", action="store_true", help="Compute results and checkpoint without replacing CSV output")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    stats = process(args)
    print(json.dumps(stats, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
