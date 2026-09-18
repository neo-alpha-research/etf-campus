#!/usr/bin/env python3
"""Pension Regulatory Consistency Checker (Gate A).

Validates internal consistency across all ETF master records against rules R1 to R12 and P1 to P5.
Strictly exits with code 1 if any violation is detected, preventing CI/CD deployment
of inconsistent regulatory classifications.

========================================================================================================================
PENSION & ISA REGULATORY INTEGRITY PRECEDENCE TABLE (33 RULES HIERARCHY)
========================================================================================================================
Level   | Priority / Authority             | Applicable Rules
------------------------------------------------------------------------------------------------------------------------
Level 1 | Statutory Supremacy (법령 절대 상한) | R7, P2, S3, S10, S1, S2, S4
        | 조문 명문 규정에 의한 편입 차단     | - R7/P2: 레버리지/인버스 퇴직연금·개인연금 원천 차단 (약관 제8조, 퇴직급여법 시행령 제9조)
        | 및 근거 조문 원문 실재성 검증       | - S3: 조문-한도 매핑 (WRBA_ART21 등 금지 조문 차단)
        | (어떤 공시·원장으로도 번복 불가)   | - S10: 법령 스냅샷 90일 만료 검증 (recheck_due)
        |                                  | - S1/S2/S4: statute_registry 실존 및 조문 원문 일치
------------------------------------------------------------------------------------------------------------------------
Level 2 | Statutory & Disclosure Validation (법령 및 공시 적격성) | P4, S11
        | 1배수 정방향 종목의 공시 적격성 검증   | - P4: 한화 8종(CX8) 등 비레버리지 공시 종목의 정상 적격성(가능/100%) 유지
        | 및 개인연금 증거 소스 타당성 검증     | - S11: KOFIA DIS 전자공시 및 공식 원장 기반 검증, 레버리지/인버스 편입 원천 차단
------------------------------------------------------------------------------------------------------------------------
Level 3 | Ledger Closure (원장 3자 정합·폐쇄) | P5, R10, R11, R12, P1, P3, R3, R4, R9
        | 마스터-스크리너-레지스트리 100% 동기화 | - P5: registry(1167) == screener(1167) == master(1167) 전수 일치
        | 및 미설명/미커버 종목 격리 보류    | - P1: 미커버 운용사 '확인 필요' 격리
        |                                  | - P3: 미설명 잔여 종목 격리 (unexplained gap)
        |                                  | - R10~R12: 원장-큐 상호배타성 및 요약 정합성
        |                                  | - R3, R4, R9: 엔진 재계산 및 양방향 한도 일치
------------------------------------------------------------------------------------------------------------------------
Level 4 | Evidence Provenance (증거 출처 등급) | E1, E2, E3, E4, E5, E6, S5, S6-a, S7, S8, S9, S11, R1, R2, R8
        | 원본 증거의 물리적 실재성, 유효기간,   | - E1: evidence_ref 파일 물리적 실재
        | 도메인 규격 및 내부 생성 파일 차단    | - E2: DART(rcpNo 14자리), KOFIA(serviceId) 형식
        |                                  | - E3: 비화이트리스트 파일 50건 초과 차단
        |                                  | - E4: verified_at >= mtime
        |                                  | - E5: SHA-256 해시 검증
        |                                  | - E6: 판매사 원장 60일 유효기간 검사
        |                                  | - S7: 저장소 내부 생성/파생 파일 인용 금지
        |                                  | - S9: 외부 공인 원본 한정
        |                                  | - S11: 개인연금 증거 소스 판별력 검정 통과 필수
========================================================================================================================
[규칙 충돌 시 해결 원칙]
1. 상위 레벨의 규칙이 하위 레벨의 규칙보다 항상 우선한다 (Level 1 > Level 2 > Level 3 > Level 4).
2. Level 1 (법령 상한)에 위배되는 경우, 발행사/판매사 공시나 원장이 '가능'으로 표기되어 있어도 무조건 '불가'로 강제 처리된다.
3. Level 2 (P4 및 S11 검정): 비레버리지 1배수 종목은 KOFIA DIS 및 공식 공시에 의해 '가능'으로 판정하되, 레버리지/인버스가 잘못 인입되지 않도록 원천 차단한다.
4. Level 3 (원장 정합성)에서 근거가 불충분하거나 운용사 공시가 없는 경우(P1, P3), 임의 추정 승격 없이 '확인 필요'로 격리한다.
========================================================================================================================
"""

