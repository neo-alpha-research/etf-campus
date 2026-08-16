#!/usr/bin/env python3
"""Upsert immutable official-source rows referenced by manual distribution events."""
from __future__ import annotations

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "data" / "distributions" / "etf_distribution_source_documents.csv"


def main() -> None:
    with PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        fields = reader.fieldnames or []
        rows = {row["source_id"]: row for row in reader if row.get("source_id")}

    updates = [
        {
            "source_id": "issuer:rise:266160:20260816:table",
            "etf_id": "KR7266160001",
            "ticker": "266160",
            "source_owner": "RISE ETF",
            "source_type": "issuer_product_distribution_table",
            "source_document_key": "4454",
            "source_title": "RISE 고배당 공식 상품 페이지 분배금 지급현황",
            "source_url": "https://riseetf.co.kr/prod/finderDetail/4454",
            "published_at": "2026-08-16",
            "retrieved_at": "2026-08-16T09:05:00+00:00",
            "http_status": "200",
            "media_type": "text/html",
            "content_hash_sha256": "e5b9de3a545765061378a6bc36f9a96527d073890d7ede0bfc04691c3abbca8f",
            "parser_name": "rise_product_distribution_table_v1",
            "parser_version": "1",
            "parse_status": "manual_review",
            "raw_path": "data/distributions/raw/RISE_ETF/2026/08/issuer_rise_266160_20260816_detail.html",
            "source_etf_name": "RISE 고배당",
            "parse_note": "RISE 공식 상품 페이지의 최근 3년 분배금 지급현황. UI 표시용 이벤트만 수기 검증하며 KIND 분배락 공시 연결 전 TR 계산에는 사용하지 않는다.",
        },
        {
            "source_id": "krx:kind:489030:20260729:20260729000622",
            "etf_id": "KR7489030007",
            "ticker": "489030",
            "source_owner": "KRX KIND",
            "source_type": "krx_distribution_disclosure",
            "source_document_key": "20260729000622",
            "source_title": "PLUS 고배당주위클리커버드콜 ETF이익금분배신고(분배금안내)",
            "source_url": "https://kind.krx.co.kr/common/disclsviewer.do?method=search&acptno=20260729000622",
            "published_at": "2026-07-29",
            "retrieved_at": "2026-08-16T08:55:00+00:00",
            "http_status": "200",
            "media_type": "text/html",
            "content_hash_sha256": "c3b4e529ebbd4b657aa24b94e39ee1d559d88ca10b6b6d1d756f5e23439dfdca",
            "parser_name": "krx_kind_distribution_notice_v1",
            "parser_version": "1",
            "parse_status": "manual_review",
            "raw_path": "data/distributions/raw/KRX_KIND/2026/07/krx_kind_489030_20260729_20260729002071_68659.htm",
            "source_etf_name": "PLUS 고배당주위클리커버드콜",
            "parse_note": "KIND 공식 일괄 분배금 공시의 489030 행. 같은 날짜의 KIND 분배락 기준가격 공시와 대조해 UI용 krx_verified 이벤트로 사용하며 TR 계산은 차단한다.",
        },
    ]

    for update in updates:
        rows[update["source_id"]] = {field: update.get(field, "") for field in fields}

    with PATH.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows[source_id] for source_id in sorted(rows))

    print({"upserted": [row["source_id"] for row in updates], "source_count": len(rows)})


if __name__ == "__main__":
    main()
