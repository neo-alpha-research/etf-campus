#!/usr/bin/env python3
"""Reconcile issuer distribution candidates with KRX KIND ex-rights evidence.

This pipeline is intentionally conservative.  It can create a `verified` event only
when an immutable issuer candidate and an immutable KRX KIND evidence row share an
ETF ticker and satisfy a short publication-to-application-date window.  It does not
use estimated distributions, does not infer a record/payment date, and preserves the
TR coverage gate maintained by collect_distribution_sources.py.

KIND viewer pages can be protected from direct HTTP retrieval.  For that documented
case, this program accepts a browser-rendered official KIND document snapshot that is
saved under data/distributions/raw/ with a SHA-256 hash.  The source URL, acceptance
number, document number, capture method, parser version, and row locations are
recorded in the evidence ledger.

Commands:
  bootstrap  Create KIND input, evidence, and candidate-match ledger headers.
  ingest     Parse immutable KIND source snapshots declared in the manual input.
  reconcile  Match KIND evidence to issuer candidates and upsert verified events.
  validate   Validate source hash chains, parsed evidence, matches, and events.
  run        Execute bootstrap -> ingest -> reconcile -> validate.

Only the Python standard library is used.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from datetime import date
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable

from collect_distribution_sources import (
    DATA_DIR,
    EVENT_COLUMNS,
    EVENTS_PATH,
    MASTER_PATH,
    REPORT_DIR,
    ROOT,
    SOURCE_COLUMNS,
    SOURCES_PATH,
    blank_event,
    blank_source,
    clean,
    deterministic_id,
    iso_date,
    load_master,
    normalise_ticker,
    parse_decimal,
    read_csv,
    refresh_coverage,
    sha256,
    utc_now,
    write_csv,
)

CANDIDATE_PATH = DATA_DIR / "etf_distribution_event_candidates.csv"
EVIDENCE_PATH = DATA_DIR / "etf_distribution_krx_kind_evidence.csv"
MATCH_PATH = DATA_DIR / "etf_distribution_candidate_krx_matches.csv"
MANUAL_INPUT_PATH = DATA_DIR / "manual_krx_kind_evidence_inputs.csv"
VALIDATION_PATH = REPORT_DIR / "krx_kind_reconciliation_validation_report.json"

# A 14-day window covers both monthly and mid-month issuer notices without creating
# a cross-cycle match.  A candidate outside this window stays pending for review.
MAX_NOTICE_TO_APPLY_DAYS = 14

MANUAL_INPUT_COLUMNS = [
    "source_id", "ticker", "source_title", "source_url", "published_at",
    "acpt_no", "doc_no", "raw_path", "capture_method", "note",
]
EVIDENCE_COLUMNS = [
    "krx_evidence_id", "source_id", "etf_id", "ticker", "etf_name",
    "source_title", "source_url", "published_at", "acpt_no", "doc_no",
    "disclosed_reason", "krx_apply_date", "ex_rights_reference_price_krw",
    "row_locator", "content_hash_sha256", "capture_method", "parser_name",
    "parser_version", "evidence_status", "review_status", "created_at", "note",
]
MATCH_COLUMNS = [
    "match_id", "candidate_id", "krx_evidence_id", "event_id", "ticker",
    "candidate_source_id", "krx_source_id", "match_rule_version", "match_status",
    "match_reason", "created_at", "updated_at", "note",
]

SPACE_RE = re.compile(r"\s+")
LABEL_PREFIX_RE = re.compile(r"^\d+\s*[.·)]\s*")


class TableParser(HTMLParser):
    """Extract text rows from a KIND HTML snapshot without external packages."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.tables: list[list[list[str]]] = []
        self._depth = 0
        self._table: list[list[str]] | None = None
        self._row: list[str] | None = None
        self._cell: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "table":
            self._depth += 1
            if self._depth == 1:
                self._table = []
        elif tag == "tr" and self._depth == 1:
            self._row = []
        elif tag in {"td", "th"} and self._depth == 1 and self._row is not None:
            self._cell = []
        elif tag == "br" and self._cell is not None:
            self._cell.append(" ")

    def handle_data(self, data: str) -> None:
        if self._cell is not None:
            self._cell.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag in {"td", "th"} and self._cell is not None and self._row is not None:
            self._row.append(normalize_text("".join(self._cell)))
            self._cell = None
        elif tag == "tr" and self._depth == 1 and self._table is not None and self._row is not None:
            if any(self._row):
                self._table.append(self._row)
            self._row = None
        elif tag == "table":
            if self._depth == 1 and self._table is not None:
                self.tables.append(self._table)
                self._table = None
            self._depth = max(0, self._depth - 1)