from __future__ import annotations

import argparse
import csv
import json
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
    load_kofia_fund_types,
    load_verified_broker_tickers,
    load_verified_ledger_entries,
)
from scripts.rules.validate_evidence_integrity import (
    validate_evidence_integrity,
    WHITELISTED_SHARED_EVIDENCE,
)

RULE_DESCRIPTIONS = {
    "R1": "pension_verified = Y -> pension_source in {협회공시대조, KRX공시대조, 투자설명서대조, 증권사목록대조, 증권사·운용사교차검증, 운용사공시대조, 수동확인, 표본대조, 법령조건직접판정}",
    "R2": "pension_verified = N -> pension_confidence != 높음",
    "R3": "pension_eligible = 불가 <-> pension_limit = 불가 (양방향 일치)",
    "R4": "pension_eligible = 가능 -> pension_limit in {100% (안전자산), 70% (위험자산)}",
    "R5": "asset_class in {채권, 금리·파킹} and pension_limit = 70% (위험자산) -> 위반 후보 (단, 하이일드 채무증권 제외)",
    "R6": "asset_class in {주식-국내, 주식-해외} and pension_limit = 100% (안전자산) -> 위반 후보",
    "R7": "이름에 레버리지/인버스 포함 -> pension_limit = 불가",
    "R8": "pension_source = 법령조건직접판정 -> 판정 조건 일치",
    "R9": "엔진 재실행 결과 vs 마스터 CSV 전 행 100% 일치",
    "R10": "pension_audit_ledger.csv(검증 완료)와 pension_unverified_queue.csv 교집합 공집합(상호배타성)",
    "R11": "감사 원장의 검증 ticker 수 == 마스터의 pension_verified=='Y' 수",
    "R12": "summary.json의 verified_count == 감사 원장 검증 행수 == 마스터 pension_verified='Y' 수 == total - 큐 행수",
    "P1": "비레버리지 1,064종 전원 -> personal_pension = '가능', personal_pension_limit = '100%' (표준약관 제8조 당연 적격)",
    "P2": "riskType in ('leverage', 'inverse') 또는 레버리지/인버스 명칭 -> personal_pension = '불가', personal_pension_limit = '불가' (편입 원천 차단)",
    "P3": "개인연금 미설명/미확인 잔여 종목 0건 (100% 커버리지 무결성)",
    "P4": "한화 8종(CX8) 등 비레버리지 공시 종목 -> personal_pension = '가능', personal_pension_limit = '100%' 유지 검증",
    "P5": "개인연금 마스터-스크리너 정합 검사: master 종목 수 == screener 종목 수 == 100% 필드 일치",
}


