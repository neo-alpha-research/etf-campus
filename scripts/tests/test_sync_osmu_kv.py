#!/usr/bin/env python3
"""
scripts/tests/test_sync_osmu_kv.py

Opus 5.0 지시서에 따른 스마트 머지 및 캐리포워드 규약 3대 필수 회귀 테스트:
1. 표기 없는 이월은 차단 (Fail-Closed)
2. 표기 있는 이월(<field>AsOf 명시)은 통과
3. 당일 종가/지수/등락률 이월 시도는 엄격 차단
+ 휴장일(is_closed=True) 허용 및 개장일 결측 차단 검증
"""

from __future__ import annotations

import unittest
from pathlib import Path
import sys

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.schemas.briefing_contract import (
    BriefingContract,
    validate_briefing_payload,
    CARRY_FORWARD_ALLOWLIST,
    CANONICAL_MACRO_CODES,
)


def make_valid_base_payload(as_of_date: str = "2026-09-18") -> dict:
    """계약 검증을 통과하는 기본 정상 페이로드 픽스처 생성"""
    indices = []
    for code in sorted(CANONICAL_MACRO_CODES):
        if code in ("KOSPI", "KOSDAQ"):
            val = 2500.0
        elif code == "SPX":
            val = 5000.0
        elif code == "NDX":
            val = 18000.0
        elif "USD" in code:
            val = 1300.0
        elif "10" in code:  # KR10Y, DGS10
            val = 3.5
        elif code in ("CLF", "SI"):
            val = 50.0
        elif code == "GC":
            val = 2000.0
        else:
            val = 18.0  # VIX, VKOSPI
        indices.append({
            "code": code,
            "label": code,
            "value": val,
            "change_pct": 0.5,
            "change_points": 2.5,
            "as_of_date": as_of_date,
            "is_closed": False,
        })

    sample_inflows = [
        {"ticker": f"00000{i}", "name": f"ETF_{i}", "netInflowValue": 1000000000.0 * (6 - i)}
        for i in range(1, 6)
    ]
    sample_outflows = [
        {"ticker": f"10000{i}", "name": f"ETF_OUT_{i}", "netInflowValue": -500000000.0 * i}
        for i in range(1, 6)
    ]

    return {
        "briefing": {
            "asOfDate": as_of_date,
            "prevAsOfDate": "2026-09-17",
            "generalEtfCount": 1000,
            "generalTotalAum": 150_000_000_000_000.0,
            "generalAumWeightedReturnPct": 0.45,
            "marketIndices": indices,
            "fundFlow": {
                "general": {
                    "topInflows": sample_inflows,
                    "topOutflows": sample_outflows,
                }
            },
        }
    }


class TestCarryForwardAndContract(unittest.TestCase):
    def test_carry_forward_allowlist_is_ssot(self):
        """허용 목록 상수 확인 (FM-014 준수)"""
        expected = {"weeklyFundFlows", "monthlyFundFlows", "marketScaleTimeSeries"}
        self.assertEqual(CARRY_FORWARD_ALLOWLIST, expected)

    def test_carry_forward_without_as_of_is_blocked(self):
        """회귀 테스트 1: 명시적 asOf 표기 없는 이월은 차단 (Fail-Closed)"""
        payload = make_valid_base_payload("2026-09-18")
        b = payload["briefing"]
        # 전일 데이터로부터 주간 자금흐름을 가져왔으나 AsOf를 누락한 상황 모의
        b["weeklyFundFlows"] = [{"rank": 1, "peerGroup": "반도체", "netInflow": 500}]
        b["weeklyFundFlowsIsCarried"] = True  # 이월되었으나 weeklyFundFlowsAsOf 없음

        is_valid, errors, contract = validate_briefing_payload(payload)
        self.assertFalse(is_valid)
        self.assertIsNone(contract)
        self.assertTrue(any("무표기 캐리포워드 감지 차단" in err for err in errors))

    def test_carry_forward_with_as_of_passes(self):
        """회귀 테스트 2: 명시적 asOf 표기가 있는 이월은 계약 정상 통과"""
        payload = make_valid_base_payload("2026-09-18")
        b = payload["briefing"]
        b["weeklyFundFlows"] = [{"rank": 1, "peerGroup": "반도체", "netInflow": 500}]
        b["weeklyFundFlowsAsOf"] = "2026-09-17"  # 브리핑 날짜(09-18)와 다른 전일 기준일자 정직 표기
        b["weeklyFundFlowsIsCarried"] = True

        b["monthlyFundFlows"] = [{"rank": 1, "peerGroup": "2차전지", "netInflow": -300}]
        b["monthlyFundFlowsAsOf"] = "2026-09-17"
        b["monthlyFundFlowsIsCarried"] = True

        is_valid, errors, contract = validate_briefing_payload(payload)
        self.assertTrue(is_valid, f"Validation failed unexpectedly: {errors}")
        self.assertIsNotNone(contract)
        self.assertEqual(contract.carried_fields.get("weeklyFundFlows"), "2026-09-17")
        self.assertEqual(contract.carried_fields.get("monthlyFundFlows"), "2026-09-17")

    def test_daily_prices_or_indices_carry_forward_is_strictly_forbidden(self):
        """회귀 테스트 3: 당일 종가/지수/등락률 이월 시도는 엄격 차단"""
        payload = make_valid_base_payload("2026-09-18")
        b = payload["briefing"]
        # 허용 목록 외 필드(marketIndices 또는 close)에 AsOf를 달아 이월 시도
        b["marketIndicesAsOf"] = "2026-09-17"

        is_valid, errors, contract = validate_briefing_payload(payload)
        self.assertFalse(is_valid)
        self.assertIsNone(contract)
        self.assertTrue(any("불법 캐리포워드 감지 차단" in err for err in errors))

    def test_holiday_index_is_closed_passes(self):
        """휴장일 지표: is_closed=True 이면 value None/전일자여도 계약 통과"""
        payload = make_valid_base_payload("2026-09-18")
        b = payload["briefing"]
        # 미국 시장 휴장 가정: SPX 지수에 is_closed=True 부여 및 value=None
        for m in b["marketIndices"]:
            if m["code"] == "SPX":
                m["is_closed"] = True
                m["value"] = None
                m["change_pct"] = None
                m["as_of_date"] = "2026-09-17"  # 전일 거래일자

        is_valid, errors, contract = validate_briefing_payload(payload)
        self.assertTrue(is_valid, f"Holiday SPX should pass contract: {errors}")

    def test_open_day_missing_index_value_fails(self):
        """개장일 지표: is_closed=False 인데 value 누락 시 Fail-Closed 차단"""
        payload = make_valid_base_payload("2026-09-18")
        b = payload["briefing"]
        for m in b["marketIndices"]:
            if m["code"] == "SPX":
                m["is_closed"] = False
                m["value"] = None  # 수집 실패 모의

        is_valid, errors, contract = validate_briefing_payload(payload)
        self.assertFalse(is_valid)
        self.assertTrue(any("value/close 값이 누락되었습니다" in err for err in errors))


if __name__ == "__main__":
    unittest.main()
