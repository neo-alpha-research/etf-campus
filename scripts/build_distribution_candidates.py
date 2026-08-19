#!/usr/bin/env python3
"""Build reviewable ETF distribution candidates from immutable issuer documents.

This P1 pipeline deliberately writes *candidates*, not verified distribution events.
It parses selected official issuer notices saved by collect_distribution_sources.py,
records row-level evidence, creates month-level coverage windows, and keeps all
outputs blocked from the total-return calculator until KIND evidence is attached.

Commands:
  bootstrap  Create candidate, evidence, coverage-window, and run-log CSVs.
  parse      Parse supported issuer notices preserved in data/distributions/raw.
  validate   Check candidate source chains, ticker mapping, and evidence links.
  run        Execute bootstrap -> parse -> validate.

Only the Python standard library is used.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from dataclasses import dataclass
from datetime import date, datetime, timezone
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable

from distribution_registry_parser import parse_registry_source

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "distributions"
MASTER_PATH = ROOT / "data" / "etf_master_draft.csv"
SOURCES_PATH = DATA_DIR / "etf_distribution_source_documents.csv"
REPORT_DIR = DATA_DIR / "reports"

CANDIDATE_PATH = DATA_DIR / "etf_distribution_event_candidates.csv"
EVIDENCE_PATH = DATA_DIR / "etf_distribution_event_evidence.csv"
WINDOW_PATH = DATA_DIR / "etf_distribution_coverage_windows.csv"
RUNS_PATH = DATA_DIR / "distribution_collection_runs.csv"

CANDIDATE_COLUMNS = [
    "candidate_id", "event_id", "source_id", "source_owner", "etf_id", "ticker",
    "etf_name", "issuer_ex_date", "record_date", "pay_date",
    "distribution_per_share_krw", "currency", "distribution_type",
    "row_locator", "raw_row_text", "parser_name", "parser_version",
    "extraction_status", "candidate_status", "created_at", "updated_at", "note",
]
EVIDENCE_COLUMNS = [
    "evidence_id", "event_id", "candidate_id", "source_id", "field_name",
    "source_value", "normalized_value", "row_locator", "evidence_status",
    "review_status", "created_at", "note",
]
WINDOW_COLUMNS = [
    "window_id", "etf_id", "ticker", "window_start", "window_end",
    "issuer_document_source_ids", "issuer_coverage_status", "krx_coverage_status",
    "corporate_action_coverage_status", "window_status", "last_checked_at", "note",
]
RUN_COLUMNS = [
    "run_id", "pipeline_step", "status", "started_at", "completed_at",
    "input_source_ids", "input_hash_sha256", "output_count", "error_count", "note",
]

TICKER_RE = re.compile(r"^[0-9A-Z]{6}$")
NUMBER_RE = re.compile(r"^-?\d+(?:\.\d+)?$")
SPACE_RE = re.compile(r"\s+")


@dataclass(frozen=True)
class ParserConfig:
    source_id: str
    parser_name: str
    ticker_index: int
    name_index: int
    amount_index: int
    issuer_ex_date: str = ""
    record_date: str = ""
    pay_date: str = ""


PARSER_CONFIGS = {
    "issuer:kodex:notice:20260728:monthend": ParserConfig(
        "issuer:kodex:notice:20260728:monthend", "kodex_notice_table_v1", 0, 1, 3,
        "2026-07-30", "2026-07-31", "2026-08-04",
    ),
    "issuer:tiger:notice:20260527:monthend": ParserConfig(
        "issuer:tiger:notice:20260527:monthend", "tiger_notice_table_v1", 0, 1, 2, "2026-05-28", "2026-05-29", "2026-06-02"
    ),
    "issuer:tiger:notice:20260611:midmonth": ParserConfig(
        "issuer:tiger:notice:20260611:midmonth", "tiger_notice_table_v1", 0, 1, 2, "2026-06-12", "2026-06-15", "2026-06-17"
    ),
    "issuer:tiger:notice:20260626:monthend": ParserConfig(
        "issuer:tiger:notice:20260626:monthend", "tiger_notice_table_v1", 0, 1, 2, "2026-06-29", "2026-06-30", "2026-07-02"
    ),
    "issuer:tiger:notice:20260713:midmonth": ParserConfig(
        "issuer:tiger:notice:20260713:midmonth", "tiger_notice_table_v1", 0, 1, 2, "2026-07-14", "2026-07-15", "2026-07-20"
    ),
    "issuer:tiger:notice:20260812:midmonth": ParserConfig(
        "issuer:tiger:notice:20260812:midmonth", "tiger_notice_table_v1", 0, 1, 2, "2026-08-13", "2026-08-14", "2026-08-19"
    ),
    "issuer:rise:notice:20260728:monthend": ParserConfig(
        "issuer:rise:notice:20260728:monthend", "rise_notice_table_v1", 1, 0, 2,
        "", "2026-07-31", "2026-08-04",
    ),
    "issuer:ace:notice:20260729:monthend": ParserConfig(
        "issuer:ace:notice:20260729:monthend", "ace_notice_table_v1", 1, 0, 2
    ),
    "issuer:ace:notice:20260713:midmonth": ParserConfig(
        "issuer:ace:notice:20260713:midmonth", "ace_notice_table_v1", 1, 0, 2
    ),
}


class TableParser(HTMLParser):
    """Extract text cells from HTML tables without adding a project dependency."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.tables: list[list[list[str]]] = []
        self._table_depth = 0
        self._current_table: list[list[str]] | None = None
        self._current_row: list[str] | None = None
        self._cell_parts: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "table":
            self._table_depth += 1
            if self._table_depth == 1:
                self._current_table = []
        elif tag == "tr" and self._table_depth == 1:
            self._current_row = []
        elif tag in {"td", "th"} and self._table_depth == 1 and self._current_row is not None:
            self._cell_parts = []
        elif tag == "br" and self._cell_parts is not None:
            self._cell_parts.append(" ")

    def handle_data(self, data: str) -> None:
        if self._cell_parts is not None:
            self._cell_parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag in {"td", "th"} and self._cell_parts is not None and self._current_row is not None:
            self._current_row.append(normalize_text("".join(self._cell_parts)))
            self._cell_parts = None
        elif tag == "tr" and self._table_depth == 1 and self._current_table is not None and self._current_row is not None:
            if any(self._current_row):
                self._current_table.append(self._current_row)
            self._current_row = None
        elif tag == "table":
            if self._table_depth == 1 and self._current_table is not None:
                self.tables.append(self._current_table)
                self._current_table = None
            self._table_depth = max(0, self._table_depth - 1)


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def clean(value: object | None) -> str:
    return "" if value is None else str(value).strip()


