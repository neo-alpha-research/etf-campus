#!/usr/bin/env python3
"""Build issuer-notice based estimated distribution return (D2) histories.

This output is intentionally separate from verified TR.  It uses only issuer
notice amounts and issuer-announced ex-dates, requires an exact price on every
cash event date, and limits the visible history to the confirmed event window.
"""
from __future__ import annotations

import csv
import json
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DIST = DATA / "distributions"
CANDIDATES = DIST / "etf_distribution_event_candidates.csv"
WATCHLIST = DIST / "income_etf_collection_watchlist.csv"
MASTER = DATA / "etf_master_draft.csv"
PRICE_PATHS = [DATA / "income_page2_price_history.csv", DATA / "page3_price_history.csv"]
OUT_CSV = DATA / "returns" / "estimated_distribution_return_history.csv"
OUT_JSON = ROOT / "public" / "data" / "returns" / "estimated_distribution_return_history.json"
STATUS_JSON = DATA / "returns" / "estimated_distribution_return_status.json"
COLUMNS = ["etf_id", "ticker", "date", "close", "pr_index", "distribution_cash", "estimated_distribution_index", "estimated_return_pct", "return_basis", "quality_status", "source_ids"]


def clean(value: object | None) -> str:
    return "" if value is None else str(value).strip()


def ticker(value: object | None) -> str:
    value = clean(value).upper()
    return value.zfill(6) if value.isdigit() and len(value) < 6 else value


def parse_date(value: object | None) -> date | None:
    for fmt in ("%Y-%m-%d", "%Y%m%d", "%Y.%m.%d"):
        try:
            return datetime.strptime(clean(value), fmt).date()
        except ValueError:
            continue
    return None


def number(value: object | None) -> float | None:
    try:
        return float(clean(value).replace(",", "").replace("원", ""))
    except ValueError:
        return None


def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, records: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(records)


def available_periods(first: date, last: date) -> list[str]:
    span = (last - first).days
    periods: list[str] = []
    for key, days in (("1d", 1), ("1w", 7), ("2w", 14), ("1m", 28), ("2m", 59), ("3m", 89)):
        if span >= days:
            periods.append(key)
    return periods


