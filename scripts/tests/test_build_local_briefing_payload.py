import sys
import unittest
from pathlib import Path
import json

ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from scripts.build_local_briefing_payload import build_briefing_payload


class TestBuildLocalBriefingPayload(unittest.TestCase):
    def setUp(self):
        self.data_dir = Path("data")
        self.payload_dict = build_briefing_payload(self.data_dir, target_date="2026-09-17")
        self.briefing = self.payload_dict.get("briefing") or self.payload_dict

    def test_commodity_peer_groups_include_energy(self):
        """FM-015: 원자재 자산군 산하에 에너지(원유·천연가스) 테마가 정상 포함되어야 함."""
        raw_materials = [
            p for p in self.briefing.get("peerGroups", [])
            if p.get("assetClass") == "원자재"
        ]
        pg_names = [p.get("peerGroup") for p in raw_materials]
        
        # 4대 원자재 테마 필수 포함 검증
        self.assertIn("귀금속 (금·은·팔라듐)", pg_names)
        self.assertIn("에너지 (원유·천연가스)", pg_names)
        self.assertIn("산업용 금속 (구리·비철)", pg_names)
        self.assertIn("농산물 (곡물·소프트)", pg_names)

    def test_market_scale_snapshot_has_four_categories(self):
        """STEP 6: 시장 규모 4대 카테고리(일반, 파킹, 레버리지, 인버스)가 정상 생성되어야 함."""
        snapshot = self.briefing.get("marketScaleSnapshot")
        self.assertIsNotNone(snapshot, "marketScaleSnapshot should not be None")
        
        categories = snapshot.get("categories", [])
        self.assertEqual(len(categories), 4, "Must have exactly 4 categories")
        
        cat_keys = {c.get("category") for c in categories}
        self.assertEqual(cat_keys, {"general", "parking", "leveraged", "inverse"})
        
        total_aum = snapshot.get("totalAum", 0)
        self.assertGreater(total_aum, 0, "Total AUM must be greater than 0")

    def test_weekly_and_monthly_fund_flows_preserved(self):
        """STEP 5: 주간/월간 자금 흐름 데이터가 빈 배열로 초기화되지 않고 보존되어야 함."""
        weekly = self.briefing.get("weeklyFundFlows")
        monthly = self.briefing.get("monthlyFundFlows")
        self.assertIsNotNone(weekly)
        self.assertIsNotNone(monthly)

    def test_disparity_warning_excludes_zero_liquidity_and_halted_etfs(self):
        """괴리율 경보: 거래정지(265690) 및 저유동성(거래대금 1,000만원 미만) 종목이 제외되어야 함."""
        warnings = self.briefing.get("disparityWarning", [])
        self.assertIsInstance(warnings, list)
        
        tickers = [w.get("ticker") for w in warnings]
        # 거래정지 및 비정상 괴리율(+17527%) 종목 265690 배제 확인
        self.assertNotIn("265690", tickers, "Halted ETF 265690 (ACE 러시아MSCI) must be excluded from disparity warnings")
        
        for w in warnings:
            # 종목명 필드 정합성 (UI 공백 방지)
            self.assertTrue(bool(w.get("etfName")), f"etfName must be non-empty for {w.get('ticker')}")
            self.assertTrue(bool(w.get("name")), f"name must be non-empty for {w.get('ticker')}")
            
            # 기준 괴리율 (국내 1.0%, 해외 3.0%) 준수 확인
            asset_cls = w.get("assetClass", "")
            threshold = 1.0 if "국내" in asset_cls else 3.0
            self.assertGreaterEqual(abs(w.get("disparityPct", 0)), threshold)
            
            # 비정상 수치(50% 이상 극단치) 배제 확인
            self.assertLess(abs(w.get("disparityPct", 0)), 50.0)

    def test_macro_spike_contract_dynamic_limits(self):
        """FM-014: VIX/VKOSPI는 ±60%까지 정상 수용하고, 주가지수(SPX)는 ±15% 초과 시 차단해야 함."""
        from scripts.schemas.briefing_contract import BriefingContract, MacroIndexItem, FundFlowItem

        base_indices = [
            {"code": "KOSPI", "label": "코스피", "value": 2600.0, "change_pct": 1.5, "as_of_date": "2026-09-17"},
            {"code": "KOSDAQ", "label": "코스닥", "value": 850.0, "change_pct": 0.8, "as_of_date": "2026-09-17"},
            {"code": "VKOSPI", "label": "VKOSPI", "value": 25.0, "change_pct": 35.0, "as_of_date": "2026-09-17"},  # High volatility VKOSPI (+35%)
            {"code": "SPX", "label": "S&P 500", "value": 5500.0, "change_pct": -0.5, "as_of_date": "2026-09-17"},
            {"code": "NDX", "label": "나스닥", "value": 19000.0, "change_pct": -0.8, "as_of_date": "2026-09-17"},
            {"code": "VIX", "label": "VIX", "value": 22.0, "change_pct": 45.0, "as_of_date": "2026-09-17"},  # High volatility VIX (+45%)
            {"code": "USDKRW", "label": "원/달러", "value": 1340.0, "change_pct": 0.3, "as_of_date": "2026-09-17"},
            {"code": "KR10Y", "label": "국채 10년", "value": 3.2, "change_pct": 0.05, "as_of_date": "2026-09-17"},
            {"code": "DGS10", "label": "미 국채 10년물", "value": 4.1, "change_pct": -0.02, "as_of_date": "2026-09-17"},
            {"code": "CLF", "label": "WTI 원유", "value": 75.0, "change_pct": 18.0, "as_of_date": "2026-09-17"},  # WTI (+18%) within 25%
            {"code": "GC", "label": "금 선물", "value": 2500.0, "change_pct": 1.2, "as_of_date": "2026-09-17"},
            {"code": "SI", "label": "은 선물", "value": 30.0, "change_pct": 2.1, "as_of_date": "2026-09-17"},
        ]
        sample_flows = [
            {"ticker": f"0000{i}0", "name": f"ETF_{i}", "net_flow": 100000000.0}
            for i in range(5)
        ]

        # 1. Valid: VIX +45% and VKOSPI +35% should pass under dynamic macro limits
        contract = BriefingContract(
            as_of_date="2026-09-17",
            general_etf_count=1000,
            general_total_aum=100000000000.0,
            aum_weighted_return_pct=1.2,
            market_indices=[MacroIndexItem(**item) for item in base_indices],
            top_inflows=[FundFlowItem(**item) for item in sample_flows],
            top_outflows=[FundFlowItem(**item) for item in sample_flows],
        )
        self.assertIsNotNone(contract)

        # 2. Invalid: SPX +20% (exceeds equity ±15% limit) must fail closed
        invalid_indices = [dict(item) for item in base_indices]
        for item in invalid_indices:
            if item["code"] == "SPX":
                item["change_pct"] = 20.0  # Illegal spike for S&P 500

        with self.assertRaises(ValueError):
            BriefingContract(
                as_of_date="2026-09-17",
                general_etf_count=1000,
                general_total_aum=100000000000.0,
                aum_weighted_return_pct=1.2,
                market_indices=[MacroIndexItem(**item) for item in invalid_indices],
                top_inflows=[FundFlowItem(**item) for item in sample_flows],
                top_outflows=[FundFlowItem(**item) for item in sample_flows],
            )


if __name__ == "__main__":
    unittest.main()