def normalize_text(value: object | None) -> str:
    return SPACE_RE.sub(" ", unescape(clean(value))).strip()


def ensure_csv(path: Path, columns: list[str]) -> None:
    if not path.exists():
        write_csv(path, columns, [])


def blank(columns: list[str]) -> dict[str, str]:
    return {column: "" for column in columns}


def parse_html_tables(body: bytes) -> list[list[list[str]]]:
    text = ""
    for encoding in ("utf-8", "euc-kr", "cp949"):
        try:
            text = body.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    if not text:
        text = body.decode("utf-8", errors="replace")
    parser = TableParser()
    parser.feed(text)
    parser.close()
    return parser.tables


def normalized_label(value: str) -> str:
    return LABEL_PREFIX_RE.sub("", normalize_text(value)).replace(" ", "")


def parse_kind_snapshot(raw_path: Path) -> tuple[dict[str, str], dict[str, str]]:
    """Parse one official KIND document snapshot into its disclosure fields."""
    body = raw_path.read_bytes()
    parsed: dict[str, str] = {}
    locators: dict[str, str] = {}
    for table_index, table in enumerate(parse_html_tables(body)):
        for row_index, row in enumerate(table):
            if len(row) < 2:
                continue
            label = normalized_label(row[0])
            value = normalize_text(row[1])
            locator = f"table[{table_index}]/row[{row_index}]"
            if "종목명" in label and "etf_name" not in parsed:
                parsed["etf_name"] = value
                locators["etf_name"] = locator
            elif "기준가격" in label and "reference_price" not in parsed:
                parsed["reference_price"] = value
                locators["reference_price"] = locator
            elif label == "사유" and "reason" not in parsed:
                parsed["reason"] = value
                locators["reason"] = locator
            elif "적용일" in label and "apply_date" not in parsed:
                parsed["apply_date"] = value
                locators["apply_date"] = locator
    required = {"etf_name", "reference_price", "reason", "apply_date"}
    missing = sorted(required - set(parsed))
    if missing:
        raise ValueError(f"KIND table required fields missing: {', '.join(missing)}")
    amount = parse_decimal(parsed["reference_price"])
    if amount is None or amount <= 0:
        raise ValueError("KIND reference price is not a positive number")
    if not iso_date(parsed["apply_date"]):
        raise ValueError("KIND apply date is invalid")
    return (
        {
            "etf_name": parsed["etf_name"],
            "disclosed_reason": parsed["reason"],
            "krx_apply_date": iso_date(parsed["apply_date"]),
            "ex_rights_reference_price_krw": format(amount, "g"),
        },
        locators,
    )


def bootstrap() -> None:
    ensure_csv(MANUAL_INPUT_PATH, MANUAL_INPUT_COLUMNS)
    ensure_csv(EVIDENCE_PATH, EVIDENCE_COLUMNS)
    ensure_csv(MATCH_PATH, MATCH_COLUMNS)


