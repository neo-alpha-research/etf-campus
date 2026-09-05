#!/usr/bin/env python3
"""Pension Regulatory Consistency Checker (Gate A).

Validates internal consistency across all ETF master records against rules R1 to R9.
Strictly exits with code 1 if any violation is detected, preventing CI/CD deployment
of inconsistent regulatory classifications.
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path
from typing import Any, Mapping

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.rules.pension_regulatory_engine import (
    VALID_VERIFIED_SOURCES,
    classify_pension_and_isa,
    load_verified_broker_tickers,
    load_verified_ledger_entries,
)

RULE_DESCRIPTIONS = {
    "R1": "pension_verified = Y -> pension_source in {협회공시대조, KRX공시대조, 투자설명서대조, 증권사목록대조, 수동확인, 표본대조}",
    "R2": "pension_verified = N -> pension_confidence != 높음",
    "R3": "pension_eligible = 불가 <-> pension_limit = 불가 (양방향 일치)",
    "R4": "pension_eligible = 가능 -> pension_limit in {100% (안전자산), 70% (위험자산)}",
    "R5": "asset_class in {채권, 금리·파킹} and pension_limit = 70% (위험자산) -> 위반 후보",
    "R6": "asset_class in {주식-국내, 주식-해외} and pension_limit = 100% (안전자산) -> 위반 후보",
    "R7": "이름에 레버리지/인버스 포함 -> pension_limit = 불가",
    "R8": "pension_source = 법령조건직접판정 -> 판정 조건 일치",
    "R9": "엔진 재실행 결과 vs 마스터 CSV 전 행 100% 일치",
}


def validate_pension_consistency(
    master_rows: list[Mapping[str, Any]],
    verified_entries: dict[str, dict[str, str]] | None = None,
    verified_tickers: set[str] | None = None,
) -> dict[str, list[dict[str, Any]]]:
    """Validate all rows against consistency rules R1 through R9."""
    if verified_entries is None:
        verified_entries = load_verified_ledger_entries()
    if verified_tickers is None:
        verified_tickers = load_verified_broker_tickers()

    violations: dict[str, list[dict[str, Any]]] = {rule: [] for rule in RULE_DESCRIPTIONS}

    for r in master_rows:
        tk = str(r.get("ticker") or "").strip()
        name = str(r.get("name") or "").strip()
        p_ver = str(r.get("pension_verified") or "").strip()
        p_src = str(r.get("pension_source") or "").strip()
        p_conf = str(r.get("pension_confidence") or "").strip()
        p_elig = str(r.get("pension_eligible") or "").strip()
        p_lim = str(r.get("pension_limit") or "").strip()
        asset = str(r.get("asset_class") or "").strip()

        # R1: pension_verified = Y -> pension_source in VALID_VERIFIED_SOURCES
        if p_ver == "Y" and p_src not in VALID_VERIFIED_SOURCES:
            violations["R1"].append({
                "ticker": tk, "name": name,
                "reason": f"pension_verified={p_ver} but pension_source={p_src}"
            })

        # R2: pension_verified = N -> pension_confidence != 높음
        if p_ver == "N" and p_conf == "높음":
            violations["R2"].append({
                "ticker": tk, "name": name,
                "reason": f"pension_verified={p_ver} but pension_confidence={p_conf}"
            })

        # R3: pension_eligible = 불가 <-> pension_limit = 불가 (양방향)
        if (p_elig == "불가" and p_lim != "불가") or (p_lim == "불가" and p_elig != "불가"):
            violations["R3"].append({
                "ticker": tk, "name": name,
                "reason": f"pension_eligible={p_elig} <-> pension_limit={p_lim} mismatch"
            })

        # R4: pension_eligible = 가능 -> pension_limit in {100% (안전자산), 70% (위험자산)}
        if p_elig == "가능" and p_lim not in ("100% (안전자산)", "70% (위험자산)"):
            violations["R4"].append({
                "ticker": tk, "name": name,
                "reason": f"pension_eligible={p_elig} but pension_limit={p_lim}"
            })

        # R5: asset_class in {채권, 금리·파킹} and pension_limit = 70% (위험자산)
        if asset in ("채권", "금리·파킹") and p_lim == "70% (위험자산)":
            violations["R5"].append({
                "ticker": tk, "name": name,
                "reason": f"asset_class={asset} but pension_limit={p_lim}"
            })

        # R6: asset_class in {주식-국내, 주식-해외} and pension_limit = 100% (안전자산)
        if asset in ("주식-국내", "주식-해외") and p_lim == "100% (안전자산)":
            violations["R6"].append({
                "ticker": tk, "name": name,
                "reason": f"asset_class={asset} but pension_limit={p_lim}"
            })

        # R7: 이름에 레버리지 또는 인버스 포함 -> pension_limit = 불가
        if ("레버리지" in name or "인버스" in name) and p_lim != "불가":
            violations["R7"].append({
                "ticker": tk, "name": name,
                "reason": f"name contains leverage/inverse but pension_limit={p_lim}"
            })

        # Engine re-calculation
        recomputed = classify_pension_and_isa(
            r, verified_entries=verified_entries, verified_tickers=verified_tickers
        )

        # R8: pension_source = 법령조건직접판정 -> engine recomputation matches
        if p_src == "법령조건직접판정":
            eng_src = recomputed.get("pension_source")
            if eng_src != "법령조건직접판정":
                violations["R8"].append({
                    "ticker": tk, "name": name,
                    "reason": f"master source={p_src} but engine computed={eng_src}"
                })

        # R9: engine recomputation vs current master CSV matches 100%
        mismatches = {}
        for k in (
            "pension_eligible",
            "pension_limit",
            "isa_eligible",
            "isa_education_required",
            "pension_source",
            "pension_verified",
            "pension_confidence",
        ):
            if r.get(k) != recomputed.get(k):
                mismatches[k] = (r.get(k), recomputed.get(k))

        if mismatches:
            violations["R9"].append({
                "ticker": tk, "name": name,
                "reason": f"fields differed from engine: {mismatches}"
            })

    return violations


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--master",
        type=Path,
        default=REPO_ROOT / "data/etf_master_draft.csv",
        help="Path to master ETF CSV to validate",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress detailed item printout on violation",
    )
    args = parser.parse_args()

    if not args.master.exists():
        print(f"[ERROR] Master CSV not found: {args.master}", file=sys.stderr)
        return 1

    with args.master.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print("=" * 80)
    print("PENSION & ISA REGULATORY CONSISTENCY CHECKER (Gate A)")
    print("=" * 80)
    print(f"Target CSV : {args.master}")
    print(f"Total ETFs : {len(rows):,} rows\n")

    violations = validate_pension_consistency(rows)
    total_violations = sum(len(v) for v in violations.values())

    header_rule = "Rule"
    header_status = "Status"
    header_viols = "Violations"
    header_desc = "Description"
    print(f"{header_rule:<6} | {header_status:<6} | {header_viols:<10} | {header_desc}")
    print("-" * 80)
    for rule, desc in RULE_DESCRIPTIONS.items():
        v_list = violations[rule]
        status = "PASS" if len(v_list) == 0 else "FAIL"
        print(f"{rule:<6} | {status:<6} | {len(v_list):<10} | {desc}")
        if v_list and not args.quiet:
            for item in v_list[:5]:
                print(f"       -> [{item['ticker']}] {item['name']}: {item['reason']}")
            if len(v_list) > 5:
                print(f"       -> ... and {len(v_list) - 5} more")

    print("=" * 80)
    if total_violations == 0:
        print("\n>>> RESULT: SUCCESS (0 violations across all 9 rules). All master records are internally consistent.\n")
        return 0
    else:
        print(f"\n>>> RESULT: FAILED ({total_violations} total violations detected). Strict compliance requires 0 violations.\n", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
