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

    def test_commodity_value_chain_records_explicit_equity_basis(self) -> None:
        row = {
            "name": "미국천연가스밸류체인",
            "base_index": "US Natural Gas Value Chain Equity Index",
            "asset_class": "원자재",
            "risk_type": "normal",
        }
        asset, asset_basis = suggest_asset(row)
        market, market_basis = suggest_market(row, asset)
        fx, fx_basis = suggest_fx(row, market)
        score, decision, reason, basis = confidence_assessment(
            row, market, market_basis, asset, asset_basis, fx, fx_basis, "일반"
        )

        self.assertEqual(asset_basis, "원자재 밸류체인·생산기업 주식 키워드")
        self.assertGreaterEqual(score, 85)
        self.assertEqual((decision, reason), ("자동확정", "RULES_AGREE"))
        self.assertIn("명시적 자산 재분류", basis)

    def test_plain_bond_equity_mix_can_override_single_bond_source_class(self) -> None:
        row = {
            "name": "미국S&P500미국채혼합50",
            "base_index": "S&P 500 and U.S. Treasury 50/50 Blend Index",
            "asset_class": "채권",
            "risk_type": "normal",
        }
        asset, asset_basis = suggest_asset(row)
        market, market_basis = suggest_market(row, asset)
        fx, fx_basis = suggest_fx(row, market)
        score, decision, reason, basis = confidence_assessment(
            row, market, market_basis, asset, asset_basis, fx, fx_basis, "일반"
        )

        self.assertEqual((market, asset, fx), ("미국", "혼합자산", "환노출"))
        self.assertGreaterEqual(score, 85)
        self.assertEqual((decision, reason), ("자동확정", "RULES_AGREE"))
        self.assertIn("명시적 자산 재분류", basis)

    def test_currency_future_can_override_stock_source_class(self) -> None:
        row = {
            "name": "KIWOOM 미국달러선물",
            "base_index": "미국달러선물지수",
            "asset_class": "주식-해외",
            "risk_type": "normal",
        }
        asset, asset_basis = suggest_asset(row)
        market, market_basis = suggest_market(row, asset)
        fx, fx_basis = suggest_fx(row, market)
        score, decision, reason, basis = confidence_assessment(
            row, market, market_basis, asset, asset_basis, fx, fx_basis, "일반"
        )

        self.assertEqual((market, asset, fx), ("해당없음", "통화", "환노출"))
        self.assertGreaterEqual(score, 85)
        self.assertEqual((decision, reason), ("자동확정", "RULES_AGREE"))
        self.assertIn("명시적 자산 재분류", basis)

    def test_structured_mix_keeps_explicit_core_asset_classification(self) -> None:
        row = {
            "name": "미국S&P500미국채커버드콜혼합",
            "base_index": "S&P 500 and Treasury Covered Call Blend Index",
            "asset_class": "채권",
            "risk_type": "normal",
        }
        asset, asset_basis = suggest_asset(row)
        market, market_basis = suggest_market(row, asset)
        fx, fx_basis = suggest_fx(row, market)
        _, decision, reason, basis = confidence_assessment(
            row, market, market_basis, asset, asset_basis, fx, fx_basis, "커버드콜"
        )

        self.assertEqual(asset, "혼합자산")
        self.assertEqual((decision, reason), ("자동확정", "RULES_AGREE"))
        self.assertIn("명시적 자산 재분류", basis)

    def test_active_reit_can_confirm_core_class_when_market_and_fx_are_clear(self) -> None:
        row = {
            "name": "미국데이터센터리츠액티브",
            "base_index": "US Data Center REIT Index",
            "asset_class": "리츠·인프라",
            "risk_type": "normal",
        }
        asset, asset_basis = suggest_asset(row)
        market, market_basis = suggest_market(row, asset)
        fx, fx_basis = suggest_fx(row, market)
        _, decision, reason, _ = confidence_assessment(
            row, market, market_basis, asset, asset_basis, fx, fx_basis, "액티브"
        )

        self.assertEqual((market, asset, fx), ("미국", "리츠/인프라", "환노출"))
        self.assertEqual((decision, reason), ("자동확정", "RULES_AGREE"))

    def test_complex_product_with_unknown_market_stays_manual(self) -> None:
        row = {
            "name": "테마인프라액티브",
            "base_index": "Theme Infrastructure Index",
            "asset_class": "리츠·인프라",
            "risk_type": "normal",
        }
        asset, asset_basis = suggest_asset(row)
        market, market_basis = suggest_market(row, asset)
        fx, fx_basis = suggest_fx(row, market)
        _, decision, reason, _ = confidence_assessment(
            row, market, market_basis, asset, asset_basis, fx, fx_basis, "액티브"
        )

        self.assertEqual(market, "검수 필요")
        self.assertEqual(decision, "검수필요")
        self.assertIn("MARKET_UNKNOWN", reason)

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

    def test_existing_domestic_equity_class_is_explicit_market_evidence(self) -> None:
        row = {
            "name": "PLUS 한화그룹주",
            "base_index": "FnGuide 한화그룹주 지수",
            "asset_class": "주식-국내",
            "risk_type": "normal",
        }
        asset, asset_basis = suggest_asset(row)
        market, market_basis = suggest_market(row, asset)
        fx, fx_basis = suggest_fx(row, market)
        score, decision, reason, confidence_basis = confidence_assessment(
            row, market, market_basis, asset, asset_basis, fx, fx_basis, "일반"
        )

        self.assertEqual((market, market_basis), ("국내", "기존 국내주식 분류"))
        self.assertEqual(score, 90)
        self.assertEqual((decision, reason), ("자동확정", "RULES_AGREE"))
        self.assertIn("시장 명시", confidence_basis)

    def test_foreign_asset_class_cannot_borrow_domestic_market_confidence(self) -> None:
        row = {
            "name": "테마성장",
            "base_index": "Theme Growth Index",
            "asset_class": "주식-해외",
            "risk_type": "normal",
        }
        score, decision, reason, _ = confidence_assessment(
            row,
            "국내",
            "기존 국내주식 분류",
            "주식",
            "주식 기본값·기존 분류 참고",
            "해당없음",
            "국내 기초자산",
            "일반",
        )

        self.assertEqual(score, 80)
        self.assertEqual((decision, reason), ("표본검수", "CONFIDENCE_BELOW_85"))

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