def ingest() -> dict[str, object]:
    """Parse declared immutable KIND snapshots and update source/evidence ledgers."""
    bootstrap()
    master = load_master()
    sources = {row["source_id"]: row for row in read_csv(SOURCES_PATH) if row.get("source_id")}
    existing_evidence = {row["krx_evidence_id"]: row for row in read_csv(EVIDENCE_PATH) if row.get("krx_evidence_id")}
    errors: list[dict[str, str]] = []
    processed = 0

    for inbound in read_csv(MANUAL_INPUT_PATH):
        ticker = normalise_ticker(inbound.get("ticker"))
        published = iso_date(inbound.get("published_at"))
        acpt_no = clean(inbound.get("acpt_no"))
        doc_no = clean(inbound.get("doc_no"))
        raw_rel = clean(inbound.get("raw_path"))
        raw_path = ROOT / raw_rel
        source_id = clean(inbound.get("source_id")) or deterministic_id("krx:kind", ticker, published, acpt_no)
        prefix = {"source_id": source_id, "ticker": ticker}
        if not ticker or not re.fullmatch(r"[0-9A-Z]{6}", ticker):
            errors.append({**prefix, "issue": "invalid_or_missing_ticker"})
            continue
        if not published or not acpt_no or not raw_rel:
            errors.append({**prefix, "issue": "missing_required_source_metadata"})
            continue
        if not raw_path.exists():
            errors.append({**prefix, "issue": "raw_snapshot_missing"})
            continue
        try:
            parsed, locators = parse_kind_snapshot(raw_path)
        except Exception as error:
            errors.append({**prefix, "issue": f"parse_failed:{type(error).__name__}:{error}"})
            continue
        if normalize_text(parsed["disclosed_reason"]) != "분배락":
            errors.append({**prefix, "issue": "disclosure_reason_is_not_distribution_ex_rights"})
            continue

        metadata = master.get(ticker, {})
        body_hash = sha256(raw_path.read_bytes())
        now = utc_now()
        source = blank_source()
        source.update({
            "source_id": source_id, "etf_id": clean(metadata.get("isin_cd")), "ticker": ticker,
            "source_owner": "KRX KIND", "source_type": "krx_ex_rights_disclosure",
            "source_document_key": acpt_no, "source_title": clean(inbound.get("source_title")) or "ETF 분배락 기준가격 안내",
            "source_url": clean(inbound.get("source_url")), "published_at": published,
            "retrieved_at": now, "http_status": "200", "media_type": "text/html",
            "content_hash_sha256": body_hash, "parser_name": "krx_kind_browser_dom_table_v1",
            "parser_version": "1", "parse_status": "parsed", "raw_path": raw_rel,
            "source_etf_name": parsed["etf_name"],
            "parse_note": f"{clean(inbound.get('capture_method')) or 'browser_dom_snapshot'}로 보존한 KRX KIND 본문을 표 파서로 추출.",
        })
        sources[source_id] = source

        evidence_id = deterministic_id("krx-evidence", source_id, ticker, parsed["krx_apply_date"], parsed["ex_rights_reference_price_krw"])
        evidence = blank(EVIDENCE_COLUMNS)
        evidence.update({
            "krx_evidence_id": evidence_id, "source_id": source_id,
            "etf_id": clean(metadata.get("isin_cd")), "ticker": ticker,
            "etf_name": parsed["etf_name"], "source_title": source["source_title"],
            "source_url": source["source_url"], "published_at": published,
            "acpt_no": acpt_no, "doc_no": doc_no,
            "disclosed_reason": parsed["disclosed_reason"], "krx_apply_date": parsed["krx_apply_date"],
            "ex_rights_reference_price_krw": parsed["ex_rights_reference_price_krw"],
            "row_locator": ";".join(f"{field}:{locator}" for field, locator in sorted(locators.items())),
            "content_hash_sha256": body_hash,
            "capture_method": clean(inbound.get("capture_method")) or "browser_dom_snapshot",
            "parser_name": "krx_kind_browser_dom_table_v1", "parser_version": "1",
            "evidence_status": "parsed", "review_status": "unreviewed", "created_at": now,
            "note": clean(inbound.get("note")) or "KIND 분배락 기준가격 원문 증거. 운용사 후보 대조 전에는 이벤트를 생성하지 않음.",
        })
        existing_evidence[evidence_id] = evidence
        processed += 1

    write_csv(SOURCES_PATH, SOURCE_COLUMNS, [sources[key] for key in sorted(sources)])
    write_csv(EVIDENCE_PATH, EVIDENCE_COLUMNS, [existing_evidence[key] for key in sorted(existing_evidence)])
    return {"processed": processed, "evidence_count": len(existing_evidence), "error_count": len(errors), "errors": errors}


