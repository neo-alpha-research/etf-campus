from unittest import TestCase
from pathlib import Path

from scripts.build_classification_review import (
    build_rows,
    confidence_assessment,
    review_status,
    suggest_asset,
    suggest_fx,
    suggest_market,
    write_csv,
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

    def test_english_korea_index_is_treated_as_domestic_market(self) -> None:
        row = {
            "name": "KODEX TDF2060액티브",
            "base_index": "Samsung Korea Target Date 2060 Index",
            "asset_class": "혼합·자산배분",
        }
        asset, _ = suggest_asset(row)
        market, _ = suggest_market(row, asset)

        self.assertEqual((market, asset), ("국내", "혼합자산"))

    def test_special_bond_is_not_mistaken_for_equity(self) -> None:
        row = {
            "name": "BNK 27-12 특수채(AAA이상)액티브",
            "base_index": "KAP 27-12 특수채 총수익 지수(AAA이상)",
            "asset_class": "채권",
        }
        asset, _ = suggest_asset(row)

        self.assertEqual(asset, "채권")

    def test_official_source_registry_enriches_without_confirming_by_itself(self) -> None:
        rows = build_rows(
            Path("data/etf_master_draft.csv"),
            official_sources={
                "0079X0": {
                    "official_source_url": "https://issuer.example/0079X0",
                    "evidence_summary": "공식 자료 연결",
                    "source_status": "공식 자료 연결",
                }
            },
        )
        row = next(item for item in rows if item["ticker"] == "0079X0")

        self.assertEqual(row["official_source_url"], "https://issuer.example/0079X0")
        self.assertEqual(row["source_status"], "공식 자료 연결")
        self.assertEqual(row["review_status"], "미검수")

    def test_current_official_source_can_auto_confirm_a_complex_product(self) -> None:
        source_rows = build_rows(Path("data/etf_master_draft.csv"))
        target = next(item for item in source_rows if item["ticker"] == "0086B0")
        rows = build_rows(
            Path("data/etf_master_draft.csv"),
            official_sources={
                "0086B0": {
                    "auto_confirm": "Y",
                    "name_snapshot": target["name"],
                    "base_index_snapshot": target["base_index"],
                    "final_market_scope": "국내",
                    "final_asset_class": "리츠/인프라",
                    "final_asset_detail": "리츠/인프라",
                    "final_fx_hedge": "해당없음",
                }
            },
        )
        row = next(item for item in rows if item["ticker"] == "0086B0")

        self.assertEqual(row["auto_decision"], "자동확정")
        self.assertEqual(row["reason_code"], "OFFICIAL_SOURCE_CONFIRMED")
        self.assertEqual(row["review_status"], "자동확정")
        self.assertEqual(row["final_asset_class"], "리츠/인프라")

    def test_changed_benchmark_disables_official_source_auto_confirm(self) -> None:
        rows = build_rows(
            Path("data/etf_master_draft.csv"),
            official_sources={
                "0086B0": {
                    "auto_confirm": "Y",
                    "name_snapshot": "TIGER 리츠부동산인프라TOP10액티브",
                    "base_index_snapshot": "changed benchmark",
                    "final_market_scope": "국내",
                    "final_asset_class": "리츠/인프라",
                    "final_asset_detail": "리츠/인프라",
                    "final_fx_hedge": "해당없음",
                }
            },
        )
        row = next(item for item in rows if item["ticker"] == "0086B0")

        self.assertNotEqual(row["reason_code"], "OFFICIAL_SOURCE_CONFIRMED")

    def test_empty_review_queue_can_be_written_with_headers(self) -> None:
        from tempfile import TemporaryDirectory

        with TemporaryDirectory() as directory:
            path = Path(directory) / "queue.csv"
            write_csv(path, [], ["ticker", "name"])
            self.assertEqual(path.read_text(encoding="utf-8-sig").strip(), "ticker,name")

    def test_infrastructure_industries_are_equity_not_reit(self) -> None:
        row = {
            "name": "KoAct 미국천연가스인프라액티브",
            "base_index": "Solactive 미국천연가스인프라 PR 지수",
            "asset_class": "원자재",
        }
        asset, _ = suggest_asset(row)
        market, _ = suggest_market(row, asset)

        self.assertEqual((market, asset), ("미국", "주식"))

    def test_reit_bond_combination_is_mixed_asset(self) -> None:
        row = {
            "name": "TIGER 리츠부동산인프라채권",
            "base_index": "KIS 리츠부동산인프라채권PR 지수",
            "asset_class": "채권",
        }
        asset, _ = suggest_asset(row)

        self.assertEqual(asset, "혼합자산")

    def test_singapore_reit_has_explicit_market_scope(self) -> None:
        row = {
            "name": "ACE 싱가포르리츠",
            "base_index": "Morningstar Singapore REIT Yield Focus Index(PR)",
            "asset_class": "리츠·인프라",
        }
        asset, _ = suggest_asset(row)
        market, _ = suggest_market(row, asset)

        self.assertEqual((market, asset), ("싱가포르", "리츠/인프라"))

    def test_explicit_industry_infrastructure_can_override_commodity_even_when_active(self) -> None:
        row = {
            "name": "KoAct 미국천연가스인프라액티브",
            "base_index": "Solactive 미국천연가스인프라 PR 지수",
            "asset_class": "원자재",
            "risk_type": "normal",
        }
        asset, asset_basis = suggest_asset(row)
        market, market_basis = suggest_market(row, asset)
        fx, fx_basis = suggest_fx(row, market)
        _, decision, reason, _ = confidence_assessment(
            row, market, market_basis, asset, asset_basis, fx, fx_basis, "액티브"
        )

        self.assertEqual((asset, decision, reason), ("주식", "자동확정", "RULES_AGREE"))

    def test_special_bond_can_override_noisy_legacy_equity_tag(self) -> None:
        row = {
            "name": "마이티 5월만기자동연장특수채(AAA)액티브",
            "base_index": "KAP 5월 만기자동연장 특수채(AAA) 총수익 지수",
            "asset_class": "주식-국내",
            "risk_type": "normal",
        }
        asset, asset_basis = suggest_asset(row)
        market, market_basis = suggest_market(row, asset)
        fx, fx_basis = suggest_fx(row, market)
        _, decision, reason, _ = confidence_assessment(
            row, market, market_basis, asset, asset_basis, fx, fx_basis, "액티브"
        )

        self.assertEqual((asset, decision, reason), ("채권", "자동확정", "RULES_AGREE"))
