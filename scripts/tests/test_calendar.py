#!/usr/bin/env python3
"""
scripts/tests/test_calendar.py

lib/calendar.py 모듈의 거래일 판정, 주말/휴장일 제외, 직전 거래일 역산, 만료 경고 단위 테스트.
"""

from __future__ import annotations

import unittest
from datetime import date
from pathlib import Path
import sys

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from lib.calendar import (
    is_trading_day,
    prev_trading_day,
    next_trading_day,
    check_calendar_expiry,
    normalize_market,
)


class TestTradingCalendar(unittest.TestCase):
    def test_normalize_market(self):
        self.assertEqual(normalize_market("kr"), "KRX")
        self.assertEqual(normalize_market("KOSPI"), "KRX")
        self.assertEqual(normalize_market("us"), "US")
        self.assertEqual(normalize_market("NASDAQ"), "US")
        with self.assertRaises(ValueError):
            normalize_market("EUROPE")

    def test_krx_trading_days(self):
        # 2026-09-18 is Friday (normal trading day)
        self.assertTrue(is_trading_day("KRX", "2026-09-18"))
        # 2026-09-19 is Saturday (weekend)
        self.assertFalse(is_trading_day("KRX", "2026-09-19"))
        # 2026-09-20 is Sunday (weekend)
        self.assertFalse(is_trading_day("KRX", "2026-09-20"))
        # 2026-09-24 is Thursday (Chuseok holiday)
        self.assertFalse(is_trading_day("KRX", "2026-09-24"))
        # 2026-09-25 is Friday (Chuseok holiday)
        self.assertFalse(is_trading_day("KRX", "2026-09-25"))
        # 2026-05-01 is Labor Day (KRX closed)
        self.assertFalse(is_trading_day("KRX", "2026-05-01"))

    def test_us_trading_days(self):
        # 2026-09-18 is Friday (normal trading day)
        self.assertTrue(is_trading_day("US", "2026-09-18"))
        # 2026-09-07 is Labor Day (US holiday)
        self.assertFalse(is_trading_day("US", "2026-09-07"))
        # 2026-11-26 is Thanksgiving (US holiday)
        self.assertFalse(is_trading_day("US", "2026-11-26"))
        # 2026-07-03 is Independence day observed (July 4 is Sat)
        self.assertFalse(is_trading_day("US", "2026-07-03"))

    def test_prev_trading_day(self):
        # Prev trading day for Monday 2026-09-21 should be Friday 2026-09-18
        self.assertEqual(prev_trading_day("KRX", "2026-09-21"), "2026-09-18")
        # Prev trading day for Monday 2026-09-28 (after Chuseok Thu 24, Fri 25, Sat 26, Sun 27)
        # should be Wednesday 2026-09-23
        self.assertEqual(prev_trading_day("KRX", "2026-09-28"), "2026-09-23")

    def test_calendar_expiry_check(self):
        # Valid as of 2026-09-18 (more than 1 year left until 2027-12-31)
        self.assertTrue(check_calendar_expiry(warning_months=3, as_of=date(2026, 9, 18)))
        # Warning when close to expiry (e.g. 2027-11-01 is within 2 months of 2027-12-31)
        self.assertFalse(check_calendar_expiry(warning_months=3, as_of=date(2027, 11, 1)))


if __name__ == "__main__":
    unittest.main()
