#!/usr/bin/env python3
"""Collect provisional first-traded dates for ETF rows not matched to KIND notices.

The source is the Korean public Securities Product Price API used by the existing
ETF Campus daily updater. A returned earliest ``basDt`` is explicitly stored as
``provisional_first_trade`` and is never labelled an official listing date.
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from datetime import date
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import requests

BASE_URL = (
    "https://apis.data.go.kr/1160100/service/"
    "GetSecuritiesProductInfoService/getETFPriceInfo"
)
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


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, rows: list[dict[str, str]], fields: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def unwrap_items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    response = payload.get("response") or {}
    body = response.get("body") or {}
    items = body.get("items") or {}
    rows = items.get("item") or []
    return rows if isinstance(rows, list) else [rows]


def fetch_earliest_trade(
    session: requests.Session, service_key: str, ticker: str, start: str, end: str
) -> tuple[str, str]:
    """Return earliest basDt and a redacted provenance URL from the official API."""
    page = 1
    dates: list[str] = []
    while True:
        params = {
            "serviceKey": service_key,
            "resultType": "json",
            "srtnCd": ticker,
            "beginBasDt": start,
            "endBasDt": end,
            "numOfRows": "1000",
            "pageNo": str(page),
        }
        response = session.get(BASE_URL, params=params, timeout=30)
        response.raise_for_status()
        payload = response.json()
        rows = unwrap_items(payload)
        dates.extend(str(row.get("basDt") or "") for row in rows)
        if len(rows) < 1000:
            break
        page += 1

    valid = sorted(value for value in dates if len(value) == 8 and value.isdigit())
    source_params = {
        "resultType": "json",
        "srtnCd": ticker,
        "beginBasDt": start,
        "endBasDt": end,
        "numOfRows": "1000",
    }
    source_url = f"{BASE_URL}?{urlencode(source_params)}"
    return (f"{valid[0][:4]}-{valid[0][4:6]}-{valid[0][6:]}" if valid else "", source_url)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--enrichment", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--errors", type=Path, required=True)
    parser.add_argument("--start-date", default="20020101")
    parser.add_argument("--end-date", default=date.today().strftime("%Y%m%d"))
    args = parser.parse_args()

    service_key = os.environ.get("DATA_GO_KR_SERVICE_KEY", "").strip()
    if not service_key:
        print("DATA_GO_KR_SERVICE_KEY is not configured; no API requests were sent.", file=sys.stderr)
        return 2

    rows = read_csv(args.enrichment)
    unresolved = [row for row in rows if row.get("listing_date_status") == "unavailable"]
    session = requests.Session()
    session.headers.update({"User-Agent": "ETF-Campus-first-trade-candidates/1.0"})
    errors: list[dict[str, str]] = []

    for row in unresolved:
        ticker = row.get("ticker", "")
        try:
            first_date, source_url = fetch_earliest_trade(
                session, service_key, ticker, args.start_date, args.end_date
            )
            if first_date:
                row.update(
                    {
                        "first_traded_date": first_date,
                        "listing_date_status": "provisional_first_trade",
                        "listing_date_source_type": "fsc_price_api_first_seen",
                        "listing_date_source_url": source_url,
                        "verification_note": (
                            "금융위원회 증권상품시세정보 API에서 확인한 최초 기준일입니다. "
                            "공식 상장일이 아니므로 KIND 또는 운용사 원문 검증 전에는 상장일로 표시하지 마세요."
                        ),
                    }
                )
                print(f"[OK] {ticker}: {first_date}")
            else:
                row["verification_note"] = (
                    "공식 KIND 공시와 금융위원회 시세 API에서 모두 확인하지 못했습니다. 수동 검토가 필요합니다."
                )
                errors.append({"ticker": ticker, "error": "no price rows returned"})
                print(f"[EMPTY] {ticker}", file=sys.stderr)
        except (requests.RequestException, ValueError, KeyError) as error:
            errors.append({"ticker": ticker, "error": str(error)})
            row["verification_note"] = f"최초거래일 API 조회 실패: {error}"
            print(f"[ERROR] {ticker}: {error}", file=sys.stderr)

    write_csv(args.output, rows, OUTPUT_FIELDS)
    write_csv(args.errors, errors, ["ticker", "error"])
    print(f"Wrote: {args.output}")
    print(f"Wrote: {args.errors}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
