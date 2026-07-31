from unittest import TestCase

from scripts.build_classification_review import (
    confidence_assessment,
    review_status,
    suggest_asset,
    suggest_fx,
    suggest_market,
)


class ClassificationDraftTest(TestCase):
    def test_classifies_foreign_equity_exposure_separately_from_fx_hedge(self) -> None:
        row = {
            "name": "KODEX 미국S&P500(H)",
            "base_index": "S&P 500 Hedged Index",
            "asset_class": "주식-해외",
        }
        asset, _ = suggest_asset(row)
        market, _ = suggest_market(row, asset)
        fx, _ = suggest_fx(row, market)

        self.assertEqual((market, asset, fx), ("미국", "주식", "환헤지"))

    def test_treats_commodity_value_chain_as_equity(self) -> None:
        row = {
            "name": "미국천연가스밸류체인",
            "base_index": "US Natural Gas Value Chain Equity Index",
            "asset_class": "원자재",
        }
        asset, _ = suggest_asset(row)
        market, _ = suggest_market(row, asset)

        self.assertEqual((market, asset), ("미국", "주식"))

    def test_direct_gold_future_has_no_country_scope(self) -> None:
        row = {
            "name": "KODEX 골드선물(H)",
            "base_index": "S&P GSCI Gold Index",
            "asset_class": "원자재",
        }
        asset, _ = suggest_asset(row)
        market, _ = suggest_market(row, asset)

        self.assertEqual((market, asset), ("해당없음", "원자재"))

    def test_foreign_etf_without_h_mark_is_classified_as_unhedged(self) -> None:
        row = {
            "name": "미국S&P500",
            "base_index": "S&P 500",
            "asset_class": "주식-해외",
        }
        fx, _ = suggest_fx(row, "미국")
        status, _ = review_status(row, "미국", "주식", fx, "일반")

        self.assertEqual(fx, "환노출")
        self.assertEqual(status, "자동 초안")

    def test_partial_and_dynamic_hedge_override_name_convention(self) -> None:
        partial, _ = suggest_fx(
            {"name": "글로벌채권 부분환헤지", "base_index": ""},
            "글로벌",
        )
        dynamic, _ = suggest_fx(
            {"name": "글로벌채권 탄력적 환헤지", "base_index": ""},
            "글로벌",
        )

        self.assertEqual(partial, "부분헤지")
        self.assertEqual(dynamic, "탄력헤지")

    def test_direct_foreign_commodity_without_h_mark_is_unhedged(self) -> None:
        row = {
            "name": "금선물",
            "base_index": "S&P GSCI Gold Index",
            "asset_class": "원자재",
        }
        fx, _ = suggest_fx(row, "해당없음")

        self.assertEqual(fx, "환노출")

    def test_plus_brand_is_not_mistaken_for_us_market(self) -> None:
        row = {
            "name": "PLUS 한화그룹주",
            "base_index": "FnGuide 한화그룹주 지수",
            "asset_class": "주식-국내",
        }
        asset, _ = suggest_asset(row)
        market, _ = suggest_market(row, asset)

        self.assertEqual(market, "국내")

    def test_asia_ex_china_is_not_mistaken_for_china(self) -> None:
        row = {
            "name": "KODEX 아시아AI반도체exChina액티브",
            "base_index": "아시아 반도체 제조동맹 지수",
            "asset_class": "주식-해외",
        }
        asset, _ = suggest_asset(row)
        market, _ = suggest_market(row, asset)

        self.assertEqual(market, "아시아")

    def test_us_company_name_can_identify_market_scope(self) -> None:
        row = {
            "name": "RISE 테슬라고정테크100",
            "base_index": "KEDI 테슬라고정테크100 지수",
            "asset_class": "주식-해외",
        }
        asset, _ = suggest_asset(row)
        market, _ = suggest_market(row, asset)

        self.assertEqual(market, "미국")

    def test_domestic_plain_equity_can_be_auto_confirmed(self) -> None:
        row = {
            "name": "KODEX 코스피200",
            "base_index": "KOSPI 200",
            "asset_class": "주식-국내",
            "risk_type": "normal",
        }
        asset, asset_basis = suggest_asset(row)
        market, market_basis = suggest_market(row, asset)
        fx, fx_basis = suggest_fx(row, market)
        score, decision, reason, _ = confidence_assessment(
            row, market, market_basis, asset, asset_basis, fx, fx_basis, "일반"
        )

        self.assertGreaterEqual(score, 85)
        self.assertEqual((decision, reason), ("자동확정", "RULES_AGREE"))

    def test_unknown_market_is_never_auto_confirmed(self) -> None:
        row = {
            "name": "테마성장",
            "base_index": "Theme Growth Index",
            "asset_class": "주식-해외",
            "risk_type": "normal",
        }
        score, decision, reason, _ = confidence_assessment(
            row,
            "검수 필요",
            "시장 단서 부족",
            "주식",
            "주식 기본값·기존 분류 참고",
            "미확인",
            "시장 노출과 공식 문서 확인 필요",
            "일반",
        )

        self.assertGreater(score, 0)
        self.assertEqual(decision, "검수필요")
        self.assertIn("MARKET_UNKNOWN", reason)
        self.assertIn("FX_UNKNOWN", reason)
