from datetime import date
from unittest import TestCase

from scripts.collect_page1_performance_sources import source_window
from scripts.lead_magnet_dates import compact, parse_as_of, years_before


class LeadMagnetDatesTest(TestCase):
    def test_accepts_compact_and_dashed_dates(self) -> None:
        self.assertEqual(parse_as_of("20260810"), date(2026, 8, 10))
        self.assertEqual(parse_as_of("2026-08-10"), date(2026, 8, 10))

    def test_handles_leap_day_year_subtraction(self) -> None:
        self.assertEqual(years_before(date(2024, 2, 29), 1), date(2023, 2, 28))

    def test_page1_window_covers_three_year_anchor_with_margin(self) -> None:
        as_of, start = source_window("20260810")
        self.assertEqual(as_of, "20260810")
        self.assertLess(start, compact(years_before(date(2026, 8, 10), 3)))