def normalize_text(value: object | None) -> str:
    return SPACE_RE.sub(" ", unescape(clean(value))).strip()


def normalise_ticker(value: object | None) -> str:
    text = normalize_text(value).upper().replace(" ", "")
    if text.isdigit() and len(text) < 6:
        return text.zfill(6)
    return text


def parse_amount(value: object | None) -> str:
    text = normalize_text(value).replace(",", "").replace("원", "").replace("₩", "")
    return text if NUMBER_RE.fullmatch(text) else ""


def month_window(published_at: str) -> tuple[str, str]:
    try:
        parsed = datetime.strptime(published_at, "%Y-%m-%d").date()
    except ValueError:
        return "", ""
    start = parsed.replace(day=1)
    if start.month == 12:
        next_month = date(start.year + 1, 1, 1)
    else:
        next_month = date(start.year, start.month + 1, 1)
    return start.isoformat(), (next_month.fromordinal(next_month.toordinal() - 1)).isoformat()


def deterministic_id(prefix: str, *parts: str) -> str:
    digest = hashlib.sha256("|".join(clean(part) for part in parts).encode("utf-8")).hexdigest()[:20]
    return f"{prefix}:{digest}"


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


def content_hash(rows: Iterable[dict[str, str]]) -> str:
    payload = json.dumps(list(rows), ensure_ascii=False, sort_keys=True).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def blank(columns: list[str]) -> dict[str, str]:
    return {column: "" for column in columns}


def load_master() -> dict[str, dict[str, str]]:
    result: dict[str, dict[str, str]] = {}
    for row in read_csv(MASTER_PATH):
        ticker = normalise_ticker(row.get("ticker"))
        if ticker:
            result[ticker] = {**row, "ticker": ticker, "isin_cd": clean(row.get("isin_cd")), "name": clean(row.get("name"))}
    return result