def main() -> int:
    income = {ticker(row.get("ticker")) for row in read_csv(WATCHLIST)}
    master = {ticker(row.get("ticker")): clean(row.get("isin_cd")) for row in read_csv(MASTER)}
    prices: dict[str, dict[date, float]] = defaultdict(dict)
    for path in PRICE_PATHS:
        for row in read_csv(path):
            code, day, close = ticker(row.get("ticker")), parse_date(row.get("date")), number(row.get("close"))
            if code and day and close and close > 0:
                prices[code][day] = close

    # Deduplicate exactly matching candidates and reject a same-ticker/date amount conflict.
    event_candidates: dict[tuple[str, date], list[dict[str, str]]] = defaultdict(list)
    for row in read_csv(CANDIDATES):
        code, ex_day, amount = ticker(row.get("ticker")), parse_date(row.get("issuer_ex_date")), number(row.get("distribution_per_share_krw"))
        if code in income and ex_day and amount is not None and amount >= 0:
            event_candidates[(code, ex_day)].append(row)

    events: dict[str, list[tuple[date, float, list[str]]]] = defaultdict(list)
    rejected: dict[str, str] = {}
    for (code, ex_day), rows in event_candidates.items():
        amounts = {number(row.get("distribution_per_share_krw")) for row in rows}
        if len(amounts) != 1:
            rejected[code] = "동일 분배락일의 운용사 분배금 후보가 서로 충돌합니다."
            continue
        if ex_day not in prices.get(code, {}):
            rejected[code] = "운용사 분배락일의 시장 종가가 없습니다."
            continue
        source_ids = sorted({clean(row.get("source_id")) for row in rows if clean(row.get("source_id"))})
        events[code].append((ex_day, next(iter(amounts)) or 0.0, source_ids))

    output: list[dict[str, str]] = []
    status_records: list[dict[str, object]] = []
    for code in sorted(income):
        code_events = sorted(events.get(code, []), key=lambda item: item[0])
        if code in rejected:
            status_records.append({"ticker": code, "estimatedStatus": "blocked_conflict", "estimatedAvailablePeriods": [], "coverageMonths": 0, "firstCoveredDate": "", "lastCoveredDate": "", "eventCount": 0, "reason": rejected[code]})
            continue
        # D2 requires at least two independently announced cash events, so a single
        # announcement cannot be mislabeled as a period-return series.
        if len(code_events) < 2:
            status_records.append({"ticker": code, "estimatedStatus": "partial", "estimatedAvailablePeriods": [], "coverageMonths": len({item[0].strftime('%Y-%m') for item in code_events}), "firstCoveredDate": "", "lastCoveredDate": "", "eventCount": len(code_events), "reason": "운용사 공식 분배락일이 확인된 분배 이벤트가 2건 미만입니다."})
            continue
        ordered_prices = sorted(prices.get(code, {}).items())
        first_event, last_event = code_events[0][0], code_events[-1][0]
        start_index = next((i for i, (day, _) in enumerate(ordered_prices) if day >= first_event), None)
        if start_index is None or start_index == 0:
            status_records.append({"ticker": code, "estimatedStatus": "partial", "estimatedAvailablePeriods": [], "coverageMonths": len({item[0].strftime('%Y-%m') for item in code_events}), "firstCoveredDate": "", "lastCoveredDate": "", "eventCount": len(code_events), "reason": "첫 운용사 분배락일 이전의 기준 시장 종가가 없습니다."})
            continue
        event_cash = {day: amount for day, amount, _ in code_events}
        source_map = {day: source_ids for day, _, source_ids in code_events}
        # Start on the trading close immediately before the first known event and
        # end at the last known event. Never extrapolate D2 beyond confirmed coverage.
        segment = [(day, close) for day, close in ordered_prices[start_index - 1:] if day <= last_event]
        if len(segment) < 2:
            status_records.append({"ticker": code, "estimatedStatus": "partial", "estimatedAvailablePeriods": [], "coverageMonths": len({item[0].strftime('%Y-%m') for item in code_events}), "firstCoveredDate": "", "lastCoveredDate": "", "eventCount": len(code_events), "reason": "분배 이벤트 사이의 가격 이력이 충분하지 않습니다."})
            continue
        pr_index = est_index = 100.0
        rows_out: list[dict[str, str]] = []
        for index, (day, close) in enumerate(segment):
            cash = event_cash.get(day, 0.0)
            if index > 0:
                previous_close = segment[index - 1][1]
                pr_index *= close / previous_close
                est_index *= (close + cash) / previous_close
            rows_out.append({
                "etf_id": master.get(code, ""), "ticker": code, "date": day.isoformat(), "close": f"{close:.6f}",
                "pr_index": f"{pr_index:.8f}", "distribution_cash": f"{cash:.6f}",
                "estimated_distribution_index": f"{est_index:.8f}", "estimated_return_pct": f"{(est_index - 100):.6f}",
                "return_basis": "issuer_notice_estimated_pre_tax_ex_date_reinvested", "quality_status": "issuer_estimated",
                "source_ids": ";".join(source_map.get(day, [])),
            })
        output.extend(rows_out)
        covered_months = len({item[0].strftime('%Y-%m') for item in code_events})
        status_records.append({
            "ticker": code, "estimatedStatus": "available", "estimatedAvailablePeriods": available_periods(segment[0][0], segment[-1][0]),
            "coverageMonths": covered_months, "firstCoveredDate": segment[0][0].isoformat(), "lastCoveredDate": segment[-1][0].isoformat(),
            "eventCount": len(code_events), "reason": "운용사 공식 분배금·분배락일과 시장 종가로 산출한 추정 수익률입니다.",
        })

    write_csv(OUT_CSV, output)
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps({"schemaVersion": 1, "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z'), "returnBasis": "issuer_estimated", "records": output}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    STATUS_JSON.write_text(json.dumps({"schemaVersion": 1, "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z'), "statuses": status_records}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    counts: dict[str, int] = defaultdict(int)
    for status in status_records: counts[str(status["estimatedStatus"])] += 1
    print(json.dumps({"history_rows": len(output), "available_tickers": [record["ticker"] for record in status_records if record["estimatedStatus"] == "available"], "status_counts": dict(sorted(counts.items())), "history_output": str(OUT_CSV.relative_to(ROOT)), "status_output": str(STATUS_JSON.relative_to(ROOT))}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
