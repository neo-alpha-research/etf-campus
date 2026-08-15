#!/usr/bin/env python3
"""Verify unavailable ETF listing dates from official KIND issue-summary pages.

For regular six-character ETF tickers, KIND's ``strIsurCd`` is the ticker without
its final series digit. Each candidate is accepted only if KIND's standard code
and stock code exactly equal the current master row.
"""

from __future__ import annotations

import argparse
import csv
import re
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup

BASE_URL = (
    "https://kind.krx.co.kr/disclosure/etfisudetail.do?method="
    "searchEtfIsuSummary&strIsurCd="
)

CANDIDATE_FIELDS = [
    "ticker", "isin", "master_name", "kind_code", "kind_name", "kind_isin",
    "kind_ticker", "listing_date", "source_url", "verification_result",
    "error", "collected_at",
]


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CANDIDATE_FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def text(value: object) -> str:
    return " ".join(str(value or "").split())


def parse_summary(html: str) -> dict[str, str]:
    soup = BeautifulSoup(html, "html.parser")
    result: dict[str, str] = {}
    for header in soup.find_all(["th", "dt"]):
        key = text(header.get_text(" ", strip=True))
        if key not in {"한글명", "표준코드", "종목코드", "상장일"}:
            continue
        value = header.find_next(["td", "dd"])
        if value:
            result[key] = text(value.get_text(" ", strip=True))
    return result


def kind_code_for_ticker(ticker: str) -> str:
    if len(ticker) == 6 and ticker.isalnum():
        return ticker[:-1]
    return ""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--enrichment", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--throttle-seconds", type=float, default=0.4)
    args = parser.parse_args()

    source_rows = read_csv(args.enrichment)
    targets = [row for row in source_rows if row.get("listing_date_status") == "unavailable"]
    session = requests.Session()
    session.headers.update({"User-Agent": "ETF-Campus-KIND-verification/1.0"})
    results: list[dict[str, str]] = []

    for index, row in enumerate(targets, start=1):
        ticker = row.get("ticker", "")
        isin = row.get("isin", "")
        code = kind_code_for_ticker(ticker)
        source_url = BASE_URL + code if code else ""
        record = {
            "ticker": ticker,
            "isin": isin,
            "master_name": row.get("master_name", ""),
            "kind_code": code,
            "kind_name": "",
            "kind_isin": "",
            "kind_ticker": "",
            "listing_date": "",
            "source_url": source_url,
            "verification_result": "rejected",
            "error": "",
            "collected_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        }
        try:
            response = session.get(source_url, timeout=30)
            response.raise_for_status()
            # KIND detail pages are UTF-8; enforce it because requests can infer
            # an incorrect Korean legacy encoding from the response headers.
            response.encoding = "utf-8"
            parsed = parse_summary(response.text)
            record.update(
                {
                    "kind_name": parsed.get("한글명", ""),
                    "kind_isin": parsed.get("표준코드", ""),
                    "kind_ticker": parsed.get("종목코드", ""),
                    "listing_date": parsed.get("상장일", "").replace(".", "-"),
                }
            )
            if not parsed:
                record["error"] = "KIND summary fields not found"
            elif record["kind_isin"] != isin:
                record["error"] = f"ISIN mismatch: {record['kind_isin']}"
            elif record["kind_ticker"] != ticker:
                record["error"] = f"ticker mismatch: {record['kind_ticker']}"
            elif not re.fullmatch(r"\d{4}-\d{2}-\d{2}", record["listing_date"]):
                record["error"] = f"invalid listing_date: {record['listing_date']}"
            else:
                record["verification_result"] = "accepted"
        except requests.RequestException as error:
            record["error"] = str(error)
        results.append(record)
        print(f"[{index}/{len(targets)}] {ticker}: {record['verification_result']} {record['error']}")
        time.sleep(args.throttle_seconds)

    write_csv(args.output, results)
    accepted = sum(row["verification_result"] == "accepted" for row in results)
    print(f"Accepted: {accepted}/{len(results)}")
    print(f"Wrote: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
