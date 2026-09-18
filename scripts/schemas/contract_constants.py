#!/usr/bin/env python3
"""
scripts/schemas/contract_constants.py

Briefing contract and pipeline constants (zero-dependency SSOT).
"""

from __future__ import annotations

# FM-014 SSOT: Carry-Forward 허용 필드 목록 (Trailing Window 누적 집계 지표에 한정)
# 당일 종가/지수/수익률/거래대금 등 당일성 데이터는 이월 불가
CARRY_FORWARD_ALLOWLIST: frozenset[str] = frozenset({
    "weeklyFundFlows",
    "monthlyFundFlows",
    "marketScaleTimeSeries",
})

# FM-014 SSOT: 거시 지표별 일간 최대 허용 등락폭 (상대 변동성 특성 반영)
# 주가지수는 ±15% 상한이나, 변동성 지수(VIX/VKOSPI) 및 원자재는 시장 급변 시 확장 허용
MACRO_MAX_DAILY_CHANGE_PCT: dict[str, float] = {
    "DEFAULT": 15.0,  # KOSPI, KOSDAQ, SPX, NDX 등 대표 주가지수 및 가중수익률
    "VIX": 60.0,      # VIX 변동성 지수 (급변장세 특성 반영)
    "VKOSPI": 60.0,   # 코스피 변동성 지수 (급변장세 특성 반영)
    "CLF": 25.0,      # WTI 원유 선물
    "GC": 20.0,       # 금 선물
    "SI": 25.0,       # 은 선물
    "KR10Y": 25.0,    # 한국 국채 10년물 금리
    "DGS10": 25.0,    # 미국 국채 10년물 금리
    "USDKRW": 15.0,   # 원/달러 환율
}

