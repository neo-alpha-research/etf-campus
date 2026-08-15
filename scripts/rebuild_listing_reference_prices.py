#!/usr/bin/env python3
"""Rebuild ETF ITD anchors from KRX KIND listing-reference-price notices.

This tool treats KRX KIND's ``ETF 신규상장 기준가격 안내`` as the authoritative
source for an ETF's initial ITD reference price. It creates a separate immutable
ledger and audit first; legacy return/cache files are changed only with explicit
opt-in flags and are backed up before replacement.

The KRX Open API ETF daily trading service remains the source for daily closing
prices. It does not replace the KIND listing-reference-price notice used here.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import os
import re
import shutil
import sys
import tempfile
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence
from urllib.parse import parse_qs, urljoin, urlparse

import requests
from bs4 import BeautifulSoup

KIND_ETF_SEARCH_URL = (
    "https://kind.krx.co.kr/disclosure/disclosurebystocktype.do"
)
KIND_DISCLOSURE_URL = "https://kind.krx.co.kr/common/disclsviewer.do"
KIND_NOTICE_TITLE = "ETF 신규상장 기준가격 안내"
KIND_SOURCE_NAME = "KRX KIND ETF 신규상장 기준가격 안내"

LEDGER_FIELDS = [
    "ticker",
    "isin",
    "name",
    "listing_date",
    "reference_price",
    "reference_price_currency",
    "source_name",
    "source_receipt_no",
    "source_url",
    "notice_applied_date",
    "notice_title",
    "verification_status",
    "verification_note",
    "fetched_at",
]

AUDIT_FIELDS = [
    "ticker",
    "isin",
    "name",
    "listing_date",
    "existing_anchor_close",
    "official_reference_price",
    "verification_status",
    "source_receipt_no",
    "source_url",
    "reason",
    "checked_at",
]

PLACEHOLDER_TICKERS = {"", "N/A", "NA", "NONE"}


@dataclass(frozen=True)
class ListingNotice:
    receipt_no: str
    title: str
    instrument_name: str
    reference_price: float | None
    applied_date: str | None
    source_url: str


@dataclass(frozen=True)
class Resolution:
    ticker: str
    isin: str
    name: str
    listing_date: str
    existing_anchor_close: float | None
    reference_price: float | None
    status: str
    reason: str
    receipt_no: str = ""
    source_url: str = ""
    notice_applied_date: str = ""
    notice_title: str = ""


def now_kst() -> str:
    return dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).isoformat(timespec="seconds")


def normalize_ticker(value: Any) -> str:
    text = str(value or "").strip().upper()
    if text in PLACEHOLDER_TICKERS:
        return ""
    # ETF tickers are ordinarily six digits. Preserve non-numeric identifiers
    # rather than silently changing their identity.
    if text.isdigit() and len(text) < 6:
        return text.zfill(6)
    return text


def normalize_date(value: Any) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    text = text.replace(".", "-").replace("/", "-")
    match = re.search(r"(\d{4})\D?(\d{1,2})\D?(\d{1,2})", text)
    if not match:
        return None
    try:
        return dt.date(
            int(match.group(1)), int(match.group(2)), int(match.group(3))
        ).isoformat()
    except ValueError:
        return None


def normalize_name(value: Any) -> str:
    """Normalize ETF names only for matching a KIND notice to a master row."""
    return re.sub(r"[^0-9A-Z가-힣]", "", str(value or "").upper())


def names_equivalent(left: Any, right: Any) -> bool:
    """Match historical/current ETF names while ignoring the common 'Fn' label."""
    left_name = normalize_name(left).replace("FN", "")
    right_name = normalize_name(right).replace("FN", "")
    return bool(left_name and right_name and left_name == right_name)


def positive_number(value: Any) -> float | None:
    if value is None:
        return None
    text = str(value).replace(",", "").strip()
    if not text:
        return None
    try:
        number = float(text)
    except ValueError:
        return None
    return number if number > 0 else None


def format_number(value: float | None) -> str:
    if value is None:
        return ""
    return str(int(value)) if value.is_integer() else f"{value:.8f}".rstrip("0").rstrip(".")


def read_csv_rows(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        raise FileNotFoundError(path)
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv_atomic(path: Path, fields: Sequence[str], rows: Iterable[Mapping[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8-sig", newline="", dir=path.parent, delete=False
    ) as handle:
        writer = csv.DictWriter(handle, fieldnames=list(fields), extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in fields})
        temp_name = handle.name
    os.replace(temp_name, path)


def write_json_atomic(path: Path, payload: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2, sort_keys=True)
        handle.write("\n")
        temp_name = handle.name
    os.replace(temp_name, path)


def extract_receipt_no(value: str) -> str | None:
    parsed = urlparse(value)
    query = parse_qs(parsed.query)
    for key in ("acptno", "acptNo", "receiptNo"):
        candidates = query.get(key, [])
        if candidates and re.fullmatch(r"\d{14}", candidates[0]):
            return candidates[0]
    match = re.search(r"(?<!\d)(20\d{12})(?!\d)", value)
    return match.group(1) if match else None


def parse_kind_notice(html: str, receipt_no: str, source_url: str) -> ListingNotice:
    """Extract the official reference price and applied date from one KIND notice."""
    soup = BeautifulSoup(html, "html.parser")
    title = soup.title.get_text(" ", strip=True) if soup.title else KIND_NOTICE_TITLE
    price: float | None = None
    applied_date: str | None = None
    instrument_name = ""

    for row in soup.select("tr"):
        cells = [cell.get_text(" ", strip=True) for cell in row.select("th, td")]
        if len(cells) < 2:
            continue
        label = re.sub(r"\s+", "", cells[0])
        value = " ".join(cells[1:])
        if "종목명" in label and not instrument_name:
            instrument_name = value
        if "기준가격" in label and price is None:
            numeric = re.search(r"\d[\d,]*(?:\.\d+)?", value)
            price = positive_number(numeric.group(0) if numeric else None)
        if "적용일" in label and applied_date is None:
            applied_date = normalize_date(value)

    # Fallback for notices whose table markup was altered but still contains
    # consecutive visible label/value strings.
    text = soup.get_text(" ", strip=True)
    if price is None:
        match = re.search(r"기준가격\s*\(?\s*원\s*\)?\s*[:：]?\s*(\d[\d,]*(?:\.\d+)?)", text)
        price = positive_number(match.group(1) if match else None)
    if applied_date is None:
        match = re.search(r"적용일\s*[:：]?\s*(20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2})", text)
        applied_date = normalize_date(match.group(1) if match else None)

    if not instrument_name:
        title_match = re.search(r"\[([^\]]+)\]", title)
        instrument_name = title_match.group(1).strip() if title_match else ""

    return ListingNotice(
        receipt_no=receipt_no,
        title=title,
        instrument_name=instrument_name,
        reference_price=price,
        applied_date=applied_date,
        source_url=source_url,
    )


def extract_notice_receipts(search_html: str) -> list[str]:
    """Find receipt numbers attached to listing-reference-price notices.

    KIND has changed both link paths and JavaScript handlers over time. The
    parser deliberately accepts receipt numbers in anchors, onclick handlers,
    and table rows, then de-duplicates them in page order.
    """
    soup = BeautifulSoup(search_html, "html.parser")
    found: list[str] = []
    seen: set[str] = set()
    for node in soup.find_all(["a", "tr", "li"]):
        text = node.get_text(" ", strip=True)
        if KIND_NOTICE_TITLE not in text:
            continue
        candidates = re.findall(r"(?<!\d)(20\d{12})(?!\d)", str(node))
        for receipt in candidates:
            if receipt not in seen:
                seen.add(receipt)
                found.append(receipt)
    return found


def request_kind_search(
    session: requests.Session,
    listing_date: str,
    timeout: float,
) -> str:
    """Search KIND by date window, mirroring the official ETF search AJAX form.

    The page's per-ticker filter requires browser autocomplete to populate a
    hidden issuer-code field. A direct text ticker is not reliable. Searching
    one date window and later matching the official notice name/date is both
    more stable and far less repetitive for ETFs listed on the same day.
    """
    date_value = dt.date.fromisoformat(listing_date)
    start = date_value - dt.timedelta(days=14)
    end = date_value + dt.timedelta(days=7)
    response = session.post(
        KIND_ETF_SEARCH_URL,
        data={
            "method": "searchDisclosureByStockTypeEtfSub",
            "forward": "disclosurebystocktype_etf_sub",
            "pageIndex": "1",
            "currentPageSize": "100",
            "etfIsuSrtCd": "",
            "etfIsuSrtNm": "",
            "reportNm": KIND_NOTICE_TITLE,
            "fromDate": start.isoformat(),
            "toDate": end.isoformat(),
            "orderMode": "1",
            "orderStat": "D",
        },
        timeout=timeout,
    )
    response.raise_for_status()
    return response.text


def select_main_document_number(viewer_html: str) -> str | None:
    """Extract the selected KIND main-document number from a disclosure viewer."""
    soup = BeautifulSoup(viewer_html, "html.parser")
    selected = soup.select_one("select#mainDoc option[selected]") or soup.select_one("select#mainDoc option[value]")
    if not selected:
        return None
    value = str(selected.get("value") or "").strip()
    document_number = value.split("|", 1)[0].strip()
    return document_number if re.fullmatch(r"\d{14}", document_number) else None


def extract_kind_content_url(path_response_html: str) -> str | None:
    """Extract the final official external HTML URL returned by KIND searchContents."""
    match = re.search(r"parent\.setPath\(\s*'[^']*'\s*,\s*'([^']+)'", path_response_html)
    if not match:
        return None
    candidate = match.group(1).replace("\\/", "/").strip()
    if not candidate:
        return None
    return urljoin(KIND_DISCLOSURE_URL, candidate)


def request_kind_notice(
    session: requests.Session, receipt_no: str, timeout: float
) -> tuple[str, str]:
    """Load the final KIND-hosted HTML used by the disclosure viewer iframe."""
    viewer = session.get(
        KIND_DISCLOSURE_URL,
        params={"method": "searchInitInfo", "acptNo": receipt_no, "docno": ""},
        timeout=timeout,
    )
    viewer.raise_for_status()
    document_number = select_main_document_number(viewer.text)
    if not document_number:
        raise requests.RequestException(f"KIND main document number unavailable for receipt {receipt_no}")
    path_response = session.post(
        KIND_DISCLOSURE_URL,
        data={
            "method": "searchContents",
            "docNo": document_number,
            "acptNo": receipt_no,
            "sndLocTpCd": "",
            "formUpclssCd": "",
        },
        timeout=timeout,
    )
    path_response.raise_for_status()
    source_url = extract_kind_content_url(path_response.text)
    if not source_url:
        raise requests.RequestException(f"KIND external content path unavailable for receipt {receipt_no}")
    content = session.get(source_url, timeout=timeout)
    content.raise_for_status()
    # KIND external documents may carry a stale EUC-KR meta declaration while
    # the actual response bytes are UTF-8. Decode explicitly so Korean table
    # labels such as '기준가격' and '적용일' are not mojibake-parsed as missing.
    content.encoding = "utf-8"
    return content.text, source_url


def fetch_notices_for_listing_date(
    session: requests.Session,
    listing_date: str,
    timeout: float,
) -> list[ListingNotice]:
    search_html = request_kind_search(session, listing_date, timeout)
    notices: list[ListingNotice] = []
    for receipt in extract_notice_receipts(search_html):
        try:
            html, source_url = request_kind_notice(session, receipt, timeout)
            notice = parse_kind_notice(html, receipt, source_url)
        except requests.RequestException:
            continue
        if notice.reference_price:
            notices.append(notice)
    return notices


def choose_matching_notice(
    notices: Sequence[ListingNotice], listing_date: str, name: str
) -> ListingNotice | None:
    exact = [notice for notice in notices if notice.applied_date == listing_date and notice.reference_price]
    normalized_name = normalize_name(name)
    name_matches = [
        notice for notice in exact
        if names_equivalent(notice.instrument_name, normalized_name)
    ]
    if len(name_matches) == 1:
        return name_matches[0]
    # Only a unique same-date notice may be accepted when historical and current
    # product names differ; otherwise the row must remain in manual review.
    if len(exact) == 1:
        return exact[0]
    return None


def resolve_reference_price(
    row: Mapping[str, str],
    session: requests.Session,
    timeout: float,
    notice_cache: dict[str, list[ListingNotice]],
) -> Resolution:
    ticker = normalize_ticker(row.get("ticker"))
    listing_date = normalize_date(row.get("listing_date"))
    name = str(row.get("name") or "").strip()
    isin = str(row.get("isin") or row.get("isin_cd") or "").strip()
    existing_anchor = positive_number(row.get("itd_anchor_close"))
    if not ticker or not listing_date:
        return Resolution(
            ticker=ticker,
            isin=isin,
            name=name,
            listing_date=listing_date or "",
            existing_anchor_close=existing_anchor,
            reference_price=None,
            status="listing_date_unavailable",
            reason="Master data has no valid ETF ticker or listing date.",
        )
    if listing_date not in notice_cache:
        try:
            notice_cache[listing_date] = fetch_notices_for_listing_date(session, listing_date, timeout)
        except requests.RequestException as error:
            return Resolution(ticker, isin, name, listing_date, existing_anchor, None, "kind_search_error", str(error))
    notices = notice_cache[listing_date]
    if not notices:
        return Resolution(
            ticker, isin, name, listing_date, existing_anchor, None,
            "official_notice_not_found", "No KIND listing-reference-price notice was found in the listing-date search window."
        )
    chosen = choose_matching_notice(notices, listing_date, name)
    if not chosen:
        reason = "No unique KIND notice with a positive reference price, matching applied date, and unambiguous ETF name."
        return Resolution(
            ticker, isin, name, listing_date, existing_anchor, None,
            "manual_review_required", reason
        )
    return Resolution(
        ticker=ticker,
        isin=isin,
        name=name,
        listing_date=listing_date,
        existing_anchor_close=existing_anchor,
        reference_price=chosen.reference_price,
        status="official_verified",
        reason="KRX KIND listing-reference-price notice verified.",
        receipt_no=chosen.receipt_no,
        source_url=chosen.source_url,
        notice_applied_date=chosen.applied_date or "",
        notice_title=chosen.title,
    )


def latest_close_field(fieldnames: Sequence[str]) -> str | None:
    candidates = [field for field in fieldnames if re.fullmatch(r"close_\d{8}", field)]
    return max(candidates) if candidates else None


def calculate_return(latest_close: float | None, anchor: float | None) -> float | None:
    if latest_close is None or anchor is None or latest_close <= 0 or anchor <= 0:
        return None
    return round((latest_close / anchor - 1) * 100, 2)


def apply_verified_anchors(
    return_rows: list[dict[str, str]],
    resolutions: Mapping[str, Resolution],
    checked_at: str,
) -> tuple[list[dict[str, str]], int]:
    """Return updated rows without mutating caller-owned values."""
    fields = list(return_rows[0].keys()) if return_rows else []
    close_field = latest_close_field(fields)
    updated = 0
    result: list[dict[str, str]] = []
    for original in return_rows:
        row = dict(original)
        ticker = normalize_ticker(row.get("ticker"))
        resolution = resolutions.get(ticker)
        if resolution and resolution.status.startswith("official_verified") and resolution.reference_price:
            latest_close = positive_number(row.get(close_field or ""))
            row["itd_anchor_close"] = format_number(resolution.reference_price)
            row["itd_anchor_date"] = resolution.listing_date
            row["itd_return_type"] = "pr"
            row["itd_source"] = "KRX_KIND_LISTING_REFERENCE_PRICE"
            row["itd_verified_at"] = checked_at
            row["itd_quality_status"] = resolution.status
            calculated = calculate_return(latest_close, resolution.reference_price)
            row["r_itd"] = "" if calculated is None else f"{calculated:.2f}"
            updated += 1
        result.append(row)
    return result, updated


def merge_official_listing_cache(
    cache: Mapping[str, Any], resolutions: Mapping[str, Resolution]
) -> dict[str, float]:
    merged: dict[str, float] = {}
    for ticker, value in cache.items():
        parsed = positive_number(value)
        if parsed is not None:
            merged[normalize_ticker(ticker)] = parsed
    for ticker, resolution in resolutions.items():
        if resolution.status.startswith("official_verified") and resolution.reference_price:
            merged[ticker] = resolution.reference_price
    return dict(sorted(merged.items()))


def backup_file(path: Path, backup_dir: Path, checked_at: str) -> Path:
    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = checked_at.replace(":", "").replace("+", "_").replace("-", "")
    target = backup_dir / f"{path.stem}.{stamp}{path.suffix}"
    shutil.copy2(path, target)
    return target


def load_checkpoint(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"version": 1, "results": {}}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"version": 1, "results": {}}
    return payload if isinstance(payload, dict) else {"version": 1, "results": {}}


def resolution_from_checkpoint(payload: Mapping[str, Any]) -> Resolution | None:
    try:
        return Resolution(**payload)
    except (TypeError, ValueError):
        return None


def to_ledger_row(resolution: Resolution, checked_at: str) -> dict[str, str]:
    return {
        "ticker": resolution.ticker,
        "isin": resolution.isin,
        "name": resolution.name,
        "listing_date": resolution.listing_date,
        "reference_price": format_number(resolution.reference_price),
        "reference_price_currency": "KRW" if resolution.reference_price else "",
        "source_name": KIND_SOURCE_NAME if resolution.reference_price else "",
        "source_receipt_no": resolution.receipt_no,
        "source_url": resolution.source_url,
        "notice_applied_date": resolution.notice_applied_date,
        "notice_title": resolution.notice_title,
        "verification_status": resolution.status,
        "verification_note": resolution.reason,
        "fetched_at": checked_at,
    }


def to_audit_row(resolution: Resolution, checked_at: str) -> dict[str, str]:
    return {
        "ticker": resolution.ticker,
        "isin": resolution.isin,
        "name": resolution.name,
        "listing_date": resolution.listing_date,
        "existing_anchor_close": format_number(resolution.existing_anchor_close),
        "official_reference_price": format_number(resolution.reference_price),
        "verification_status": resolution.status,
        "source_receipt_no": resolution.receipt_no,
        "source_url": resolution.source_url,
        "reason": resolution.reason,
        "checked_at": checked_at,
    }


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(
        description="Collect KRX KIND ETF listing reference prices and rebuild ITD anchors safely."
    )
    result.add_argument("--data-dir", default="data", help="Project data directory (default: data)")
    result.add_argument("--ticker", action="append", default=[], help="ETF ticker to process; repeatable")
    result.add_argument("--refresh", action="store_true", help="Ignore checkpointed results and query KIND again")
    result.add_argument("--apply", action="store_true", help="Write the official ledger, audit, and checkpoint")
    result.add_argument(
        "--apply-returns",
        action="store_true",
        help="After --apply, replace verified ITD anchors in etf_returns_draft.csv with a backup",
    )
    result.add_argument(
        "--apply-listing-cache",
        action="store_true",
        help="After --apply, replace verified listing_prices.json values with a backup",
    )
    result.add_argument("--limit", type=int, default=0, help="Maximum selected tickers to query")
    result.add_argument("--throttle-seconds", type=float, default=0.35, help="Delay between KIND requests")
    result.add_argument("--timeout", type=float, default=20.0, help="HTTP timeout in seconds")
    return result


def process(args: argparse.Namespace, session: requests.Session | None = None) -> dict[str, int]:
    if (args.apply_returns or args.apply_listing_cache) and not args.apply:
        raise ValueError("--apply-returns and --apply-listing-cache require --apply")
    data_dir = Path(args.data_dir)
    master_path = data_dir / "etf_master_draft.csv"
    returns_path = data_dir / "etf_returns_draft.csv"
    cache_path = data_dir / "listing_prices.json"
    ledger_path = data_dir / "listing-ledger" / "etf_listing_reference_prices.csv"
    audit_path = data_dir / "quality" / "krx_listing_reference_price_audit.csv"
    checkpoint_path = data_dir / "quality" / "krx_listing_reference_price_checkpoint.json"
    backup_dir = data_dir / "backups"
    master_rows = read_csv_rows(master_path)
    return_rows = read_csv_rows(returns_path)
    returns_by_ticker = {normalize_ticker(row.get("ticker")): row for row in return_rows}
    selected = {normalize_ticker(value) for value in args.ticker if normalize_ticker(value)}
    rows = [row for row in master_rows if not selected or normalize_ticker(row.get("ticker")) in selected]
    if args.limit > 0:
        rows = rows[: args.limit]
    checkpoint = load_checkpoint(checkpoint_path)
    checkpoint_results = checkpoint.setdefault("results", {})
    client = session or requests.Session()
    client.headers.setdefault("User-Agent", "ETF-Campus/1.0 official-reference-price-audit")
    checked_at = now_kst()
    resolutions: list[Resolution] = []
    notice_cache: dict[str, list[ListingNotice]] = {}
    for index, master in enumerate(rows):
        ticker = normalize_ticker(master.get("ticker"))
        cached = resolution_from_checkpoint(checkpoint_results.get(ticker, {}))
        if cached and not args.refresh:
            resolution = cached
        else:
            merged = dict(master)
            merged.update(returns_by_ticker.get(ticker, {}))
            resolution = resolve_reference_price(merged, client, args.timeout, notice_cache)
            checkpoint_results[ticker] = asdict(resolution)
            if args.throttle_seconds > 0 and index + 1 < len(rows):
                time.sleep(args.throttle_seconds)
        resolutions.append(resolution)
    resolution_map = {resolution.ticker: resolution for resolution in resolutions}
    stats = {
        "total": len(resolutions),
        "official_verified": sum(item.status.startswith("official_verified") for item in resolutions),
        "manual_review": sum(item.status == "manual_review_required" for item in resolutions),
        "unavailable": sum(not item.reference_price for item in resolutions),
        "returns_updated": 0,
        "cache_updated": 0,
    }
    if args.apply:
        write_csv_atomic(ledger_path, LEDGER_FIELDS, [to_ledger_row(item, checked_at) for item in resolutions])
        write_csv_atomic(audit_path, AUDIT_FIELDS, [to_audit_row(item, checked_at) for item in resolutions])
        checkpoint.update({"version": 1, "updated_at": checked_at})
        write_json_atomic(checkpoint_path, checkpoint)
        if args.apply_returns:
            backup_file(returns_path, backup_dir, checked_at)
            updated_rows, updated = apply_verified_anchors(return_rows, resolution_map, checked_at)
            write_csv_atomic(returns_path, list(return_rows[0].keys()), updated_rows)
            stats["returns_updated"] = updated
        if args.apply_listing_cache:
            backup_file(cache_path, backup_dir, checked_at)
            cache_payload = json.loads(cache_path.read_text(encoding="utf-8"))
            merged_cache = merge_official_listing_cache(cache_payload, resolution_map)
            write_json_atomic(cache_path, merged_cache)
            stats["cache_updated"] = stats["official_verified"]
    return stats


def main(argv: Sequence[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        stats = process(args)
    except (FileNotFoundError, ValueError, requests.RequestException) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2
    print(json.dumps(stats, ensure_ascii=False, sort_keys=True))
    if not args.apply:
        print("Dry run only: no data file was changed. Re-run with --apply after reviewing results.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
