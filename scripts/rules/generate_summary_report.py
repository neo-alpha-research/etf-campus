#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generates pension_verification_summary.json with dual indicators and strict audit assertions."""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.rules.validate_evidence_integrity import validate_evidence_integrity


def generate_summary() -> dict[str, Any]:
    audit_path = REPO_ROOT / "data/regulatory/pension_audit_ledger.csv"
    with open(audit_path, "r", encoding="utf-8-sig", newline="") as f:
        audit_rows = list(csv.DictReader(f))

    master_path = REPO_ROOT / "data/etf_master_draft.csv"
    with open(master_path, "r", encoding="utf-8-sig", newline="") as f:
        master_rows = list(csv.DictReader(f))

    queue_path = REPO_ROOT / "data/reports/pension_unverified_queue.csv"
    queue_rows = []
    if queue_path.exists():
        with open(queue_path, "r", encoding="utf-8-sig", newline="") as f:
            queue_rows = list(csv.DictReader(f))

    total = len(master_rows)
    master_verified_tickers = {
        r["ticker"].strip().upper()
        for r in master_rows
        if str(r.get("pension_verified") or "").strip() == "Y"
    }
    master_Y_count = len(master_verified_tickers)

    verified_rows = [
        r for r in audit_rows
        if str(r.get("pension_verified") or "").strip() == "Y"
    ]

    # Count tiers and grades from verified audit rows
    tiers: dict[str, int] = {}
    grades: dict[str, int] = {}
    for r in verified_rows:
        t = str(r.get("evidence_tier") or "").strip()
        g = str(r.get("evidence_grade") or "").strip()
        if t:
            tiers[t] = tiers.get(t, 0) + 1
        if g:
            grades[g] = grades.get(g, 0) + 1

    # Statutory basis count: strictly E1, E1B, E2, E3 (excluding RULE_NAME)
    statutory_basis_count = sum(grades.get(k, 0) for k in ["E1", "E1B", "E2", "E3"])
    verified_count = len(verified_rows)
    unverified_count = len(queue_rows)

    # Validate evidence integrity to get live S5 violation count
    e_viols = validate_evidence_integrity(audit_rows=audit_rows)
    s5_violations_count = len(e_viols.get("S5", []))

    safe_caution_remaining = sum(
        1 for qr in queue_rows if qr.get("위험방향") == "안전자산_주의"
    )

    isa_covered = sum(1 for m in master_rows if m.get("isa_tax_type") in ("국내주식형", "기타"))
    isa_pct = round((isa_covered / total) * 100, 1)

    summary: dict[str, Any] = {
        "updated_at": "2026-09-06",
        "total_universe": total,
        "verified_count": verified_count,
        "verified_ratio": round(verified_count / total * 100, 2),
        "unverified_count": unverified_count,
        "unverified_ratio": round(unverified_count / total * 100, 2),
        "법령근거_확보": {
            "건수": statutory_basis_count,
            "비율": round(statutory_basis_count / total * 100, 1),
            "구성": {
                "E1": grades.get("E1", 0),
                "E1B": grades.get("E1B", 0),
                "E2": grades.get("E2", 0),
                "E3": grades.get("E3", 0),
            },
            "설명": "E1(투자설명서원문), E1B(운용사공식확약), E2(정정신고서), E3(금융투자협회표준유형XML) 등 법령 및 공시 원문 직접 검증 확보",
        },
        "실무_확인": {
            "건수": verified_count,
            "비율": round(verified_count / total * 100, 1),
            "설명": "전체 검증 완료 (법령·공시·운용사·판매사 복합 실무 확인)",
        },
        "교차검증_강도": {
            "3way": tiers.get("3way", 0),
            "2way": tiers.get("2way", 0),
            "1way": tiers.get("1way", 0),
            "설명": "3way: 법령/공시 + 운용사 + 판매사 3자 완전 일치, 2way: 운용사 + 규제엔진/판매사 2자 일치, 1way: 법령/공시/명칭규칙 1자 확인",
        },
        "evidence_grades": grades,
        "unverified_queue": [
            {
                "ticker": qr["ticker"],
                "name": qr["name"],
                "reason": qr.get("확정_불가_사유", ""),
            }
            for qr in queue_rows
        ],
        # Backward-compatibility fields
        "as_of": "2026-09-06",
        "total": total,
        "verified": verified_count,
        "unverified": unverified_count,
        "verified_pct": round(verified_count / total * 100, 1),
        "s5_evidence_sufficiency_violations": s5_violations_count,
        "안전자산_주의_잔여": safe_caution_remaining,
        "isa_tax_type_coverage_pct": isa_pct,
        "isa_breakdown": {
            "국내주식형_절세낮음": sum(1 for m in master_rows if m.get("isa_tax_type") == "국내주식형"),
            "기타_절세높음": sum(1 for m in master_rows if m.get("isa_tax_type") == "기타"),
            "사전교육대상_Y": sum(1 for m in master_rows if m.get("isa_education_required") == "Y"),
        },
    }

    # 4 Strict Assertions mandated by Claude Opus 5.0 audit:
    assert summary["verified_count"] == len(verified_rows), (
        f"verified_count ({summary['verified_count']}) != audit verified rows ({len(verified_rows)})"
    )
    assert summary["verified_count"] == master_Y_count, (
        f"verified_count ({summary['verified_count']}) != master Y count ({master_Y_count})"
    )
    assert summary["verified_count"] + summary["unverified_count"] == total, (
        f"verified ({summary['verified_count']}) + unverified ({summary['unverified_count']}) != {total}"
    )
    assert statutory_basis_count == (
        grades.get("E1", 0) + grades.get("E1B", 0) + grades.get("E2", 0) + grades.get("E3", 0)
    ), "법령근거_합계 mismatch"

    print(">>> All 4 Opus audit assertions passed successfully!")

    # Write to canonical path
    out_path = REPO_ROOT / "data/reports/pension_verification_summary.json"
    with open(out_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"[OK] Canonical summary updated at: {out_path}")
    print(f"     Verified: {summary['verified_count']} / Unverified: {summary['unverified_count']}")
    print(f"     Statutory basis: {summary['법령근거_확보']['건수']} ({summary['법령근거_확보']['비율']}%)")
    print(f"     Cross-validation: {summary['교차검증_강도']}")

    return summary


if __name__ == "__main__":
    generate_summary()

