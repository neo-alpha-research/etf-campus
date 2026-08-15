#!/usr/bin/env python3
"""Synchronize verified ETF listing dates into ETF Campus's master CSV.

The Next.js repository already exposes ``listing_date`` and
``listing_date_source`` from ``etf_master_draft.csv``. This script is the
single deterministic hand-off from the audited evidence ledger to the data file
served by pages and ``/api/etfs``.
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

SOURCE_LABELS = {
    "verified_official": "KRX KIND ETF 종목상세 검증",
    "official_notice_pending_isin": "KRX KIND 신규상장 공시",
    "provisional_first_trade": "금융위원회 시세 최초 기준일",
    "manual_review": "수동 검토 필요",
    "conflict": "원천 불일치 검토 필요",
    "unavailable": "상장일 확인 중",
}


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def write_csv(path: Path, fields: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--master", type=Path, required=True)
    parser.add_argument("--listing-ledger", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--audit", type=Path, required=True)
    args = parser.parse_args()

    master_fields, master_rows = read_csv(args.master)
    _, ledger_rows = read_csv(args.listing_ledger)
    required_master = {"ticker", "isin_cd"}
    required_ledger = {"ticker", "isin", "listing_date", "listing_date_status"}
    if missing := required_master.difference(master_fields):
        raise ValueError(f"Master is missing columns: {sorted(missing)}")
    if ledger_rows and (missing := required_ledger.difference(ledger_rows[0])):
        raise ValueError(f"Ledger is missing columns: {sorted(missing)}")

    for field in ("listing_date", "listing_date_source"):
        if field not in master_fields:
            master_fields.append(field)

    ledger_by_ticker = {row["ticker"]: row for row in ledger_rows}
    audit_rows: list[dict[str, str]] = []
    updated = 0
    for row in master_rows:
        ticker = row["ticker"]
        evidence = ledger_by_ticker.get(ticker)
        audit = {
            "ticker": ticker,
            "master_isin": row.get("isin_cd", ""),
            "ledger_isin": evidence.get("isin", "") if evidence else "",
            "listing_date": evidence.get("listing_date", "") if evidence else "",
            "listing_date_status": evidence.get("listing_date_status", "") if evidence else "missing",
            "result": "",
        }
        if not evidence:
            audit["result"] = "missing_ledger_row"
        elif row.get("isin_cd") != evidence.get("isin"):
            audit["result"] = "isin_mismatch"
        elif not evidence.get("listing_date"):
            audit["result"] = "missing_listing_date"
        else:
            status = evidence["listing_date_status"]
            row["listing_date"] = evidence["listing_date"]
            row["listing_date_source"] = SOURCE_LABELS.get(status, status)
            audit["result"] = "synced"
            updated += 1
        audit_rows.append(audit)

    invalid = [row for row in audit_rows if row["result"] != "synced"]
    if invalid:
        write_csv(args.audit, list(audit_rows[0]), audit_rows)
        raise ValueError(f"Refusing to write incomplete master; invalid rows: {len(invalid)}")

    write_csv(args.output, master_fields, master_rows)
    write_csv(args.audit, list(audit_rows[0]), audit_rows)
    verified = sum(row["listing_date_status"] == "verified_official" for row in audit_rows)
    pending = sum(row["listing_date_status"] == "official_notice_pending_isin" for row in audit_rows)
    print(f"Synchronized rows: {updated:,}")
    print(f"Verified official: {verified:,}")
    print(f"KIND notice pending ISIN: {pending:,}")
    print(f"Wrote: {args.output}")
    print(f"Wrote: {args.audit}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
