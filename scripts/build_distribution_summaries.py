"""Build frontend-safe distribution payout summaries from issuer-notice candidates.

This builder publishes only per-share cash distributions when an issuer notice
states either an ex-date or a record date. It does not derive yields, total
returns, ex-dates, or payment completion. Each record remains labelled as
issuer-notice information until the separate KIND reconciliation promotes the
underlying event.
"""

from __future__ import annotations

import csv
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "data" / "distributions" / "etf_distribution_event_candidates.csv"
MANUAL_EVENTS_INPUT = ROOT / "data" / "distributions" / "manual_verified_distribution_events.csv"
OUTPUT = ROOT / "data" / "distributions" / "etf_distribution_summaries.json"
MAX_RECORDS_PER_TICKER = 12


def parse_amount(raw: str) -> int | None:
    value = (raw or "").replace(",", "").strip()
    if not value:
        return None
    try:
        number = float(value)
    except ValueError:
        return None
    if number <= 0 or not number.is_integer():
        return None
    return int(number)


def text(row: dict[str, str], field: str) -> str | None:
    value = (row.get(field) or "").strip()
    return value or None


def record_from_row(row: dict[str, str]) -> dict[str, object] | None:
    ticker = text(row, "ticker")
    amount = parse_amount(row.get("distribution_per_share_krw") or "")
    ex_date = text(row, "issuer_ex_date")
    record_date = text(row, "record_date")
    if not ticker or amount is None or not (ex_date or record_date):
        return None

    return {
        "eventId": text(row, "candidate_id"),
        "sourceId": text(row, "source_id"),
        "sourceOwner": text(row, "source_owner"),
        "amountKrw": amount,
        "exDate": ex_date,
        "recordDate": record_date,
        "payDate": text(row, "pay_date"),
        "distributionType": text(row, "distribution_type") or "ordinary_cash",
        "displayStatus": "issuer_notice",
        "displayLabel": "운용사 공식 공지 기반",
        "updatedAt": text(row, "updated_at"),
    }


def record_from_manual_event(row: dict[str, str]) -> dict[str, object] | None:
    """Expose only explicit KIND facts; never derive dates or amounts."""
    ticker = text(row, "ticker")
    amount = parse_amount(row.get("distribution_per_share_krw") or "")
    ex_date = text(row, "ex_date") or text(row, "krx_apply_date")
    record_date = text(row, "record_date")
    if not ticker or amount is None or not (ex_date or record_date):
        return None
    has_krx_evidence = text(row, "krx_ex_date_verified") == "true"
    has_issuer_evidence = bool(text(row, "issuer_source_id"))
    if not (has_krx_evidence or has_issuer_evidence):
        return None

    if has_krx_evidence:
        source_id = text(row, "krx_source_id")
        source_owner = "KRX KIND"
        display_status = "krx_official_partial"
        display_label = "KIND 공식 공시 기반"
    else:
        source_id = text(row, "issuer_source_id")
        source_owner = "운용사 공식 자료"
        display_status = "issuer_notice"
        display_label = "운용사 공식 공지 기반"

    return {
        "eventId": text(row, "event_id"),
        "sourceId": source_id,
        "sourceOwner": source_owner,
        "amountKrw": amount,
        "exDate": ex_date,
        "recordDate": record_date,
        "payDate": text(row, "pay_date"),
        "distributionType": text(row, "distribution_type") or "ordinary_cash",
        "displayStatus": display_status,
        "displayLabel": display_label,
        "updatedAt": text(row, "updated_at"),
    }


def main() -> None:
    if not INPUT.exists():
        raise FileNotFoundError(f"distribution candidate file not found: {INPUT}")

    grouped: dict[str, list[dict[str, object]]] = defaultdict(list)
    seen_event_ids: set[str] = set()
    with INPUT.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            record = record_from_row(row)
            if record is not None:
                event_id = str(record.get("eventId") or "")
                if event_id:
                    seen_event_ids.add(event_id)
                grouped[str(row["ticker"]).strip()].append(record)

    if MANUAL_EVENTS_INPUT.exists():
        with MANUAL_EVENTS_INPUT.open(encoding="utf-8-sig", newline="") as handle:
            for row in csv.DictReader(handle):
                record = record_from_manual_event(row)
                event_id = str(record.get("eventId") or "") if record is not None else ""
                if record is not None and event_id not in seen_event_ids:
                    seen_event_ids.add(event_id)
                    grouped[str(row["ticker"]).strip()].append(record)

    summaries = []
    for ticker, records in sorted(grouped.items()):
        records.sort(
            key=lambda item: (
                str(item.get("exDate") or item.get("recordDate") or ""),
                str(item.get("updatedAt") or ""),
            ),
            reverse=True,
        )
        visible_records = records[:MAX_RECORDS_PER_TICKER]
        has_krx = any(item.get("displayStatus") == "krx_official_partial" for item in records)
        has_issuer = any(item.get("displayStatus") == "issuer_notice" for item in records)
        source_status = "mixed_official_sources" if has_krx and has_issuer else ("krx_official_partial" if has_krx else "issuer_notice")
        source_label = "공식 공시 기반" if has_krx and has_issuer else ("KIND 공식 공시 기반" if has_krx else "운용사 공식 공지 기반")
        summaries.append(
            {
                "ticker": ticker,
                "sourceStatus": source_status,
                "sourceLabel": source_label,
                "latest": visible_records[0],
                "records": visible_records,
                "eventCount": len(records),
                "updatedAt": max((str(item.get("updatedAt") or "") for item in records), default=""),
            }
        )

    payload = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": "etf_distribution_event_candidates.csv",
        "summaryCount": len(summaries),
        "summaries": summaries,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUTPUT.with_suffix(".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(OUTPUT)
    print(json.dumps({"output": str(OUTPUT.relative_to(ROOT)), "summary_count": len(summaries)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
