"""Collect registry-backed issuer notice pages without third-party dependencies.

The command seeds six official list/product sources into collection_targets.csv,
collects them through the existing immutable source ledger, and discovers same-host
notice links using conservative keyword matching. It never parses or publishes a
value by itself; downstream candidate parsing and validation remain required.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "distributions"
REGISTRY_PATH = DATA_DIR / "distribution_source_registry.json"
TARGETS_PATH = DATA_DIR / "collection_targets.csv"
SOURCES_PATH = DATA_DIR / "etf_distribution_source_documents.csv"

TARGET_COLUMNS = [
    "source_id", "etf_id", "ticker", "source_owner", "source_type",
    "source_document_key", "source_title", "source_url", "published_at",
    "parser_name", "parser_version", "parse_status", "parse_note",
]
SOURCE_COLUMNS = [
    "source_id", "etf_id", "ticker", "source_owner", "source_type",
    "source_document_key", "source_title", "source_url", "published_at",
    "retrieved_at", "http_status", "media_type", "content_hash_sha256",
    "parser_name", "parser_version", "parse_status", "raw_path",
    "source_etf_name", "parse_note",
]


def clean(value: object | None) -> str:
    return "" if value is None else str(value).strip()


def now_date() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return [{key: clean(value) for key, value in row.items()} for row in csv.DictReader(handle)]


def write_csv(path: Path, columns: list[str], rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows({column: clean(row.get(column)) for column in columns} for row in rows)


def deterministic_id(prefix: str, *parts: str) -> str:
    digest = hashlib.sha256("|".join(clean(part) for part in parts).encode("utf-8")).hexdigest()[:16]
    return f"{prefix}:{digest}"


def load_registry() -> list[dict]:
    payload = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    return list(payload.get("sources", []))


def seed_registry_targets() -> dict[str, int]:
    existing = {row.get("source_id", ""): row for row in read_csv(TARGETS_PATH) if row.get("source_id")}
    added = 0
    unconfigured_skipped = 0
    for definition in load_registry():
        source_key = clean(definition.get("source_key"))
        if not source_key:
            continue
        source_id = f"issuer:registry:{source_key}:root"
        source_url = clean(definition.get("url"))
        # Keep discovery_required definitions in the registry for auditability, but do not
        # create an executable target until an official URL and request shape are known.
        if not source_url:
            existing.pop(source_id, None)
            unconfigured_skipped += 1
            continue
        if source_id in existing:
            existing[source_id].update({
                "source_owner": clean(definition.get("owner_label")) or clean(definition.get("issuer")),
                "source_type": clean(definition.get("source_type")) or "issuer_notice_list",
                "source_document_key": f"registry:{source_key}",
                "source_title": f"{clean(definition.get('issuer'))} ETF 공식 분배금 원천 목록",
                "source_url": source_url,
                "parser_name": clean(definition.get("parser_name")) or "registry_notice_table_v1",
                "parser_version": clean(definition.get("parser_version")) or "1",
            })
            continue
        existing[source_id] = {
            "source_id": source_id, "etf_id": "", "ticker": "",
            "source_owner": clean(definition.get("owner_label")) or clean(definition.get("issuer")),
            "source_type": clean(definition.get("source_type")) or "issuer_notice_list",
            "source_document_key": f"registry:{source_key}",
            "source_title": f"{clean(definition.get('issuer'))} ETF 공식 분배금 원천 목록",
            "source_url": clean(definition.get("url")), "published_at": now_date(),
            "parser_name": clean(definition.get("parser_name")) or "registry_notice_table_v1",
            "parser_version": clean(definition.get("parser_version")) or "1",
            "parse_status": "pending_registry_parse",
            "parse_note": "레지스트리 공식 목록/상품별 현황 페이지. 같은 호스트의 상세 공지를 증분 발견한다.",
        }
        added += 1
    write_csv(TARGETS_PATH, TARGET_COLUMNS, sorted(existing.values(), key=lambda row: row.get("source_id", "")))
    return {"added": added, "total": len(existing), "unconfigured_skipped": unconfigured_skipped}


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[tuple[str, str]] = []
        self.href = ""
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "a":
            self.href = next((clean(value) for key, value in attrs if key.lower() == "href" and value), "")
            self.parts = []

    def handle_data(self, data: str) -> None:
        if self.href:
            self.parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self.href:
            self.links.append((self.href, " ".join(self.parts).strip()))
            self.href = ""
            self.parts = []


def discover_targets() -> dict[str, int]:
    registry = {item["source_key"]: item for item in load_registry()}
    sources = {row.get("source_id", ""): row for row in read_csv(SOURCES_PATH) if row.get("source_id")}
    targets = {row.get("source_id", ""): row for row in read_csv(TARGETS_PATH) if row.get("source_id")}
    added = 0
    for source_id, source in sources.items():
        document_key = clean(source.get("source_document_key"))
        if not document_key.startswith("registry:") or not clean(source.get("raw_path")):
            continue
        source_key = document_key.split(":", 1)[1]
        definition = registry.get(source_key)
        if not definition or not definition.get("discovery", {}).get("enabled"):
            continue
        raw_path = ROOT / clean(source["raw_path"])
        if not raw_path.exists():
            continue
        html = raw_path.read_text(encoding="utf-8", errors="replace")
        parser = LinkParser()
        parser.feed(html)
        root_url = clean(source.get("source_url"))
        root = urllib.parse.urlparse(root_url)
        keywords = [clean(value).lower() for value in definition.get("discovery", {}).get("keywords", [])]
        for href, title in parser.links:
            absolute = urllib.parse.urljoin(root_url, href)
            parsed = urllib.parse.urlparse(absolute)
            if not parsed.scheme or parsed.netloc != root.netloc or absolute == root_url:
                continue
            if keywords and not any(keyword in f"{title} {absolute}".lower() for keyword in keywords):
                continue
            detail_id = deterministic_id("issuer:registry:detail", source_key, absolute)
            if detail_id in targets:
                continue
            targets[detail_id] = {
                "source_id": detail_id, "etf_id": "", "ticker": "",
                "source_owner": clean(definition.get("owner_label")) or clean(definition.get("issuer")),
                "source_type": "issuer_notice_detail",
                "source_document_key": f"registry:{source_key}",
                "source_title": title or f"{definition.get('issuer', '')} 분배금 공지",
                "source_url": absolute, "published_at": now_date(),
                "parser_name": clean(definition.get("parser_name")) or "registry_notice_table_v1",
                "parser_version": clean(definition.get("parser_version")) or "1",
                "parse_status": "pending_registry_parse",
                "parse_note": "공식 목록에서 키워드 기반으로 발견한 상세 공지. 티커 매칭 전 게시 금지.",
            }
            added += 1
    write_csv(TARGETS_PATH, TARGET_COLUMNS, sorted(targets.values(), key=lambda row: row.get("source_id", "")))
    return {"added": added, "total": len(targets)}


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed and discover registry-backed issuer distribution sources")
    parser.add_argument("command", choices=("seed", "discover", "run"))
    args = parser.parse_args()
    seeded = seed_registry_targets()
    discovered = discover_targets() if args.command in {"discover", "run"} else {"added": 0, "total": seeded["total"]}
    print(json.dumps({"seeded": seeded, "discovered": discovered}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
