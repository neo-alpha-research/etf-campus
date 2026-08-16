"""Registry-driven, standard-library-only distribution notice parser.

The parser is intentionally conservative: it extracts only rows containing a
known ETF ticker and a numeric per-share amount. Missing dates remain blank and
never get inferred from another date. It emits the same candidate/evidence
contract used by build_distribution_candidates.py.
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
from datetime import datetime, timezone
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = ROOT / "data" / "distributions" / "distribution_source_registry.json"
MASTER_PATH = ROOT / "data" / "etf_master_draft.csv"

TICKER_RE = re.compile(r"^[0-9A-Z]{6}$")
NUMBER_RE = re.compile(r"^-?\d+(?:\.\d+)?$")
DATE_RE = re.compile(r"(?:20\d{2})[.\-/년\s]*(?:\d{1,2})[.\-/월\s]*(?:\d{1,2})[일]?")
SPACE_RE = re.compile(r"\s+")


def clean(value: object | None) -> str:
    return "" if value is None else str(value).strip()


def normalize_text(value: object | None) -> str:
    return SPACE_RE.sub(" ", unescape(clean(value))).strip()


def normalise_ticker(value: object | None) -> str:
    text = normalize_text(value).upper().replace(" ", "")
    return text.zfill(6) if text.isdigit() and len(text) < 6 else text


def parse_amount(value: object | None) -> str:
    text = normalize_text(value).replace(",", "").replace("원", "").replace("₩", "")
    text = text.replace("-", "") if text in {"-", "–", "—"} else text
    return text if NUMBER_RE.fullmatch(text) else ""


def parse_date(value: object | None) -> str:
    text = normalize_text(value)
    match = DATE_RE.search(text)
    if not match:
        return ""
    raw = match.group(0).replace("년", "-").replace("월", "-").replace("일", "")
    raw = re.sub(r"[./\s]+", "-", raw).strip("-")
    parts = raw.split("-")
    if len(parts) != 3:
        return ""
    try:
        return datetime.strptime("-".join(part.zfill(2) for part in parts), "%Y-%m-%d").date().isoformat()
    except ValueError:
        return ""


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def deterministic_id(prefix: str, *parts: str) -> str:
    digest = hashlib.sha256("|".join(clean(part) for part in parts).encode("utf-8")).hexdigest()[:20]
    return f"{prefix}:{digest}"


def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return [{key: clean(value) for key, value in row.items()} for row in csv.DictReader(handle)]


def load_registry() -> dict:
    return json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))


def registry_by_key() -> dict[str, dict]:
    return {item["source_key"]: item for item in load_registry().get("sources", [])}


def load_master() -> dict[str, dict[str, str]]:
    return {normalise_ticker(row.get("ticker")): row for row in read_csv(MASTER_PATH) if normalise_ticker(row.get("ticker"))}


class TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.tables: list[list[list[str]]] = []
        self.depth = 0
        self.table: list[list[str]] | None = None
        self.row: list[str] | None = None
        self.cell: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "table":
            self.depth += 1
            if self.depth == 1:
                self.table = []
        elif tag == "tr" and self.depth == 1:
            self.row = []
        elif tag in {"th", "td"} and self.depth == 1 and self.row is not None:
            self.cell = []
        elif tag == "br" and self.cell is not None:
            self.cell.append(" ")

    def handle_data(self, data: str) -> None:
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag in {"th", "td"} and self.cell is not None and self.row is not None:
            self.row.append(normalize_text("".join(self.cell)))
            self.cell = None
        elif tag == "tr" and self.depth == 1 and self.table is not None and self.row is not None:
            if any(self.row):
                self.table.append(self.row)
            self.row = None
        elif tag == "table":
            if self.depth == 1 and self.table is not None:
                self.tables.append(self.table)
                self.table = None
            self.depth = max(0, self.depth - 1)


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


def alias_index(header: list[str], aliases: dict[str, list[str]]) -> dict[str, int]:
    normalized = [normalize_text(value).replace(" ", "") for value in header]
    result: dict[str, int] = {}
    for field, names in aliases.items():
        for index, cell in enumerate(normalized):
            if any(normalize_text(alias).replace(" ", "") in cell for alias in names):
                result[field] = index
                break
    return result


def cell(row: list[str], index: int | None) -> str:
    return normalize_text(row[index]) if index is not None and 0 <= index < len(row) else ""


def registry_key_from_source(source: dict[str, str]) -> str:
    document_key = clean(source.get("source_document_key"))
    if document_key.startswith("registry:"):
        return document_key.split(":", 1)[1]
    raise ValueError(f"source is not registry-backed: {source.get('source_id')}")


def blank_candidate(columns: Iterable[str]) -> dict[str, str]:
    return {column: "" for column in columns}


def text_notice_rows(path: Path, definition: dict) -> list[list[str]]:
    """Convert an official prose notice into one conservative synthetic table row."""
    raw = decode_raw(path)
    text = normalize_text(re.sub(r"<[^>]+>", " ", raw))
    tickers = [normalise_ticker(value) for value in definition.get("tickers", [])]
    ticker = next((value for value in tickers if TICKER_RE.fullmatch(value) and re.search(rf"(?<!\d){re.escape(value)}(?!\d)", text)), "")
    if not ticker:
        return []
    amount_match = re.search(r"(?:주당\s*)?(?:분배금|분배금액)\s*[:：]?\s*(?:주당\s*)?(\d+(?:\.\d+)?)\s*원", text)
    if not amount_match:
        return []
    def labelled_date(labels: str) -> str:
        match = re.search(rf"(?:{labels})\s*[:：]?\s*([^\s,;]+(?:\s*\([^)]*\))?)", text)
        return parse_date(match.group(1)) if match else ""
    record_date = labelled_date("분배금\\s*지급\\s*기준일|지급\\s*기준일|기준일")
    pay_date = labelled_date("분배금\\s*지급\\s*예정일|지급\\s*예정일|지급일")
    return [["종목코드", "종목명", "분배금", "분배금 지급 기준일", "분배금 지급 예정일"], [ticker, "", amount_match.group(1), record_date, pay_date]]


def parse_registry_source(source: dict[str, str], candidate_columns: list[str], evidence_columns: list[str]) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    raw_path = ROOT / clean(source.get("raw_path"))
    if not raw_path.exists() or not raw_path.is_file():
        raise FileNotFoundError(f"raw source is missing or is not a file: {raw_path}")
    definition = registry_by_key()[registry_key_from_source(source)]
    master = load_master()
    candidates: list[dict[str, str]] = []
    evidence: list[dict[str, str]] = []
    seen: set[tuple[str, str, str]] = set()
    tables = table_rows(raw_path)
    if clean(source.get("parser_name")) == "registry_notice_detail_text_v1":
        tables.extend(text_notice_rows(raw_path, definition))
    for table_index, table in enumerate(tables):
        if not table:
            continue
        header_index = next((index for index, row in enumerate(table[:5]) if alias_index(row, definition.get("fields", {})).get("ticker") is not None and alias_index(row, definition.get("fields", {})).get("amount") is not None), None)
        if header_index is None:
            continue
        indexes = alias_index(table[header_index], definition["fields"])
        for row_index, row in enumerate(table[header_index + 1:], start=header_index + 1):
            ticker = normalise_ticker(cell(row, indexes.get("ticker")))
            amount = parse_amount(cell(row, indexes.get("amount")))
            if not TICKER_RE.fullmatch(ticker) or not amount or ticker not in master:
                continue
            key = (source["source_id"], ticker, amount)
            if key in seen:
                continue
            seen.add(key)
            metadata = master[ticker]
            name = cell(row, indexes.get("name")) or clean(metadata.get("name"))
            ex_date = parse_date(cell(row, indexes.get("ex_date")))
            record_date = parse_date(cell(row, indexes.get("record_date")))
            pay_date = parse_date(cell(row, indexes.get("pay_date")))
            row_locator = f"table[{table_index}]/row[{row_index}]"
            candidate_id = deterministic_id("candidate", source["source_id"], ticker, amount, row_locator)
            now = utc_now()
            candidate = blank_candidate(candidate_columns)
            candidate.update({
                "candidate_id": candidate_id, "source_id": source["source_id"],
                "source_owner": clean(source.get("source_owner")), "etf_id": clean(metadata.get("isin_cd")),
                "ticker": ticker, "etf_name": name, "issuer_ex_date": ex_date,
                "record_date": record_date, "pay_date": pay_date,
                "distribution_per_share_krw": amount, "currency": "KRW",
                "distribution_type": "ordinary_cash", "row_locator": row_locator,
                "raw_row_text": " | ".join(row), "parser_name": clean(source.get("parser_name")),
                "parser_version": clean(source.get("parser_version")) or "1",
                "extraction_status": "rule_based_extracted", "candidate_status": "pending_krx_verification",
                "created_at": now, "updated_at": now,
                "note": "운용사 공식 원문 레지스트리 공통 파서 추출. KIND 대조 전에는 TR 계산에 사용하지 않음.",
            })
            candidates.append(candidate)
            observed = [("distribution_per_share_krw", cell(row, indexes.get("amount")), amount), ("issuer_ticker", cell(row, indexes.get("ticker")), ticker), ("issuer_etf_name", cell(row, indexes.get("name")), name)]
            for field_name, source_value, normalized_value in observed:
                if not normalized_value:
                    continue
                evidence_row = blank_candidate(evidence_columns)
                evidence_row.update({
                    "evidence_id": deterministic_id("evidence", candidate_id, field_name, normalized_value),
                    "candidate_id": candidate_id, "source_id": source["source_id"],
                    "field_name": field_name, "source_value": source_value,
                    "normalized_value": normalized_value, "row_locator": row_locator,
                    "evidence_status": "observed", "review_status": "unreviewed",
                    "created_at": now, "note": "레지스트리 기반 운용사 원문 행에서 추출된 증거.",
                })
                evidence.append(evidence_row)
            for field_name, value in (("issuer_ex_date", ex_date), ("record_date", record_date), ("pay_date", pay_date)):
                if not value:
                    continue
                evidence_row = blank_candidate(evidence_columns)
                evidence_row.update({
                    "evidence_id": deterministic_id("evidence", candidate_id, field_name, value),
                    "candidate_id": candidate_id, "source_id": source["source_id"],
                    "field_name": field_name, "source_value": value,
                    "normalized_value": value, "row_locator": row_locator,
                    "evidence_status": "observed", "review_status": "unreviewed",
                    "created_at": now, "note": "공식 원문 표에서 직접 추출한 일정 증거.",
                })
                evidence.append(evidence_row)
    return candidates, evidence