def source_rows() -> dict[str, dict[str, str]]:
    return {row["source_id"]: row for row in read_csv(SOURCES_PATH) if row.get("source_id")}


def record_run(step: str, status: str, source_ids: list[str], output_count: int, error_count: int = 0, note: str = "") -> None:
    ensure_csv(RUNS_PATH, RUN_COLUMNS)
    rows = read_csv(RUNS_PATH)
    now = utc_now()
    run_id = deterministic_id("run", step, now, ";".join(sorted(source_ids)))
    rows.append({
        "run_id": run_id, "pipeline_step": step, "status": status,
        "started_at": now, "completed_at": now,
        "input_source_ids": ";".join(sorted(source_ids)),
        "input_hash_sha256": content_hash([{"source_id": source_id} for source_id in sorted(source_ids)]),
        "output_count": str(output_count), "error_count": str(error_count), "note": note,
    })
    write_csv(RUNS_PATH, RUN_COLUMNS, rows)


def bootstrap() -> None:
    for path, columns in (
        (CANDIDATE_PATH, CANDIDATE_COLUMNS),
        (EVIDENCE_PATH, EVIDENCE_COLUMNS),
        (WINDOW_PATH, WINDOW_COLUMNS),
        (RUNS_PATH, RUN_COLUMNS),
    ):
        ensure_csv(path, columns)


def decode_raw(path: Path) -> str:
    body = path.read_bytes()
    for encoding in ("utf-8", "euc-kr", "cp949"):
        try:
            return body.decode(encoding)
        except UnicodeDecodeError:
            continue
    return body.decode("utf-8", errors="replace")


def table_rows(path: Path) -> list[list[list[str]]]:
    parser = TableParser()
    parser.feed(decode_raw(path))
    parser.close()
    return parser.tables


def row_value(row: list[str], index: int) -> str:
    return normalize_text(row[index]) if 0 <= index < len(row) else ""


def parse_source(source: dict[str, str], config: ParserConfig, master: dict[str, dict[str, str]]) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    raw_path = ROOT / clean(source.get("raw_path"))
    if not raw_path.exists():
        raise FileNotFoundError(f"raw source is missing: {raw_path}")

    candidates: list[dict[str, str]] = []
    evidence: list[dict[str, str]] = []
    for table_index, table in enumerate(table_rows(raw_path)):
        for row_index, row in enumerate(table):
            ticker = normalise_ticker(row_value(row, config.ticker_index))
            amount = parse_amount(row_value(row, config.amount_index))
            if not TICKER_RE.fullmatch(ticker) or not amount:
                continue
            metadata = master.get(ticker, {})
            name = row_value(row, config.name_index) or clean(metadata.get("name"))
            row_locator = f"table[{table_index}]/row[{row_index}]"
            candidate_id = deterministic_id("candidate", source["source_id"], ticker, amount, row_locator)
            now = utc_now()
            candidate = blank(CANDIDATE_COLUMNS)
            candidate.update({
                "candidate_id": candidate_id, "source_id": source["source_id"],
                "source_owner": source.get("source_owner", ""), "etf_id": clean(metadata.get("isin_cd")),
                "ticker": ticker, "etf_name": name, "issuer_ex_date": config.issuer_ex_date,
                "record_date": config.record_date, "pay_date": config.pay_date,
                "distribution_per_share_krw": amount, "currency": "KRW", "distribution_type": "ordinary_cash", "row_locator": row_locator,
                "raw_row_text": " | ".join(row), "parser_name": config.parser_name,
                "parser_version": "1", "extraction_status": "rule_based_extracted",
                "candidate_status": "pending_krx_verification", "created_at": now, "updated_at": now,
                "note": "운용사 공식 공지에서 규칙 기반 추출. KIND 분배락 적용일·기준가격 대조 전에는 이벤트·TR 계산에 사용하지 않음.",
            })
            candidates.append(candidate)
            for field_name, source_value, normalized_value in (
                ("distribution_per_share_krw", row_value(row, config.amount_index), amount),
                ("issuer_ticker", row_value(row, config.ticker_index), ticker),
                ("issuer_etf_name", row_value(row, config.name_index), name),
            ):
                evidence_row = blank(EVIDENCE_COLUMNS)
                evidence_row.update({
                    "evidence_id": deterministic_id("evidence", candidate_id, field_name, normalized_value),
                    "candidate_id": candidate_id, "source_id": source["source_id"],
                    "field_name": field_name, "source_value": source_value,
                    "normalized_value": normalized_value, "row_locator": row_locator,
                    "evidence_status": "observed", "review_status": "unreviewed",
                    "created_at": now, "note": "운용사 공식 원문 행에서 추출된 증거. KRX 교차검증 전.",
                })
                evidence.append(evidence_row)
    return candidates, evidence


