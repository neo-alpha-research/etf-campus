#!/usr/bin/env python3
"""Statutory Pension & ISA Classification Engine.

Implements statutory regulatory rules under:
1. 근로자퇴직급여 보장법 (근퇴법) 제21조(적립금 운용방법 및 정보제공), 제25조(개인형퇴직연금제도의 운영 등)
2. 퇴직연금감독규정 제9조(증권 및 기타 적립금 운용방법의 종류 등), 제12조(확정기여형퇴직연금 및 개인형퇴직연금의 위험자산 및 투자한도) 제4항, [별표 1]
3. 조세특례제한법 제91조의18(개인종합자산관리계좌에 대한 과세특례)
"""

from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path
from typing import Any, Mapping

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

PENSION_CONFIDENCE_HIGH = "높음"
PENSION_CONFIDENCE_MODERATE = "보통"
PENSION_CONFIDENCE_LOW = "낮음"

PENSION_VERIFIED_YES = "Y"
PENSION_VERIFIED_NO = "N"

SAMPLE_VERIFIED_TICKERS: set[str] = set()


def load_verified_broker_tickers() -> set[str]:
    """Load verified tickers from broker pension universe CSV, falling back to default sample set."""
    verified = set(SAMPLE_VERIFIED_TICKERS)
    broker_csv = Path(__file__).resolve().parent.parent.parent / "data" / "regulatory" / "broker_pension_universe.csv"
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
    """Determine whether the ETF's underlying asset is securities (stocks/bonds) or non-securities (commodities/FX).

    Under 퇴직연금감독규정 제9조 제1항 (2016.9.21 금융위 고시 제2016-31호), synthetic ETFs
    eligible for the derivative limit exception must have underlying assets that are securities (증권).
    Commodity futures (carbon credits, crude oil, gold futures) and currency futures are excluded.

    Returns:
        "Y" if underlying is securities (equities, bonds, REITs, money market rates),
        "N" if underlying is non-securities (commodities, FX futures, carbon credits).
    """
    ticker = str(row.get("ticker") or "").strip()
    name = str(row.get("name") or "").strip()
    base_index = str(row.get("base_index") or "").strip()
    asset = str(row.get("asset_class") or "").strip()

    # 1. Non-securities: Carbon credits (ICE Carbon Futures)
    if "탄소배출권" in name or "Carbon" in base_index:
        return "N"

    # 2. Commodity / FX futures
    # Special audit case: 219390 (RISE 미국S&P원유생산기업(합성 H))
    # Its asset_class is erroneously labeled '원자재', but its underlying is S&P Oil & Gas E&P equity shares.
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
    row: Mapping[str, Any], verified_tickers: set[str] | None = None
) -> dict[str, str]:
    """Classify a single ETF according to statutory Pension (DC/IRP) and ISA regulations.

    Returns:
        dict with keys:
            - pension_eligible: "가능" | "불가"
            - pension_limit: "100% (안전자산)" | "70% (위험자산)" | "불가"
            - isa_eligible: "가능" | "불가"
            - isa_education_required: "Y" | "N"
            - pension_source: "규칙기반추정" | "표본대조" | "증권사목록대조"
            - pension_confidence: "높음" | "보통" | "낮음"
            - pension_reason: descriptive legal/regulatory basis
    """
    ticker = str(row.get("ticker") or "").strip()
    name = str(row.get("name") or "").strip()
    base_index = str(row.get("base_index") or "").strip()
    risk = str(row.get("risk_type") or "normal").strip().lower()
    asset = str(row.get("asset_class") or "").strip()
    underlying_sec = is_underlying_security(row)

    # -----------------------------------------------------------------------
    # 1. ISA 편입 적격 및 레버리지 교육 요건 판정 (조세특례제한법 및 거래소 규정)
    # -----------------------------------------------------------------------
    # 조세특례제한법상 국내 상장된 모든 ETF는 중개형 ISA 계좌에서 편입 가능.
    # 금융투자협회 및 한국거래소 ETP 규정:
    # 차입(레버리지 2X) 및 인버스 2X(-2X) ETP는 금융투자협회 사전교육(1시간) 및 기본예탁금 필요.
    # 단, -1배 인버스(31종목) 및 일반(1X) 상품은 사전교육/기본예탁금 대상이 아님.
    isa_eligible = ISA_ELIGIBLE

    is_leverage = (risk == "leverage")
    is_inverse_2x = (risk == "inverse" and bool(re.search(r"2X|2x", name)))
    isa_education_required = (
        ISA_EDUCATION_REQUIRED if (is_leverage or is_inverse_2x) else ISA_EDUCATION_NOT_REQUIRED
    )

    # -----------------------------------------------------------------------
    # 2. 퇴직연금 (DC/IRP) 편입 적격 판별 (퇴직연금감독규정 제9조 및 제12조, [별표 1])
    # -----------------------------------------------------------------------
    # 2-1) 영역 A: 레버리지 / 인버스 - 파생상품 순위험평가액 40% 초과로 절대 불가
    if risk in ("leverage", "inverse"):
        return {
            "pension_eligible": PENSION_INELIGIBLE,
            "pension_limit": LIMIT_INELIGIBLE,
            "isa_eligible": isa_eligible,
            "isa_education_required": isa_education_required,
            "pension_source": PENSION_SOURCE_RULE_ESTIMATE,
            "pension_verified": PENSION_VERIFIED_NO,
            "pension_confidence": PENSION_CONFIDENCE_LOW,
            "pension_reason": "레버리지/인버스 파생평가액 초과 (퇴직연금 편입 요건 미충족)",
            "underlying_is_security": underlying_sec,
        }

    # 2-2) 영역 C: 파생상품(선물) 기반 1X 고위험 자산 배제
    # 원자재 선물, 통화 선물, VIX 선물, 국채선물 등 파생평가액 40% 초과 종목
    # 단, '현물'(KRX금현물 등)은 실물 기반이므로 적격
    is_spot = "현물" in name
    has_futures_keyword = bool(
        re.search(r"선물|Futures", f"{name} {base_index}", re.IGNORECASE)
    )

    if has_futures_keyword and not is_spot:
        return {
            "pension_eligible": PENSION_INELIGIBLE,
            "pension_limit": LIMIT_INELIGIBLE,
            "isa_eligible": isa_eligible,
            "isa_education_required": isa_education_required,
            "pension_source": PENSION_SOURCE_RULE_ESTIMATE,
            "pension_verified": PENSION_VERIFIED_NO,
            "pension_confidence": PENSION_CONFIDENCE_LOW,
            "pension_reason": "선물 기반 파생 위험평가액 40% 초과 (퇴직연금 편입 요건 미충족)",
            "underlying_is_security": underlying_sec,
        }

    # -----------------------------------------------------------------------
    # 3. 퇴직연금 계좌 내 편입 한도 판정 (100% 안전자산 vs 70% 위험자산)
    # -----------------------------------------------------------------------
    # 퇴직연금감독규정 제12조 제4항: 계좌 잔고의 최대 70%까지만 위험자산 투자 가능.
    # (제11조는 확정급여형 DB 전용 규정이므로, DC/IRP 계좌는 제12조 제4항을 적용)
    # 안전자산(100% 투자 가능, 30% 의무바스켓 충족 종목) 기준:
    #   (1) 순수 채권형 (asset == '채권')
    #   (2) 금리·파킹형 (asset == '금리·파킹')
    #   (3) 적격 채권혼합형 (주식 비중 50% 이하)
    #   (4) 적격 TDF (Glide-path 기반 금융위 등록 적격 TDF)
    #   (5) TRF3070 / TRF5050 / TIF 등 주식비중 50% 이하 멀티에셋
    pension_eligible = PENSION_ELIGIBLE
    is_safe = False
    reason = "위험자산 (계좌 내 70% 한도)"

    if asset == "금리·파킹":
        is_safe = True
        reason = "금리·파킹형 안전자산 (100% 투자 가능)"
    elif asset == "채권":
        is_safe = True
        reason = "채권형 안전자산 (100% 투자 가능)"
    elif "TDF" in name:
        # 모든 적격 TDF ETF는 금융위 등록 적격 TDF로 안전자산 100% 인정
        is_safe = True
        reason = "적격 TDF 안전자산 (100% 투자 가능)"
    elif "TRF3070" in name or "TRF5050" in name or "TIF" in name:
        is_safe = True
        reason = "주식비중 50% 이하 자산배분 안전자산 (100% 투자 가능)"
    elif any(kw in name for kw in ["채권혼합", "혼합50", "국채혼합50"]):
        is_safe = True
        reason = "적격 채권혼합형(주식 50% 이하) 안전자산 (100% 투자 가능)"

    pension_limit = LIMIT_SAFE_ASSET if is_safe else LIMIT_RISK_ASSET

    # -----------------------------------------------------------------------
    # 4. 검증 출처(pension_source), 외부대조(pension_verified), 신뢰도(pension_confidence) 판정
    # -----------------------------------------------------------------------
    # 2축 분리 구조:
    #   - 축 1: pension_source: 판정 근거 ("증권사목록대조" | "법령조건직접판정" | "규칙기반추정")
    #   - 축 2: pension_verified: 외부 대조 실적 ("Y" | "N")
    #
    # 신뢰도(pension_confidence) 엄격 종속 규칙 (DoD Gate A-2):
    #   - 증권사목록대조 / 표본대조 -> 높음 (PENSION_CONFIDENCE_HIGH)
    #   - 법령조건직접판정           -> 보통 (PENSION_CONFIDENCE_MODERATE)
    #   - 규칙기반추정               -> 낮음 (PENSION_CONFIDENCE_LOW)
    is_synthetic = bool(SYNTHETIC_NAME_PATTERN.search(name))
    is_cc = "커버드콜" in name
    v_set = verified_tickers if verified_tickers is not None else load_verified_broker_tickers()
    is_verified = (PENSION_VERIFIED_YES if ticker in v_set else PENSION_VERIFIED_NO)

    if is_verified == PENSION_VERIFIED_YES:
        pension_source = PENSION_SOURCE_BROKER_VERIFIED
        pension_verified = PENSION_VERIFIED_YES
        pension_confidence = PENSION_CONFIDENCE_HIGH
        pension_reason = f"증권사 적격 대조 완료 - {reason}"
    elif is_synthetic and underlying_sec == "Y" and risk == "normal" and not is_cc:
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
        "isa_education_required": isa_education_required,
        "pension_source": pension_source,
        "pension_verified": pension_verified,
        "pension_confidence": pension_confidence,
        "pension_reason": pension_reason,
        "underlying_is_security": underlying_sec,
    }


