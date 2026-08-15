#!/usr/bin/env python3
"""Collect Korean ETF listing dates from official KRX KIND ETF disclosure search pages.

This collector deliberately treats a KIND search-result title as an official notice
source but *not* as ISIN-cross-validated evidence.  It writes an auditable raw notice
ledger and, when a local ETF master CSV is supplied, a merge-ready enrichment file.

No third-party endpoint is used.  The source is the public KRX KIND ETF disclosure
search screen.  The collector never overwrites a master file; downstream validation
must decide how to merge the output.
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
import time
from dataclasses import asdict, dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Iterable
from urllib.parse import urlencode

import requests
from bs4 import BeautifulSoup

KIND_SEARCH_URL = (
    "https://kind.krx.co.kr/disclosure/disclosurebystocktype.do"
)
LISTING_TITLE_RE = re.compile(
    r"^신규상장\(.+?,\s*상장일\s*(\d{4})\.(\d{2})\.(\d{2})\)\s*$"
)
RECEIPT_RE = re.compile(r"openDisclsViewer\('([0-9]+)'\s*,\s*'[^']*'\)")
TICKER_CODE_RE = re.compile(r"etfisusummary_open\('([^']+)'\)")


@dataclass(frozen=True)
class KindNotice:
    ticker_name: str
    kind_ticker_code: str
    listing_date: str
    filed_at: str
    kind_receipt_no: str
    report_title: str
    kind_search_url: str
    source_type: str
    verification_status: str
    collected_at: str


def iter_months(start_year: int, end_day: date) -> Iterable[tuple[date, date]]:
    """Yield inclusive calendar months from January of start_year to end_day."""
    year, month = start_year, 1
    while (year, month) <= (end_day.year, end_day.month):
        month_start = date(year, month, 1)
        if month == 12:
            next_month = date(year + 1, 1, 1)
        else:
            next_month = date(year, month + 1, 1)
        month_end = min(end_day, date.fromordinal(next_month.toordinal() - 1))
        yield month_start, month_end
        if month == 12:
            year, month = year + 1, 1
        else:
            month += 1


def normalize_name(value: str) -> str:
    """Use a conservative comparison key for ETF display names."""
    return re.sub(r"[^0-9A-Z가-힣]", "", (value or "").upper())


def build_search_url(start: date, end: date, page_index: int = 1) -> str:
    params = {
        "method": "searchDisclosureByStockTypeEtfSub",
        "forward": "disclosurebystocktype_etf_sub",
        "currentPageSize": "100",
        "pageIndex": str(page_index),
        "orderMode": "1",
        "orderStat": "D",
        "etfIsuSrtCd": "",
        "reportCd": "",
        "reportTmp": "",
        "etfIsuSrtNm": "",
        "reportNm": "신규상장",
        "fromDate": start.isoformat(),
        "toDate": end.isoformat(),
    }
    return f"{KIND_SEARCH_URL}?{urlencode(params)}"


def parse_notice_rows(html: str, source_url: str, collected_at: str) -> list[KindNotice]:
    """Parse only the formal ETF listing-title pattern from one KIND result page."""
    soup = BeautifulSoup(html, "html.parser")
    notices: list[KindNotice] = []

    for row in soup.select("tr"):
        cells = row.find_all("td")
        if len(cells) < 3:
            continue
        notice_link = next(
            (
                anchor
                for cell in cells
                for anchor in cell.find_all("a")
                if "openDisclsViewer" in (anchor.get("onclick") or "")
            ),
            None,
        )
        if notice_link is None:
            continue
        report_title = " ".join(notice_link.get_text(" ", strip=True).split())
        title_match = LISTING_TITLE_RE.match(report_title)
        receipt_match = RECEIPT_RE.search(notice_link.get("onclick") or "")
        if title_match is None or receipt_match is None:
            continue

        ticker_link = row.find("a", id="etfisusum")
        ticker_name = " ".join(
            (ticker_link.get("title") if ticker_link else "")
            .strip()
            .split()
        )
        ticker_code_match = TICKER_CODE_RE.search(
            ticker_link.get("onclick") if ticker_link else ""
        )
        kind_ticker_code = ticker_code_match.group(1) if ticker_code_match else ""
        # KIND's current result table has 번호, 시간, 종목명, 공시제목, 제출인
        # columns.  Use the table header/row convention rather than the visual
        # position of the report link, which can change with icon columns.
        filed_at = " ".join(cells[1].get_text(" ", strip=True).split())
        listing_day = "-".join(title_match.groups())
        notices.append(
            KindNotice(
                ticker_name=ticker_name,
                kind_ticker_code=kind_ticker_code,
                listing_date=listing_day,
                filed_at=filed_at,
                kind_receipt_no=receipt_match.group(1),
                report_title=report_title,
                kind_search_url=source_url,
                source_type="kind_listing_notice_title",
                verification_status="official_notice_pending_isin",
                collected_at=collected_at,
            )
        )
    return notices


def page_count(html: str) -> int:
    """Read KIND's displayed current/total page count; default to one safely."""
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(" ", strip=True)
    match = re.search(r"전체\s*\d+\s*건\s*:\s*\d+\s*/\s*(\d+)", text)
    return int(match.group(1)) if match else 1


