#!/usr/bin/env python3
"""Discover KRX disclosure leads from a secondary index without changing verification.

This tool is deliberately a discovery-only bridge for cases where the primary KIND
viewer does not expose a stable download URL.  It writes a lead ledger that must be
resolved to a KRX KIND raw snapshot before it can be used as evidence.  It never
writes events, candidates, coverage, or total-return files.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "distributions"
CANDIDATES = DATA / "etf_distribution_event_candidates.csv"
WATCHLIST = DATA / "income_etf_collection_watchlist.csv"
OUT = DATA / "krx_kind_disclosure_leads.csv"
COLUMNS = [
    "lead_id", "candidate_id", "ticker", "etf_name", "source_owner", "priority_tier",
    "candidate_distribution_per_share_krw", "disclosure_title", "disclosed_at",
    "secondary_discovery_url", "secondary_discovery_id", "reference_price_krw",
    "ex_rights_apply_date", "reason", "source_class", "lead_status", "tr_eligible",
    "discovered_at", "note",
]

class TextCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def fetch(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "ETF-Campus evidence discovery/1.0"})
    with urlopen(request, timeout=30) as response:
        return response.read()


def text_from_html(content: bytes) -> str:
    parser = TextCollector()
    parser.feed(content.decode("utf-8", errors="replace"))
    return re.sub(r"\s+", " ", " ".join(parser.parts)).strip()


def amount(value: str) -> str:
    return value.replace(",", "")


def parse_fields(content: bytes) -> tuple[str, str, str]:
    text = text_from_html(content)
    price = re.search(r"2\.\s*기준가격\s*\(원\)\s*([0-9,]+)", text)
    reason = re.search(r"3\.\s*사유\s*(분배락|[^0-9]{1,30}?)\s*4\.\s*적용일", text)
    apply = re.search(r"4\.\s*적용일\s*(20\d{2}-\d{2}-\d{2})", text)
    return (amount(price.group(1)) if price else "", reason.group(1).strip() if reason else "", apply.group(1) if apply else "")


def read(path: Path) -> list[dict[str, str]]:
    if not path.exists(): return []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write(rows: list[dict[str, str]]) -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS)
        writer.writeheader(); writer.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--owner", default="TIGER")
    parser.add_argument("--month", default="2026-07")
    args = parser.parse_args()
    tiers = {row["ticker"].upper(): row["priority_tier"] for row in read(WATCHLIST) if row.get("ticker")}
    targets = [row for row in read(CANDIDATES) if row.get("source_owner") == args.owner and row.get("ticker", "").upper() in tiers]
    rows: list[dict[str, str]] = []
    errors: list[str] = []
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    for candidate in targets:
        ticker = candidate["ticker"].upper()
        try:
            listing = json.loads(fetch(f"https://mweb-api.stockplus.com/api/securities/KOREA-A{ticker}/disclosures.json?limit=30").decode("utf-8"))
            items = listing.get("newsItems", [])
            selected = [item for item in items if item.get("createdAt", "").startswith(args.month) and "ETF 분배락 기준가격 안내" in item.get("title", "")]
            if not selected:
                errors.append(f"{ticker}: no matching disclosure in secondary discovery index")
                continue
            for item in selected:
                url = item["url"]
                price, reason, apply = parse_fields(fetch(url))
                secondary_id = url.rstrip("/").split("/")[-1]
                row = {key: "" for key in COLUMNS}
                row.update({
                    "lead_id": f"krx-kind-lead:{ticker}:{secondary_id}", "candidate_id": candidate["candidate_id"],
                    "ticker": ticker, "etf_name": candidate["etf_name"], "source_owner": args.owner,
                    "priority_tier": tiers[ticker], "candidate_distribution_per_share_krw": candidate["distribution_per_share_krw"],
                    "disclosure_title": item.get("title", ""), "disclosed_at": item.get("createdAt", "")[:10],
                    "secondary_discovery_url": url, "secondary_discovery_id": secondary_id,
                    "reference_price_krw": price, "ex_rights_apply_date": apply, "reason": reason,
                    "source_class": "secondary_discovery_only", "lead_status": "requires_primary_kind_capture",
                    "tr_eligible": "false", "discovered_at": now,
                    "note": "보조 인덱스에서 찾은 KRX 공시 후보. 공식 KIND 원문 스냅샷·해시와 접수번호가 확보되기 전에는 증거·verified 이벤트·TR에 사용 금지.",
                })
                rows.append(row)
        except Exception as exc:
            errors.append(f"{ticker}: {type(exc).__name__}: {exc}")
    write(sorted(rows, key=lambda row: (row["ticker"], row["secondary_discovery_id"])))
    print(json.dumps({"target_count": len(targets), "lead_count": len(rows), "error_count": len(errors), "errors": errors}, ensure_ascii=False, indent=2))
    return 0

if __name__ == "__main__": sys.exit(main())
