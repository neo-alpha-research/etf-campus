#!/usr/bin/env python3
"""Apply manually verified KIND ETF issue-summary records to ETF Campus CSVs."""

from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
from pathlib import Path

KIND_BASE = (
    "https://kind.krx.co.kr/disclosure/etfisudetail.do?method="
    "searchEtfIsuSummary&strIsurCd="
)
EVIDENCE_FIELDS = [
    "ticker", "isin", "candidate_listing_date", "candidate_first_traded_date",
    "source_rank", "source_type", "source_url", "source_document_id",
    "source_document_title", "evidence_quote", "match_basis", "checked_at",
    "checked_by", "review_status",
]


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
    parser.add_argument("--verifications", type=Path, required=True)
    parser.add_argument("--enrichment", type=Path, required=True)
    parser.add_argument("--queue", type=Path, required=True)
    parser.add_argument("--output-enrichment", type=Path, required=True)
    parser.add_argument("--output-queue", type=Path, required=True)
    parser.add_argument("--evidence-output", type=Path, required=True)
    args = parser.parse_args()

    _, verification_rows = read_csv(args.verifications)
    enrichment_fields, enrichment_rows = read_csv(args.enrichment)
    queue_fields, queue_rows = read_csv(args.queue)
    verification_by_ticker = {row["ticker"]: row for row in verification_rows}
    checked_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    applied: set[str] = set()
    evidence_rows: list[dict[str, str]] = []

    for row in enrichment_rows:
        ticker = row.get("ticker", "")
        verification = verification_by_ticker.get(ticker)
        if not verification:
            continue
        if row.get("isin") != verification.get("isin"):
            raise ValueError(f"ISIN mismatch for {ticker}")
        if row.get("listing_date_status") == "verified_official":
            raise ValueError(f"{ticker} is already verified")
        kind_code = verification["kind_code"]
        source_url = KIND_BASE + kind_code
        listing_date = verification["listing_date"]
        title = f"KIND ETF 종목상세 — {row.get('master_name', '')}"
        row.update(
            {
                "listing_date": listing_date,
                "listing_date_status": "verified_official",
                "listing_date_source_type": "krx_kind_etf_issue_summary",
                "listing_date_source_url": source_url,
                "kind_receipt_no": "",
                "verified_at": checked_at,
                "verification_note": "KRX KIND ETF 종목상세에서 상장일·표준코드(ISIN)·종목코드를 직접 교차확인했습니다.",
            }
        )
        applied.add(ticker)
        evidence_rows.append(
            {
                "ticker": ticker,
                "isin": row["isin"],
                "candidate_listing_date": listing_date,
                "candidate_first_traded_date": "",
                "source_rank": "1",
                "source_type": "krx_kind_etf_issue_summary",
                "source_url": source_url,
                "source_document_id": kind_code,
                "source_document_title": title,
                "evidence_quote": f"표준코드 {row['isin']}; 종목코드 {ticker}; 상장일 {listing_date}",
                "match_basis": "isin",
                "checked_at": checked_at,
                "checked_by": "Manus AI",
                "review_status": "accepted",
            }
        )

    expected = set(verification_by_ticker)
    if applied != expected:
        raise ValueError(f"Could not apply all verifications; applied={sorted(applied)}")

    for row in queue_rows:
        ticker = row.get("ticker", "")
        verification = verification_by_ticker.get(ticker)
        if not verification:
            continue
        source_url = KIND_BASE + verification["kind_code"]
        listing_date = verification["listing_date"]
        row.update(
            {
                "review_status": "accepted",
                "candidate_listing_date": listing_date,
                "evidence_url": source_url,
                "source_document_id": verification["kind_code"],
                "source_document_title": f"KIND ETF 종목상세 — {row.get('master_name', '')}",
                "evidence_quote": f"표준코드 {row['isin']}; 종목코드 {ticker}; 상장일 {listing_date}",
                "match_basis": "isin",
                "reviewer": "Manus AI",
                "reviewed_at": checked_at,
                "next_action": "없음 — KIND 공식 증적 검증 완료",
                "verification_note": "KIND ETF 종목상세의 상장일·ISIN·종목코드 일치로 승인되었습니다.",
            }
        )

    write_csv(args.output_enrichment, enrichment_fields, enrichment_rows)
    write_csv(args.output_queue, queue_fields, queue_rows)
    write_csv(args.evidence_output, EVIDENCE_FIELDS, evidence_rows)
    print(f"Verified KIND rows: {len(evidence_rows)}")
    print(f"Wrote: {args.output_enrichment}")
    print(f"Wrote: {args.output_queue}")
    print(f"Wrote: {args.evidence_output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
