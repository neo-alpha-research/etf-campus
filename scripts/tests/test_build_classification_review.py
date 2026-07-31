from unittest import TestCase

from scripts.build_classification_review import (
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

    def test_unknown_fx_policy_is_preserved_for_manual_review(self) -> None:
        row = {
            "name": "미국S&P500",
            "base_index": "S&P 500",
            "asset_class": "주식-해외",
        }
        fx, _ = suggest_fx(row, "미국")
        status, _ = review_status(row, "미국", "주식", fx, "일반")

        self.assertEqual(fx, "미확인")
        self.assertEqual(status, "환헤지 검수")

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
