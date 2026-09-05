#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Statutory Pension & ISA Classification Engine.

Implements statutory regulatory rules under:
1. 근로자퇴직급여 보장법 (근퇴법) 제21조(적립금 운용방법 및 정보제공), 제25조(개인형퇴직연금제도의 운영 등)
2. 퇴직연금감독규정 제9조(증권 및 기타 적립금 운용방법의 종류 등), 제12조(확정기여형퇴직연금 및 개인형퇴직연금의 위험자산 및 투자한도) 제4항, [별표 1]
3. 조세특례제한법 제91조의18(개인종합자산관리계좌에 대한 과세특례)
4. 금융투자협회(KOFIA) 전자공시 펀드유형 및 퇴직연금 검증 원장(pension_verification_ledger.csv) 연동
"""

from __future__ import annotations

import argparse
import csv
import datetime
import json
import re
import sys
from pathlib import Path
from typing import Any, Mapping

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# ---------------------------------------------------------------------------
# Regulatory Classification Constants
# ---------------------------------------------------------------------------
PENSION_ELIGIBLE = "가능"
PENSION_INELIGIBLE = "불가"

LIMIT_SAFE_ASSET = "100% (안전자산)"
LIMIT_RISK_ASSET = "70% (위험자산)"
LIMIT_INELIGIBLE = "불가"

ISA_ELIGIBLE = "가능"
ISA_INELIGIBLE = "불가"

ISA_EDUCATION_REQUIRED = "Y"
ISA_EDUCATION_NOT_REQUIRED = "N"

# ---------------------------------------------------------------------------
# Pension Audit & Confidence Metadata Constants
# ---------------------------------------------------------------------------
PENSION_SOURCE_STATUTE_DIRECT = "법령조건직접판정"
PENSION_SOURCE_RULE_ESTIMATE = "규칙기반추정"
PENSION_SOURCE_SAMPLE_VERIFIED = "표본대조"
PENSION_SOURCE_BROKER_VERIFIED = "증권사목록대조"
PENSION_SOURCE_KOFIA_VERIFIED = "협회공시대조"
PENSION_SOURCE_KRX_VERIFIED = "KRX공시대조"
PENSION_SOURCE_PROSPECTUS_VERIFIED = "투자설명서대조"
PENSION_SOURCE_MANUAL_VERIFIED = "수동확인"

VALID_VERIFIED_SOURCES = {
    PENSION_SOURCE_KOFIA_VERIFIED,
    PENSION_SOURCE_KRX_VERIFIED,
    PENSION_SOURCE_PROSPECTUS_VERIFIED,
    PENSION_SOURCE_BROKER_VERIFIED,
    PENSION_SOURCE_MANUAL_VERIFIED,
    PENSION_SOURCE_SAMPLE_VERIFIED,
    PENSION_SOURCE_STATUTE_DIRECT,
}

PENSION_CONFIDENCE_HIGH = "높음"
PENSION_CONFIDENCE_MODERATE = "보통"
PENSION_CONFIDENCE_LOW = "낮음"

PENSION_VERIFIED_YES = "Y"
PENSION_VERIFIED_NO = "N"

ISA_TAX_TYPE_DOMESTIC_EQUITY = "국내주식형"
ISA_TAX_TYPE_OTHER = "기타"

ISA_TAX_BENEFIT_HIGH = "높음"
ISA_TAX_BENEFIT_LOW = "낮음"

SAMPLE_VERIFIED_TICKERS: set[str] = set()


def load_kofia_fund_types(kofia_path: Path | None = None) -> dict[str, str]:
    """Load official KOFIA fund types mapping (ticker -> fund_type)."""
    path = kofia_path or (REPO_ROOT / "data" / "regulatory" / "kofia_fund_types.csv")
    mapping: dict[str, str] = {}
    if not path.exists():
        return mapping
    try:
        with path.open("r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for r in reader:
                tk = str(r.get("ticker") or "").strip().upper()
                ft = str(r.get("fund_type") or "").strip()
                if tk and ft:
                    mapping[tk] = ft
    except Exception as e:
        print(f"[WARN] Failed to load kofia_fund_types.csv at {path}: {e}")
    return mapping


_KOFIA_FUND_TYPES_CACHE: dict[str, str] | None = None


def load_verified_ledger_entries(ledger_path: Path | None = None) -> dict[str, dict[str, str]]:
    """Load valid, unexpired entries from pension_verification_ledger.csv."""
    path = ledger_path or (REPO_ROOT / "data" / "regulatory" / "pension_verification_ledger.csv")
    entries: dict[str, dict[str, str]] = {}
    if not path.exists():
        return entries

    today_str = datetime.date.today().isoformat()
    try:
        with path.open("r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                tk = str(row.get("ticker") or "").strip().upper()
                if not tk:
                    continue
                expires_at = str(row.get("expires_at") or "").strip()
                # If expiration date is specified and expired, do not consider verified
                if expires_at and expires_at < today_str:
                    continue
                entries[tk] = row
    except Exception as e:
        print(f"[WARN] Failed to read verification ledger at {path}: {e}")
    return entries


def load_verified_broker_tickers() -> set[str]:
    """Legacy helper: loads tickers from broker_pension_universe.csv."""
    verified = set(SAMPLE_VERIFIED_TICKERS)
    broker_csv = REPO_ROOT / "data" / "regulatory" / "broker_pension_universe.csv"
    if broker_csv.exists():
        try:
            with broker_csv.open("r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    tk = str(row.get("ticker") or "").strip().upper()
                    if tk:
                        verified.add(tk)
        except Exception:
            pass
    return verified


SYNTHETIC_NAME_PATTERN = re.compile(r"\(합성[ H]*\)")


def is_underlying_security(row: Mapping[str, Any]) -> str:
    """Determine whether the ETF's underlying asset is securities or non-securities."""
    ticker = str(row.get("ticker") or "").strip()
    name = str(row.get("name") or "").strip()
    base_index = str(row.get("base_index") or "").strip()
    asset = str(row.get("asset_class") or "").strip()

    if "탄소배출권" in name or "Carbon" in base_index:
        return "N"

    if ticker == "219390" or "원유생산기업" in name or "자원생산기업" in name:
        return "Y"
    if "금현물" in name:
        return "Y"

    commodity_or_fx_kw = [
        "원유선물", "골드선물", "은선물", "구리선물", "농산물선물", "콩선물",
        "달러선물", "엔선물", "유로선물", "VIX선물", "천연가스선물"
    ]
    if any(kw in name for kw in commodity_or_fx_kw):
        return "N"

    if asset in ("원자재", "통화"):
        if any(kw in base_index.lower() for kw in ["commodity", "futures", "crude", "gold", "silver", "wti", "brent"]):
            return "N"
        if not ("기업" in name or "리츠" in name or "인프라" in name or "주식" in name):
            return "N"

    return "Y"


