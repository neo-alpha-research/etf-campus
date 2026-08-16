from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def nonempty(row: dict[str, str], key: str) -> bool:
    return bool((row.get(key) or "").strip())


def main() -> None:
    master = read_csv(DATA / "etf_master_draft.csv")
    master_tickers = {(row.get("ticker") or "").strip() for row in master}

    statuses = json.loads((DATA / "returns" / "etf_return_display_status.json").read_text(encoding="utf-8"))
    status_rows = statuses.get("statuses", statuses if isinstance(statuses, list) else [])
    income_tickers = {
        str(row.get("ticker") or "").strip()
        for row in status_rows
        if row.get("isIncomeEtf") is True
    }

    candidates = read_csv(DATA / "distributions" / "etf_distribution_event_candidates.csv")
    candidates_by_ticker: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in candidates:
        ticker = (row.get("ticker") or "").strip()
        if ticker:
            candidates_by_ticker[ticker].append(row)

    candidate_tickers = set(candidates_by_ticker)
    amount_tickers = {
        ticker for ticker, rows in candidates_by_ticker.items()
        if any(nonempty(row, "distribution_per_share_krw") for row in rows)
    }
    ex_date_tickers = {
        ticker for ticker, rows in candidates_by_ticker.items()
        if any(nonempty(row, "distribution_per_share_krw") and nonempty(row, "issuer_ex_date") for row in rows)
    }
    pay_date_tickers = {
        ticker for ticker, rows in candidates_by_ticker.items()
        if any(nonempty(row, "distribution_per_share_krw") and nonempty(row, "issuer_ex_date") and nonempty(row, "pay_date") for row in rows)
    }

    events_path = DATA / "distributions" / "etf_distribution_events.csv"
    events = read_csv(events_path) if events_path.exists() else []
    event_status_key = next((key for key in ("event_status", "verification_status", "status") if events and key in events[0]), None)
    event_counts = Counter((row.get(event_status_key) or "unknown").strip() for row in events) if event_status_key else Counter()
    event_tickers = {(row.get("ticker") or "").strip() for row in events if (row.get("ticker") or "").strip()}

    summaries_payload = json.loads((DATA / "distributions" / "etf_distribution_summaries.json").read_text(encoding="utf-8"))
    summaries = summaries_payload.get("summaries", [])
    summary_tickers = {str(row.get("ticker") or "").strip() for row in summaries}

    owner_counts = Counter((row.get("source_owner") or "unknown").strip() for row in candidates)
    owner_income_tickers: dict[str, set[str]] = defaultdict(set)
    for row in candidates:
        ticker = (row.get("ticker") or "").strip()
        owner = (row.get("source_owner") or "unknown").strip()
        if ticker in income_tickers:
            owner_income_tickers[owner].add(ticker)
    field_counts = {
        "amount": sum(nonempty(row, "distribution_per_share_krw") for row in candidates),
        "amount_and_ex_date": sum(nonempty(row, "distribution_per_share_krw") and nonempty(row, "issuer_ex_date") for row in candidates),
        "amount_ex_date_pay_date": sum(
            nonempty(row, "distribution_per_share_krw") and nonempty(row, "issuer_ex_date") and nonempty(row, "pay_date")
            for row in candidates
        ),
    }

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "master_etf_count": len(master_tickers),
        "income_etf_count": len(income_tickers),
        "candidate_event_count": len(candidates),
        "candidate_ticker_count": len(candidate_tickers),
        "normalized_event_count": len(events),
        "normalized_event_status_key": event_status_key,
        "normalized_event_status_counts": dict(sorted(event_counts.items())),
        "normalized_event_ticker_count": len(event_tickers),
        "detail_summary_ticker_count": len(summary_tickers),
        "candidate_field_event_counts": field_counts,
        "all_etf_ticker_coverage": {
            "any_candidate": len(candidate_tickers),
            "amount": len(amount_tickers),
            "amount_and_ex_date": len(ex_date_tickers),
            "amount_ex_date_pay_date": len(pay_date_tickers),
            "detail_summary": len(summary_tickers),
            "no_candidate": len(master_tickers - candidate_tickers),
            "no_detail_summary": len(master_tickers - summary_tickers),
        },
        "income_etf_ticker_coverage": {
            "any_candidate": len(candidate_tickers & income_tickers),
            "amount": len(amount_tickers & income_tickers),
            "amount_and_ex_date": len(ex_date_tickers & income_tickers),
            "amount_ex_date_pay_date": len(pay_date_tickers & income_tickers),
            "detail_summary": len(summary_tickers & income_tickers),
            "no_candidate": len(income_tickers - candidate_tickers),
            "candidate_but_no_amount_and_ex_date": len((candidate_tickers & income_tickers) - ex_date_tickers),
            "amount_and_ex_date_but_no_pay_date": len(ex_date_tickers - pay_date_tickers),
        },
        "candidate_source_owner_counts": dict(sorted(owner_counts.items())),
        "income_candidate_ticker_counts_by_source_owner": {
            owner: len(tickers) for owner, tickers in sorted(owner_income_tickers.items())
        },
        "out_of_master_candidate_tickers": sorted(candidate_tickers - master_tickers),
        "income_without_detail_summary": sorted(income_tickers - summary_tickers),
    }

    output = ROOT / "tmp" / "distribution_coverage_audit_20260816.json"
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
