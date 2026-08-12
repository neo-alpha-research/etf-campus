from unittest import TestCase

from scripts.build_lead_magnet_candidates import (
    AI_CANDIDATE_RE,
    AI_RE,
    apply_page3_official_validations,
    ai_theme,
    dividend_bucket,
    has_full_history,
    rank_and_select,
    validate_selection,
)


class LeadMagnetCandidateRulesTest(TestCase):
    def test_daily_does_not_false_match_ai(self) -> None:
        self.assertIsNone(AI_RE.search("NASDAQ 100 DAILY COVERED CALL"))

    def test_cloud_is_an_ai_ecosystem_candidate(self) -> None:
        self.assertIsNotNone(AI_CANDIDATE_RE.search("KEDI 글로벌 AI 클라우드 지수"))
        theme, status = ai_theme(
            {"name": "글로벌클라우드", "base_index": "Global Cloud Computing Index"}
        )
        self.assertEqual((theme, status), ("ai_platform_software", "confirmed_ecosystem"))

    def test_information_technology_is_an_ai_ecosystem_candidate(self) -> None:
        theme, status = ai_theme(
            {"name": "KODEX IT", "base_index": "KRX 정보기술"}
        )
        self.assertEqual((theme, status), ("ai_it_bigtech", "confirmed_ecosystem"))

    def test_generic_space_tech_is_not_automatically_ai(self) -> None:
        self.assertIsNone(AI_CANDIDATE_RE.search("미국우주테크 Space Tech Index"))

    def test_official_validation_promotes_broad_ai_candidate(self) -> None:
        rows = [
            {
                "page_id": "ai_momentum",
                "ticker": "456600",
                "bucket": "broad_ai_value_chain",
                "theme_key": "broad_ai_value_chain",
                "region": "global",
                "classification_status": "manual_review",
                "eligibility_status": "excluded_or_review",
                "exclusion_codes": "CLASSIFICATION_UNCONFIRMED",
                "official_validation_status": "",
                "official_source_url": "",
                "official_evidence_summary": "",
                "strategy_change_status": "",
            }
        ]
        validations = {
            "456600": {
                "validated_theme": "broad_ai_value_chain",
                "validated_region": "global",
                "validation_status": "confirmed",
                "source_url": "https://example.test/official",
                "evidence_summary": "official AI objective",
                "strategy_change_status": "pending_kind_notice_check",
            }
        }
        apply_page3_official_validations(rows, validations)
        self.assertEqual(rows[0]["eligibility_status"], "eligible")
        self.assertEqual(rows[0]["exclusion_codes"], "")

    def test_material_strategy_change_remains_excluded(self) -> None:
        rows = [
            {
                "page_id": "ai_momentum",
                "ticker": "395160",
                "bucket": "ai_semiconductor",
                "theme_key": "ai_semiconductor",
                "region": "korea",
                "classification_status": "manual_review",
                "eligibility_status": "excluded_or_review",
                "exclusion_codes": "CLASSIFICATION_UNCONFIRMED",
                "official_validation_status": "",
                "official_source_url": "",
                "official_evidence_summary": "",
                "strategy_change_status": "",
            }
        ]
        validations = {
            "395160": {
                "validated_theme": "ai_semiconductor",
                "validated_region": "korea",
                "validation_status": "confirmed",
                "strategy_change_status": "material_change_within_1y",
            }
        }
        apply_page3_official_validations(rows, validations)
        self.assertEqual(rows[0]["eligibility_status"], "excluded_or_review")
        self.assertEqual(rows[0]["exclusion_codes"], "STRATEGY_CHANGE_IN_WINDOW")

    def test_ai_semiconductor_gets_one_specialist_theme(self) -> None:
        theme, status = ai_theme(
            {"name": "미국AI반도체", "base_index": "US AI Semiconductor Index"}
        )
        self.assertEqual((theme, status), ("ai_semiconductor", "confirmed"))

    def test_multi_theme_ai_requires_review(self) -> None:
        theme, status = ai_theme(
            {"name": "AI반도체&인프라", "base_index": "AI Semiconductor and Infrastructure Index"}
        )
        self.assertIsNone(theme)
        self.assertEqual(status, "manual_review_theme_conflict")

    def test_dividend_covered_call_is_not_assigned(self) -> None:
        bucket, reason = dividend_bucket(
            {"name": "미국배당커버드콜", "base_index": "US Dividend Covered Call"},
            "us",
        )
        self.assertIsNone(bucket)
        self.assertEqual(reason, "excluded_structure")

    def test_ai_selection_keeps_one_per_theme_then_top_five(self) -> None:
        rows = []
        for theme_index in range(6):
            theme = f"theme_{theme_index}"
            for product_index, aum in enumerate((100 - theme_index, 50 - theme_index)):
                rows.append(
                    {
                        "page_id": "ai_momentum",
                        "bucket": theme,
                        "theme_key": theme,
                        "ticker": f"{theme_index}{product_index}",
                        "aum_krw": str(aum),
                        "eligibility_status": "eligible",
                        "aum_rank_in_bucket": "",
                        "selection_rank": "",
                        "selection_status": "not_selected",
                        "selection_reason": "",
                    }
                )

        rank_and_select(rows)

        selected = [row for row in rows if row["selection_status"] == "provisional_selected"]
        self.assertEqual(len(selected), 5)
        self.assertEqual(len({row["theme_key"] for row in selected}), 5)
        self.assertTrue(all(row["aum_rank_in_bucket"] == 1 for row in selected))

    def test_since_inception_fallback_does_not_count_as_one_year_history(self) -> None:
        master = {"listing_date": "20260512"}
        returns = {"r_12m": "-25.61", "new_12m": "Y"}
        self.assertFalse(has_full_history(master, returns, "20260810", 1))

    def test_old_product_with_real_three_year_field_passes_history_gate(self) -> None:
        master = {"listing_date": ""}
        returns = {"r_36m": "42.1", "new_12m": "N"}
        self.assertTrue(has_full_history(master, returns, "20260810", 3))

    def test_selection_validation_rejects_duplicate_ai_theme(self) -> None:
        selected = [
            {
                "page_id": "long_term_core",
                "theme_key": "",
                "region": "korea",
                "ticker": str(index),
                "aum_rank_in_bucket": 1,
                "selection_rank": 1,
            }
            for index in range(3)
        ]
        selected.extend(
            {
                "page_id": "dividend_income",
                "theme_key": "",
                "region": "korea" if index < 3 else "us",
                "ticker": f"d{index}",
                "aum_rank_in_bucket": (index % 3) + 1,
                "selection_rank": (index % 3) + 1,
            }
            for index in range(6)
        )
        selected.extend(
            {
                "page_id": "ai_momentum",
                "theme_key": "duplicate",
                "region": "korea" if index == 0 else "us",
                "ticker": f"a{index}",
                "aum_rank_in_bucket": 1,
                "selection_rank": index + 1,
            }
            for index in range(5)
        )
        with self.assertRaisesRegex(RuntimeError, "AI_THEME_DUPLICATE"):
            validate_selection(selected)
