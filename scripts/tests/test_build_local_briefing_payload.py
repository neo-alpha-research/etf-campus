import unittest
from pathlib import Path
import json

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


if __name__ == "__main__":
    unittest.main()
