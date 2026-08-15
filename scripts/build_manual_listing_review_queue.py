#!/usr/bin/env python3
"""Create an auditable manual review queue from unavailable ETF listing-date rows."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

P0_TICKERS = {"069500", "069660", "102110", "220130"}
ISSUER_BY_TICKER = {
    "069500": "삼성자산운용",
    "069660": "키움투자자산운용",
    "091160": "삼성자산운용",
    "091170": "삼성자산운용",
    "091180": "삼성자산운용",
    "091220": "미래에셋자산운용",
    "091230": "미래에셋자산운용",
    "099140": "삼성자산운용",
    "100910": "키움투자자산운용",
    "101280": "삼성자산운용",
    "102110": "미래에셋자산운용",
    "102780": "삼성자산운용",
    "102960": "삼성자산운용",
    "102970": "삼성자산운용",
    "104520": "키움투자자산운용",
    "104530": "키움투자자산운용",
    "169950": "삼성자산운용",
    "174350": "미래에셋자산운용",
    "200250": "키움투자자산운용",
    "204480": "미래에셋자산운용",
    "220130": "신한자산운용",
}

FIELDS = [
    "priority",
    "review_status",
    "ticker",
    "isin",
    "master_name",
    "issuer_group",
    "search_key_1_isin",
    "search_key_2_ticker",
    "search_key_3_current_name",
    "preferred_source_1",
    "preferred_source_2",
    "candidate_listing_date",
    "candidate_first_traded_date",
    "evidence_url",
    "source_document_id",
    "source_document_title",
    "evidence_quote",
    "match_basis",
    "reviewer",
    "reviewed_at",
    "next_action",
    "verification_note",
]


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--enrichment", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    rows = read_csv(args.enrichment)
    unavailable = [row for row in rows if row.get("listing_date_status") == "unavailable"]
    queue: list[dict[str, str]] = []
    for row in unavailable:
        ticker = row.get("ticker", "")
        issuer = ISSUER_BY_TICKER.get(ticker, "확인 필요")
        is_p0 = ticker in P0_TICKERS
        queue.append(
            {
                "priority": "P0" if is_p0 else "P1",
                "review_status": "not_started",
                "ticker": ticker,
                "isin": row.get("isin", ""),
                "master_name": row.get("master_name", ""),
                "issuer_group": issuer,
                "search_key_1_isin": row.get("isin", ""),
                "search_key_2_ticker": ticker,
                "search_key_3_current_name": row.get("master_name", ""),
                "preferred_source_1": "KRX KIND/레거시 KRX 상장 공고",
                "preferred_source_2": f"{issuer} 공식 상품·보관 문서",
                "candidate_listing_date": "",
                "candidate_first_traded_date": "",
                "evidence_url": "",
                "source_document_id": "",
                "source_document_title": "",
                "evidence_quote": "",
                "match_basis": "",
                "reviewer": "",
                "reviewed_at": "",
                "next_action": "ISIN으로 KRX·운용사 문서를 검색하고 상장일·ISIN/단축코드 동시 확인",
                "verification_note": "KIND 수집 원장에 자동 매칭되지 않아 수동 증적 확인이 필요합니다.",
            }
        )
    queue.sort(key=lambda row: (row["priority"], row["issuer_group"], row["ticker"]))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(queue)
    print(f"Wrote {args.output} ({len(queue)} rows)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