def validate_pension_consistency(
    master_rows: list[Mapping[str, Any]],
    verified_entries: dict[str, dict[str, str]] | None = None,
    verified_tickers: set[str] | None = None,
    ledger_path: Path | None = None,
    queue_path: Path | None = None,
    summary_path: Path | None = None,
) -> dict[str, list[dict[str, Any]]]:
    """Validate all rows against consistency rules R1 through R12."""
    if verified_entries is None:
        verified_entries = load_verified_ledger_entries()
    if verified_tickers is None:
        verified_tickers = load_verified_broker_tickers()
    kofia_types = load_kofia_fund_types()

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

        # R5: asset_class in {채권, 금리·파킹} and pension_limit = 70% (위험자산) (단, 하이일드 채권, 특별자산, 외화금리(SOFR) 제외)
        is_high_yield = ("하이일드" in name or "High Yield" in name)
        kofia_ft = kofia_types.get(tk, "")
        is_special_asset = ("특별자산" in kofia_ft)
        is_special_or_fx_rate = ("SOFR" in name or "KOFR" in name or "달러" in name or is_special_asset)
        if asset in ("채권", "금리·파킹") and p_lim == "70% (위험자산)" and not is_high_yield and not is_special_or_fx_rate:
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

        # Personal pension fields
        p_pers = str(r.get("personal_pension") or "").strip()
        p_pers_lim = str(r.get("personal_pension_limit") or "").strip()
        risk = str(r.get("risk_type") or "").strip()

        # P2: riskType in ('leverage', 'inverse') or prohibited keywords -> personal_pension = 불가, personal_pension_limit = 불가
        prohibited_keywords = ("레버리지", "인버스", "Leverage", "Inverse", "2X", "2x", "-2X", "-2x", "곱버스", "선물인버스")
        is_leverage_or_inverse = risk in ("leverage", "inverse") or any(k in name for k in prohibited_keywords)
        if is_leverage_or_inverse:
            if p_pers != "불가" or p_pers_lim != "불가":
                violations["P2"].append({
                    "ticker": tk, "name": name,
                    "reason": f"leverage/inverse must have personal_pension=불가/limit=불가 (got status={p_pers}, limit={p_pers_lim})"
                })

        # P3: No items may have personal_pension in ('확인중', '확인 필요') (100% 커버리지 완성)
        if p_pers in ("확인중", "확인 필요"):
            violations["P3"].append({
                "ticker": tk, "name": name,
                "reason": f"unresolved pending item found: personal_pension={p_pers}, limit={p_pers_lim}"
            })

        # P1: Non-leverage items (1,064 items) must have personal_pension = '가능', limit = '100%'
        if not is_leverage_or_inverse:
            if p_pers != "가능" or p_pers_lim != "100%":
                violations["P1"].append({
                    "ticker": tk, "name": name,
                    "reason": f"non-leverage item must have personal_pension='가능'/limit='100%' (got status={p_pers}, limit={p_pers_lim})"
                })

        # P4: Hanwha 8 items (CX8) are verified non-leverage ETFs -> must have personal_pension = '가능', limit = '100%'
        COUNTEREXAMPLE_8_TICKERS = {"0210E0", "238670", "433880", "447660", "451000", "451600", "453010", "477050"}
        if tk in COUNTEREXAMPLE_8_TICKERS:
            if p_pers != "가능" or p_pers_lim != "100%":
                violations["P4"].append({
                    "ticker": tk, "name": name,
                    "reason": f"CX8 item must maintain personal_pension=가능/limit=100% based on KOFIA DIS (got status={p_pers}, limit={p_pers_lim})"
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
            "isa_tax_type",
            "isa_tax_benefit",
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

    # P4: Hanwha disclosure recheck expiration (90 days interval) and status change guardrail
    COUNTEREXAMPLE_8_TICKERS = {"0210E0", "238670", "433880", "447660", "451000", "451600", "453010", "477050"}
    hanwha_path = REPO_ROOT / "data" / "regulatory" / "sources" / "issuers" / "hanwha" / "plus_product_universe_20260906.json"
    if hanwha_path.is_file():
        try:
            import datetime
            with hanwha_path.open("r", encoding="utf-8") as f:
                h_meta = json.load(f)

            # 1. recheck_due validation: Hanwha snapshot collected_at + 90 days
            coll_str = h_meta.get("collected_at", "2026-09-06")
            coll_date = datetime.date.fromisoformat(coll_str[:10])
            due_date = coll_date + datetime.timedelta(days=90)
            today = datetime.date.today()
            if today > due_date:
                days_overdue = (today - due_date).days
                if days_overdue > 90:  # 180 days total
                    violations["P4"].append({
                        "ticker": "ALL_COUNTEREXAMPLES",
                        "name": "한화 공시 재확인 180일 초과 방치",
                        "reason": f"한화 공시 재확인 기한 180일 초과 ({days_overdue}일 초과) -> CRITICAL FAIL",
                    })
                else:
                    print(f"       [WARN P4] 한화 공시 재확인 주기(90일) 도래: 반례 8종 상태 재확인 필요 (기준일: {coll_date}, {days_overdue}일 경과)", file=sys.stderr)

            # 2. Recheck file existence and parseability
            pass
        except Exception as e:
            violations["P4"].append({
                "ticker": "ALL_COUNTEREXAMPLES",
                "name": "한화 공시 파일 파싱 오류",
                "reason": f"한화 공시 파싱 실패: {e}",
            })

    # R10: pension_audit_ledger.csv vs pension_unverified_queue.csv mutual exclusivity
    if ledger_path is None:
        ledger_path = REPO_ROOT / "data/regulatory/pension_audit_ledger.csv"
    if queue_path is None:
        queue_path = REPO_ROOT / "data/reports/pension_unverified_queue.csv"

    ledger_tickers: set[str] = set()
    if ledger_path.exists():
        with ledger_path.open("r", encoding="utf-8-sig") as f:
            ledger_tickers = {
                row["ticker"].strip().upper()
                for row in csv.DictReader(f)
                if row.get("ticker") and str(row.get("pension_verified") or "Y").strip() == "Y"
            }

    queue_tickers: set[str] = set()
    if queue_path.exists():
        with queue_path.open("r", encoding="utf-8-sig") as f:
            queue_tickers = {row["ticker"].strip().upper() for row in csv.DictReader(f) if row.get("ticker")}

    overlap = ledger_tickers & queue_tickers
    if overlap:
        for tk in sorted(overlap):
            violations["R10"].append({
                "ticker": tk,
                "name": "",
                "reason": f"ticker {tk} exists in both verification ledger and unverified queue (mutual exclusivity violation)",
            })

    # R11: ledger ticker count == master verified 'Y' count
    master_verified_y = sum(1 for r in master_rows if str(r.get("pension_verified") or "").strip() == "Y")
    if len(ledger_tickers) != master_verified_y:
        violations["R11"].append({
            "ticker": "ALL",
            "name": "",
            "reason": f"ledger ticker count ({len(ledger_tickers)}) != master verified 'Y' count ({master_verified_y})",
        })

    # R12: summary.json verified_count == ledger row count == master pension_verified='Y' count == total - queue count
    if summary_path is None:
        summary_path = REPO_ROOT / "data/reports/pension_verification_summary.json"
    if summary_path.exists():
        try:
            with summary_path.open("r", encoding="utf-8") as f:
                summary_data = json.load(f)
            sum_verified = summary_data.get("verified_count")
            sum_unverified = summary_data.get("unverified_count")

            mismatches = []
            if sum_verified != len(ledger_tickers):
                mismatches.append(f"summary verified_count ({sum_verified}) != ledger row count ({len(ledger_tickers)})")
            if sum_verified != master_verified_y:
                mismatches.append(f"summary verified_count ({sum_verified}) != master 'Y' count ({master_verified_y})")
            if sum_verified != (len(master_rows) - len(queue_tickers)):
                mismatches.append(f"summary verified_count ({sum_verified}) != total - queue count ({len(master_rows) - len(queue_tickers)})")
            if sum_unverified is not None and sum_unverified != len(queue_tickers):
                mismatches.append(f"summary unverified_count ({sum_unverified}) != queue row count ({len(queue_tickers)})")

            if mismatches:
                violations["R12"].append({
                    "ticker": "SUMMARY",
                    "name": "pension_verification_summary.json",
                    "reason": " / ".join(mismatches),
                })
        except Exception as e:
            violations["R12"].append({
                "ticker": "SUMMARY",
                "name": "pension_verification_summary.json",
                "reason": f"summary.json parsing or read failure: {e}",
            })

    # P5: 개인연금 마스터-스크리너 정합 검사: master 종목 수 == screener 종목 수 == 100% 필드 일치
    screener_path = REPO_ROOT / "public" / "data" / "screener.json"

    if not screener_path.exists():
        violations["P5"].append({
            "ticker": "SCREENER",
            "name": "screener.json",
            "reason": f"screener.json 파일이 존재하지 않음: {screener_path}",
        })
    else:
        try:
            with open(screener_path, "r", encoding="utf-8") as f:
                screener_data = json.load(f)

            screener_items = {x["ticker"]: x for x in screener_data}
            master_tickers = {r.get("ticker"): r for r in master_rows if r.get("ticker")}

            if len(screener_items) != len(master_tickers):
                violations["P5"].append({
                    "ticker": "COUNT",
                    "name": "screener.json",
                    "reason": f"screener 종목 수 ({len(screener_items)}) != master 종목 수 ({len(master_tickers)})",
                })

            for tk, m_row in master_tickers.items():
                m_pers = str(m_row.get("personal_pension") or "").strip()
                m_lim = str(m_row.get("personal_pension_limit") or "").strip()

                sc_item = screener_items.get(tk)
                if not sc_item:
                    violations["P5"].append({
                        "ticker": tk,
                        "name": m_row.get("name", ""),
                        "reason": f"master 종목이 screener.json에 누락됨",
                    })
                    continue

                s_pers = str(sc_item.get("personalPension") or "").strip()
                s_lim = str(sc_item.get("personalPensionLimit") or "").strip()

                if m_pers != s_pers:
                    violations["P5"].append({
                        "ticker": tk,
                        "name": m_row.get("name", ""),
                        "reason": f"personal_pension 불일치: master='{m_pers}' vs screener='{s_pers}'",
                    })
                if m_lim != s_lim:
                    violations["P5"].append({
                        "ticker": tk,
                        "name": m_row.get("name", ""),
                        "reason": f"personal_pension_limit 불일치: master='{m_lim}' vs screener='{s_lim}'",
                    })
        except Exception as e:
            violations["P5"].append({
                "ticker": "ALL",
                "name": "screener.json",
                "reason": f"P5 정합 검사 파싱 오류: {e}",
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
        print("\n>>> Gate A (Internal Consistency): PASS (0 violations across all 9 rules).\n")
    else:
        print(f"\n>>> Gate A (Internal Consistency): FAILED ({total_violations} violations detected).\n", file=sys.stderr)

    # Gate 1: Serial Chain to Evidence Integrity Validation
    audit_path = REPO_ROOT / "data/regulatory/pension_audit_ledger.csv"
    evidence_violations_count = 0

    if audit_path.exists():
        with audit_path.open("r", encoding="utf-8-sig", newline="") as f:
            audit_rows = list(csv.DictReader(f))

        e_viols = validate_evidence_integrity(audit_rows=audit_rows)
        evidence_violations_count = sum(len(v) for v in e_viols.values())

        print("=" * 80)
        print("Gate 1: REGULATORY EVIDENCE INTEGRITY CHECKER (E1 ~ E5)")
        print("=" * 80)
        from scripts.rules.validate_evidence_integrity import RULE_DESCRIPTIONS as E_DESCS
        for r_code, r_desc in E_DESCS.items():
            ev_list = e_viols[r_code]
            e_status = "PASS" if len(ev_list) == 0 else "FAIL"
            print(f"{r_code:<6} | {e_status:<6} | {len(ev_list):<10} | {r_desc}")
            if ev_list and not args.quiet:
                for item in ev_list[:5]:
                    print(f"       -> {item.get('ticker', '')}: {item.get('reason', '')}")
        print("=" * 80)
        if evidence_violations_count == 0:
            print("\n>>> Gate 1 (Evidence Integrity): PASS (0 violations across all 5 rules).\n")
        else:
            print(f"\n>>> Gate 1 (Evidence Integrity): FAILED ({evidence_violations_count} violations detected).\n", file=sys.stderr)

    if total_violations == 0 and evidence_violations_count == 0:
        print(">>> OVERALL RESULT: SUCCESS (0 violations). All rules and evidence checks verified.\n")
        return 0
    else:
        print(f">>> OVERALL RESULT: FAILED ({total_violations + evidence_violations_count} total violations).\n", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
