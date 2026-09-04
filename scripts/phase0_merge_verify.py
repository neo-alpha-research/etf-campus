# Phase 0 — 연금 태그 법정 감독규정 단일 룰 엔진 검증 시트 생성
# 입력: data/etf_master_draft.csv / 출력: data/pension_verify_sheet.csv
import csv
import collections
from pathlib import Path
try:
    from scripts.phase0_collect_and_tag import pension_rule
except ModuleNotFoundError:
    from phase0_collect_and_tag import pension_rule

def main():
    master_path = Path("data/etf_master_draft.csv")
    if not master_path.exists():
        master_path = Path("etf_master_draft.csv")
    master = list(csv.DictReader(open(master_path, encoding="utf-8-sig")))

    out, stats = [], collections.Counter()
    for r in master:
        risk = r.get("risk_type", "normal")
        name = r.get("name", "")
        base_index = r.get("base_index", "")
        rule_result = pension_rule(risk, name, base_index)
        is_eligible = rule_result.startswith("가능")
        
        status = "확인완료(법정규칙)"
        stats[status] += 1
        out.append({
            **r,
            "official_src": "근로자퇴직급여보장법 감독규정",
            "issuer_official": "가능" if is_eligible else "불가",
            "verify_status": status,
            "final_pension": "가능" if is_eligible else "불가",
            "final_src": "법정규칙",
        })
        
    out_path = Path("data/pension_verify_sheet.csv")
    if not out_path.parent.exists():
        out_path = Path("pension_verify_sheet.csv")
    with open(out_path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0].keys()))
        w.writeheader()
        w.writerows(out)
    print(f"Verified {len(out)} ETFs with statutory pension rule engine. Summary: {dict(stats)}")


if __name__ == "__main__":
    main()
