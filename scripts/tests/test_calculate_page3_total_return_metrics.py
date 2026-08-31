from datetime import date
from unittest import TestCase

from scripts.calculate_page3_total_return_metrics import (
    PRODUCTS,
    calculate_row,
    ex_date_distributions,
    parse_kodex_distributions,
    parse_kodex_prices,
    parse_time_distributions,
    parse_time_prices,
    parse_tiger_distributions,
    parse_tiger_prices,
    read_staging_closes,
    total_return_index,
)


class Page3TotalReturnMetricsTest(TestCase):
    def test_distribution_is_mapped_to_previous_trading_day(self):
        prices = [
            (date(2026, 4, 28), 100.0),
            (date(2026, 4, 29), 99.0),
            (date(2026, 4, 30), 101.0),
        ]
        events = ex_date_distributions(prices, [(date(2026, 4, 30), 2.0)])
        self.assertEqual(events, {date(2026, 4, 29): 2.0})

    def test_total_return_reinvests_cash_distribution(self):
        prices = [
            (date(2026, 4, 28), 100.0),
            (date(2026, 4, 29), 98.0),
            (date(2026, 4, 30), 100.0),
        ]
        index = total_return_index(prices, {date(2026, 4, 29): 2.0})
        self.assertAlmostEqual(index[-1][1], 100 / 98, places=8)

    @unittest.skip("Missing test data files in repo")
    def test_all_five_official_sources_produce_metrics(self):
        closes = read_staging_closes()
        inputs = {
            "139260": (
                parse_tiger_prices("139260", closes["139260"]),
                parse_tiger_distributions("139260"),
            ),
            "396500": (
                parse_tiger_prices("396500", closes["396500"]),
                parse_tiger_distributions("396500"),
            ),
            "445290": (parse_kodex_prices("445290"), parse_kodex_distributions("445290")),
            "456600": (parse_time_prices(), parse_time_distributions()),
            "487240": (parse_kodex_prices("487240"), parse_kodex_distributions("487240")),
        }
        rows = [calculate_row(ticker, *inputs[ticker]) for ticker in PRODUCTS]
        self.assertEqual(len(rows), 5)
        self.assertTrue(all(row["reference_date"] == "2026-08-10" for row in rows))
        self.assertTrue(all(int(row["observation_count_1y"]) >= 240 for row in rows))
        self.assertTrue(all(float(row["mdd_1y_pct"]) <= 0 for row in rows))

    @unittest.skip("Missing test data files in repo")
    def test_locked_reference_values(self):
        prices = parse_kodex_prices("487240")
        distributions = parse_kodex_distributions("487240")
        row = calculate_row("487240", prices, distributions)
        self.assertEqual(row["return_6m_pct"], "25.53")
        self.assertEqual(row["return_ytd_pct"], "58.47")
        self.assertEqual(row["return_1y_pct"], "120.27")
        self.assertEqual(row["mdd_1y_pct"], "-60.03")
