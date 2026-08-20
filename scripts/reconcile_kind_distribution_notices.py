#!/usr/bin/env python3
"""Parse KRX KIND batch distribution notices and reconcile them with issuer candidates.

A KIND batch notice is an official source for per-share distribution amount, record
(date of entitlement), and scheduled payment date.  It is *not* an ex-rights
reference-price notice, so a batch match alone never creates a verified event or
unblocks total-return calculation.  It can enrich a separately verified event that
already has a linked KRX ex-rights disclosure.

Commands:
  bootstrap  Create batch evidence and candidate-match ledgers.
  parse      Parse collected KRX batch notices into field-level row evidence.
  reconcile  Match exact ISIN/ticker/amount candidates and enrich eligible events.
  validate   Check immutable raw hashes and strict no-premature-verification rules.
  run        Execute bootstrap -> parse -> reconcile -> validate.

Only Python's standard library is used.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from datetime import date
from pathlib import Path
from typing import Iterable

from build_distribution_candidates import table_rows
from collect_distribution_sources import (
    DATA_DIR,
    EVENT_COLUMNS,
    EVENTS_PATH,
    MASTER_PATH,
    REPORT_DIR,
    ROOT,
    SOURCE_COLUMNS,
    SOURCES_PATH,
    clean,
    deterministic_id,
    iso_date,
    normalise_ticker,
    parse_decimal,
    read_csv,
    refresh_coverage,
    sha256,
    verify_raw_hash,
    utc_now,
    write_csv,
)

CANDIDATE_PATH = DATA_DIR / "etf_distribution_event_candidates.csv"
EVIDENCE_PATH = DATA_DIR / "etf_distribution_krx_kind_notice_evidence.csv"
MATCH_PATH = DATA_DIR / "etf_distribution_candidate_krx_notice_matches.csv"
VALIDATION_PATH = REPORT_DIR / "krx_kind_distribution_notice_validation_report.json"

EVIDENCE_COLUMNS = [
    "notice_evidence_id", "source_id", "etf_id", "ticker", "etf_name",
    "distribution_record_date", "distribution_pay_date", "distribution_per_share_krw",
    "row_locator", "raw_row_text", "content_hash_sha256", "parser_name",
    "parser_version", "evidence_status", "review_status", "created_at", "note",
]
MATCH_COLUMNS = [
    "match_id", "candidate_id", "notice_evidence_id", "event_id", "ticker",
    "candidate_source_id", "krx_notice_source_id", "match_rule_version",
    "match_status", "match_reason", "created_at", "updated_at", "note",
]
ISIN_RE = re.compile(r"^KR[0-9A-Z]{10}$")


def ensure_csv(path: Path, columns: list[str]) -> None:
    if not path.exists():
        write_csv(path, columns, [])


def blank(columns: list[str]) -> dict[str, str]:
    return {column: "" for column in columns}


def parse_record(row: list[str], table_index: int, row_index: int, isin_to_master: dict[str, dict[str, str]], source_id: str, body_hash: str) -> dict[str, str] | None:
    """Parse an expected six-column KRX batch distribution-notice row."""
    if len(row) < 6:
        return None
    isin = clean(row[0]).upper()
    if not ISIN_RE.fullmatch(isin):
        return None
    record_date = iso_date(row[2])
    pay_date = iso_date(row[3])
    amount = parse_decimal(row[4])
    if not record_date or not pay_date or amount is None or amount < 0:
        raise ValueError(f"invalid batch-notice row at table[{table_index}]/row[{row_index}]")
    if date.fromisoformat(pay_date) < date.fromisoformat(record_date):
        raise ValueError(f"payment date precedes record date at table[{table_index}]/row[{row_index}]")
    metadata = isin_to_master.get(isin, {})
    ticker = normalise_ticker(metadata.get("ticker"))
    now = utc_now()
    evidence = blank(EVIDENCE_COLUMNS)
    evidence.update({
        "notice_evidence_id": deterministic_id("krx-notice-evidence", source_id, isin, record_date, format(amount, "g"), f"{table_index}:{row_index}"),
        "source_id": source_id, "etf_id": isin, "ticker": ticker,
        "etf_name": clean(metadata.get("name")) or clean(row[1]),
        "distribution_record_date": record_date, "distribution_pay_date": pay_date,
        "distribution_per_share_krw": format(amount, "g"),
        "row_locator": f"table[{table_index}]/row[{row_index}]", "raw_row_text": " | ".join(clean(item) for item in row[:6]),
        "content_hash_sha256": body_hash, "parser_name": "krx_kind_distribution_notice_table_v1",
        "parser_version": "1", "evidence_status": "parsed", "review_status": "unreviewed",
        "created_at": now,
        "note": "KRX KIND 일괄 분배금 공시 행. 기준일·지급예정일·분배금 증거이며, 분배락 적용일·기준가격 증거를 대체하지 않음.",
    })
    return evidence


def bootstrap() -> None:
    ensure_csv(EVIDENCE_PATH, EVIDENCE_COLUMNS)
    ensure_csv(MATCH_PATH, MATCH_COLUMNS)


def master_maps() -> tuple[dict[str, dict[str, str]], dict[str, dict[str, str]]]:
    by_ticker: dict[str, dict[str, str]] = {}
    by_isin: dict[str, dict[str, str]] = {}
    for row in read_csv(MASTER_PATH):
        ticker = normalise_ticker(row.get("ticker"))
        isin = clean(row.get("isin_cd")).upper()
        record = {**row, "ticker": ticker, "isin_cd": isin, "name": clean(row.get("name"))}
        if ticker:
            by_ticker[ticker] = record
        if ISIN_RE.fullmatch(isin):
            by_isin[isin] = record
    return by_ticker, by_isin


def batch_sources(sources: dict[str, dict[str, str]]) -> list[dict[str, str]]:
    return [row for row in sources.values() if clean(row.get("source_type")) == "krx_distribution_notice_batch"]


def parse() -> dict[str, object]:
    bootstrap()
    _, by_isin = master_maps()
    sources = {row["source_id"]: row for row in read_csv(SOURCES_PATH) if row.get("source_id")}
    existing = {row["notice_evidence_id"]: row for row in read_csv(EVIDENCE_PATH) if row.get("notice_evidence_id")}
    parsed_sources: list[str] = []
    errors: list[dict[str, str]] = []
    total_rows = 0

    for source in batch_sources(sources):
        source_id = source["source_id"]
        raw_path = ROOT / clean(source.get("raw_path"))
        if not raw_path.exists():
            errors.append({"source_id": source_id, "issue": "raw_source_file_missing"})
            continue
        body_hash = sha256(raw_path.read_bytes())
        expected_hash = clean(source.get("content_hash_sha256"))
        if expected_hash and not verify_raw_hash(raw_path.read_bytes(), expected_hash):
            errors.append({"source_id": source_id, "issue": "raw_source_hash_mismatch"})
            continue
        source_records: dict[str, dict[str, str]] = {}
        try:
            for table_index, table in enumerate(table_rows(raw_path)):
                for row_index, row in enumerate(table):
                    record = parse_record(row, table_index, row_index, by_isin, source_id, body_hash)
                    if record:
                        source_records[record["notice_evidence_id"]] = record
        except Exception as error:
            errors.append({"source_id": source_id, "issue": f"parse_failed:{type(error).__name__}:{error}"})
            continue
        if not source_records:
            errors.append({"source_id": source_id, "issue": "no_distribution_rows_found"})
            continue
        # Replace only evidence originating from successfully parsed sources.
        existing = {key: value for key, value in existing.items() if value.get("source_id") != source_id}
        existing.update(source_records)
        source["parser_name"] = "krx_kind_distribution_notice_table_v1"
        source["parser_version"] = "1"
        source["parse_status"] = "parsed"
        source["parse_note"] = "KRX KIND 일괄공시 표에서 ISIN·기준일·지급예정일·분배금을 행 단위로 추출. 분배락 적용일 대조는 별도 KIND 공시 필요."
        sources[source_id] = source
        parsed_sources.append(source_id)
        total_rows += len(source_records)

    write_csv(SOURCES_PATH, SOURCE_COLUMNS, [sources[key] for key in sorted(sources)])
    write_csv(EVIDENCE_PATH, EVIDENCE_COLUMNS, [existing[key] for key in sorted(existing)])
    return {"parsed_sources": len(parsed_sources), "parsed_rows": total_rows, "evidence_count": len(existing), "error_count": len(errors), "errors": errors}


def same_amount(left: str, right: str) -> bool:
    left_value = parse_decimal(left)
    right_value = parse_decimal(right)
    return left_value is not None and right_value is not None and left_value == right_value


def reconcile() -> dict[str, object]:
    """Match batch-notice rows, enriching only already verified ex-rights events."""
    bootstrap()
    by_ticker, _ = master_maps()
    sources = {row["source_id"]: row for row in read_csv(SOURCES_PATH) if row.get("source_id")}
    candidates = read_csv(CANDIDATE_PATH)
    evidence_rows = read_csv(EVIDENCE_PATH)
    events = {row["event_id"]: row for row in read_csv(EVENTS_PATH) if row.get("event_id")}
    matches: dict[str, dict[str, str]] = {}
    candidates_by_ticker: dict[str, list[dict[str, str]]] = {}
    evidence_by_ticker: dict[str, list[dict[str, str]]] = {}
    for candidate in candidates:
        candidates_by_ticker.setdefault(normalise_ticker(candidate.get("ticker")), []).append(candidate)
    for evidence in evidence_rows:
        evidence_by_ticker.setdefault(normalise_ticker(evidence.get("ticker")), []).append(evidence)

    exact_candidate_matches = 0
    enriched_events = 0
    conflicts = 0
    now = utc_now()
    for ticker, items in evidence_by_ticker.items():
        for evidence in items:
            eligible = [candidate for candidate in candidates_by_ticker.get(ticker, []) if same_amount(candidate.get("distribution_per_share_krw", ""), evidence.get("distribution_per_share_krw", ""))]
            if len(eligible) != 1:
                status = "unmatched" if not eligible else "ambiguous_candidate_match"
                reason = "no_issuer_candidate_with_equal_distribution_amount" if not eligible else f"{len(eligible)}_issuer_candidates_with_equal_distribution_amount"
                match = blank(MATCH_COLUMNS)
                match.update({
                    "match_id": deterministic_id("krx-notice-match", evidence["notice_evidence_id"], status),
                    "notice_evidence_id": evidence["notice_evidence_id"], "ticker": ticker,
                    "krx_notice_source_id": evidence["source_id"], "match_rule_version": "1",
                    "match_status": status, "match_reason": reason, "created_at": now, "updated_at": now,
                    "note": "일괄공시 단독으로는 이벤트를 verified로 승격하지 않음.",
                })
                matches[match["match_id"]] = match
                continue

            candidate = eligible[0]
            exact_candidate_matches += 1
            event_id = ""
            status = "amount_and_schedule_matched"
            note = "운용사 후보 금액과 KRX KIND 일괄공시 금액이 일치. 이 증거만으로는 분배락 적용일·기준가격이 없어 verified 이벤트를 생성하지 않음."
            # Only enrich an event that is already verified through the individual KIND ex-rights evidence chain.
            verified_events = [event for event in events.values() if normalise_ticker(event.get("ticker")) == ticker and event.get("verification_status") == "verified" and same_amount(event.get("distribution_per_share_krw", ""), evidence.get("distribution_per_share_krw", ""))]
            if len(verified_events) == 1:
                event = verified_events[0]
                event_id = event["event_id"]
                existing_record = iso_date(event.get("record_date"))
                existing_pay = iso_date(event.get("pay_date"))
                incoming_record = evidence["distribution_record_date"]
                incoming_pay = evidence["distribution_pay_date"]
                if (existing_record and existing_record != incoming_record) or (existing_pay and existing_pay != incoming_pay):
                    event["verification_status"] = "conflict"
                    event["verification_note"] = "기존 이벤트의 기준일 또는 지급일과 KRX KIND 일괄공시가 달라 자동 갱신하지 않음. TR 차단 상태 유지."
                    event["updated_at"] = now
                    events[event_id] = event
                    status = "event_schedule_conflict"
                    note = "이미 검증된 이벤트와 KRX 일괄공시 일정이 불일치함."
                    conflicts += 1
                else:
                    event["record_date"] = incoming_record
                    event["pay_date"] = incoming_pay
                    source_marker = f"KRX 일괄공시 원천 {evidence['source_id']}"
                    if source_marker not in event.get("verification_note", ""):
                        event["verification_note"] = f"{clean(event.get('verification_note'))} | {source_marker} 행으로 지급기준일 {incoming_record}, 지급예정일 {incoming_pay} 대조.".strip()
                    event["updated_at"] = now
                    events[event_id] = event
                    status = "verified_event_schedule_enriched"
                    note = "개별 KIND 분배락 공시로 기존 verified인 이벤트에 KRX 일괄공시의 기준일·지급예정일을 보강함."
                    enriched_events += 1

            match = blank(MATCH_COLUMNS)
            match.update({
                "match_id": deterministic_id("krx-notice-match", candidate["candidate_id"], evidence["notice_evidence_id"], status),
                "candidate_id": candidate["candidate_id"], "notice_evidence_id": evidence["notice_evidence_id"],
                "event_id": event_id, "ticker": ticker, "candidate_source_id": candidate["source_id"],
                "krx_notice_source_id": evidence["source_id"], "match_rule_version": "1",
                "match_status": status, "match_reason": "ticker_exact_and_distribution_amount_equal",
                "created_at": now, "updated_at": now, "note": note,
            })
            matches[match["match_id"]] = match

    write_csv(EVENTS_PATH, EVENT_COLUMNS, [events[key] for key in sorted(events)])
    write_csv(MATCH_PATH, MATCH_COLUMNS, [matches[key] for key in sorted(matches)])
    refresh_coverage(by_ticker, events.values(), sources)
    return {"exact_candidate_matches": exact_candidate_matches, "enriched_events": enriched_events, "conflicts": conflicts, "event_count": len(events), "match_count": len(matches)}


def validate() -> dict[str, object]:
    bootstrap()
    sources = {row["source_id"]: row for row in read_csv(SOURCES_PATH) if row.get("source_id")}
    candidates = {row["candidate_id"]: row for row in read_csv(CANDIDATE_PATH) if row.get("candidate_id")}
    evidence = {row["notice_evidence_id"]: row for row in read_csv(EVIDENCE_PATH) if row.get("notice_evidence_id")}
    events = {row["event_id"]: row for row in read_csv(EVENTS_PATH) if row.get("event_id")}
    matches = read_csv(MATCH_PATH)
    errors: list[dict[str, str]] = []
    warnings: list[dict[str, str]] = []

    for evidence_id, row in evidence.items():
        source = sources.get(row.get("source_id", ""))
        if not source:
            errors.append({"notice_evidence_id": evidence_id, "issue": "source_missing_from_ledger"})
            continue
        raw = ROOT / clean(source.get("raw_path"))
        if not raw.exists():
            errors.append({"notice_evidence_id": evidence_id, "issue": "raw_source_file_missing"})
        else:
            actual_hash = sha256(raw.read_bytes())
            expected_row_hash = clean(row.get("content_hash_sha256"))
            expected_source_hash = clean(source.get("content_hash_sha256"))
            if not verify_raw_hash(raw.read_bytes(), expected_row_hash) or not verify_raw_hash(raw.read_bytes(), expected_source_hash):
                errors.append({"notice_evidence_id": evidence_id, "issue": "raw_source_hash_mismatch"})
        if not ISIN_RE.fullmatch(clean(row.get("etf_id")).upper()):
            errors.append({"notice_evidence_id": evidence_id, "issue": "invalid_isin"})
        if not iso_date(row.get("distribution_record_date")) or not iso_date(row.get("distribution_pay_date")):
            errors.append({"notice_evidence_id": evidence_id, "issue": "invalid_schedule_date"})
        elif date.fromisoformat(iso_date(row.get("distribution_pay_date"))) < date.fromisoformat(iso_date(row.get("distribution_record_date"))):
            errors.append({"notice_evidence_id": evidence_id, "issue": "payment_before_record_date"})
        if parse_decimal(row.get("distribution_per_share_krw")) is None:
            errors.append({"notice_evidence_id": evidence_id, "issue": "invalid_distribution_amount"})

    for match in matches:
        status = clean(match.get("match_status"))
        candidate = candidates.get(clean(match.get("candidate_id"))) if match.get("candidate_id") else None
        notice = evidence.get(clean(match.get("notice_evidence_id"))) if match.get("notice_evidence_id") else None
        if status in {"amount_and_schedule_matched", "verified_event_schedule_enriched"}:
            if not candidate or not notice:
                errors.append({"match_id": clean(match.get("match_id")), "issue": "matched_record_missing_candidate_or_notice_evidence"})
            elif normalise_ticker(candidate.get("ticker")) != normalise_ticker(notice.get("ticker")) or not same_amount(candidate.get("distribution_per_share_krw", ""), notice.get("distribution_per_share_krw", "")):
                errors.append({"match_id": clean(match.get("match_id")), "issue": "matched_candidate_notice_disagreement"})
        if status == "verified_event_schedule_enriched":
            event = events.get(clean(match.get("event_id")))
            if not event or event.get("verification_status") != "verified":
                errors.append({"match_id": clean(match.get("match_id")), "issue": "enriched_event_not_verified"})
            elif not event.get("krx_source_id"):
                errors.append({"match_id": clean(match.get("match_id")), "issue": "enriched_event_missing_individual_kind_source"})
        if status in {"unmatched", "ambiguous_candidate_match", "event_schedule_conflict"}:
            warnings.append({"match_id": clean(match.get("match_id")), "issue": f"tr_blocked_{status}"})

    # A batch notice must never be the lone KRX source that made an event verified.
    for event in events.values():
        if event.get("verification_status") == "verified" and clean(event.get("krx_source_id")) in {row.get("source_id", "") for row in evidence.values()}:
            errors.append({"event_id": event.get("event_id", ""), "issue": "batch_notice_cannot_be_sole_verified_krx_source"})

    report = {
        "generated_at": utc_now(), "notice_evidence_count": len(evidence), "match_count": len(matches),
        "event_count": len(events), "error_count": len(errors), "warning_count": len(warnings),
        "errors": errors, "warnings": warnings,
        "verified_event_count": sum(1 for row in events.values() if row.get("verification_status") == "verified"),
    }
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    VALIDATION_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


def run(_: argparse.Namespace) -> dict[str, object]:
    bootstrap()
    return {"parse": parse(), "reconcile": reconcile(), "validation": validate()}


def main() -> int:
    parser = argparse.ArgumentParser(description="ETF Campus KRX KIND batch distribution notice reconciler")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("bootstrap").set_defaults(func=lambda _: {"status": "bootstrapped"})
    subparsers.add_parser("parse").set_defaults(func=lambda _: parse())
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