def refresh_windows(candidates: list[dict[str, str]], sources: dict[str, dict[str, str]], master: dict[str, dict[str, str]]) -> list[dict[str, str]]:
    grouped: dict[tuple[str, str, str], list[dict[str, str]]] = {}
    for candidate in candidates:
        source = sources.get(candidate.get("source_id", ""), {})
        start, end = month_window(clean(source.get("published_at")))
        if not start:
            continue
        grouped.setdefault((candidate.get("ticker", ""), start, end), []).append(candidate)

    rows: list[dict[str, str]] = []
    now = utc_now()
    for (ticker, start, end), items in sorted(grouped.items()):
        metadata = master.get(ticker, {})
        source_ids = sorted({item["source_id"] for item in items})
        row = blank(WINDOW_COLUMNS)
        row.update({
            "window_id": deterministic_id("window", ticker, start, end),
            "etf_id": clean(metadata.get("isin_cd")), "ticker": ticker,
            "window_start": start, "window_end": end,
            "issuer_document_source_ids": ";".join(source_ids),
            "issuer_coverage_status": "issuer_events_observed",
            "krx_coverage_status": "pending",
            "corporate_action_coverage_status": "pending",
            "window_status": "blocked",
            "last_checked_at": now,
            "note": "공식 운용사 공지에서 분배금 후보를 확보했으나 KIND·무분배·기업행동 검증 전이므로 TR 계산 차단.",
        })
        rows.append(row)
    return rows


def parse_supported_sources() -> dict[str, object]:
    bootstrap()
    sources = source_rows()
    master = load_master()
    existing_candidates = read_csv(CANDIDATE_PATH)
    existing_evidence = read_csv(EVIDENCE_PATH)
    registry_ids = sorted(
        source_id for source_id, source in sources.items()
        if clean(source.get("source_document_key")).startswith("registry:")
    )
    supported_ids = sorted(set(source_id for source_id in PARSER_CONFIGS if source_id in sources) | set(registry_ids))

    replacement_candidates: dict[str, list[dict[str, str]]] = {}
    replacement_evidence: dict[str, list[dict[str, str]]] = {}
    failures: list[dict[str, str]] = []
    for source_id in supported_ids:
        try:
            if source_id in registry_ids:
                candidates, evidence = parse_registry_source(sources[source_id], CANDIDATE_COLUMNS, EVIDENCE_COLUMNS)
            else:
                candidates, evidence = parse_source(sources[source_id], PARSER_CONFIGS[source_id], master)
            replacement_candidates[source_id] = candidates
            replacement_evidence[source_id] = evidence
        except Exception as error:
            failures.append({"source_id": source_id, "error": f"{type(error).__name__}: {error}"})

    replaced_ids = set(replacement_candidates)
    retained_candidates = [row for row in existing_candidates if row.get("source_id") not in replaced_ids]
    retained_evidence = [row for row in existing_evidence if row.get("source_id") not in replaced_ids]
    all_candidates = retained_candidates + [row for source_id in sorted(replacement_candidates) for row in replacement_candidates[source_id]]
    all_evidence = retained_evidence + [row for source_id in sorted(replacement_evidence) for row in replacement_evidence[source_id]]
    all_candidates.sort(key=lambda row: (row.get("source_id", ""), row.get("ticker", ""), row.get("candidate_id", "")))
    all_evidence.sort(key=lambda row: (row.get("candidate_id", ""), row.get("field_name", "")))
    write_csv(CANDIDATE_PATH, CANDIDATE_COLUMNS, all_candidates)
    write_csv(EVIDENCE_PATH, EVIDENCE_COLUMNS, all_evidence)
    write_csv(WINDOW_PATH, WINDOW_COLUMNS, refresh_windows(all_candidates, sources, master))
    record_run(
        "parse_issuer_notices", "completed" if not failures else "completed_with_errors", supported_ids,
        sum(len(rows) for rows in replacement_candidates.values()), len(failures),
        json.dumps(failures, ensure_ascii=False) if failures else "공식 공지 후보 추출 완료. 모든 후보는 KIND 대조 전 blocked 상태.",
    )
    return {
        "parsed_sources": len(replacement_candidates),
        "candidate_count": len(all_candidates),
        "evidence_count": len(all_evidence),
        "window_count": len(refresh_windows(all_candidates, sources, master)),
        "failures": failures,
    }


