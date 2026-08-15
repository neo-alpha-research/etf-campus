#!/usr/bin/env python3
"""Build an auditable ETF distribution ledger from official issuer and KRX documents.

This P0 pipeline intentionally separates immutable source documents, normalized cash
 distribution events, and coverage status.  It never labels an event as verified
when its ex-date or source chain is incomplete.

Commands:
  bootstrap  Create directories, CSV headers, seed targets, and a manual-review input.
  collect    Download official source documents listed in collection_targets.csv.
  normalize  Merge the legacy ledger and manual verified entries into event records.
  validate   Run strict structural and source-chain checks; write a JSON report.
  run        Execute bootstrap -> collect -> normalize -> validate.

Only Python's standard library is used so it is safe for the existing static-data
workflow.  Raw documents are preserved before parsing; parsers can be added later
without losing evidence.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import mimetypes
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "distributions"
RAW_DIR = DATA_DIR / "raw"
REPORT_DIR = DATA_DIR / "reports"
MASTER_PATH = ROOT / "data" / "etf_master_draft.csv"
LEGACY_LEDGER_PATH = ROOT / "data" / "income_page2_distribution_ledger.csv"

SOURCE_COLUMNS = [
    "source_id", "etf_id", "ticker", "source_owner", "source_type",
    "source_document_key", "source_title", "source_url", "published_at",
    "retrieved_at", "http_status", "media_type", "content_hash_sha256",
    "parser_name", "parser_version", "parse_status", "raw_path",
    "source_etf_name", "parse_note",
]
EVENT_COLUMNS = [
    "event_id", "etf_id", "ticker", "etf_name", "issuer_ex_date",
    "krx_apply_date", "ex_date", "record_date", "pay_date",
    "distribution_per_share_krw", "distribution_type", "event_status",
    "currency", "ex_rights_reference_price_krw", "issuer_source_id",
    "krx_source_id", "issuer_amount_verified", "krx_ex_date_verified",
    "verification_status", "verification_note", "supersedes_event_id",
    "source_collected_at", "updated_at",
]
COVERAGE_COLUMNS = [
    "etf_id", "ticker", "coverage_start", "coverage_end",
    "issuer_checked_through", "krx_checked_through",
    "distribution_coverage_status", "corporate_action_coverage_status",
    "last_checked_at", "blocking_source_ids", "note",
]
TARGET_COLUMNS = [
    "source_id", "etf_id", "ticker", "source_owner", "source_type",
    "source_document_key", "source_title", "source_url", "published_at",
    "parser_name", "parser_version", "parse_status", "parse_note",
]
MANUAL_EVENT_COLUMNS = EVENT_COLUMNS.copy()

SOURCES_PATH = DATA_DIR / "etf_distribution_source_documents.csv"
EVENTS_PATH = DATA_DIR / "etf_distribution_events.csv"
COVERAGE_PATH = DATA_DIR / "etf_tr_data_coverage.csv"
TARGETS_PATH = DATA_DIR / "collection_targets.csv"
MANUAL_EVENTS_PATH = DATA_DIR / "manual_verified_distribution_events.csv"

DATE_FORMATS = ("%Y-%m-%d", "%Y.%m.%d", "%Y/%m/%d", "%Y%m%d")
SAFE_COMPONENT = re.compile(r"[^0-9A-Za-z가-힣._-]+")


@dataclass(frozen=True)
class FetchResult:
    body: bytes
    status: int
    media_type: str
    final_url: str
    error: str = ""


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def clean(value: object | None) -> str:
    return "" if value is None else str(value).strip()


def normalise_ticker(value: object | None) -> str:
    """Preserve 6-character numeric or alpha-numeric ETF codes, including leading zeros."""
    text = clean(value).upper()
    if text.isdigit() and len(text) < 6:
        return text.zfill(6)
    return text


def parse_iso_date(value: object | None) -> date | None:
    text = clean(value)
    if not text:
        return None
    text = text.replace("년", "-").replace("월", "-").replace("일", "")
    text = re.sub(r"\s+", "", text)
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            pass
    return None


def iso_date(value: object | None) -> str:
    parsed = parse_iso_date(value)
    return parsed.isoformat() if parsed else ""


def parse_decimal(value: object | None) -> float | None:
    text = clean(value).replace(",", "").replace("원", "").replace("₩", "")
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def bool_string(value: object | None) -> str:
    return "true" if clean(value).lower() in {"1", "true", "yes", "y", "검증완료"} else "false"


def safe_component(value: str) -> str:
    output = SAFE_COMPONENT.sub("_", value).strip("._")
    return output or "unknown"


def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return [{key: clean(value) for key, value in row.items()} for row in csv.DictReader(handle)]


def write_csv(path: Path, columns: list[str], rows: Iterable[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({column: clean(row.get(column)) for column in columns})


def ensure_csv(path: Path, columns: list[str]) -> None:
    if not path.exists():
        write_csv(path, columns, [])


def sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def deterministic_id(prefix: str, *parts: str) -> str:
    digest = hashlib.sha256("|".join(clean(part) for part in parts).encode("utf-8")).hexdigest()[:16]
    return f"{prefix}:{digest}"


def source_extension(url: str, media_type: str, body: bytes) -> str:
    content_type = media_type.lower().split(";", 1)[0]
    if body.startswith(b"%PDF"):
        return ".pdf"
    if body.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if body.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if "json" in content_type:
        return ".json"
    if "html" in content_type or body.lstrip().startswith(b"<"):
        return ".html"
    suffix = Path(urllib.parse.urlparse(url).path).suffix
    if suffix and len(suffix) <= 8:
        return suffix.lower()
    guessed = mimetypes.guess_extension(content_type)
    return guessed or ".bin"


def fetch_url(url: str, timeout: int = 30) -> FetchResult:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; ETF-Campus-Distribution/1.0; +https://etf-campus.local)",
            "Accept": "text/html,application/json,application/pdf,image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return FetchResult(
                body=response.read(),
                status=response.status,
                media_type=response.headers.get_content_type() or "application/octet-stream",
                final_url=response.geturl(),
            )
    except urllib.error.HTTPError as error:
        return FetchResult(
            body=error.read(), status=error.code,
            media_type=error.headers.get_content_type() if error.headers else "application/octet-stream",
            final_url=url, error=f"HTTP {error.code}",
        )
    except Exception as error:  # Network failures must remain visible in the ledger.
        return FetchResult(b"", 0, "application/octet-stream", url, f"{type(error).__name__}: {error}")


def load_master() -> dict[str, dict[str, str]]:
    records: dict[str, dict[str, str]] = {}
    for row in read_csv(MASTER_PATH):
        ticker = normalise_ticker(row.get("ticker"))
        if ticker:
            records[ticker] = {**row, "ticker": ticker, "isin_cd": clean(row.get("isin_cd")), "name": clean(row.get("name"))}
    return records


def blank_event() -> dict[str, str]:
    return {column: "" for column in EVENT_COLUMNS}


def blank_source() -> dict[str, str]:
    return {column: "" for column in SOURCE_COLUMNS}


def bootstrap() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    ensure_csv(SOURCES_PATH, SOURCE_COLUMNS)
    ensure_csv(EVENTS_PATH, EVENT_COLUMNS)
    ensure_csv(COVERAGE_PATH, COVERAGE_COLUMNS)

    if not TARGETS_PATH.exists():
        targets: list[dict[str, str]] = [
            {
                "source_id": "issuer:plus:489030:20260728:notice",
                "etf_id": "KR7489030007", "ticker": "489030", "source_owner": "PLUS ETF",
                "source_type": "issuer_notice", "source_document_key": "30823",
                "source_title": "PLUS ETF 7월 분배금 공지(월말)",
                "source_url": "https://www.plusetf.co.kr/customer/notice/detail?n=30823",
                "published_at": "2026-07-28", "parser_name": "manual_official_notice",
                "parser_version": "1", "parse_status": "manual_review",
                "parse_note": "공지 본문의 분배금 표는 이미지이므로 OCR 없이 자동 추출하지 않는다.",
            },
            {
                "source_id": "issuer:plus:489030:20260728:table",
                "etf_id": "KR7489030007", "ticker": "489030", "source_owner": "PLUS ETF",
                "source_type": "issuer_image_notice", "source_document_key": "202607281627538301a85b",
                "source_title": "PLUS ETF 7월 분배금 공지 부속표",
                "source_url": "https://hwadm.plusetf.co.kr/webapp/upload/202607281627538301a85b-0c66-4c14-a3a1-519aafbc12b4.PNG",
                "published_at": "2026-07-28", "parser_name": "manual_official_notice",
                "parser_version": "1", "parse_status": "manual_review",
                "parse_note": "운용사 공식 공지 부속 이미지. 수동 검증된 이벤트만 원장으로 정규화한다.",
            },
            {
                "source_id": "krx:kind:489030:20241029:20241029000652",
                "etf_id": "KR7489030007", "ticker": "489030", "source_owner": "KRX KIND",
                "source_type": "krx_ex_rights_disclosure", "source_document_key": "20241029000652",
                "source_title": "[PLUS 고배당주위클리커버드콜] ETF 분배락 기준가격 안내",
                "source_url": "https://kind.krx.co.kr/common/disclsviewer.do?method=searchInitInfo&acptNo=20241029000652&docno=",
                "published_at": "2024-10-29", "parser_name": "krx_kind_manual_review",
                "parser_version": "1", "parse_status": "manual_review",
                "parse_note": "공시 적용일·분배락 기준가격 구조 검증용. 2026-07 이벤트에는 연결하지 않는다.",
            },
        ]
        seen = {row["source_id"] for row in targets}
        for legacy in read_csv(LEGACY_LEDGER_PATH):
            ticker = normalise_ticker(legacy.get("ticker"))
            url = clean(legacy.get("source_url"))
            if not ticker or not url:
                continue
            source_id = deterministic_id("legacy", ticker, url)
            if source_id in seen:
                continue
            seen.add(source_id)
            targets.append({
                "source_id": source_id, "etf_id": "", "ticker": ticker,
                "source_owner": "legacy_candidate", "source_type": "issuer_product_or_notice",
                "source_document_key": "", "source_title": clean(legacy.get("etf_name")),
                "source_url": url, "published_at": "", "parser_name": "unparsed",
                "parser_version": "1", "parse_status": "pending",
                "parse_note": "기존 분배금 원장의 후보 원천 URL. 문서 수집 후 운용사별 파서를 지정한다.",
            })
        write_csv(TARGETS_PATH, TARGET_COLUMNS, targets)

    if not MANUAL_EVENTS_PATH.exists():
        now = utc_now()
        sample = blank_event()
        sample.update({
            "event_id": "KR7489030007:2026-07-30:ordinary_cash:v1",
            "etf_id": "KR7489030007", "ticker": "489030", "etf_name": "PLUS 고배당주위클리커버드콜",
            "issuer_ex_date": "2026-07-30", "krx_apply_date": "2026-07-30", "ex_date": "2026-07-30",
            "record_date": "2026-07-31", "pay_date": "2026-08-04",
            "distribution_per_share_krw": "103", "distribution_type": "ordinary_cash",
            "event_status": "paid", "currency": "KRW", "issuer_source_id": "issuer:plus:489030:20260728:table",
            "issuer_amount_verified": "true", "krx_ex_date_verified": "false",
            "verification_status": "partial",
            "verification_note": "운용사 공식 공지의 분배락일 및 KRX 적용일은 2026-07-30으로 대조됨. KIND 원문 연결 전에는 partial 유지.",
            "source_collected_at": now, "updated_at": now,
        })
        write_csv(MANUAL_EVENTS_PATH, MANUAL_EVENT_COLUMNS, [sample])


def collect_sources(force: bool = False, limit: int | None = None, sleep_seconds: float = 0.2) -> dict[str, int]:
    bootstrap()
    existing = {row["source_id"]: row for row in read_csv(SOURCES_PATH) if row.get("source_id")}
    target_rows = read_csv(TARGETS_PATH)
    if limit is not None:
        target_rows = target_rows[:limit]
    collected = 0
    skipped = 0
    failed = 0

    for target in target_rows:
        source_id = clean(target.get("source_id"))
        if source_id in existing and existing[source_id].get("parse_status") not in {"failed", ""} and not force:
            skipped += 1
            continue
        result = fetch_url(clean(target.get("source_url")))
        row = blank_source()
        row.update({key: clean(target.get(key)) for key in TARGET_COLUMNS if key in row})
        row["retrieved_at"] = utc_now()
        row["http_status"] = str(result.status)
        row["media_type"] = result.media_type
        row["source_url"] = result.final_url or clean(target.get("source_url"))
        if result.status < 200 or result.status >= 300 or not result.body:
            row["parse_status"] = "failed"
            row["parse_note"] = f"{clean(target.get('parse_note'))} | {result.error or 'empty response'}".strip()
            existing[source_id] = row
            failed += 1
            continue

        digest = sha256(result.body)
        published = iso_date(target.get("published_at")) or utc_now()[:10]
        owner = safe_component(clean(target.get("source_owner")))
        filename = f"{safe_component(source_id)}_{digest[:12]}{source_extension(row['source_url'], result.media_type, result.body)}"
        destination = RAW_DIR / owner / published[:4] / published[5:7] / filename
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(result.body)
        row["content_hash_sha256"] = digest
        row["raw_path"] = destination.relative_to(ROOT).as_posix()
        row["parse_status"] = clean(target.get("parse_status")) or "collected"
        existing[source_id] = row
        collected += 1
        time.sleep(sleep_seconds)

    ordered = [existing[key] for key in sorted(existing)]
    write_csv(SOURCES_PATH, SOURCE_COLUMNS, ordered)
    return {"collected": collected, "skipped": skipped, "failed": failed, "total": len(target_rows)}


def legacy_event_rows(master: dict[str, dict[str, str]]) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    events: list[dict[str, str]] = []
    sources: list[dict[str, str]] = []
    now = utc_now()
    for legacy in read_csv(LEGACY_LEDGER_PATH):
        ticker = normalise_ticker(legacy.get("ticker"))
        amount = parse_decimal(legacy.get("distribution_per_share_krw"))
        record_date = iso_date(legacy.get("distribution_record_date"))
        reference_month = clean(legacy.get("reference_month"))
        if not ticker or amount is None or not record_date:
            continue
        metadata = master.get(ticker, {})
        source_url = clean(legacy.get("source_url"))
        source_id = deterministic_id("legacy", ticker, source_url, reference_month)
        source = blank_source()
        source.update({
            "source_id": source_id, "etf_id": clean(metadata.get("isin_cd")), "ticker": ticker,
            "source_owner": "legacy_ledger", "source_type": "legacy_ledger_record",
            "source_document_key": reference_month, "source_title": clean(legacy.get("etf_name")),
            "source_url": source_url, "retrieved_at": now, "http_status": "",
            "media_type": "text/csv", "parser_name": "legacy_migration", "parser_version": "1",
            "parse_status": "migrated_legacy", "raw_path": "",
            "source_etf_name": clean(legacy.get("etf_name")),
            "parse_note": "기존 원장에는 분배락일·지급일·원문 해시가 없어 TR 검증에 단독 사용하지 않는다.",
        })
        sources.append(source)
        event = blank_event()
        event.update({
            "event_id": f"{clean(metadata.get('isin_cd')) or ticker}:legacy:{record_date}:ordinary_cash:v1",
            "etf_id": clean(metadata.get("isin_cd")), "ticker": ticker,
            "etf_name": clean(legacy.get("etf_name")) or clean(metadata.get("name")),
            "record_date": record_date, "distribution_per_share_krw": format(amount, "g"),
            "distribution_type": "ordinary_cash", "event_status": "announced", "currency": "KRW",
            "issuer_source_id": source_id,
            "issuer_amount_verified": bool_string(legacy.get("verification_status")),
            "krx_ex_date_verified": "false", "verification_status": "partial",
            "verification_note": "기존 원장에서 이관됨. 분배락일·지급일·원문 해시 확인 전 TR 계산 금지.",
            "source_collected_at": now, "updated_at": now,
        })
        events.append(event)
    return events, sources


def normalise_events() -> dict[str, int]:
    bootstrap()
    master = load_master()
    sources = {row["source_id"]: row for row in read_csv(SOURCES_PATH) if row.get("source_id")}
    events: dict[str, dict[str, str]] = {row["event_id"]: row for row in read_csv(EVENTS_PATH) if row.get("event_id")}
    legacy_events, legacy_sources = legacy_event_rows(master)
    for source in legacy_sources:
        sources.setdefault(source["source_id"], source)
    for event in legacy_events:
        events.setdefault(event["event_id"], event)

    imported_manual = 0
    for incoming in read_csv(MANUAL_EVENTS_PATH):
        event = blank_event()
        event.update({column: clean(incoming.get(column)) for column in EVENT_COLUMNS})
        event["ticker"] = normalise_ticker(event.get("ticker"))
        metadata = master.get(event["ticker"], {})
        event["etf_id"] = event["etf_id"] or clean(metadata.get("isin_cd"))
        event["etf_name"] = event["etf_name"] or clean(metadata.get("name"))
        for key in ("issuer_ex_date", "krx_apply_date", "ex_date", "record_date", "pay_date"):
            event[key] = iso_date(event[key])
        event["distribution_per_share_krw"] = clean(event["distribution_per_share_krw"]).replace(",", "")
        event["updated_at"] = utc_now()
        if not event["event_id"]:
            date_key = event["ex_date"] or event["record_date"] or "undated"
            event["event_id"] = f"{event['etf_id'] or event['ticker']}:{date_key}:{event['distribution_type'] or 'other'}:v1"
        events[event["event_id"]] = event
        imported_manual += 1

    write_csv(SOURCES_PATH, SOURCE_COLUMNS, [sources[key] for key in sorted(sources)])
    write_csv(EVENTS_PATH, EVENT_COLUMNS, [events[key] for key in sorted(events)])
    refresh_coverage(master, events.values(), sources)
    return {"events": len(events), "legacy_events": len(legacy_events), "manual_events": imported_manual, "sources": len(sources)}


def refresh_coverage(master: dict[str, dict[str, str]], events: Iterable[dict[str, str]], sources: dict[str, dict[str, str]]) -> None:
    grouped: dict[str, list[dict[str, str]]] = {}
    for event in events:
        grouped.setdefault(normalise_ticker(event.get("ticker")), []).append(event)
    now = utc_now()
    coverage: list[dict[str, str]] = []
    for ticker, item in sorted(master.items()):
        rows = grouped.get(ticker, [])
        dates = [parse_iso_date(row.get("ex_date")) or parse_iso_date(row.get("record_date")) for row in rows]
        dates = [item for item in dates if item]
        statuses = {clean(row.get("verification_status")) for row in rows}
        if not rows:
            distribution_status = "pending"
            note = "운용사 분배금 원천을 아직 수집·검증하지 않음. 무분배로 해석하지 않는다."
        elif "conflict" in statuses:
            distribution_status = "conflict"
            note = "원천 일정 또는 금액의 불일치 해결 전 TR을 산출하지 않는다."
        elif statuses == {"verified"}:
            distribution_status = "partial"
            note = "이벤트는 검증됐으나 전체 기간의 무분배 여부·기업행동 범위가 아직 완결되지 않았다."
        else:
            distribution_status = "partial"
            note = "일부 분배 이벤트만 확보됐거나 권리락일·원문 체인이 미완결이다."
        source_ids = [clean(row.get("issuer_source_id")) for row in rows if clean(row.get("issuer_source_id"))]
        source_dates = [parse_iso_date(sources[source_id].get("published_at")) for source_id in source_ids if source_id in sources]
        source_dates = [item for item in source_dates if item]
        coverage.append({
            "etf_id": clean(item.get("isin_cd")), "ticker": ticker,
            "coverage_start": min(dates).isoformat() if dates else "",
            "coverage_end": max(dates).isoformat() if dates else "",
            "issuer_checked_through": max(source_dates).isoformat() if source_dates else "",
            "krx_checked_through": "", "distribution_coverage_status": distribution_status,
            "corporate_action_coverage_status": "pending", "last_checked_at": now,
            "blocking_source_ids": ";".join(source_ids), "note": note,
        })
    write_csv(COVERAGE_PATH, COVERAGE_COLUMNS, coverage)


def validate() -> dict[str, object]:
    bootstrap()
    sources = {row["source_id"]: row for row in read_csv(SOURCES_PATH) if row.get("source_id")}
    events = read_csv(EVENTS_PATH)
    errors: list[dict[str, str]] = []
    warnings: list[dict[str, str]] = []
    source_integrity = {"checked": 0, "passed": 0, "issues": []}
    for source_id, source in sources.items():
        raw_path = clean(source.get("raw_path"))
        http_status = clean(source.get("http_status"))
        expected_hash = clean(source.get("content_hash_sha256"))
        if raw_path:
            source_integrity["checked"] += 1
            raw_file = ROOT / raw_path
            if not raw_file.exists():
                issue = {"source_id": source_id, "issue": "raw_source_file_missing"}
                errors.append(issue)
                source_integrity["issues"].append(issue)
            elif expected_hash and sha256(raw_file.read_bytes()) != expected_hash:
                issue = {"source_id": source_id, "issue": "raw_source_hash_mismatch"}
                errors.append(issue)
                source_integrity["issues"].append(issue)
            else:
                source_integrity["passed"] += 1
        elif http_status.startswith("2"):
            warning = {"source_id": source_id, "issue": "collected_source_missing_raw_path"}
            warnings.append(warning)
            source_integrity["issues"].append(warning)
    seen_event_ids: set[str] = set()

    for event in events:
        event_id = clean(event.get("event_id"))
        if not event_id or event_id in seen_event_ids:
            errors.append({"event_id": event_id, "issue": "missing_or_duplicate_event_id"})
        seen_event_ids.add(event_id)
        ticker = normalise_ticker(event.get("ticker"))
        if not re.fullmatch(r"[0-9A-Z]{6}", ticker):
            errors.append({"event_id": event_id, "issue": "invalid_ticker"})
        amount = parse_decimal(event.get("distribution_per_share_krw"))
        if event.get("event_status") != "no_distribution" and amount is None:
            errors.append({"event_id": event_id, "issue": "missing_or_invalid_distribution_amount"})
        ex_date = parse_iso_date(event.get("ex_date"))
        record_date = parse_iso_date(event.get("record_date"))
        pay_date = parse_iso_date(event.get("pay_date"))
        if ex_date and record_date and record_date < ex_date:
            errors.append({"event_id": event_id, "issue": "record_date_before_ex_date"})
        if record_date and pay_date and pay_date < record_date:
            errors.append({"event_id": event_id, "issue": "pay_date_before_record_date"})
        issuer_source = clean(event.get("issuer_source_id"))
        krx_source = clean(event.get("krx_source_id"))
        if issuer_source and issuer_source not in sources:
            errors.append({"event_id": event_id, "issue": "issuer_source_missing_from_source_ledger"})
        if krx_source and krx_source not in sources:
            errors.append({"event_id": event_id, "issue": "krx_source_missing_from_source_ledger"})
        status = clean(event.get("verification_status"))
        if status == "verified":
            if not ex_date or bool_string(event.get("issuer_amount_verified")) != "true" or bool_string(event.get("krx_ex_date_verified")) != "true":
                errors.append({"event_id": event_id, "issue": "verified_event_missing_required_verification"})
            if not issuer_source or not krx_source:
                errors.append({"event_id": event_id, "issue": "verified_event_missing_source_chain"})
        if status in {"partial", "pending", "conflict"}:
            warnings.append({"event_id": event_id, "issue": f"tr_blocked_{status}"})

    coverage = read_csv(COVERAGE_PATH)
    report: dict[str, object] = {
        "generated_at": utc_now(),
        "source_document_count": len(sources),
        "event_count": len(events),
        "coverage_count": len(coverage),
        "error_count": len(errors),
        "warning_count": len(warnings),
        "errors": errors,
        "warnings": warnings,
        "status_counts": {},
        "source_integrity": source_integrity,
    }
    counts: dict[str, int] = {}
    for event in events:
        status = clean(event.get("verification_status")) or "missing"
        counts[status] = counts.get(status, 0) + 1
    report["status_counts"] = counts
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    (REPORT_DIR / "distribution_validation_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


def print_json(payload: object) -> None:
    print(json.dumps(payload, ensure_ascii=False, indent=2))


def command_run(args: argparse.Namespace) -> int:
    bootstrap()
    collected = collect_sources(force=args.force, limit=args.limit, sleep_seconds=args.sleep)
    normalized = normalise_events()
    report = validate()
    print_json({"collection": collected, "normalization": normalized, "validation": report})
    return 0 if report["error_count"] == 0 else 2


def main() -> int:
    parser = argparse.ArgumentParser(description="ETF Campus official distribution evidence pipeline")
    subparsers = parser.add_subparsers(dest="command", required=True)

    bootstrap_parser = subparsers.add_parser("bootstrap", help="Create schema files and seed inputs")
    bootstrap_parser.set_defaults(func=lambda args: (bootstrap(), print_json({"status": "bootstrapped"}), 0)[2])

    collect_parser = subparsers.add_parser("collect", help="Fetch target source documents into immutable raw storage")
    collect_parser.add_argument("--force", action="store_true", help="Fetch again even when source_id already exists")
    collect_parser.add_argument("--limit", type=int, default=None, help="Limit number of targets for a controlled initial run")
    collect_parser.add_argument("--sleep", type=float, default=0.2, help="Delay between fetches in seconds")
    collect_parser.set_defaults(func=lambda args: (print_json(collect_sources(args.force, args.limit, args.sleep)), 0)[1])

    normalize_parser = subparsers.add_parser("normalize", help="Normalize legacy and manually verified events")
    normalize_parser.set_defaults(func=lambda args: (print_json(normalise_events()), 0)[1])

    validate_parser = subparsers.add_parser("validate", help="Validate source chain, dates, and strict statuses")
    validate_parser.set_defaults(func=lambda args: (print_json(validate()), 0)[1])

    run_parser = subparsers.add_parser("run", help="Execute bootstrap, collection, normalization, and validation")
    run_parser.add_argument("--force", action="store_true")
    run_parser.add_argument("--limit", type=int, default=None)
    run_parser.add_argument("--sleep", type=float, default=0.2)
    run_parser.set_defaults(func=command_run)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
