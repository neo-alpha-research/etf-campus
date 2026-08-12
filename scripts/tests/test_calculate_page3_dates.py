from datetime import date
from unittest import TestCase

from scripts import calculate_page3_total_return_metrics as metrics


class CalculatePage3DatesTest(TestCase):
    def test_configure_sets_all_time_anchors_from_as_of(self) -> None:
        metrics.configure("2026-08-10")
        self.assertEqual(metrics.AS_OF, date(2026, 8, 10))
        self.assertEqual(metrics.SIX_MONTH_ANCHOR, date(2026, 2, 10))
        self.assertEqual(metrics.ONE_YEAR_ANCHOR, date(2025, 8, 10))
        self.assertEqual(metrics.OUT_DIR.name, "20260810")
