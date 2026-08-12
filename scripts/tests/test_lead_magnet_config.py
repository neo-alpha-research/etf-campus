import json
from pathlib import Path
from unittest import TestCase


ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT / "config" / "lead_magnet.json"


def load_config() -> dict:
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


class LeadMagnetConfigContractTest(TestCase):
    def setUp(self) -> None:
        self.config = load_config()
        self.pages = {page["id"]: page for page in self.config["pages"]}

    def test_config_is_locked_and_points_to_existing_ssot(self) -> None:
        self.assertEqual(self.config["status"], "locked_for_implementation")
        ssot = ROOT / self.config["ssot_document"]
        self.assertTrue(ssot.is_file())

    def test_output_contract_is_exactly_three_landscape_a4_pages(self) -> None:
        output = self.config["output"]
        self.assertEqual(output["page_count"], 3)
        self.assertEqual((output["page_size"], output["orientation"]), ("A4", "landscape"))
        self.assertEqual([page["page_number"] for page in self.config["pages"]], [1, 2, 3])

    def test_aum_uses_direct_net_assets_and_never_market_cap(self) -> None:
        aum = self.config["aum"]
        self.assertEqual(aum["ranking_field"], "net_asset_value_total_krw")
        self.assertTrue(aum["require_direct_value"])
        self.assertFalse(aum["allow_market_cap_as_substitute"])
        self.assertFalse(aum["allow_nav_times_shares_as_substitute"])

    def test_eligibility_precedes_aum_ranking(self) -> None:
        common = self.config["common_eligibility"]
        self.assertEqual(common["data_failure_action"], "exclude_before_aum_ranking")
        self.assertEqual(common["classification_unknown_action"], "manual_review")

    def test_page1_has_one_aum_leader_per_required_index_family(self) -> None:
        page = self.pages["long_term_core"]
        self.assertEqual(page["rows_target"], 3)
        self.assertEqual(page["minimum_listing_history_years"], 3)
        self.assertEqual(
            [bucket["key"] for bucket in page["buckets"]],
            ["kospi200", "sp500", "nasdaq100"],
        )
        self.assertTrue(all(bucket["select_count"] == 1 for bucket in page["buckets"]))

    def test_page2_selects_three_domestic_and_three_us_dividend_etfs(self) -> None:
        page = self.pages["dividend_income"]
        self.assertEqual(page["rows_target"], 6)
        self.assertEqual(
            [(bucket["investment_region"], bucket["select_count"]) for bucket in page["buckets"]],
            [("korea", 3), ("us", 3)],
        )
        self.assertIn("covered_call", page["excluded_dividend_adjacent_strategies"])
        self.assertIn("option_income", page["excluded_dividend_adjacent_strategies"])

    def test_page3_uses_two_stage_theme_aum_selection(self) -> None:
        page = self.pages["ai_momentum"]
        self.assertEqual(
            page["selection_method"],
            "top_aum_per_theme_then_top_aum_theme_representatives",
        )
        self.assertEqual(page["rows_target"], 5)
        self.assertEqual(page["theme_assignment_mode"], "exactly_one_or_manual_review")

    def test_page3_theme_registry_is_unique_and_has_broad_fallback(self) -> None:
        themes = self.pages["ai_momentum"]["themes"]
        keys = [theme["key"] for theme in themes]
        self.assertEqual(len(keys), len(set(keys)))
        self.assertIn("broad_ai_value_chain", keys)
        self.assertGreaterEqual(len(keys), 5)

    def test_page3_region_coverage_blocks_instead_of_silent_substitution(self) -> None:
        rules = self.pages["ai_momentum"]["region_rules"]
        self.assertEqual(rules["minimum_final_korea_count"], 1)
        self.assertEqual(rules["minimum_final_us_or_global_count"], 1)
        self.assertEqual(
            rules["coverage_failure_action"],
            "block_release_without_silent_substitution",
        )

    def test_all_pages_use_total_return_without_price_return_fallback(self) -> None:
        performance = self.config["performance"]
        self.assertEqual(performance["basis"], "krw_market_price_total_return")
        self.assertEqual(performance["distribution_treatment"], "reinvest_on_official_ex_date")
        self.assertFalse(performance["allow_price_return_fallback"])

    def test_release_contract_contains_selection_and_theme_guards(self) -> None:
        codes = set(self.config["release_block_codes"])
        self.assertIn("AUM_SELECTION_INVARIANT_FAIL", codes)
        self.assertIn("AI_THEME_DUPLICATE", codes)
        self.assertIn("AI_REGION_COVERAGE_FAIL", codes)
        self.assertIn("RETURN_BASIS_MIXED", codes)