def fetch(session: requests.Session, url: str, timeout: int) -> str:
    response = session.get(url, timeout=timeout)
    response.raise_for_status()
    # KIND's response header does not reliably declare the UTF-8 encoding used
    # by its Korean disclosure titles, so do not accept Requests' guessed codec.
    response.encoding = "utf-8"
    if "해당 서비스를 제공하지 않습니다" in response.text:
        raise RuntimeError("KIND returned a service-unavailable page")
    return response.text


def collect_notices(
    start_year: int,
    end_day: date,
    throttle_seconds: float,
    timeout: int,
) -> tuple[list[KindNotice], list[dict[str, str]]]:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "ETF-Campus-Listing-Date-Collector/1.0 "
                "(public KIND disclosure search; contact: data@etfcampus.kr)"
            ),
            "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
        }
    )
    collected_at = datetime.now().astimezone().replace(microsecond=0).isoformat()
    notices_by_receipt: dict[str, KindNotice] = {}
    errors: list[dict[str, str]] = []

    for month_start, month_end in iter_months(start_year, end_day):
        first_url = build_search_url(month_start, month_end)
        try:
            first_html = fetch(session, first_url, timeout)
            pages = page_count(first_html)
            page_htmls = [(1, first_url, first_html)]
            for index in range(2, pages + 1):
                url = build_search_url(month_start, month_end, index)
                time.sleep(throttle_seconds)
                page_htmls.append((index, url, fetch(session, url, timeout)))

            for _, url, html in page_htmls:
                for notice in parse_notice_rows(html, url, collected_at):
                    prior = notices_by_receipt.get(notice.kind_receipt_no)
                    if prior is None or notice.filed_at > prior.filed_at:
                        notices_by_receipt[notice.kind_receipt_no] = notice
            print(
                f"[OK] {month_start:%Y-%m}: pages={pages}, "
                f"notices={sum(len(parse_notice_rows(html, url, collected_at)) for _, url, html in page_htmls)}",
                flush=True,
            )
        except (requests.RequestException, RuntimeError, ValueError) as error:
            errors.append(
                {
                    "month": month_start.strftime("%Y-%m"),
                    "search_url": first_url,
                    "error": str(error),
                }
            )
            print(f"[ERROR] {month_start:%Y-%m}: {error}", file=sys.stderr, flush=True)
        time.sleep(throttle_seconds)

    return sorted(
        notices_by_receipt.values(),
        key=lambda item: (item.listing_date, item.kind_receipt_no),
    ), errors


