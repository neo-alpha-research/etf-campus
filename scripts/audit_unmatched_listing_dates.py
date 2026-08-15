#!/usr/bin/env python3
"""Inspect current-master ETF rows without a KIND listing-date match."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--enrichment", type=Path, required=True)
    parser.add_argument("--returns", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    enrichment = read_csv(args.enrichment)
    returns = read_csv(args.returns)
    returns_by_ticker = {row.get("ticker", ""): row for row in returns}
    unmatched = [row for row in enrichment if row.get("listing_date_status") == "unavailable"]

    output_rows: list[dict[str, str]] = []
    candidate_columns = [
        "listing_date",
        "listing_date_source",
        "listing_date_candidate",
        "first_traded_date",
        "first_seen_date",
        "itd_anchor_date",
        "itd_anchor_close",
    ]
    for row in unmatched:
        result = {
            "ticker": row.get("ticker", ""),
            "isin": row.get("isin", ""),
            "master_name": row.get("master_name", ""),
            "existing_returns_found": "Y" if row.get("ticker", "") in returns_by_ticker else "N",
        }
        return_row = returns_by_ticker.get(row.get("ticker", ""), {})
        for field in candidate_columns:
            result[field] = return_row.get(field, "")
        output_rows.append(result)

    fields = ["ticker", "isin", "master_name", "existing_returns_found", *candidate_columns]
    with args.output.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(output_rows)

    print(f"Unmatched current-master ETFs: {len(output_rows)}")
    for field in candidate_columns:
        count = sum(bool(row[field].strip()) for row in output_rows)
        print(f"{field}: {count}")
    print(f"Wrote: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
