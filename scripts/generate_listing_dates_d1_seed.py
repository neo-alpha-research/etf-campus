#!/usr/bin/env python3
"""Generate a deterministic D1 SQL seed file from ETF listing-date enrichment CSV."""

from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
from pathlib import Path

FIELDS = [
    "ticker",
    "isin",
    "listing_date",
    "first_traded_date",
    "fund_inception_date",
    "listing_date_status",
    "listing_date_source_type",
    "listing_date_source_url",
    "kind_receipt_no",
    "verified_at",
    "verification_note",
]


def sql_literal(value: str) -> str:
    return "NULL" if not value else "'" + value.replace("'", "''") + "'"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    with args.input.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    missing = set(FIELDS).difference(rows[0] if rows else {})
    if missing:
        raise ValueError(f"Input is missing: {', '.join(sorted(missing))}")

    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    columns = ", ".join([*FIELDS, "updated_at"])
    updates = ", ".join(
        f"{field}=excluded.{field}" for field in [*FIELDS[1:], "updated_at"]
    )
    lines = [
        "-- GENERATED FILE. Do not edit by hand.",
        f"-- source: {args.input.name}; generated_at: {generated_at}",
        "BEGIN TRANSACTION;",
    ]
    for row in rows:
        values = ", ".join(sql_literal(row.get(field, "")) for field in FIELDS)
        lines.extend(
            [
                f"INSERT INTO etf_listing_dates ({columns}) VALUES ({values}, {sql_literal(generated_at)})",
                f"ON CONFLICT(ticker) DO UPDATE SET {updates};",
            ]
        )
    lines.extend(["COMMIT;", ""])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {args.output} ({len(rows):,} rows)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