def dates_within_window(candidate_source: dict[str, str], evidence: dict[str, str]) -> tuple[bool, str]:
    try:
        issuer_published = date.fromisoformat(iso_date(candidate_source.get("published_at")))
        apply_date = date.fromisoformat(iso_date(evidence.get("krx_apply_date")))
    except ValueError:
        return False, "candidate_source_or_kind_apply_date_missing"
    gap = (apply_date - issuer_published).days
    if 0 <= gap <= MAX_NOTICE_TO_APPLY_DAYS:
        return True, f"ticker_exact_and_apply_date_{gap}_days_after_issuer_notice"
    return False, f"apply_date_outside_{MAX_NOTICE_TO_APPLY_DAYS}_day_window:{gap}"


def new_event(candidate: dict[str, str], evidence: dict[str, str], master: dict[str, dict[str, str]]) -> dict[str, str]:
    ticker = normalise_ticker(candidate.get("ticker"))
    metadata = master.get(ticker, {})
    apply_date = evidence["krx_apply_date"]
    event = blank_event()
    event.update({
        "event_id": f"{clean(metadata.get('isin_cd')) or ticker}:{apply_date}:ordinary_cash:v1",
        "etf_id": clean(metadata.get("isin_cd")), "ticker": ticker,
        "etf_name": clean(metadata.get("name")) or candidate.get("etf_name", ""),
        "krx_apply_date": apply_date, "ex_date": apply_date,
        "distribution_per_share_krw": candidate["distribution_per_share_krw"],
        "distribution_type": "ordinary_cash", "event_status": "announced", "currency": "KRW",
        "ex_rights_reference_price_krw": evidence["ex_rights_reference_price_krw"],
        "issuer_source_id": candidate["source_id"], "krx_source_id": evidence["source_id"],
        "issuer_amount_verified": "true", "krx_ex_date_verified": "true",
        "verification_status": "verified",
        "verification_note": "운용사 공식 공지의 좌당 분배금과 KRX KIND의 분배락 적용일·기준가격을 종목코드 및 14일 이내 공시-적용일 규칙으로 대조함. 기준일·지급일은 원문 미확보로 공란 유지.",
        "source_collected_at": utc_now(), "updated_at": utc_now(),
    })
    return event


