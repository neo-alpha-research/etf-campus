#!/usr/bin/env python3
"""Build an ETF Campus listing-date enrichment file from master + KIND ledger.

This script never changes the master CSV. It creates a merge-ready dataset and a
review queue. A name-only match to a KIND official new-listing notice is labelled
``official_notice_pending_isin``; it is deliberately not upgraded to
``verified_official`` because the current KIND list result does not expose ISIN.
"""

from __future__ import annotations

import argparse
import csv
import re
from collections import defaultdict
from pathlib import Path


OUTPUT_FIELDS = [
    "ticker",
    "isin",
    "master_name",
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


def normalize_name(value: str) -> str:
    return re.sub(r"[^0-9A-Z가-힣]", "", (value or "").upper())


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, rows: list[dict[str, str]], fields: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--master", type=Path, required=True)
    parser.add_argument("--kind-ledger", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--review-output", type=Path, required=True)
    args = parser.parse_args()

    master_rows = read_csv(args.master)
    ledger_rows = read_csv(args.kind_ledger)
    if not master_rows:
        raise ValueError("Master CSV contains no data rows")
    if not ledger_rows:
        raise ValueError("KIND ledger contains no data rows")

    required_master = {"ticker", "isin_cd", "name"}
    required_ledger = {
        "ticker_name",
        "listing_date",
        "kind_receipt_no",
        "kind_ticker_code",
        "kind_search_url",
        "source_type",
        "verification_status",
    }
    missing_master = required_master.difference(master_rows[0])
    missing_ledger = required_ledger.difference(ledger_rows[0])
    if missing_master or missing_ledger:
        raise ValueError(
            f"Missing columns: master={sorted(missing_master)}, ledger={sorted(missing_ledger)}"
        )

    notices_by_name: dict[str, list[dict[str, str]]] = defaultdict(list)
    notices_by_code: dict[str, list[dict[str, str]]] = defaultdict(list)
    for notice in ledger_rows:
        notices_by_name[normalize_name(notice["ticker_name"])].append(notice)
        code = notice.get("kind_ticker_code", "").strip()
        if code:
            notices_by_code[code].append(notice)

    out_rows: list[dict[str, str]] = []
    review_rows: list[dict[str, str]] = []
    matched_receipts: set[str] = set()

    for master in master_rows:
        base = {
            "ticker": master.get("ticker", ""),
            "isin": master.get("isin_cd", ""),
            "master_name": master.get("name", ""),
            "listing_date": "",
            "first_traded_date": "",
            "fund_inception_date": "",
            "listing_date_status": "unavailable",
            "listing_date_source_type": "",
            "listing_date_source_url": "",
            "kind_receipt_no": "",
            "verified_at": "",
            "verification_note": "No exact normalized name match in KIND listing notice ledger.",
        }
        name_candidates = notices_by_name.get(normalize_name(master.get("name", "")), [])
        ticker = master.get("ticker", "").strip()
        # KRX's ETF summary code is normally the master ticker without a trailing
        # series digit (e.g., KIND 0204S -> master 0204S0) or an exact ticker.
        code_candidates = notices_by_code.get(ticker, []) + notices_by_code.get(
            ticker[:-1], []
        )
        candidates = name_candidates or code_candidates
        match_basis = "normalized_name" if name_candidates else "kind_ticker_code"
        if len(candidates) == 1:
            notice = candidates[0]
            base.update(
                {
                    "listing_date": notice["listing_date"],
                    "listing_date_status": "official_notice_pending_isin",
                    "listing_date_source_type": (
                        notice["source_type"] if match_basis == "normalized_name" else "kind_listing_notice_ticker_code"
                    ),
                    "listing_date_source_url": notice["kind_search_url"],
                    "kind_receipt_no": notice["kind_receipt_no"],
                    "verification_note": (
                        "KIND ETF 신규상장 공시의 공식 상장일을 현재 마스터와 "
                        f"{('정규화 종목명' if match_basis == 'normalized_name' else 'KRX 내부 종목코드')} 기준으로 일치시켰습니다. "
                        "KIND 원문 ISIN 교차검증 전에는 verified_official로 승격하지 마세요."
                    ),
                }
            )
            matched_receipts.add(notice["kind_receipt_no"])
        elif len(candidates) > 1:
            base.update(
                {
                    "listing_date_status": "manual_review",
                    "verification_note": (
                        f"동일한 정규화 종목명으로 KIND 공시 {len(candidates)}건이 있어 ISIN 검토가 필요합니다."
                    ),
                }
            )
            for notice in candidates:
                review_rows.append(
                    {
                        "review_type": "ambiguous_master_name",
                        "ticker": master.get("ticker", ""),
                        "isin": master.get("isin_cd", ""),
                        "master_name": master.get("name", ""),
                        "kind_ticker_name": notice["ticker_name"],
                        "kind_listing_date": notice["listing_date"],
                        "kind_receipt_no": notice["kind_receipt_no"],
                        "kind_search_url": notice["kind_search_url"],
                        "note": "Match by ISIN in the KIND original notice before use.",
                    }
                )
        else:
            review_rows.append(
                {
                    "review_type": "no_kind_name_match",
                    "ticker": master.get("ticker", ""),
                    "isin": master.get("isin_cd", ""),
                    "master_name": master.get("name", ""),
                    "kind_ticker_name": "",
                    "kind_ticker_code": "",
                    "kind_listing_date": "",
                    "kind_receipt_no": "",
                    "kind_search_url": "",
                    "note": "Use first-traded date as provisional candidate, then seek KIND original notice or issuer page.",
                }
            )
        out_rows.append(base)

    for notice in ledger_rows:
        if notice["kind_receipt_no"] not in matched_receipts:
            review_rows.append(
                {
                    "review_type": "kind_notice_not_in_current_master",
                    "ticker": "",
                    "isin": "",
                    "master_name": "",
                    "kind_ticker_name": notice["ticker_name"],
                    "kind_ticker_code": notice.get("kind_ticker_code", ""),
                    "kind_listing_date": notice["listing_date"],
                    "kind_receipt_no": notice["kind_receipt_no"],
                    "kind_search_url": notice["kind_search_url"],
                    "note": "Likely delisted, renamed, or absent from the current master; do not force-map by name.",
                }
            )

    write_csv(args.output, out_rows, OUTPUT_FIELDS)
    write_csv(
        args.review_output,
        review_rows,
        [
            "review_type",
            "ticker",
            "isin",
            "master_name",
            "kind_ticker_name",
            "kind_ticker_code",
            "kind_listing_date",
            "kind_receipt_no",
            "kind_search_url",
            "note",
        ],
    )

    counts = defaultdict(int)
    for row in out_rows:
        counts[row["listing_date_status"]] += 1
    print(f"Master rows: {len(out_rows):,}")
    for status, count in sorted(counts.items()):
        print(f"{status}: {count:,}")
    print(f"Review queue rows: {len(review_rows):,}")
    print(f"Wrote: {args.output}")
    print(f"Wrote: {args.review_output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