def classify_pension_and_isa(
    row: Mapping[str, Any],
    verified_entries: dict[str, dict[str, str]] | None = None,
    verified_tickers: set[str] | None = None,
) -> dict[str, str]:
    """Classify a single ETF according to statutory Pension (DC/IRP) and ISA regulations.

    Reconciliation rule with verification ledger:
    - If ticker exists in ledger and ledger's verified_limit == statutory pension_limit:
        pension_verified = 'Y', pension_source = source_type, pension_confidence = '높음'
    - If ledger's verified_limit != statutory pension_limit (divergence):
        pension_verified = 'N', pension_confidence = '낮음', records divergence
    """
    ticker = str(row.get("ticker") or "").strip().upper()
    name = str(row.get("name") or "").strip()
    base_index = str(row.get("base_index") or "").strip()
    risk = str(row.get("risk_type") or "normal").strip().lower()
    asset = str(row.get("asset_class") or "").strip()
    underlying_sec = is_underlying_security(row)

    # 1. ISA Classification (Complete 4-field architecture)
    isa_eligible = ISA_ELIGIBLE
    is_leverage = (risk == "leverage")
    is_inverse_2x = (risk == "inverse" and bool(re.search(r"2X|2x", name)))
    isa_education_required = (
        ISA_EDUCATION_REQUIRED if (is_leverage or is_inverse_2x) else ISA_EDUCATION_NOT_REQUIRED
    )

    kofia_ft = str(row.get("kofia_fund_type") or "").strip()
    if not kofia_ft:
        global _KOFIA_FUND_TYPES_CACHE
        if _KOFIA_FUND_TYPES_CACHE is None:
            _KOFIA_FUND_TYPES_CACHE = load_kofia_fund_types()
        kofia_ft = _KOFIA_FUND_TYPES_CACHE.get(ticker, "")

    if kofia_ft == "주식형" and asset == "주식-국내":
        isa_tax_type = ISA_TAX_TYPE_DOMESTIC_EQUITY
        isa_tax_benefit = ISA_TAX_BENEFIT_LOW
    else:
        isa_tax_type = ISA_TAX_TYPE_OTHER
        isa_tax_benefit = ISA_TAX_BENEFIT_HIGH

    # 2. Pension Absolute Exclusion
    is_spot = "현물" in name
    has_futures_keyword = bool(
        re.search(r"선물|Futures", f"{name} {base_index}", re.IGNORECASE)
    )

    if risk in ("leverage", "inverse"):
        pension_eligible = PENSION_INELIGIBLE
        pension_limit = LIMIT_INELIGIBLE
        reason = "레버리지/인버스 파생평가액 초과 (퇴직연금 편입 요건 미충족)"
    elif has_futures_keyword and not is_spot:
        pension_eligible = PENSION_INELIGIBLE
        pension_limit = LIMIT_INELIGIBLE
        reason = "선물 기반 파생 위험평가액 40% 초과 (퇴직연금 편입 요건 미충족)"
    else:
        # 3. Pension Limit Determination (100% vs 70%)
        pension_eligible = PENSION_ELIGIBLE
        is_safe = False
        reason = "위험자산 (계좌 내 70% 한도)"

        is_high_yield = ("하이일드" in name or "High Yield" in name or "high yield" in base_index.lower())

        if is_high_yield:
            is_safe = False
            reason = "하이일드 채권 (투자적격등급 외 채무증권 30% 초과 가능으로 안전자산 제외, 퇴직연금감독규정 제11조 제1항 제5호 단서, 70% 한도 적용)"
        elif asset == "금리·파킹":
            is_safe = True
            reason = "금리·파킹형 안전자산 (100% 투자 가능)"
        elif asset == "채권":
            is_safe = True
            reason = "채권형 안전자산 (100% 투자 가능)"
        elif "TDF" in name:
            is_safe = True
            reason = "적격 TDF 안전자산 (100% 투자 가능)"
        elif "TRF3070" in name or "TIF" in name:
            is_safe = True
            reason = "주식비중 50% 미만 자산배분 안전자산 (100% 투자 가능)"
        elif any(kw in name for kw in ["채권혼합", "혼합50", "국채혼합50"]):
            is_safe = True
            reason = "적격 채권혼합형(주식 50% 미만) 안전자산 (100% 투자 가능)"

        pension_limit = LIMIT_SAFE_ASSET if is_safe else LIMIT_RISK_ASSET

    # 4. Source & Verification Reconciliation
    is_synthetic = bool(SYNTHETIC_NAME_PATTERN.search(name))
    is_cc = "커버드콜" in name

    # Load ledger entries if not explicitly passed
    ledger = verified_entries if verified_entries is not None else load_verified_ledger_entries()
    v_entry = ledger.get(ticker)

    if v_entry:
        v_limit = str(v_entry.get("verified_limit") or "").strip()
        v_src = str(v_entry.get("source_type") or PENSION_SOURCE_KOFIA_VERIFIED).strip()
        v_grade = str(v_entry.get("evidence_grade") or "").strip()
        if v_limit == pension_limit:
            # Agreement: Verified
            # Opus review: RULE_NAME or E3 mixed bond items keep confidence = 보통 until prospectus/data verified, pure bond/equity restored to 높음
            conf = PENSION_CONFIDENCE_MODERATE if (v_grade in ("RULE_NAME", "RULE") or (v_grade == "E3" and kofia_ft == "혼합채권형")) else PENSION_CONFIDENCE_HIGH
            return {
                "pension_eligible": pension_eligible,
                "pension_limit": pension_limit,
                "isa_eligible": isa_eligible,
                "isa_tax_type": isa_tax_type,
                "isa_tax_benefit": isa_tax_benefit,
                "isa_education_required": isa_education_required,
                "pension_source": v_src,
                "pension_verified": PENSION_VERIFIED_YES,
                "pension_confidence": conf,
                "pension_reason": f"{v_src} 완료 - {reason}",
                "underlying_is_security": underlying_sec,
            }
        else:
            # Divergence between ledger and engine
            return {
                "pension_eligible": pension_eligible,
                "pension_limit": pension_limit,
                "isa_eligible": isa_eligible,
                "isa_tax_type": isa_tax_type,
                "isa_tax_benefit": isa_tax_benefit,
                "isa_education_required": isa_education_required,
                "pension_source": PENSION_SOURCE_RULE_ESTIMATE,
                "pension_verified": PENSION_VERIFIED_NO,
                "pension_confidence": PENSION_CONFIDENCE_LOW,
                "pension_reason": f"공시대조 불일치 (원장: {v_limit} vs 엔진: {pension_limit}) - {reason}",
                "underlying_is_security": underlying_sec,
            }

    # Backward compatibility with verified_tickers set (e.g. broker list / mock tests)
    if verified_tickers is not None and ticker in verified_tickers and pension_eligible != PENSION_INELIGIBLE:
        return {
            "pension_eligible": pension_eligible,
            "pension_limit": pension_limit,
            "isa_eligible": isa_eligible,
            "isa_tax_type": isa_tax_type,
            "isa_tax_benefit": isa_tax_benefit,
            "isa_education_required": isa_education_required,
            "pension_source": PENSION_SOURCE_BROKER_VERIFIED,
            "pension_verified": PENSION_VERIFIED_YES,
            "pension_confidence": PENSION_CONFIDENCE_HIGH,
            "pension_reason": f"증권사 적격 대조 완료 - {reason}",
            "underlying_is_security": underlying_sec,
        }

    # Unverified items
    if is_synthetic and underlying_sec == "Y" and risk == "normal" and not is_cc:
        pension_source = PENSION_SOURCE_STATUTE_DIRECT
        pension_verified = PENSION_VERIFIED_NO
        pension_confidence = PENSION_CONFIDENCE_MODERATE
        pension_reason = f"퇴직연금감독규정 1배 증권형 합성 ETF 예외 (2016.9.21 의결) - {reason}"
    else:
        pension_source = PENSION_SOURCE_RULE_ESTIMATE
        pension_verified = PENSION_VERIFIED_NO
        pension_confidence = PENSION_CONFIDENCE_LOW
        if is_cc:
            pension_reason = f"커버드콜 옵션 매도 파생평가액 산정 미확인 (추정) - {reason}"
        else:
            pension_reason = reason

    return {
        "pension_eligible": pension_eligible,
        "pension_limit": pension_limit,
        "isa_eligible": isa_eligible,
        "isa_tax_type": isa_tax_type,
        "isa_tax_benefit": isa_tax_benefit,
        "isa_education_required": isa_education_required,
        "pension_source": pension_source,
        "pension_verified": pension_verified,
        "pension_confidence": pension_confidence,
        "pension_reason": pension_reason,
        "underlying_is_security": underlying_sec,
    }


