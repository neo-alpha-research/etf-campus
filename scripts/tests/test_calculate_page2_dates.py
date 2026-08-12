from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase

from scripts import calculate_page2_metrics as metrics


class CalculatePage2DatesTest(TestCase):
    def test_configure_uses_dated_output_and_anchors(self) -> None:
        with TemporaryDirectory() as directory:
            metrics.configure("2026-08-10", Path(directory) / "holdings.csv")
            self.assertEqual(metrics.AS_OF, date(2026, 8, 10))
            self.assertEqual(metrics.ANCHORS["6m"], date(2026, 2, 10))
            self.assertEqual(metrics.OUT.name, "20260810")

    def test_stale_holdings_are_blocked(self) -> None:
        with TemporaryDirectory() as directory:
            path = Path(directory) / "holdings.csv"
            path.write_text("ticker,holdings_date,rank,holding_name,weight_pct,source_url\n161510,2026-07-01,1,A,10,https://example.test\n", encoding="utf-8-sig")
            metrics.configure("20260810", path)
            with self.assertRaisesRegex(ValueError, "HOLDINGS_MISSING_OR_STALE"):
                metrics.holding_summaries()

    def test_counts_weekday_sessions_for_holdings_age(self) -> None:
        self.assertEqual(metrics.business_days_apart(date(2026, 7, 31), date(2026, 8, 10)), 6)