def reconcile() -> dict[str, object]:
    """Create verified events only for unique, source-chain-complete candidate matches."""
    bootstrap()
    master = load_master()
    sources = {row["source_id"]: row for row in read_csv(SOURCES_PATH) if row.get("source_id")}
    candidates = read_csv(CANDIDATE_PATH)
    evidence = read_csv(EVIDENCE_PATH)
    events = {row["event_id"]: row for row in read_csv(EVENTS_PATH) if row.get("event_id")}
    matches: dict[str, dict[str, str]] = {}
    created = 0
    conflicts = 0
    unmatched = 0

    candidates_by_ticker: dict[str, list[dict[str, str]]] = {}
    for candidate in candidates:
        candidates_by_ticker.setdefault(normalise_ticker(candidate.get("ticker")), []).append(candidate)

    for item in evidence:
        evidence_id = clean(item.get("krx_evidence_id"))
        ticker = normalise_ticker(item.get("ticker"))
        eligible: list[tuple[dict[str, str], str]] = []
        for candidate in candidates_by_ticker.get(ticker, []):
            source = sources.get(clean(candidate.get("source_id")))
            if not source or source.get("source_type") != "issuer_notice":
                continue
            if parse_decimal(candidate.get("distribution_per_share_krw")) is None:
                continue
            in_window, reason = dates_within_window(source, item)
            if in_window:
                eligible.append((candidate, reason))

        now = utc_now()
        if len(eligible) != 1:
            status = "unmatched" if not eligible else "ambiguous_candidate_match"
            reason = "no_issuer_candidate_satisfies_match_rule" if not eligible else f"{len(eligible)}_issuer_candidates_satisfy_match_rule"
            match = blank(MATCH_COLUMNS)
            match.update({
                "match_id": deterministic_id("krx-match", evidence_id, status),
                "krx_evidence_id": evidence_id, "ticker": ticker,
                "krx_source_id": item.get("source_id", ""), "match_rule_version": "1",
                "match_status": status, "match_reason": reason, "created_at": now, "updated_at": now,
                "note": "자동 이벤트 승격 없음. 수동 검토 또는 추가 원문 증거 필요.",
            })
            matches[match["match_id"]] = match
            unmatched += 1
            continue

        candidate, reason = eligible[0]
        proposed = new_event(candidate, item, master)
        event_id = proposed["event_id"]
        existing = events.get(event_id)
        status = "verified_event_created"
        note = "운용사 분배금 후보와 KRX KIND 적용일·기준가격 증거가 단일 규칙 매칭됨."
        if existing:
            amount_changed = clean(existing.get("distribution_per_share_krw")) not in {"", proposed["distribution_per_share_krw"]}
            existing_krx = clean(existing.get("krx_source_id"))
            source_changed = existing_krx not in {"", proposed["krx_source_id"]}
            if amount_changed or source_changed:
                existing["verification_status"] = "conflict"
                existing["verification_note"] = "기존 이벤트와 KIND 대조 결과의 금액 또는 KRX 원천이 달라 자동 갱신하지 않음. 수동 검토 필요."
                existing["updated_at"] = now
                events[event_id] = existing
                status = "event_conflict"
                note = "기존 이벤트와 자동 대조 결과 불일치. TR 차단 상태 유지."
                conflicts += 1
            else:
                merged = {**existing, **{key: value for key, value in proposed.items() if value or not existing.get(key)}}
                merged["updated_at"] = now
                events[event_id] = merged
                status = "verified_event_refreshed"
        else:
            events[event_id] = proposed
            created += 1

        match = blank(MATCH_COLUMNS)
        match.update({
            "match_id": deterministic_id("krx-match", candidate["candidate_id"], evidence_id, status),
            "candidate_id": candidate["candidate_id"], "krx_evidence_id": evidence_id, "event_id": event_id,
            "ticker": ticker, "candidate_source_id": candidate["source_id"], "krx_source_id": item["source_id"],
            "match_rule_version": "1", "match_status": status, "match_reason": reason,
            "created_at": now, "updated_at": now, "note": note,
        })
        matches[match["match_id"]] = match

    write_csv(EVENTS_PATH, EVENT_COLUMNS, [events[key] for key in sorted(events)])
    write_csv(MATCH_PATH, MATCH_COLUMNS, [matches[key] for key in sorted(matches)])
    refresh_coverage(master, events.values(), sources)
    return {"created": created, "conflicts": conflicts, "unmatched": unmatched, "event_count": len(events), "match_count": len(matches)}


