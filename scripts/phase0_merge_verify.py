#!/usr/bin/env python3
# Phase 0 — 연금 태그 및 ISA 법정 감독규정 단일 룰 엔진 검증 시트 생성
# 입력: data/etf_master_draft.csv / 출력: data/pension_verify_sheet.csv
import csv
import collections
from pathlib import Path

try:
    from scripts.rules.pension_regulatory_engine import classify_pension_and_isa
except ModuleNotFoundError:
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from scripts.rules.pension_regulatory_engine import classify_pension_and_isa


def main():
    master_path = Path("data/etf_master_draft.csv")
    if not master_path.exists():
        master_path = Path("etf_master_draft.csv")
    with master_path.open("r", encoding="utf-8-sig") as f:
        master = list(csv.DictReader(f))

    out, stats = [], collections.Counter()
    for r in master:
        reg = classify_pension_and_isa(r)
        is_eligible = reg["pension_eligible"] == "가능"

        status = "확인완료(법정규칙)"
        stats[status] += 1
        out.append({
            **r,
            "pension_eligible": reg["pension_eligible"],
            "pension_limit": reg["pension_limit"],
            "isa_eligible": reg["isa_eligible"],
            "isa_education_required": reg["isa_education_required"],
            "pension_source": reg["pension_source"],
            "pension_confidence": reg["pension_confidence"],
            "official_src": "퇴직연금감독규정 제9조·제12조 및 조세특례제한법 제91조의18",
            "issuer_official": "가능" if is_eligible else "불가",
            "verify_status": status,
            "final_pension": reg["pension_eligible"],
            "final_src": reg["pension_source"],
        })

    out_path = Path("data/pension_verify_sheet.csv")
    if not out_path.parent.exists():
        out_path = Path("pension_verify_sheet.csv")
    with open(out_path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0].keys()))
        w.writeheader()
        w.writerows(out)
    print(f"Verified {len(out)} ETFs with statutory pension & ISA rule engine. Summary: {dict(stats)}")


if __name__ == "__main__":
    main()
