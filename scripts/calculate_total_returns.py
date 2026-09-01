#!/usr/bin/env python3
"""Calculate fixed-period ETF total returns only when the evidence chain is complete.

The calculator deliberately writes an empty total_return_pct with an explicit
calculation_status whenever distribution or corporate-action coverage is not
verified. It does not fall back to PR and does not replace an unavailable period
with an inception-to-date return.
"""
from __future__ import annotations

import argparse
import calendar
import csv
import json
import re
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST_DIR = ROOT / "data" / "distributions"
EVENTS_PATH = DIST_DIR / "etf_distribution_events.csv"
COVERAGE_PATH = DIST_DIR / "etf_tr_data_coverage.csv"
ACTIONS_PATH = ROOT / "data" / "corporate_actions" / "etf_corporate_actions.csv"
OUT_PATH = ROOT / "data" / "returns" / "etf_total_return_metrics.csv"
PRICE_PATHS = [ROOT / "data" / "returns" / "etf_price_history.csv"]

ACTION_COLUMNS = [
    "action_id", "etf_id", "ticker", "action_type", "effective_date",
    "ratio_numerator", "ratio_denominator", "source_id", "verification_status",
    "supersedes_action_id", "updated_at", "note",
]
METRIC_COLUMNS = [
    "etf_id", "ticker", "period", "as_of_date", "target_start_date",
    "actual_start_date", "actual_end_date", "total_return_pct", "return_basis",
    "calculation_status", "distribution_event_count", "blocking_event_ids",
    "price_observation_count", "calculation_version", "calculated_at",
]
PERIODS = ("1d", "1w", "2w", "1m", "2m", "3m", "6m", "1y", "2y", "3y", "ytd")
COMPLETE_DISTRIBUTION = {"verified_complete", "verified_no_distribution"}
COMPLETE_ACTIONS = {"verified_complete", "verified_no_action"}


@dataclass(frozen=True)
class PricePoint:
    day: date
    close: float


def now_iso() -> str:
    return datetime.now().astimezone().replace(microsecond=0).isoformat()


def clean(value: object | None) -> str:
    return "" if value is None else str(value).strip()


def ticker(value: object | None) -> str:
    text = clean(value).upper()
    return text.zfill(6) if text.isdigit() and len(text) < 6 else text


def parse_day(value: object | None) -> date | None:
    text = clean(value)
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%Y%m%d", "%Y.%m.%d"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            pass
    return None


def number(value: object | None) -> float | None:
    try:
        return float(clean(value).replace(",", "").replace("원", ""))
    except ValueError:
        return None


