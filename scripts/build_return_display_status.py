#!/usr/bin/env python3
"""Build a safe PR/TR display-status snapshot for the static ETF Campus build."""
from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
MASTER = DATA / "etf_master_draft.csv"
WATCHLIST = DATA / "distributions" / "income_etf_collection_watchlist.csv"
COVERAGE = DATA / "distributions" / "etf_tr_data_coverage.csv"
METRICS = DATA / "returns" / "etf_total_return_metrics.csv"
ESTIMATED_STATUS = DATA / "returns" / "estimated_distribution_return_status.json"
OUT = DATA / "returns" / "etf_return_display_status.json"


def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def clean(value: object | None) -> str:
    return "" if value is None else str(value).strip()


def ticker(value: object | None) -> str:
    text = clean(value).upper()
    return text.zfill(6) if text.isdigit() and len(text) < 6 else text


def status_for(is_income: bool, coverage: dict[str, str] | None, metric_rows: list[dict[str, str]]) -> tuple[str, str]:
    if not is_income:
        return "not_applicable", "배당형 우선 대상이 아니므로 TR을 제공하지 않습니다."
    if not coverage:
        return "pending", "TR 커버리지 원장이 없습니다."
    distribution = clean(coverage.get("distribution_coverage_status"))
    actions = clean(coverage.get("corporate_action_coverage_status"))
    if distribution not in {"verified_complete", "verified_no_distribution"}:
        return "partial", "분배금 또는 공식 확인된 무분배 월이 충분하지 않습니다."
    if actions not in {"verified_complete", "verified_no_action"}:
        return "blocked_conflict", "기업행동 검증이 완료되지 않았습니다."
    calculated = [row for row in metric_rows if clean(row.get("calculation_status")) == "calculated"]
    if not calculated:
        return "pending", "검증된 TR 기간별 산출값이 아직 없습니다."
    return "available", "검증된 TR을 제공할 수 있습니다."


def load_estimated_statuses() -> dict[str, dict[str, object]]:
    if not ESTIMATED_STATUS.exists():
        return {}
    try:
        payload = json.loads(ESTIMATED_STATUS.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return {ticker(item.get("ticker")): item for item in payload.get("statuses", []) if ticker(item.get("ticker"))}


def main() -> int:
    watchlist = {ticker(row.get("ticker")): clean(row.get("priority_tier")) for row in read_csv(WATCHLIST) if ticker(row.get("ticker"))}
    coverage = {ticker(row.get("ticker")): row for row in read_csv(COVERAGE) if ticker(row.get("ticker"))}
    estimated = load_estimated_statuses()
    metrics: dict[str, list[dict[str, str]]] = {}
    for row in read_csv(METRICS):
        metrics.setdefault(ticker(row.get("ticker")), []).append(row)
    statuses = []
    for row in read_csv(MASTER):
        code = ticker(row.get("ticker"))
        is_income = code in watchlist
        status, reason = status_for(is_income, coverage.get(code), metrics.get(code, []))
        periods = sorted({clean(item.get("period")) for item in metrics.get(code, []) if clean(item.get("calculation_status")) == "calculated"})
        estimated_item = estimated.get(code, {})
        estimated_status = clean(estimated_item.get("estimatedStatus")) or ("not_available" if not is_income else "partial")
        statuses.append({
            "ticker": code,
            "isIncomeEtf": is_income,
            "priorityTier": watchlist.get(code, ""),
            "prAvailable": True,
            "trStatus": status,
            "trAvailablePeriods": periods,
            "trUnavailableReason": "" if status == "available" else reason,
            "lastVerifiedAt": clean(coverage.get(code, {}).get("last_verified_at")) if coverage.get(code) else "",
            "estimatedReturnStatus": estimated_status,
            "estimatedAvailablePeriods": estimated_item.get("estimatedAvailablePeriods", []) if isinstance(estimated_item.get("estimatedAvailablePeriods", []), list) else [],
            "estimatedCoverageMonths": int(estimated_item.get("coverageMonths", 0) or 0),
            "estimatedUnavailableReason": clean(estimated_item.get("reason")),
            "estimatedFirstCoveredDate": clean(estimated_item.get("firstCoveredDate")),
            "estimatedLastCoveredDate": clean(estimated_item.get("lastCoveredDate")),
        })
    payload = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "defaultReturnBasis": "pr",
        "statuses": statuses,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tr_counts: dict[str, int] = {}
    estimated_counts: dict[str, int] = {}
    for item in statuses:
        tr_counts[item["trStatus"]] = tr_counts.get(item["trStatus"], 0) + 1
        estimated_counts[item["estimatedReturnStatus"]] = estimated_counts.get(item["estimatedReturnStatus"], 0) + 1
    print(json.dumps({"status_count": len(statuses), "income_count": sum(item["isIncomeEtf"] for item in statuses), "tr_status_counts": tr_counts, "estimated_return_status_counts": estimated_counts, "output": str(OUT.relative_to(ROOT))}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
