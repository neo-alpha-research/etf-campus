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

import sys
from pathlib import Path
from typing import Any
from pydantic import BaseModel, Field, model_validator

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from lib.indices import (
    CANONICAL_MACRO_CODES,
    RAW_SOURCE_TO_CANONICAL as CODE_ALIAS_MAP,
    normalize_index_code,
)


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


from datetime import date, datetime

# 지표별 합리적 정상 수치 범위 (Sanity Range)
SANITY_RANGE: dict[str, tuple[float, float]] = {
    "KOSPI": (500.0, 10000.0),
    "KOSDAQ": (200.0, 3000.0),
    "VKOSPI": (8.0, 80.0),
    "SPX": (2000.0, 15000.0),
    "NDX": (8000.0, 60000.0),
    "VIX": (8.0, 90.0),
    "USDKRW": (900.0, 2000.0),
    "KR10Y": (0.1, 10.0),
    "DGS10": (0.1, 10.0),
    "CLF": (10.0, 200.0),
    "GC": (500.0, 10000.0),
    "SI": (5.0, 200.0),
}
MAX_DAILY_CHANGE_PCT = 15.0


class BriefingContract(BaseModel):
    as_of_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    prev_as_of_date: str = Field(default="", pattern=r"^(\d{4}-\d{2}-\d{2})?$")
    general_etf_count: int = Field(ge=950)  # 1,023개 기준 여유 7% (급락 탐지)
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

        # 3. 12대 거시 지표 Sanity Range 및 등락폭(±15%) 검사
        for m in self.market_indices:
            if m.code in SANITY_RANGE:
                min_val, max_val = SANITY_RANGE[m.code]
                if not (min_val <= m.value <= max_val):
                    raise ValueError(
                        f"지표 [{m.code}] 수치({m.value})가 정상 범위({min_val} ~ {max_val})를 벗어났습니다."
                    )
            if abs(m.change_pct) > MAX_DAILY_CHANGE_PCT:
                raise ValueError(
                    f"지표 [{m.code}] 일간 등락률({m.change_pct:+.2f}%)이 허용 한계(±{MAX_DAILY_CHANGE_PCT}%)를 초과했습니다."
                )

        # 4. 전일 대비 기준일자 간격 검사 (1~5영업일 이내)
        if self.prev_as_of_date:
            d_curr = datetime.fromisoformat(self.as_of_date).date()
            d_prev = datetime.fromisoformat(self.prev_as_of_date).date()
            gap = (d_curr - d_prev).days
            if not (1 <= gap <= 5):
                raise ValueError(
                    f"전일 스냅샷 기준일 간격 이상: {self.prev_as_of_date} -> {self.as_of_date} ({gap}일 차이, 1~5일 허용)"
                )

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

    prev_as_of = str(raw.get("prevAsOfDate") or raw.get("prev_as_of_date") or "").strip()
    if len(prev_as_of) == 8 and prev_as_of.isdigit():
        prev_as_of = f"{prev_as_of[:4]}-{prev_as_of[4:6]}-{prev_as_of[6:]}"

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
        "prev_as_of_date": prev_as_of,
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