def validate() -> dict[str, object]:
    """Validate raw-source chains and every verified event created by this pipeline."""
    bootstrap()
    sources = {row["source_id"]: row for row in read_csv(SOURCES_PATH) if row.get("source_id")}
    candidates = {row["candidate_id"]: row for row in read_csv(CANDIDATE_PATH) if row.get("candidate_id")}
    evidence = {row["krx_evidence_id"]: row for row in read_csv(EVIDENCE_PATH) if row.get("krx_evidence_id")}
    events = {row["event_id"]: row for row in read_csv(EVENTS_PATH) if row.get("event_id")}
    matches = read_csv(MATCH_PATH)
    errors: list[dict[str, str]] = []
    warnings: list[dict[str, str]] = []

    for evidence_id, item in evidence.items():
        source = sources.get(item.get("source_id", ""))
        if not source:
            errors.append({"krx_evidence_id": evidence_id, "issue": "source_missing_from_source_ledger"})
            continue
        raw_path = ROOT / clean(source.get("raw_path"))
        if not raw_path.exists():
            errors.append({"krx_evidence_id": evidence_id, "issue": "raw_snapshot_missing"})
        else:
            actual = sha256(raw_path.read_bytes())
            if actual != clean(item.get("content_hash_sha256")) or actual != clean(source.get("content_hash_sha256")):
                errors.append({"krx_evidence_id": evidence_id, "issue": "raw_snapshot_hash_mismatch"})
        if normalize_text(item.get("disclosed_reason")) != "분배락":
            errors.append({"krx_evidence_id": evidence_id, "issue": "invalid_disclosure_reason"})
        if not iso_date(item.get("krx_apply_date")):
            errors.append({"krx_evidence_id": evidence_id, "issue": "invalid_apply_date"})
        price = parse_decimal(item.get("ex_rights_reference_price_krw"))
        if price is None or price <= 0:
            errors.append({"krx_evidence_id": evidence_id, "issue": "invalid_reference_price"})

    for match in matches:
        status = clean(match.get("match_status"))
        if status.startswith("verified_event"):
            candidate = candidates.get(clean(match.get("candidate_id")))
            item = evidence.get(clean(match.get("krx_evidence_id")))
            event = events.get(clean(match.get("event_id")))
            if not candidate or not item or not event:
                errors.append({"match_id": clean(match.get("match_id")), "issue": "verified_match_missing_chain_record"})
                continue
            if normalise_ticker(candidate.get("ticker")) != normalise_ticker(item.get("ticker")):
                errors.append({"match_id": clean(match.get("match_id")), "issue": "candidate_kind_ticker_mismatch"})
            if event.get("verification_status") != "verified":
                errors.append({"match_id": clean(match.get("match_id")), "issue": "matched_event_not_verified"})
            if event.get("krx_apply_date") != item.get("krx_apply_date") or event.get("ex_date") != item.get("krx_apply_date"):
                errors.append({"match_id": clean(match.get("match_id")), "issue": "event_apply_date_not_equal_kind_evidence"})
            if event.get("distribution_per_share_krw") != candidate.get("distribution_per_share_krw"):
                errors.append({"match_id": clean(match.get("match_id")), "issue": "event_amount_not_equal_issuer_candidate"})
            if event.get("ex_rights_reference_price_krw") != item.get("ex_rights_reference_price_krw"):
                errors.append({"match_id": clean(match.get("match_id")), "issue": "event_reference_price_not_equal_kind_evidence"})
        elif status in {"unmatched", "ambiguous_candidate_match", "event_conflict"}:
            warnings.append({"match_id": clean(match.get("match_id")), "issue": f"tr_blocked_{status}"})

    report = {
        "generated_at": utc_now(), "krx_evidence_count": len(evidence), "match_count": len(matches),
        "event_count": len(events), "error_count": len(errors), "warning_count": len(warnings),
        "errors": errors, "warnings": warnings,
        "verified_event_count": sum(1 for row in events.values() if row.get("verification_status") == "verified"),
    }
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    VALIDATION_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


def run(_: argparse.Namespace) -> dict[str, object]:
    bootstrap()
    return {"ingest": ingest(), "reconcile": reconcile(), "validation": validate()}


def main() -> int:
    parser = argparse.ArgumentParser(description="ETF Campus KRX KIND distribution evidence reconciler")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("bootstrap").set_defaults(func=lambda _: {"status": "bootstrapped"})
    subparsers.add_parser("ingest").set_defaults(func=lambda _: ingest())
    subparsers.add_parser("reconcile").set_defaults(func=lambda _: reconcile())
    subparsers.add_parser("validate").set_defaults(func=lambda _: validate())
    subparsers.add_parser("run").set_defaults(func=run)
    args = parser.parse_args()
    if args.command == "bootstrap":
        bootstrap()
    result = args.func(args)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 2 if isinstance(result, dict) and result.get("error_count", 0) else 0


if __name__ == "__main__":
    sys.exit(main())