def rows(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return [{key: clean(value) for key, value in item.items()} for item in csv.DictReader(handle)]


def write_csv(path: Path, columns: list[str], records: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        for record in records:
            writer.writerow({column: clean(record.get(column)) for column in columns})


def ensure_actions_ledger() -> None:
    if not ACTIONS_PATH.exists():
        write_csv(ACTIONS_PATH, ACTION_COLUMNS, [])


def shift_months(value: date, months: int) -> date:
    raw_month = value.month - months
    year = value.year + (raw_month - 1) // 12
    month = (raw_month - 1) % 12 + 1
    return date(year, month, min(value.day, calendar.monthrange(year, month)[1]))


def target_start(as_of: date, period: str) -> date:
    if period == "1d":
        return date.fromordinal(as_of.toordinal() - 1)
    if period == "1w":
        return date.fromordinal(as_of.toordinal() - 7)
    if period == "2w":
        return date.fromordinal(as_of.toordinal() - 14)
    if period == "ytd":
        return date(as_of.year - 1, 12, 31)
    months = {"1m": 1, "2m": 2, "3m": 3, "6m": 6, "1y": 12, "2y": 24, "3y": 36}[period]
    return shift_months(as_of, months)


def nearest_on_or_before(points: list[PricePoint], wanted: date) -> PricePoint | None:
    eligible = [point for point in points if point.day <= wanted]
    return eligible[-1] if eligible else None


def load_prices() -> dict[str, list[PricePoint]]:
    values: dict[str, dict[date, float]] = defaultdict(dict)
    for path in PRICE_PATHS:
        for row in rows(path):
            day = parse_day(row.get("date"))
            close = number(row.get("close"))
            code = ticker(row.get("ticker"))
            if day and close is not None and close > 0 and code:
                values[code][day] = close
    return {code: [PricePoint(day, close) for day, close in sorted(items.items())] for code, items in values.items()}


def load_master() -> dict[str, str]:
    path = ROOT / "data" / "etf_master_draft.csv"
    return {ticker(row.get("ticker")): clean(row.get("isin_cd")) for row in rows(path) if ticker(row.get("ticker"))}


def grouped_events() -> dict[str, list[dict[str, str]]]:
    values: dict[str, list[dict[str, str]]] = defaultdict(list)
    for event in rows(EVENTS_PATH):
        values[ticker(event.get("ticker"))].append(event)
    return values


def grouped_actions() -> dict[str, list[dict[str, str]]]:
    values: dict[str, list[dict[str, str]]] = defaultdict(list)
    for action in rows(ACTIONS_PATH):
        values[ticker(action.get("ticker"))].append(action)
    return values


def coverage_by_ticker() -> dict[str, dict[str, str]]:
    return {ticker(row.get("ticker")): row for row in rows(COVERAGE_PATH) if ticker(row.get("ticker"))}


def blocked_status(ticker_value: str, start: date, end: date, coverage: dict[str, dict[str, str]], actions: dict[str, list[dict[str, str]]], events: dict[str, list[dict[str, str]]]) -> tuple[str, list[str]]:
    cover = coverage.get(ticker_value)
    if not cover:
        return "missing_distribution_coverage", []
    if clean(cover.get("distribution_coverage_status")) not in COMPLETE_DISTRIBUTION:
        return f"distribution_coverage_{clean(cover.get('distribution_coverage_status')) or 'missing'}", []
    if clean(cover.get("corporate_action_coverage_status")) not in COMPLETE_ACTIONS:
        return f"corporate_action_coverage_{clean(cover.get('corporate_action_coverage_status')) or 'missing'}", []
    blocking: list[str] = []
    for event in events.get(ticker_value, []):
        event_day = parse_day(event.get("ex_date"))
        if event_day and start < event_day <= end and clean(event.get("verification_status")) != "verified":
            blocking.append(clean(event.get("event_id")))
    for action in actions.get(ticker_value, []):
        action_day = parse_day(action.get("effective_date"))
        if action_day and start < action_day <= end and clean(action.get("verification_status")) != "verified":
            blocking.append(clean(action.get("action_id")))
    return ("blocked_unverified_event" if blocking else "ready", blocking)


def calculate_for_period(code: str, isin: str, period: str, points: list[PricePoint], coverage: dict[str, dict[str, str]], events: dict[str, list[dict[str, str]]], actions: dict[str, list[dict[str, str]]]) -> dict[str, str]:
    as_of = points[-1].day
    wanted = target_start(as_of, period)
    start_point = nearest_on_or_before(points, wanted)
    base = {
        "etf_id": isin, "ticker": code, "period": period, "as_of_date": as_of.isoformat(),
        "target_start_date": wanted.isoformat(), "actual_start_date": "", "actual_end_date": as_of.isoformat(),
        "total_return_pct": "", "return_basis": "market_price_tr_pre_tax_ex_date_reinvested",
        "calculation_status": "", "distribution_event_count": "0", "blocking_event_ids": "",
        "price_observation_count": "0", "calculation_version": "1", "calculated_at": now_iso(),
    }
    if not start_point:
        base["calculation_status"] = "insufficient_price_history"
        return base
    if start_point.day >= as_of:
        base["calculation_status"] = "insufficient_price_history"
        return base
    base["actual_start_date"] = start_point.day.isoformat()
    in_range = [point for point in points if start_point.day <= point.day <= as_of]
    base["price_observation_count"] = str(len(in_range))
    status, blocking = blocked_status(code, start_point.day, as_of, coverage, actions, events)
    if status != "ready":
        base["calculation_status"] = status
        base["blocking_event_ids"] = ";".join(item for item in blocking if item)
        return base

    distribution_by_day: dict[date, float] = defaultdict(float)
    count = 0
    for event in events.get(code, []):
        event_day = parse_day(event.get("ex_date"))
        amount = number(event.get("distribution_per_share_krw"))
        if event_day and amount is not None and start_point.day < event_day <= as_of:
            distribution_by_day[event_day] += amount
            count += 1
    factor = 1.0
    previous = in_range[0]
    for current in in_range[1:]:
        cash = distribution_by_day.get(current.day, 0.0)
        factor *= (current.close + cash) / previous.close
        previous = current
    base["total_return_pct"] = f"{(factor - 1.0) * 100:.6f}"
    base["distribution_event_count"] = str(count)
    base["calculation_status"] = "calculated"
    return base


def main() -> int:
    parser = argparse.ArgumentParser(description="Calculate verified fixed-period ETF total return metrics")
    parser.add_argument("--ticker", action="append", default=[], help="Optional ticker filter; repeatable")
    args = parser.parse_args()
    ensure_actions_ledger()
    prices = load_prices()
    master = load_master()
    events = grouped_events()
    actions = grouped_actions()
    coverage = coverage_by_ticker()
    wanted = {ticker(value) for value in args.ticker}
    result: list[dict[str, str]] = []
    for code, points in sorted(prices.items()):
        if wanted and code not in wanted:
            continue
        for period in PERIODS:
            result.append(calculate_for_period(code, master.get(code, ""), period, points, coverage, events, actions))
    write_csv(OUT_PATH, METRIC_COLUMNS, result)
    statuses: dict[str, int] = defaultdict(int)
    for row in result:
        statuses[row["calculation_status"]] += 1
    payload = {"metrics": len(result), "output": str(OUT_PATH.relative_to(ROOT)), "status_counts": dict(sorted(statuses.items()))}
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
