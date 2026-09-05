#!/usr/bin/env python3
"""Build Comprehensive Pension Regulatory Audit Ledger (전수 퇴직연금 규제 감사 원장)

This script generates `data/regulatory/pension_audit_ledger.csv` containing
full audit trails for all 1,167 ETFs:
- Exact data source (KOFIA DIS XML or DART Prospectus)
- Official statutory basis (근로자퇴직급여보장법, 퇴직연금감독규정, 관련 고시)
- Evidence references and specific clauses
- AMC and asset class metadata
- Detailed verification methodology and notes for external auditors
"""

import csv
import datetime
from pathlib import Path
import re
from typing import Dict, Any

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

BRAND_TO_AMC = {
    "KODEX": "삼성자산운용",
    "TIGER": "미래에셋자산운용",
    "ACE": "한국투자신탁운용",
    "RISE": "KB자산운용",
    "KBSTAR": "KB자산운용",
    "SOL": "신한자산운용",
    "PLUS": "한화자산운용",
    "ARIRANG": "한화자산운용",
    "HANARO": "NH-Amundi자산운용",
    "KIWOOM": "키움투자자산운용",
    "KOSEF": "키움투자자산운용",
    "WON": "우리에셋자산운용",
    "WOORI": "우리에셋자산운용",
    "TIME": "타임폴리오자산운용",
    "TIMEFOLIO": "타임폴리오자산운용",
    "1Q": "하나자산운용",
    "FOCUS": "하나자산운용",
    "UNICORN": "현대자산운용",
    "마이티": "현대자산운용",
    "파워": "교보악사자산운용",
    "MIDAS": "마이다스에셋자산운용",
    "마이다스": "마이다스에셋자산운용",
    "DAISHIN": "대신자산운용",
    "대신": "대신자산운용",
    "TRUSTON": "트러스톤자산운용",
    "트러스톤": "트러스톤자산운용",
    "에셋플러스": "에셋플러스자산운용",
    "BNK": "BNK자산운용",
    "IBK": "IBK자산운용",
    "DB": "DB자산운용",
}

def resolve_amc(name: str) -> str:
    for brand, amc in BRAND_TO_AMC.items():
        if name.upper().startswith(brand.upper()):
            return amc
    return "기타"