def process_csv(master_path: Path, output_path: Path) -> dict[str, Any]:
    """Process an ETF master CSV and enrich with regulatory pension & ISA tags."""
    with master_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fields = list(reader.fieldnames or [])
        rows = list(reader)

    # Ensure new fields exist in header
    for col in (
        "pension_limit",
        "isa_eligible",
        "isa_education_required",
        "pension_source",
        "pension_verified",
        "pension_confidence",
        "underlying_is_security",
    ):
        if col not in fields:
            fields.append(col)

    stats = {
        "total": len(rows),
        "pension_eligible": 0,
        "pension_ineligible": 0,
        "safe_asset_100": 0,
        "risk_asset_70": 0,
        "isa_eligible": 0,
        "isa_ineligible": 0,
        "isa_education_required": 0,
        "isa_education_not_required": 0,
        "source_statute": 0,
        "source_broker": 0,
        "source_rule": 0,
        "verified_y": 0,
        "verified_n": 0,
        "conf_high": 0,
        "conf_moderate": 0,
        "conf_low": 0,
        "underlying_sec_y": 0,
        "underlying_sec_n": 0,
    }

    verified_tickers = load_verified_broker_tickers()
    for row in rows:
        reg = classify_pension_and_isa(row, verified_tickers=verified_tickers)
        # Update row
        row["pension_eligible"] = reg["pension_eligible"]
        row["pension_limit"] = reg["pension_limit"]
        row["isa_eligible"] = reg["isa_eligible"]
        row["isa_education_required"] = reg["isa_education_required"]
        row["pension_source"] = reg["pension_source"]
        row["pension_verified"] = reg["pension_verified"]
        row["pension_confidence"] = reg["pension_confidence"]
        row["underlying_is_security"] = reg["underlying_is_security"]

        if reg["pension_eligible"] == PENSION_ELIGIBLE:
            stats["pension_eligible"] += 1
        else:
            stats["pension_ineligible"] += 1

        if reg["pension_limit"] == LIMIT_SAFE_ASSET:
            stats["safe_asset_100"] += 1
        elif reg["pension_limit"] == LIMIT_RISK_ASSET:
            stats["risk_asset_70"] += 1

        if reg["isa_eligible"] == ISA_ELIGIBLE:
            stats["isa_eligible"] += 1
        else:
            stats["isa_ineligible"] += 1

        if reg["isa_education_required"] == ISA_EDUCATION_REQUIRED:
            stats["isa_education_required"] += 1
        else:
            stats["isa_education_not_required"] += 1

        if reg["pension_source"] == PENSION_SOURCE_STATUTE_DIRECT:
            stats["source_statute"] += 1
        elif reg["pension_source"] == PENSION_SOURCE_BROKER_VERIFIED:
            stats["source_broker"] += 1
        else:
            stats["source_rule"] += 1

        if reg["pension_verified"] == PENSION_VERIFIED_YES:
            stats["verified_y"] += 1
        else:
            stats["verified_n"] += 1

        if reg["pension_confidence"] == PENSION_CONFIDENCE_HIGH:
            stats["conf_high"] += 1
        elif reg["pension_confidence"] == PENSION_CONFIDENCE_MODERATE:
            stats["conf_moderate"] += 1
        else:
            stats["conf_low"] += 1

        if reg["underlying_is_security"] == "Y":
            stats["underlying_sec_y"] += 1
        else:
            stats["underlying_sec_n"] += 1

    with output_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

    return stats


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--master",
        type=Path,
        default=Path("data/etf_master_draft.csv"),
        help="Path to input master CSV",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/etf_master_draft.csv"),
        help="Path to output enriched CSV",
    )
    args = parser.parse_args()

    stats = process_csv(args.master, args.output)
    print(f"Enriched {stats['total']} ETFs at {args.output}")
    print(f"  - 퇴직연금 적격: {stats['pension_eligible']:,} | 불가: {stats['pension_ineligible']:,}")
    print(f"    * 100% 안전자산: {stats['safe_asset_100']:,}")
    print(f"    * 70% 위험자산: {stats['risk_asset_70']:,}")
    print(f"  - ISA 가능: {stats['isa_eligible']:,} | 불가: {stats['isa_ineligible']:,}")
    print(f"    * ISA 레버리지 교육 필요: {stats['isa_education_required']:,}")
    print(f"    * ISA 레버리지 교육 불필요: {stats['isa_education_not_required']:,}")
    print(f"  - 기초자산 증권 여부: 증권(Y) {stats['underlying_sec_y']:,} | 비증권(N) {stats['underlying_sec_n']:,}")
    print(f"  - 퇴직연금 판정 근거: 법령조건직접판정(영역B) {stats['source_statute']:,} | 규칙기반추정 {stats['source_rule']:,}")
    print(f"  - 퇴직연금 외부대조(검증): 대조완료(Y) {stats['verified_y']:,} | 미대조(N) {stats['verified_n']:,}")
    print(f"  - 퇴직연금 신뢰도: 높음 {stats['conf_high']:,} | 보통(확인권장) {stats['conf_moderate']:,} | 낮음 {stats['conf_low']:,}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