def validate() -> dict[str, object]:
    bootstrap()
    sources = source_rows()
    master = load_master()
    candidates = read_csv(CANDIDATE_PATH)
    evidence = read_csv(EVIDENCE_PATH)
    errors: list[dict[str, str]] = []
    warnings: list[dict[str, str]] = []
    candidate_ids: set[str] = set()
    evidence_by_candidate: dict[str, list[dict[str, str]]] = {}
    for item in evidence:
        evidence_by_candidate.setdefault(item.get("candidate_id", ""), []).append(item)

    for item in candidates:
        candidate_id = clean(item.get("candidate_id"))
        if not candidate_id or candidate_id in candidate_ids:
            errors.append({"candidate_id": candidate_id, "issue": "missing_or_duplicate_candidate_id"})
        candidate_ids.add(candidate_id)
        source_id = clean(item.get("source_id"))
        source = sources.get(source_id)
        if not source:
            errors.append({"candidate_id": candidate_id, "issue": "source_missing_from_document_ledger"})
        elif not clean(source.get("raw_path")) or not (ROOT / clean(source.get("raw_path"))).exists():
            errors.append({"candidate_id": candidate_id, "issue": "candidate_source_raw_file_missing"})
        ticker = normalise_ticker(item.get("ticker"))
        if not TICKER_RE.fullmatch(ticker):
            errors.append({"candidate_id": candidate_id, "issue": "invalid_ticker"})
        elif ticker not in master:
            warnings.append({"candidate_id": candidate_id, "issue": "ticker_not_in_current_master"})
        if not parse_amount(item.get("distribution_per_share_krw")):
            errors.append({"candidate_id": candidate_id, "issue": "invalid_distribution_amount"})
        fields = {entry.get("field_name", "") for entry in evidence_by_candidate.get(candidate_id, [])}
        if "distribution_per_share_krw" not in fields:
            errors.append({"candidate_id": candidate_id, "issue": "missing_amount_evidence"})
        if clean(item.get("candidate_status")) == "verified":
            errors.append({"candidate_id": candidate_id, "issue": "candidate_cannot_be_verified_without_event_and_krx_chain"})

    report = {
        "generated_at": utc_now(), "candidate_count": len(candidates), "evidence_count": len(evidence),
        "window_count": len(read_csv(WINDOW_PATH)), "error_count": len(errors), "warning_count": len(warnings),
        "errors": errors, "warnings": warnings,
        "status_counts": {
            status: sum(1 for item in candidates if item.get("candidate_status") == status)
            for status in sorted({item.get("candidate_status", "") for item in candidates})
        },
    }
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    (REPORT_DIR / "distribution_candidate_validation_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    record_run("validate_distribution_candidates", "completed" if not errors else "failed", [], len(candidates), len(errors), "후보·증거·원문 체인 검증")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="ETF Campus distribution candidate evidence pipeline")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("bootstrap").set_defaults(func=lambda _: (bootstrap(), {"status": "bootstrapped"})[1])
    subparsers.add_parser("parse").set_defaults(func=lambda _: parse_supported_sources())
    subparsers.add_parser("validate").set_defaults(func=lambda _: validate())
    subparsers.add_parser("run").set_defaults(func=lambda _: (bootstrap(), parse_supported_sources(), validate()))
    args = parser.parse_args()
    result = args.func(args)
    if isinstance(result, tuple):
        result = result[-1]
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 2 if isinstance(result, dict) and result.get("error_count", 0) else 0


if __name__ == "__main__":
    sys.exit(main())