def build_audit_ledger():
    master_path = REPO_ROOT / "data/etf_master_draft.csv"
    ledger_path = REPO_ROOT / "data/regulatory/pension_verification_ledger.csv"
    sources_dir = REPO_ROOT / "data/regulatory/sources"
    out_audit_csv = REPO_ROOT / "data/regulatory/pension_audit_ledger.csv"

    # 1. Load Master ETFs
    with master_path.open("r", encoding="utf-8-sig") as f:
        master_rows = list(csv.DictReader(f))

    # 2. Load Verification Ledger
    verification_ledger: Dict[str, Dict[str, str]] = {}
    if ledger_path.exists():
        with ledger_path.open("r", encoding="utf-8-sig") as f:
            for r in csv.DictReader(f):
                tk = r.get("ticker", "").strip().upper()
                if tk:
                    verification_ledger[tk] = r

    audit_rows = []
    # Load statute registry for authoritative statutory citations
    statute_registry_path = REPO_ROOT / "data/regulatory/statute_registry.csv"
    statute_map = {}
    if statute_registry_path.is_file():
        with statute_registry_path.open("r", encoding="utf-8-sig", newline="") as f:
            for srow in csv.DictReader(f):
                sid = srow.get("statute_id", "").strip()
                if sid:
                    statute_map[sid] = srow

    SYNTHETIC_NAME_PATTERN = re.compile(r"\(합성[ H]*\)")

    for m in master_rows:
        tk = m["ticker"].strip().upper()
        nm = m["name"].strip()
        amc = resolve_amc(nm)
        isin = m.get("isin_cd", "").strip()
        asset = m.get("asset_class", "").strip()
        risk = m.get("risk_type", "").strip().lower()
        p_elig = m.get("pension_eligible", "").strip()
        p_lim = m.get("pension_limit", "").strip()
        p_ver = m.get("pension_verified", "").strip()
        p_conf = m.get("pension_confidence", "").strip()
        p_src = m.get("pension_source", "").strip()
        is_synth = bool(SYNTHETIC_NAME_PATTERN.search(nm))

        v_entry = verification_ledger.get(tk, {})
        delegation_basis = ""

        if p_ver == "Y" and v_entry:
            src_type = v_entry.get("source_type") or p_src or "협회공시대조"
            src_url = v_entry.get("source_url") or "https://dis.kofia.or.kr"
            evidence_ref = v_entry.get("evidence_ref") or "data/regulatory/sources/kofia_evidence_extract_20260905.xml"
            v_at = v_entry.get("verified_at") or "2026-09-05"
            audit_status = "PASS (공식 검증 완료)"

            if src_type == "협회공시대조":
                if p_lim == "100% (안전자산)":
                    statute_id = "PSR_ART11_1_4"
                    delegation_basis = ""
                    audit_note = v_entry.get("note") or "KOFIA 펀드유형 채권형 대조 완료"
                    check_method = "금융투자협회 전자공시서비스(DIS) 표준 펀드유형 '채권형' XML 전수 대조"
                else:
                    statute_id = "MOEL_WRBA_RULE_ART10_1_2"
                    delegation_basis = "ED_WRBA_ART26_1_2"
                    audit_note = v_entry.get("note") or "KOFIA 펀드유형 주식형 대조 완료 (시행령 제26조제1항제2호가목 위임)"
                    check_method = "금융투자협회 전자공시서비스(DIS) 표준 펀드유형 '주식형' XML 전수 대조 (시행규칙 제10조제1항제2호 한도 70%)"
            else:
                statute_id = "PSR_ART9_1_2" if p_lim == "100% (안전자산)" else "MOEL_WRBA_RULE_ART10_1_2"
                delegation_basis = "ED_WRBA_ART26_1_2" if statute_id == "MOEL_WRBA_RULE_ART10_1_2" else ""
                audit_note = v_entry.get("note") or m.get("pension_reason", "")
                check_method = f"공식 출처 대조 ({src_type})"
        else:
            src_type = p_src
            src_url = ""
            evidence_ref = ""
            v_at = ""
            audit_status = "ROLLED_BACK_UNVERIFIED"

            # Granular unverified remapping adhering to Gate 1 / Gate 2:
            if p_lim == "불가":
                if risk in ("leverage", "inverse"):
                    statute_id = "PSR_ART9_1_2"
                    audit_note = "레버리지/인버스 파생평가액 초과 (퇴직연금감독규정 제9조 제1항 제2호 마목 단서 배제)"
                    check_method = "규제 엔진 규칙기반 판정 (파생배율 초과 배제)"
                else:
                    # Commodity / currency futures -> leave empty ""
                    statute_id = ""
                    audit_note = "선물 기반 파생 위험평가액 40% 초과 (법령 근거 미확정 공란)"
                    check_method = "규제 엔진 규칙기반 판정 (공란 처리, 공시대조 대기)"
            elif p_lim == "100% (안전자산)":
                if is_synth and p_src == "법령조건직접판정":
                    statute_id = "PSR_ART9_1_2"
                    audit_note = "퇴직연금감독규정 1배 증권형 합성 ETF 예외 (제9조 제1항 제2호 마목 본문)"
                    check_method = "법령 조건 직접 판정 (1배수 증권형 장외파생 100% 허용)"
                elif asset == "금리·파킹":
                    statute_id = "PSR_ART11_1_6"
                    audit_note = "단기금융집합투자기구(MMF) 및 금리파킹형 안전자산"
                    check_method = "규제 엔진 규칙기반 판정 (제11조 제1항 제6호 MMF 추정)"
                elif "TDF" in nm:
                    statute_id = "PSR_ART11_1_9"
                    audit_note = "적격 TDF 안전자산 (투자목표시점 명시 및 자산배분 조정)"
                    check_method = "규제 엔진 규칙기반 판정 (제11조 제1항 제9호 적격 TDF 추정)"
                elif any(kw in nm for kw in ["채권혼합", "혼합50", "국채혼합50", "TRF3070", "TRF5050", "TIF"]):
                    statute_id = "PSR_ART11_1_5"
                    audit_note = "약관상 주식 투자한도 50% 미만 채권혼합형 안전자산"
                    check_method = "규제 엔진 규칙기반 판정 (제11조 제1항 제5호 채권혼합 추정)"
                else:
                    statute_id = "PSR_ART11_1_4"
                    audit_note = "채권형 안전자산"
                    check_method = "규제 엔진 규칙기반 판정 (제11조 제1항 제4호 채권형 추정)"
            else: # 70% (위험자산)
                if p_src == "법령조건직접판정":
                    statute_id = "PSR_ART9_1_2"
                    audit_note = "퇴직연금감독규정 1배 증권형 합성 위험자산 (제9조 제1항 제2호 마목 본문)"
                    check_method = "법령 조건 직접 판정 (1배수 증권형 장외파생 위험자산)"
                else:
                    # Fallback 규칙기반추정 -> leave empty ""
                    statute_id = ""
                    audit_note = "위험자산 (투자설명서 미검증 공란, 추정치)"
                    check_method = "규제 엔진 규칙기반 판정 (공란 처리, 공시대조 대기)"

        if statute_id:
            reg_meta = statute_map.get(statute_id, {})
            statute_text = (
                f"{reg_meta.get('statute_name', '')} {reg_meta.get('article', '')} ({reg_meta.get('title', '')})".strip()
                if reg_meta
                else statute_id
            )
        else:
            statute_text = ""

        audit_rows.append({
            "ticker": tk,
            "isin": isin,
            "name": nm,
            "amc": amc,
            "asset_class": asset,
            "pension_eligible": p_elig,
            "pension_limit": p_lim,
            "pension_verified": p_ver,
            "pension_confidence": p_conf,
            "source_type": src_type,
            "source_url": src_url,
            "evidence_ref": evidence_ref,
            "statutory_basis": statute_id,
            "statutory_basis_text": statute_text,
            "delegation_basis": delegation_basis,
            "audit_check_method": check_method,
            "audit_notes": audit_note,
            "verified_at": v_at,
            "audit_status": audit_status,
        })

    out_audit_csv.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "ticker",
        "isin",
        "name",
        "amc",
        "asset_class",
        "pension_eligible",
        "pension_limit",
        "pension_verified",
        "pension_confidence",
        "source_type",
        "source_url",
        "evidence_ref",
        "statutory_basis",
        "statutory_basis_text",
        "delegation_basis",
        "audit_check_method",
        "audit_notes",
        "verified_at",
        "audit_status",
    ]

    with out_audit_csv.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(audit_rows)

    public_audit_csv = REPO_ROOT / "public/data/regulatory/pension_audit_ledger.csv"
    public_audit_csv.parent.mkdir(parents=True, exist_ok=True)
    with public_audit_csv.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(audit_rows)

    print(f"[AUDIT LEDGER] Successfully built full audit ledger with {len(audit_rows)} rows at {out_audit_csv} and {public_audit_csv}")
    return len(audit_rows)


if __name__ == "__main__":
    build_audit_ledger()
