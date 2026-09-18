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
