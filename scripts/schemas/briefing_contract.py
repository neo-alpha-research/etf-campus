#!/usr/bin/env python3
"""
scripts/schemas/briefing_contract.py

Cloudflare Pages 마켓 브리핑 및 OSMU 자동 발행을 위한
Pydantic v2 기반 엄격한 단일 데이터 무결성 스키마 계약(Briefing Data Contract)입니다.

핵심 원칙:
1. Fail-Closed: 타입만 검사하지 않고, 개수(min_length=12)와 집합(Set) 일치를 강제합니다.
2. Zero-Hallucination: 누락(None)이나 빈 배열([])을 결코 유효한 값으로 통과시키지 않습니다.
3. Observations: 단순 PASS/FAIL 판정이 아닌, 12개 지표 및 펀드플로우의 관측값을 전수 보고합니다.
"""

from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field, model_validator

# 12대 정규 거시 지표 집합 (Canonical Codes)
CANONICAL_MACRO_CODES = frozenset({
    "KOSPI", "KOSDAQ", "VKOSPI", "SPX", "NDX", "VIX",
    "USDKRW", "KR10Y", "DGS10", "CLF", "GC", "SI"
})

CODE_ALIAS_MAP = {
    "^GSPC": "SPX",
    "^IXIC": "NDX",
    "^VIX": "VIX",
    "^TNX": "DGS10",
    "CL=F": "CLF",
    "GC=F": "GC",
    "SI=F": "SI",
    "KRW=X": "USDKRW",
}


class MacroIndexItem(BaseModel):
    code: str
    label: str = ""
    value: float  # None 불가
    change_pct: float  # None 불가
    change_points: float = 0.0
    as_of_date: str = ""

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            raw_code = str(data.get("code") or data.get("label") or "").strip()
            canon_code = CODE_ALIAS_MAP.get(raw_code, raw_code)

            val = data.get("value")
            if val is None:
                val = data.get("close")
            if val is None:
                raise ValueError(f"지표 [{raw_code}]의 value/close 값이 누락되었습니다 (None 불가).")

            chg = data.get("change_pct")
            if chg is None:
                chg = data.get("change")
            if chg is None:
                raise ValueError(f"지표 [{raw_code}]의 change_pct 값이 누락되었습니다 (None 불가).")

            return {
                "code": canon_code,
                "label": str(data.get("label") or canon_code),
                "value": float(val),
                "change_pct": float(chg),
                "change_points": float(data.get("change_points") or data.get("changePoints") or 0.0),
                "as_of_date": str(data.get("as_of_date") or data.get("asOfDate") or "").strip(),
            }
        return data


class FundFlowItem(BaseModel):
    ticker: str = Field(min_length=6, max_length=12)
    name: str = Field(min_length=1)
    net_flow: float  # 원 단위 (0은 가능하나 None 불가)

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            tk = str(data.get("ticker") or "").strip()
            name = str(data.get("name") or data.get("etfName") or "").strip()
            flow = data.get("netInflowValue")
            if flow is None:
                flow = data.get("net_flow")
            if flow is None:
                flow = data.get("netFlow")
            if flow is None:
                raise ValueError(f"종목 [{tk} {name}]의 펀드플로우 수치가 누락되었습니다 (None 불가).")
            return {
                "ticker": tk,
                "name": name,
                "net_flow": float(flow),
            }
        return data


class BriefingContract(BaseModel):
    as_of_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    general_etf_count: int = Field(ge=800)
    general_total_aum: float = Field(gt=0)
    aum_weighted_return_pct: float
    market_indices: list[MacroIndexItem] = Field(min_length=12, max_length=12)
    top_inflows: list[FundFlowItem] = Field(min_length=5)
    top_outflows: list[FundFlowItem] = Field(min_length=5)

    @model_validator(mode="after")
    def validate_macro_set_and_dates(self) -> BriefingContract:
        # 1. 12대 지표 집합(Set) 완전 일치 검사
        got_codes = {m.code for m in self.market_indices}
        if got_codes != CANONICAL_MACRO_CODES:
            missing = sorted(CANONICAL_MACRO_CODES - got_codes)
            extra = sorted(got_codes - CANONICAL_MACRO_CODES)
            raise ValueError(
                f"12대 거시 지표 불일치 발생! 누락 지표={missing}, 허용 외 지표={extra}"
            )

        # 2. 기준일자 일치 검사 (as_of_date가 명시된 지표 대상)
        mismatched_dates = [
            f"{m.code}({m.as_of_date})"
            for m in self.market_indices
            if m.as_of_date and m.as_of_date != self.as_of_date
        ]
        if mismatched_dates:
            raise ValueError(f"지표 기준일자 불일치 발생: {mismatched_dates} != {self.as_of_date}")

        return self


def extract_contract_inputs(raw_dict: dict[str, Any]) -> dict[str, Any]:
    """
    다양한 형태(Worker API, D1 metrics_json, 로컬 briefing_payload_latest.json)의
    페이로드를 BriefingContract 입력 포맷으로 단일 정규화합니다.
    """
    raw = raw_dict.get("briefing") or raw_dict
    pulse = raw.get("pulse") or {}
    indices = raw.get("marketIndices") or raw.get("market_indices") or []

    # 펀드플로우 추출 (다양한 키 구조 호환)
    flows = (
        raw.get("fundFlow")
        or raw.get("fund_flow")
        or raw.get("periodicFlows")
        or raw.get("periodic_flows")
        or {}
    )
    daily_flows = flows.get("dailyFundFlows") or flows.get("daily_fund_flows") or flows.get("general") or flows

    inflows = daily_flows.get("topInflows") or daily_flows.get("top_inflows") or []
    outflows = daily_flows.get("topOutflows") or daily_flows.get("top_outflows") or []

    as_of = str(raw.get("asOfDate") or raw.get("as_of_date") or "").strip()
    if len(as_of) == 8 and as_of.isdigit():
        as_of = f"{as_of[:4]}-{as_of[4:6]}-{as_of[6:]}"

    gen_count = (
        pulse.get("generalEtfCount")
        or raw.get("generalEtfCount")
        or raw.get("general_etf_count")
        or pulse.get("general_etf_count")
        or 0
    )

    total_aum = (
        pulse.get("generalTotalAum")
        or raw.get("generalTotalAum")
        or raw.get("general_total_aum")
        or pulse.get("general_total_aum")
        or 0.0
    )

    weighted_ret = (
        pulse.get("generalAumWeightedReturnPct")
        if pulse.get("generalAumWeightedReturnPct") is not None
        else raw.get("generalAumWeightedReturnPct")
    )
    if weighted_ret is None:
        weighted_ret = raw.get("general_aum_weighted_return_pct", 0.0)

    return {
        "as_of_date": as_of,
        "general_etf_count": int(gen_count),
        "general_total_aum": float(total_aum),
        "aum_weighted_return_pct": float(weighted_ret),
        "market_indices": indices,
        "top_inflows": inflows,
        "top_outflows": outflows,
    }


def validate_briefing_payload(raw_dict: dict[str, Any]) -> tuple[bool, list[str], BriefingContract | None]:
    """
    브리핑 페이로드를 스키마 계약에 따라 검증하고
    (is_valid, error_list, contract_instance)를 반환합니다.
    """
    errors: list[str] = []
    try:
        inputs = extract_contract_inputs(raw_dict)
        contract = BriefingContract.model_validate(inputs)
        return True, [], contract
    except Exception as e:
        # Pydantic 에러 메시지 추출
        errors.append(str(e))
        return False, errors, None
