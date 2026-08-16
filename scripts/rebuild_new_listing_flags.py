#!/usr/bin/env python3
"""Synchronize new_90d/new_3m return flags with official master listing dates."""
from __future__ import annotations

import argparse
import csv
import re
from datetime import date, datetime
from pathlib import Path


def parse_date(value: str) -> date | None:
    compact = value.replace("-", "")
    if not re.fullmatch(r"\d{8}", compact):
        return None
    try:
        return datetime.strptime(compact, "%Y%m%d").date()
    except ValueError:
        return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=Path("data"))
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    master_path = args.data_dir / "etf_master_draft.csv"
    returns_path = args.data_dir / "etf_returns_draft.csv"

    with master_path.open(encoding="utf-8-sig", newline="") as handle:
        masters = list(csv.DictReader(handle))
    with returns_path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        fieldnames = reader.fieldnames or []
        returns = list(reader)
    master_by_ticker = {row.get("ticker", "").upper(): row for row in masters}

    changed = 0
    new_count = 0
    for row in returns:
        master = master_by_ticker.get(row.get("ticker", "").upper(), {})
        listing = parse_date(master.get("listing_date", ""))
        as_of = parse_date(master.get("bas_dt", ""))
        is_new = bool(listing and as_of and 0 <= (as_of - listing).days <= 90)
        expected = "Y" if is_new else "N"
        if row.get("new_90d") != expected or row.get("new_3m") != expected:
            changed += 1
            row["new_90d"] = expected
            row["new_3m"] = expected
        new_count += int(is_new)

    print(f"new_listings={new_count} changed_rows={changed}")
    if args.apply:
        with returns_path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(returns)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
