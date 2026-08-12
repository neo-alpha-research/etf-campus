"""Validate official Page 3 TOP-5 holdings and build a compact summary."""

from __future__ import annotations

import csv
import argparse
import json
from collections import defaultdict
from datetime import datetime
from decimal import Decimal
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CASH_WORDS = ("현금", "예금", "수수금", "미수금", "CASH")


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))


def weekday_distance(start: str, end: str) -> int:
    start_day = datetime.strptime(start, "%Y-%m-%d").date()
    end_day = datetime.strptime(end, "%Y-%m-%d").date()
    low, high = sorted((start_day, end_day))
    return sum(1 for offset in range((high - low).days + 1) if (low.fromordinal(low.toordinal() + offset)).weekday() < 5) - 1


def validate_holdings(
    selected_rows: list[dict[str, str]], holdings_rows: list[dict[str, str]], as_of: str
) -> list[dict[str, object]]:
    selected = {row["ticker"]: row for row in selected_rows if row["page_id"] == "ai_momentum"}
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in holdings_rows:
        grouped[row["ticker"]].append(row)
    if set(grouped) != set(selected):
        raise RuntimeError(f"HOLDINGS_SELECTION_MISMATCH: {sorted(set(grouped) ^ set(selected))}")

    summary: list[dict[str, object]] = []
    as_of_iso = datetime.strptime(as_of, "%Y%m%d").date().isoformat()
    for ticker, rows in grouped.items():
        rows.sort(key=lambda row: int(row["rank"]))
        if [int(row["rank"]) for row in rows] != [1, 2, 3, 4, 5]:
            raise RuntimeError(f"HOLDINGS_RANK_INVALID: {ticker}")
        if any(any(word in row["holding_name"].upper() for word in CASH_WORDS) for row in rows):
            raise RuntimeError(f"HOLDINGS_CASH_INCLUDED: {ticker}")
        dates = {row["holdings_date"] for row in rows}
        if len(dates) != 1:
            raise RuntimeError(f"HOLDINGS_DATE_MIXED: {ticker}")
        holdings_date = next(iter(dates))
        if weekday_distance(as_of_iso, holdings_date) > 5:
            raise RuntimeError(f"HOLDINGS_STALE: {ticker}")
        calculated = sum(Decimal(row["weight_pct"]) for row in rows)
        declared = {Decimal(row["top5_concentration_pct"]) for row in rows}
        if declared != {calculated}:
            raise RuntimeError(f"HOLDINGS_SUM_MISMATCH: {ticker}")
        summary.append(
            {
                "ticker": ticker,
                "name": selected[ticker]["name"],
                "theme_key": selected[ticker]["theme_key"],
                "holdings_date": holdings_date,
                "top5_holdings": " | ".join(f"{row['holding_name']} {row['weight_pct']}%" for row in rows),
                "top5_concentration_pct": f"{calculated:.2f}",
                "source_url": rows[0]["source_url"],
                "validation_status": "pass",
            }
        )
    return sorted(summary, key=lambda row: int(selected[str(row["ticker"])]["selection_rank"]))


def validate_strategy_changes(
    selected_rows: list[dict[str, str]], strategy_rows: list[dict[str, str]]
) -> None:
    selected = {row["ticker"] for row in selected_rows if row["page_id"] == "ai_momentum"}
    registry = {row["ticker"]: row for row in strategy_rows}
    missing = selected - set(registry)
    if missing:
        raise RuntimeError(f"STRATEGY_CHANGE_REVIEW_MISSING: {sorted(missing)}")
    failed = [ticker for ticker in selected if registry[ticker]["eligibility_result"] != "pass"]
    if failed:
        raise RuntimeError(f"STRATEGY_CHANGE_REVIEW_FAIL: {sorted(failed)}")


def main(as_of: str, holdings_file: Path, strategies_file: Path) -> None:
    selected = read_csv(ROOT / "data" / "lead_magnet" / "generated" / as_of / "selection_preview.csv")
    holdings = read_csv(holdings_file)
    strategies = read_csv(strategies_file)
    summary = validate_holdings(selected, holdings, as_of)
    validate_strategy_changes(selected, strategies)
    output_dir = ROOT / "data" / "lead_magnet" / "generated" / as_of
    fields = list(summary[0])
    with (output_dir / "page3_holdings_summary.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(summary)
    validation = {
        "as_of_date": as_of,
        "selected_page3_count": len(summary),
        "all_selected_have_official_top5": len(summary) == 5,
        "all_holdings_within_5_weekdays": True,
        "cash_excluded": True,
        "concentration_sums_valid": True,
        "all_selected_pass_strategy_change_review": True,
        "status": "pass",
    }
    (output_dir / "page3_holdings_validation.json").write_text(
        json.dumps(validation, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(validation, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Validate page-3 AI ETF TOP5 holdings.")
    parser.add_argument("--as-of", required=True, help="Reference date: YYYYMMDD")
    parser.add_argument("--holdings-file", type=Path, required=True, help="Official TOP5 holdings CSV")
    parser.add_argument("--strategies-file", type=Path, required=True, help="Official strategy-change review CSV")
    args = parser.parse_args()
    main(args.as_of, args.holdings_file, args.strategies_file)
