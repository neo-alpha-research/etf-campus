#!/usr/bin/env python3
"""Summarize and validate a KIND ETF new-listing notice ledger."""

from __future__ import annotations

import argparse
import csv
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("ledger", type=Path)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()

    with args.ledger.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))

    required = {
        "ticker_name",
        "listing_date",
        "filed_at",
        "kind_receipt_no",
        "report_title",
        "kind_search_url",
        "source_type",
        "verification_status",
    }
    missing = required.difference(rows[0] if rows else {})
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")

    receipt_counts = Counter(row["kind_receipt_no"] for row in rows)
    duplicate_receipts = [key for key, count in receipt_counts.items() if count > 1]
    invalid_dates = []
    source_types = Counter()
    statuses = Counter()
    per_year = Counter()
    names = defaultdict(list)

    for row in rows:
        try:
            day = date.fromisoformat(row["listing_date"])
        except ValueError:
            invalid_dates.append(row)
            continue
        per_year[day.year] += 1
        source_types[row["source_type"]] += 1
        statuses[row["verification_status"]] += 1
        names[row["ticker_name"]].append(row)

    repeated_names = {
        name: values
        for name, values in names.items()
        if len(values) > 1 and len({item["listing_date"] for item in values}) > 1
    }
    earliest = min((row["listing_date"] for row in rows), default="")
    latest = max((row["listing_date"] for row in rows), default="")

    lines = [
        "# KIND ETF 신규상장 공시 원장 검수 결과",
        "",
        f"- 원장 행 수: **{len(rows):,}**",
        f"- 고유 공시번호: **{len(receipt_counts):,}**",
        f"- 상장일 범위: **{earliest} ~ {latest}**",
        f"- 중복 공시번호: **{len(duplicate_receipts):,}**",
        f"- 형식 오류 상장일: **{len(invalid_dates):,}**",
        f"- 동일 표시명·서로 다른 상장일: **{len(repeated_names):,}**",
        "",
        "## 연도별 공시 수",
        "",
        "| 연도 | 공시 수 |",
        "| ---: | ---: |",
    ]
    lines.extend(f"| {year} | {count:,} |" for year, count in sorted(per_year.items()))
    lines.extend(["", "## 상태별 수", "", "| 상태 | 수 |", "| --- | ---: |"])
    lines.extend(f"| `{status}` | {count:,} |" for status, count in sorted(statuses.items()))
    lines.extend(["", "## 원천 유형별 수", "", "| 원천 유형 | 수 |", "| --- | ---: |"])
    lines.extend(f"| `{source}` | {count:,} |" for source, count in sorted(source_types.items()))
    lines.extend(
        [
            "",
            "## 검수 결론",
            "",
            "각 행은 KIND ETF 공시 검색 결과의 `신규상장(..., 상장일 YYYY.MM.DD)` 제목과 공시번호를 함께 보존한다. "
            "공시번호 중복과 상장일 형식 오류가 없으면, 제목 기준 상장일 후보 원장으로 사용 가능하다. "
            "그러나 현 원장은 KIND 상세 원문에서 ISIN을 교차 추출하지 않았으므로, `verified_official`이 아니라 "
            "`official_notice_pending_isin` 상태를 유지해야 한다.",
        ]
    )
    if repeated_names:
        lines.extend(
            [
                "",
                "## 동일 표시명 다회 등장 사례",
                "",
                "동일한 표시명이 서로 다른 상장일로 반복된 종목은 이름만으로 현재 마스터와 결합하면 안 된다. "
                "ISIN 또는 종목코드 교차검증이 필요하다.",
                "",
                "| 표시명 | 공시 수 | 상장일 |",
                "| --- | ---: | --- |",
            ]
        )
        for name, values in sorted(repeated_names.items())[:50]:
            days = ", ".join(sorted({item["listing_date"] for item in values}))
            lines.append(f"| {name} | {len(values)} | {days} |")

    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {args.report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
