#!/usr/bin/env python3
"""Apply P0 ETF listing-date verifications from official KIND issue summaries.

The values below were manually read from public KIND ETF issue-summary pages.
The script updates only the four explicit ticker/ISIN pairs and preserves all
other enrichment and review-queue rows unchanged.
"""

from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
from pathlib import Path

KIND_BASE = (
    "https://kind.krx.co.kr/disclosure/etfisudetail.do?method="
    "searchEtfIsuSummary&strIsurCd="
)
VERIFICATIONS = {
    "069500": {
        "isin": "KR7069500007",
        "listing_date": "2002-10-14",
        "kind_code": "06950",
        "title": "삼성 KODEX 200증권상장지수투자신탁(주식)",
    },
    "069660": {
        "isin": "KR7069660009",
        "listing_date": "2002-10-14",
        "kind_code": "06966",
        "title": "키움 KIWOOM 200 상장지수증권투자신탁[주식]",
    },
    "102110": {
        "isin": "KR7102110004",
        "listing_date": "2008-04-03",
        "kind_code": "10211",
        "title": "미래에셋 TIGER 200증권상장지수투자신탁(주식)",
    },
    "220130": {
        "isin": "KR7220130009",
        "listing_date": "2015-06-08",
        "kind_code": "22013",
        "title": "신한 SOL 차이나강소기업CSI500증권상장지수투자신탁(주식-파생형)(합성 H)",
    },
}


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def write_csv(path: Path, fields: list[str], rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--enrichment", type=Path, required=True)
    parser.add_argument("--queue", type=Path, required=True)
    parser.add_argument("--output-enrichment", type=Path, required=True)
    parser.add_argument("--output-queue", type=Path, required=True)
    parser.add_argument("--evidence-output", type=Path, required=True)
    args = parser.parse_args()

    checked_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    enrichment_fields, enrichment_rows = read_csv(args.enrichment)
    queue_fields, queue_rows = read_csv(args.queue)
    evidence_rows: list[dict[str, str]] = []
    applied: set[str] = set()

    for row in enrichment_rows:
        ticker = row.get("ticker", "")
        verification = VERIFICATIONS.get(ticker)
        if not verification:
            continue
        if row.get("isin") != verification["isin"]:
            raise ValueError(f"ISIN mismatch for {ticker}: {row.get('isin')}")
        source_url = KIND_BASE + verification["kind_code"]
        row.update(
            {
                "listing_date": verification["listing_date"],
                "listing_date_status": "verified_official",
                "listing_date_source_type": "krx_kind_etf_issue_summary",
                "listing_date_source_url": source_url,
                "kind_receipt_no": "",
                "verified_at": checked_at,
                "verification_note": (
                    "KRX KIND ETF 종목상세에서 상장일·표준코드(ISIN)·종목코드를 직접 교차확인했습니다."
                ),
            }
        )
        applied.add(ticker)
        evidence_rows.append(
            {
                "ticker": ticker,
                "isin": verification["isin"],
                "candidate_listing_date": verification["listing_date"],
                "candidate_first_traded_date": "",
                "source_rank": "1",
                "source_type": "krx_kind_etf_issue_summary",
                "source_url": source_url,
                "source_document_id": verification["kind_code"],
                "source_document_title": verification["title"],
                "evidence_quote": (
                    f"표준코드 {verification['isin']}; 종목코드 {ticker}; 상장일 {verification['listing_date']}"
                ),
                "match_basis": "isin",
                "checked_at": checked_at,
                "checked_by": "Manus AI",
                "review_status": "accepted",
            }
        )

    if applied != set(VERIFICATIONS):
        raise ValueError(f"Could not apply all P0 verifications; applied={sorted(applied)}")

    for row in queue_rows:
        ticker = row.get("ticker", "")
        verification = VERIFICATIONS.get(ticker)
        if not verification:
            continue
        source_url = KIND_BASE + verification["kind_code"]
        row.update(
            {
                "review_status": "accepted",
                "candidate_listing_date": verification["listing_date"],
                "evidence_url": source_url,
                "source_document_id": verification["kind_code"],
                "source_document_title": verification["title"],
                "evidence_quote": (
                    f"표준코드 {verification['isin']}; 종목코드 {ticker}; 상장일 {verification['listing_date']}"
                ),
                "match_basis": "isin",
                "reviewer": "Manus AI",
                "reviewed_at": checked_at,
                "next_action": "없음 — KIND 공식 증적 검증 완료",
                "verification_note": "KIND ETF 종목상세의 상장일·ISIN·종목코드 일치로 승인되었습니다.",
            }
        )

    evidence_fields = [
        "ticker", "isin", "candidate_listing_date", "candidate_first_traded_date",
        "source_rank", "source_type", "source_url", "source_document_id",
        "source_document_title", "evidence_quote", "match_basis", "checked_at",
        "checked_by", "review_status",
    ]
    write_csv(args.output_enrichment, enrichment_fields, enrichment_rows)
    write_csv(args.output_queue, queue_fields, queue_rows)
    write_csv(args.evidence_output, evidence_fields, evidence_rows)
    print(f"Verified KIND rows: {len(evidence_rows)}")
    print(f"Wrote: {args.output_enrichment}")
    print(f"Wrote: {args.output_queue}")
    print(f"Wrote: {args.evidence_output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
