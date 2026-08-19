#!/usr/bin/env python3
"""Build date-level TR history only for ETFs passing the evidence gates."""
from __future__ import annotations

import csv
import json
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DIST = DATA / "distributions"
PRICE_PATHS = [DATA / "income_page2_price_history.csv", DATA / "page3_price_history.csv"]
EVENTS = DIST / "etf_distribution_events.csv"
COVERAGE = DIST / "etf_tr_data_coverage.csv"
ACTIONS = ROOT / "data" / "corporate_actions" / "etf_corporate_actions.csv"
WATCHLIST = DIST / "income_etf_collection_watchlist.csv"
OUT = DATA / "returns" / "etf_total_return_history.csv"
COLUMNS = ["etf_id", "ticker", "date", "close", "pr_index", "distribution_cash", "tr_index", "return_basis", "verification_status"]


def rows(path: Path) -> list[dict[str, str]]:
    if not path.exists(): return []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def clean(value: object | None) -> str:
    return "" if value is None else str(value).strip()


def ticker(value: object | None) -> str:
    text = clean(value).upper()
    return text.zfill(6) if text.isdigit() and len(text) < 6 else text


def parse_date(value: object | None) -> date | None:
    text = clean(value)
    for fmt in ("%Y-%m-%d", "%Y%m%d", "%Y.%m.%d"):
        try: return datetime.strptime(text, fmt).date()
        except ValueError: pass
    return None


def number(value: object | None) -> float | None:
    try: return float(clean(value).replace(",", "").replace("원", ""))
    except ValueError: return None


def is_complete(coverage: dict[str, str], actions: list[dict[str, str]], events: list[dict[str, str]]) -> bool:
    if clean(coverage.get("distribution_coverage_status")) not in {"verified_complete", "verified_no_distribution"}: return False
    if clean(coverage.get("corporate_action_coverage_status")) not in {"verified_complete", "verified_no_action"}: return False
    return all(clean(row.get("verification_status")) == "verified" for row in actions + events)


def main() -> int:
    master = {ticker(row.get("ticker")): clean(row.get("isin_cd")) for row in rows(DATA / "etf_master_draft.csv")}
    income = {ticker(row.get("ticker")) for row in rows(WATCHLIST)}
    coverage = {ticker(row.get("ticker")): row for row in rows(COVERAGE)}
    events: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows(EVENTS): events[ticker(row.get("ticker"))].append(row)
    actions: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows(ACTIONS): actions[ticker(row.get("ticker"))].append(row)
    prices: dict[str, dict[date, float]] = defaultdict(dict)
    for path in PRICE_PATHS:
        for row in rows(path):
            code, day, close = ticker(row.get("ticker")), parse_date(row.get("date")), number(row.get("close"))
            if code and day and close and close > 0: prices[code][day] = close
    output: list[dict[str, str]] = []
    eligible: list[str] = []
    for code, points in sorted(prices.items()):
        if code not in income or not is_complete(coverage.get(code, {}), actions.get(code, []), events.get(code, [])): continue
        ordered = sorted(points.items())
        if len(ordered) < 2: continue
        eligible.append(code)
        first_close = ordered[0][1]
        pr_index, tr_index = 100.0, 100.0
        cash_by_day: dict[date, float] = defaultdict(float)
        for event in events.get(code, []):
            day, cash = parse_date(event.get("ex_date")), number(event.get("distribution_per_share_krw"))
            if day and cash is not None: cash_by_day[day] += cash
        for index, (day, close) in enumerate(ordered):
            if index > 0:
                previous_close = ordered[index - 1][1]
                pr_index *= close / previous_close
                tr_index *= (close + cash_by_day.get(day, 0.0)) / previous_close
            output.append({"etf_id": master.get(code, ""), "ticker": code, "date": day.isoformat(), "close": f"{close:.6f}", "pr_index": f"{pr_index:.8f}", "distribution_cash": f"{cash_by_day.get(day, 0.0):.6f}", "tr_index": f"{tr_index:.8f}", "return_basis": "market_price_tr_pre_tax_ex_date_reinvested", "verification_status": "verified"})
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS); writer.writeheader(); writer.writerows(output)
    print(json.dumps({"eligible_tickers": eligible, "eligible_count": len(eligible), "history_rows": len(output), "output": str(OUT.relative_to(ROOT)), "calculation_version": "tr-history-v1"}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__": raise SystemExit(main())