def classify_new_listing(row: Mapping[str, Any]) -> dict[str, str]:
    """Classify newly listed ETF adhering strictly to Gate 5 conservative default principle.

    Rule: Automatic rule permits ONLY '불가' (ineligible) or '70% (위험자산)'.
    NEVER automatically assigns '100% (안전자산)' without verified disclosure evidence.
    Always initializes with pension_verified = 'N', confidence = '낮음'.
    """
    res = classify_pension_and_isa(row, verified_entries={}, verified_tickers=set())
    # Asymmetry rule: downgrade 100% safe asset to 70% risk asset pending official disclosure
    if res["pension_limit"] == LIMIT_SAFE_ASSET:
        res["pension_limit"] = LIMIT_RISK_ASSET
        res["pension_reason"] = "신규 상장 미검증 보수적 기본값 (공시 확인 전 70% 제한 적용) - " + res.get("pension_reason", "")
    res["pension_verified"] = PENSION_VERIFIED_NO
    res["pension_confidence"] = PENSION_CONFIDENCE_LOW
    res["pension_source"] = PENSION_SOURCE_RULE_ESTIMATE
    return res


def generate_unverified_queue_and_summary(
    master_rows: list[dict[str, Any]],
    ledger: dict[str, dict[str, str]],
    unverified_queue_path: Path,
    summary_json_path: Path,
    fund_types_csv: Path | None = None,
) -> dict[str, Any]:
    """Generates pension_unverified_queue.csv (sorted by risk direction) and pension_verification_summary.json."""
    # Load KOFIA fund types mapping
    kofia_fund_types: dict[str, str] = {}
    kofia_undetermined_reasons: dict[str, str] = {}
    if fund_types_csv and fund_types_csv.exists():
        from scripts.rules.kofia_type_mapping import resolve_kofia_fund_type, STATUS_UNDETERMINED
        try:
            with fund_types_csv.open("r", encoding="utf-8-sig") as f:
                for r in csv.DictReader(f):
                    tk = str(r.get("ticker") or "").strip().upper()
                    ft = str(r.get("fund_type") or "").strip()
                    kofia_fund_types[tk] = ft
                    rule = resolve_kofia_fund_type(ft)
                    if rule.status == STATUS_UNDETERMINED:
                        kofia_undetermined_reasons[tk] = rule.statutory_basis_or_reason
        except Exception:
            pass

    derivative_types = {
        "주식파생형",
        "채권파생형",
        "혼합채권파생형",
        "혼합주식파생형",
        "특별자산파생",
        "부동산파생형",
        "재간접파생형",
    }

    unverified_items = []
    source_counts = {
        PENSION_SOURCE_KOFIA_VERIFIED: 0,
        PENSION_SOURCE_PROSPECTUS_VERIFIED: 0,
        PENSION_SOURCE_KRX_VERIFIED: 0,
        PENSION_SOURCE_BROKER_VERIFIED: 0,
        PENSION_SOURCE_MANUAL_VERIFIED: 0,
        PENSION_SOURCE_SAMPLE_VERIFIED: 0,
        PENSION_SOURCE_STATUTE_DIRECT: 0,
        PENSION_SOURCE_RULE_ESTIMATE: 0,
    }

    total_count = len(master_rows)
    verified_count = 0

    for r in master_rows:
        tk = str(r.get("ticker") or "").strip().upper()
        p_ver = str(r.get("pension_verified") or "").strip()
        p_src = str(r.get("pension_source") or "").strip()
        p_lim = str(r.get("pension_limit") or "").strip()
        aum_raw = r.get("aum") or "0"
        try:
            aum_val = float(aum_raw)
        except ValueError:
            aum_val = 0.0

        if p_src in source_counts:
            source_counts[p_src] += 1

        if p_ver == PENSION_VERIFIED_YES:
            verified_count += 1
        else:
            raw_kofia_type = kofia_fund_types.get(tk)
            display_kofia_type = raw_kofia_type if raw_kofia_type else "미매칭"

            # Determine risk direction tier per Gate 1
            # 1. 미검증 + 현재 100% (안전자산) (협회 유형 매칭 종목)
            # 2. 미검증 + 현재 70% (위험자산) 중 협회 유형이 파생형 계열
            # 3. 협회 미매칭
            # 4. 나머지 (일반)
            if raw_kofia_type is not None and p_lim == LIMIT_SAFE_ASSET:
                risk_dir = "안전자산_주의"
            elif raw_kofia_type in derivative_types and p_lim == LIMIT_RISK_ASSET:
                risk_dir = "파생_위험자산"
            elif raw_kofia_type is None:
                risk_dir = "공시_미반영"
            else:
                risk_dir = "일반"

            # Determine precise unverified reason
            name_str = str(r.get("name") or "")
            is_spot = "현물" in name_str
            if "하이일드" in name_str or "High Yield" in name_str:
                reason = "투자적격등급 외 채무증권 30% 초과 여부 약관 확인 필요 (퇴직연금감독규정 제11조 제1항 제5호 단서)"
            elif "TDF" in name_str:
                reason = "적격 TDF 5대 요건(글라이드패스/자산배분) 집합투자규약 개별 대조 필요 (퇴직연금감독규정시행세칙 제5조의2)"
            elif ("선물" in name_str or "Futures" in name_str) and not is_spot:
                reason = "장내선물 위험평가액 40% 초과 여부 개별 펀드 파생상품 익스포저(VaR/상계) 확인 필요 (금융투자업규정 제4-54조)"
            elif risk_dir == "안전자산_주의" and raw_kofia_type in derivative_types:
                reason = "위험평가액 미확인"
            elif risk_dir == "공시_미반영":
                reason = "협회 공시 미반영 (신규 상장 또는 명칭 미일치)"
            elif p_lim == LIMIT_INELIGIBLE:
                reason = "법정 투자 불가 종목 (레버리지/인버스/선물 파생평가액 초과)"
            elif tk in kofia_undetermined_reasons:
                reason = kofia_undetermined_reasons[tk]
            elif "커버드콜" in name_str:
                reason = "커버드콜 옵션 매도 파생평가액 40% 한도 산정 미확인"
            else:
                reason = "개별 약관 확인 필요"

            unverified_items.append({
                "ticker": tk,
                "name": str(r.get("name") or "").strip(),
                "aum": aum_val,
                "asset_class": str(r.get("asset_class") or "").strip(),
                "kofia_fund_type": display_kofia_type,
                "현재_한도": p_lim,
                "위험방향": risk_dir,
                "확정_불가_사유": reason,
            })

    # Sort unverified queue: Risk direction priority first, then AUM descending
    tier_order = {
        "안전자산_주의": 1,
        "파생_위험자산": 2,
        "공시_미반영": 3,
        "일반": 4,
    }
    unverified_items.sort(key=lambda x: (tier_order.get(x["위험방향"], 99), -x["aum"]))

    # Write queue CSV
    unverified_queue_path.parent.mkdir(parents=True, exist_ok=True)
    with unverified_queue_path.open("w", encoding="utf-8-sig", newline="") as f:
        fieldnames = [
            "순번",
            "ticker",
            "name",
            "aum",
            "asset_class",
            "kofia_fund_type",
            "현재_한도",
            "위험방향",
            "확정_불가_사유",
        ]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for idx, item in enumerate(unverified_items, start=1):
            writer.writerow({
                "순번": idx,
                "ticker": item["ticker"],
                "name": item["name"],
                "aum": f"{item['aum']:,.0f}",
                "asset_class": item["asset_class"],
                "kofia_fund_type": item["kofia_fund_type"],
                "현재_한도": item["현재_한도"],
                "위험방향": item["위험방향"],
                "확정_불가_사유": item["확정_불가_사유"],
            })

    # Count items by tier
    tier_counts = {k: sum(1 for x in unverified_items if x["위험방향"] == k) for k in tier_order}

    # Write summary JSON
    summary_data = {
        "as_of": datetime.date.today().isoformat(),
        "total": total_count,
        "verified": verified_count,
        "verified_pct": round(verified_count / max(total_count, 1) * 100, 1),
        "by_source": source_counts,
        "unverified": len(unverified_items),
        "safe_asset_candidates_remaining": tier_counts.get("안전자산_주의", 0),
        "unverified_by_tier": tier_counts,
    }
    summary_json_path.parent.mkdir(parents=True, exist_ok=True)
    with summary_json_path.open("w", encoding="utf-8") as f:
        json.dump(summary_data, f, indent=2, ensure_ascii=False)
        f.write("\n")

    return summary_data


