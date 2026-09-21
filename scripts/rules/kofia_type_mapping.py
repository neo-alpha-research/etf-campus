#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""KOFIA Fund Type to Statutory Pension Limit Mapping.

Defines the authoritative mapping between Korea Financial Investment Association (KOFIA)
fund types (협회 펀드유형) and Statutory Retirement Pension (DC/IRP) investment limits
pursuant to:
- 근로자퇴직급여 보장법 (Act on the Guarantee of Employees' Retirement Benefits)
- 퇴직연금감독규정 제9조 및 제11조 (적립금 운용방법 등) 및 [별표 1]
- 퇴직연금감독규정시행세칙 제5조의2 (적격 집합투자증권 인정기준)
- 금융투자회사의 영업 및 업무에 관한 규정 시행세칙 제27조 [별지 제15호] 집합투자기구분류표
"""

from __future__ import annotations

from typing import NamedTuple, Optional

LIMIT_SAFE_ASSET = "100% (안전자산)"
LIMIT_RISK_ASSET = "70% (위험자산)"
LIMIT_INELIGIBLE = "불가"

STATUS_DETERMINED = "확정 가능"
STATUS_UNDETERMINED = "확정 불가"


class KofiaMappingRule(NamedTuple):
    pension_limit: Optional[str]
    status: str
    statutory_basis_or_reason: str
    statute_id: Optional[str] = None


# ==============================================================================
# KOFIA Fund Type Statutory Mapping Table (금융투자협회 펀드유형 매핑 테이블)
# ==============================================================================
KOFIA_FUND_TYPE_MAP: dict[str, KofiaMappingRule] = {
    # --------------------------------------------------------------------------
    # 1. 확정 가능 (Unambiguous Statutory Determination)
    # --------------------------------------------------------------------------
    # 주식형: 약관상 주식 편입비율 60% 이상인 집합투자기구.
    # 근거: 근로자퇴직급여 보장법 시행규칙 제10조 제1항 제2호 -> 위험자산 70% 한도 확정.
    "주식형": KofiaMappingRule(
        pension_limit=LIMIT_RISK_ASSET,
        status=STATUS_DETERMINED,
        statutory_basis_or_reason=(
            "근로자퇴직급여 보장법 시행규칙 제10조 제1항 제2호: 주식형 집합투자증권 위험자산 70% 한도"
        ),
        statute_id="MOEL_WRBA_RULE_ART10_1_2",
    ),
    # 채권형: 약관상 채권 편입비율 60% 이상이며 주식을 편입하지 아니하는 집합투자기구.
    # 근거: 퇴직연금감독규정 제11조 제1항 제4호 -> 안전자산 100% 한도 확정.
    "채권형": KofiaMappingRule(
        pension_limit=LIMIT_SAFE_ASSET,
        status=STATUS_DETERMINED,
        statutory_basis_or_reason=(
            "퇴직연금감독규정 제11조 제1항 제4호: 원리금보장 및 채권형 안전자산 (100% 편입 가능)"
        ),
        statute_id="PSR_ART11_1_4",
    ),
    # 혼합채권형: 약관상 주식 편입한도 50% 미만인 혼합형.
    # 근거: 금융투자협회 집합투자기구분류표 및 퇴직연금감독규정 제11조 제1항 제5호 -> 안전자산 100% 한도 확정.
    "혼합채권형": KofiaMappingRule(
        pension_limit=LIMIT_SAFE_ASSET,
        status=STATUS_DETERMINED,
        statutory_basis_or_reason=(
            "퇴직연금감독규정 제11조 제1항 제5호: 약관상 주식 투자한도 50% 미만 혼합채권형 안전자산 100% 한도"
        ),
        statute_id="PSR_ART11_1_5",
    ),
    # 혼합주식형: 약관상 주식 편입비율 50% 이상인 혼합형.
    # 근거: 근로자퇴직급여 보장법 시행규칙 제10조 제1항 제2호 -> 위험자산 70% 한도 확정.
    "혼합주식형": KofiaMappingRule(
        pension_limit=LIMIT_RISK_ASSET,
        status=STATUS_DETERMINED,
        statutory_basis_or_reason=(
            "근로자퇴직급여 보장법 시행규칙 제10조 제1항 제2호: 주식 투자한도 50% 이상 혼합형 위험자산 (70% 한도)"
        ),
        statute_id="MOEL_WRBA_RULE_ART10_1_2",
    ),
    # 특별자산: 실물·현물 기초자산, 파생형 아님 (40% 룰 비적용).
    # 근거: 근로자퇴직급여 보장법 시행규칙 제10조 제1항 제2호 -> 위험자산 70% 한도 확정.
    "특별자산": KofiaMappingRule(
        pension_limit=LIMIT_RISK_ASSET,
        status=STATUS_DETERMINED,
        statutory_basis_or_reason=(
            "근로자퇴직급여 보장법 시행규칙 제10조 제1항 제2호: 실물 특별자산 집합투자증권 위험자산 70% 한도"
        ),
        statute_id="MOEL_WRBA_RULE_ART10_1_2",
    ),

    # --------------------------------------------------------------------------
    # 2. 확정 불가 (Requires Prospectus / Derivative Net Risk Exposure Verification)
    # --------------------------------------------------------------------------
    # 혼합주식파생형: 약관상 주식 50% 이상 -> "안전자산 아님 확정". 파생평가액 40% 한도 확인 필요.
    "혼합주식파생형": KofiaMappingRule(
        pension_limit=None,
        status=STATUS_UNDETERMINED,
        statutory_basis_or_reason=(
            "안전자산 아님 확정 (약관상 주식 50% 이상, 퇴직연금감독규정 제11조 제1항 제5호 비해당). "
            "파생평가액 40% 한도 및 추적배수 확인 필요"
        ),
        statute_id=None,
    ),
    # 혼합채권파생형: 주식 50% 미만이나 파생평가액 40% 한도 확인 필요.
    "혼합채권파생형": KofiaMappingRule(
        pension_limit=None,
        status=STATUS_UNDETERMINED,
        statutory_basis_or_reason=(
            "주식 50% 미만이나 파생평가액 40% 한도 확인 필요 "
            "(퇴직연금감독규정 제9조 제1항 제2호 마목 및 제11조 제1항 제5호)"
        ),
        statute_id="PSR_ART11_1_5",
    ),
    # 주식파생형: 약관상 주식 60% 이상 -> "안전자산 아님 확정". 장내파생 순위험평가액 40% 한도 확인 필요.
    "주식파생형": KofiaMappingRule(
        pension_limit=None,
        status=STATUS_UNDETERMINED,
        statutory_basis_or_reason=(
            "안전자산 아님 확정 (약관상 주식 60% 이상, 퇴직연금감독규정 제11조 제1항 제5호 비해당). "
            "파생형 위험평가액 40% 한도 및 추적배수 확인 필요"
        ),
        statute_id=None,
    ),
    # 채권파생형: 장내파생상품 순위험평가액 40% 한도 및 인버스/레버리지 배수 확인 필요.
    "채권파생형": KofiaMappingRule(
        pension_limit=None,
        status=STATUS_UNDETERMINED,
        statutory_basis_or_reason="채권 파생평가액 40% 한도 및 인버스/레버리지 배수 확인 필요",
        statute_id=None,
    ),
    # 특별자산파생: 원자재/실물 파생 위험평가액 40% 한도 및 기초자산 적격성 확인 필요.
    "특별자산파생": KofiaMappingRule(
        pension_limit=None,
        status=STATUS_UNDETERMINED,
        statutory_basis_or_reason="원자재/실물 파생 위험평가액 및 기초자산 적격성(금현물 등) 약관 확인 필요",
        statute_id=None,
    ),
    # 부동산: 공모 리츠 편입 비중 및 부동산 실물 요건 확인 필요 (제11조 제2항 제4호 원칙 불가).
    "부동산": KofiaMappingRule(
        pension_limit=None,
        status=STATUS_UNDETERMINED,
        statutory_basis_or_reason="부동산집합투자기구 원칙 편입 불가 (퇴직연금감독규정 제11조 제2항 제4호, 시행령 제240조 단서 확인 필요)",
        statute_id="PSR_ART11_2",
    ),
    # 부동산파생형: 부동산 파생평가액 및 기초자산 요건 확인 필요.
    "부동산파생형": KofiaMappingRule(
        pension_limit=None,
        status=STATUS_UNDETERMINED,
        statutory_basis_or_reason="부동산 파생 위험평가액 및 집합투자기구 편입 요건 확인 필요",
        statute_id="PSR_ART11_2",
    ),
    # 재간접형: 편입 대상 기초 펀드의 적격성 및 사모펀드 편입 금지 요건 확인 필요.
    "재간접형": KofiaMappingRule(
        pension_limit=None,
        status=STATUS_UNDETERMINED,
        statutory_basis_or_reason="기초펀드 적격성 및 사모펀드 편입 여부 약관 확인 필요 (퇴직연금감독규정 제11조 제2항 제3호)",
        statute_id="PSR_ART11_2",
    ),
    # 재간접파생형: 재간접 펀드 요건 및 파생평가액 확인 필요.
    "재간접파생형": KofiaMappingRule(
        pension_limit=None,
        status=STATUS_UNDETERMINED,
        statutory_basis_or_reason="기초펀드 적격성 및 파생 위험평가액 약관 확인 필요",
        statute_id="PSR_ART11_2",
    ),
}


def resolve_kofia_fund_type(raw_type: str) -> KofiaMappingRule:
    """Resolve a raw KOFIA fund type into its statutory pension rule.

    Guarantees strict compliance: any unknown, blank, or boundary type
    is safely classified as STATUS_UNDETERMINED and held back for Stage 3 queue.
    """
    clean_type = (raw_type or "").strip()
    if clean_type in KOFIA_FUND_TYPE_MAP:
        return KOFIA_FUND_TYPE_MAP[clean_type]

    # Normalize if slightly variant (e.g. '주식' without '형')
    if clean_type == "주식":
        return KOFIA_FUND_TYPE_MAP["주식형"]
    if clean_type == "채권":
        return KOFIA_FUND_TYPE_MAP["채권형"]
    if clean_type == "혼합주식":
        return KOFIA_FUND_TYPE_MAP["혼합주식형"]
    if clean_type == "혼합채권":
        return KOFIA_FUND_TYPE_MAP["혼합채권형"]

    # Graceful fallback: Undetermined
    return KofiaMappingRule(
        pension_limit=None,
        status=STATUS_UNDETERMINED,
        statutory_basis_or_reason=f"미식별 협회 펀드유형({clean_type}) 약관 개별 확인 필요",
        statute_id=None,
    )