def write_csv(path: Path, rows: Iterable[dict[str, str]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def load_master(path: Path) -> tuple[list[dict[str, str]], list[str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            raise ValueError("Master CSV has no header")
        required = {"ticker", "isin_cd", "name"}
        missing = required.difference(reader.fieldnames)
        if missing:
            raise ValueError(f"Master CSV misses fields: {', '.join(sorted(missing))}")
        return list(reader), list(reader.fieldnames)


def merge_with_master(
    notices: list[KindNotice], master_rows: list[dict[str, str]]
) -> list[dict[str, str]]:
    """Produce an auditable merge file without mutating the source master."""
    notices_by_name: dict[str, list[KindNotice]] = {}
    for notice in notices:
        notices_by_name.setdefault(normalize_name(notice.ticker_name), []).append(notice)

    merged: list[dict[str, str]] = []
    for row in master_rows:
        matched = notices_by_name.get(normalize_name(row.get("name", "")), [])
        row_out = {
            "ticker": row.get("ticker", ""),
            "isin": row.get("isin_cd", ""),
            "master_name": row.get("name", ""),
            "listing_date": "",
            "first_traded_date": "",
            "fund_inception_date": "",
            "listing_date_status": "unavailable",
            "listing_date_source_type": "",
            "listing_date_source_url": "",
            "kind_receipt_no": "",
            "verified_at": "",
            "verification_note": "No KIND notice title matched the current master name.",
        }
        if len(matched) == 1:
            notice = matched[0]
            row_out.update(
                {
                    "listing_date": notice.listing_date,
                    "listing_date_status": "official_notice_pending_isin",
                    "listing_date_source_type": notice.source_type,
                    "listing_date_source_url": notice.kind_search_url,
                    "kind_receipt_no": notice.kind_receipt_no,
                    "verification_note": (
                        "Official KIND ETF 신규상장 notice title matched the current "
                        "master name exactly after conservative normalization; ISIN raw "
                        "notice parsing remains required before verified_official."
                    ),
                }
            )
        elif len(matched) > 1:
            row_out.update(
                {
                    "listing_date_status": "manual_review",
                    "verification_note": (
                        f"{len(matched)} KIND listing notices match the normalized name; "
                        "select by ISIN or ticker after reviewing source documents."
                    ),
                }
            )
        merged.append(row_out)
    return merged


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-dir", type=Path, required=True, help="Directory for generated CSV files."
    )
    parser.add_argument(
        "--master-csv",
        type=Path,
        help="Optional ETF master CSV with ticker, isin_cd, and name columns.",
    )
    parser.add_argument(
        "--start-year",
        type=int,
        default=2002,
        help="First year to query; Korean ETF market began in 2002.",
    )
    parser.add_argument(
        "--end-date",
        default=date.today().isoformat(),
        help="Inclusive ISO date (YYYY-MM-DD), default: today.",
    )
    parser.add_argument(
        "--throttle-seconds",
        type=float,
        default=0.35,
        help="Delay between KIND requests; do not use zero for bulk collection.",
    )
    parser.add_argument("--timeout", type=int, default=30, help="HTTP timeout in seconds.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    end_day = date.fromisoformat(args.end_date)
    if args.start_year < 2002 or args.start_year > end_day.year:
        raise ValueError("--start-year must be no earlier than 2002 and no later than --end-date")
    if args.throttle_seconds < 0.2:
        raise ValueError("--throttle-seconds must be at least 0.2 seconds")

    notices, errors = collect_notices(
        args.start_year, end_day, args.throttle_seconds, args.timeout
    )
    raw_path = args.output_dir / "kind_etf_listing_notices.csv"
    error_path = args.output_dir / "kind_etf_listing_collection_errors.csv"
    write_csv(raw_path, (asdict(item) for item in notices), list(KindNotice.__dataclass_fields__))
    write_csv(error_path, errors, ["month", "search_url", "error"])

    if args.master_csv:
        master_rows, _ = load_master(args.master_csv)
        merged_rows = merge_with_master(notices, master_rows)
        merge_path = args.output_dir / "etf_listing_dates_enrichment.csv"
        write_csv(
            merge_path,
            merged_rows,
            [
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
            ],
        )
        print(f"Wrote merge-ready dataset: {merge_path}")

    print(f"Wrote official KIND notice ledger: {raw_path} ({len(notices)} notices)")
    print(f"Wrote collection error ledger: {error_path} ({len(errors)} months with errors)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