def process_csv(master_path: Path, output_path: Path) -> dict[str, Any]:
    """Process master ETF CSV, reconcile against verification ledger, and emit queue/summary."""
    with master_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fields = list(reader.fieldnames or [])
        rows = list(reader)

    # Ensure required columns
    for col in (
        "pension_limit",
        "isa_eligible",
        "isa_education_required",
        "isa_tax_type",
        "isa_tax_benefit",
        "pension_source",
        "pension_verified",
        "pension_confidence",
        "underlying_is_security",
    ):
        if col not in fields:
            fields.append(col)

    ledger = load_verified_ledger_entries()
    divergences: list[dict[str, Any]] = []

    for r in rows:
        tk = str(r.get("ticker") or "").strip().upper()
        res = classify_pension_and_isa(r, verified_entries=ledger)
        for k in (
            "pension_eligible",
            "pension_limit",
            "isa_eligible",
            "isa_education_required",
            "isa_tax_type",
            "isa_tax_benefit",
            "pension_source",
            "pension_verified",
            "pension_confidence",
            "underlying_is_security",
        ):
            r[k] = res[k]

        # Check for divergence if in ledger
        if tk in ledger:
            ledger_lim = ledger[tk].get("verified_limit")
            if ledger_lim != res["pension_limit"]:
                divergences.append({
                    "ticker": tk,
                    "name": r.get("name"),
                    "ledger_limit": ledger_lim,
                    "engine_limit": res["pension_limit"],
                })

    # Atomic write to CSV
    temp_path = master_path.parent / f"{master_path.name}.tmp"
    with temp_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    temp_path.replace(output_path)

    # Generate unverified queue and summary
    queue_path = REPO_ROOT / "data" / "reports" / "pension_unverified_queue.csv"
    summary_path = REPO_ROOT / "data" / "reports" / "pension_verification_summary.json"
    fund_types_csv = REPO_ROOT / "data" / "regulatory" / "kofia_fund_types.csv"

    summary = generate_unverified_queue_and_summary(
        master_rows=rows,
        ledger=ledger,
        unverified_queue_path=queue_path,
        summary_json_path=summary_path,
        fund_types_csv=fund_types_csv,
    )

    summary["divergences"] = divergences
    summary["divergence_count"] = len(divergences)
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input",
        type=Path,
        default=REPO_ROOT / "data" / "etf_master_draft.csv",
        help="Input ETF master CSV",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=REPO_ROOT / "data" / "etf_master_draft.csv",
        help="Output ETF master CSV",
    )
    args = parser.parse_args()

    summary = process_csv(args.input, args.output)
    print("=" * 80)
    print("PENSION & ISA REGULATORY ENGINE EXECUTION SUMMARY")
    print("=" * 80)
    print(f"Total ETFs        : {summary['total']:,}")
    print(f"Verified (Y)      : {summary['verified']:,} ({summary['verified_pct']}%)")
    print(f"Unverified (N)    : {summary['unverified']:,}")
    print(f"By Source         : {summary['by_source']}")
    print(f"Divergences       : {summary['divergence_count']} items")
    if summary['divergences']:
        for d in summary['divergences']:
            print(f"  [DIVERGENCE] [{d['ticker']}] {d['name']}: ledger={d['ledger_limit']} vs engine={d['engine_limit']}")
    print("=" * 80)
    return 0


if __name__ == "__main__":
    sys.exit(main())
