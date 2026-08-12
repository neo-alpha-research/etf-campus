from unittest import TestCase

from scripts.validate_page3_holdings import validate_holdings, validate_strategy_changes


class Page3HoldingsValidationTest(TestCase):
    def _selected(self):
        return [
            {
                "page_id": "ai_momentum",
                "ticker": "A",
                "name": "ETF A",
                "theme_key": "theme_a",
                "selection_rank": "1",
            }
        ]

    def _holdings(self):
        return [
            {
                "ticker": "A",
                "holdings_date": "2026-08-11",
                "rank": str(rank),
                "holding_name": f"Stock {rank}",
                "weight_pct": "10.00",
                "top5_concentration_pct": "50.00",
                "source_url": "https://example.test",
            }
            for rank in range(1, 6)
        ]

    def test_valid_top_five_passes(self):
        result = validate_holdings(self._selected(), self._holdings(), "20260810")
        self.assertEqual(result[0]["top5_concentration_pct"], "50.00")

    def test_cash_is_rejected(self):
        holdings = self._holdings()
        holdings[0]["holding_name"] = "현금"
        with self.assertRaisesRegex(RuntimeError, "HOLDINGS_CASH_INCLUDED"):
            validate_holdings(self._selected(), holdings, "20260810")

    def test_bad_declared_sum_is_rejected(self):
        holdings = self._holdings()
        holdings[0]["top5_concentration_pct"] = "49.99"
        with self.assertRaisesRegex(RuntimeError, "HOLDINGS_SUM_MISMATCH"):
            validate_holdings(self._selected(), holdings, "20260810")

    def test_selected_strategy_review_must_pass(self):
        validate_strategy_changes(
            self._selected(), [{"ticker": "A", "eligibility_result": "pass"}]
        )

    def test_missing_strategy_review_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "STRATEGY_CHANGE_REVIEW_MISSING"):
            validate_strategy_changes(self._selected(), [])
