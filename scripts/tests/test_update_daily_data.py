from datetime import date
from unittest import TestCase
from unittest.mock import patch

from scripts import update_daily_data


class ResolveSnapshotTest(TestCase):
    def test_exact_mode_returns_none_instead_of_falling_back(self) -> None:
        cache: dict[str, dict[str, dict]] = {}

        with patch.object(update_daily_data, "fetch_snapshot", return_value={}) as fetch:
            result = update_daily_data.resolve_snapshot(
                "secret",
                date(2026, 7, 30),
                cache,
                require_exact_date=True,
            )

        self.assertIsNone(result)
        fetch.assert_called_once_with("secret", "20260730")

    def test_exact_mode_uses_the_requested_day(self) -> None:
        snapshot = {"069500": {"srtnCd": "069500"}}

        with patch.object(update_daily_data, "fetch_snapshot", return_value=snapshot):
            result = update_daily_data.resolve_snapshot(
                "secret",
                date(2026, 7, 30),
                {},
                require_exact_date=True,
            )

        self.assertEqual(result, ("20260730", snapshot))

    def test_reconciliation_mode_can_use_the_previous_trading_day(self) -> None:
        snapshot = {"069500": {"srtnCd": "069500"}}

        with patch.object(update_daily_data, "on_or_before", return_value=("20260729", snapshot)) as fallback:
            result = update_daily_data.resolve_snapshot(
                "secret",
                date(2026, 7, 30),
                {},
                require_exact_date=False,
            )

        self.assertEqual(result, ("20260729", snapshot))
        fallback.assert_called_once()


class PeriodAnchorTest(TestCase):
    def test_uses_the_latest_trading_close_on_or_before_the_period_start(self) -> None:
        history = [
            (date(2026, 6, 28), 9_800.0),
            (date(2026, 6, 30), 10_000.0),
            (date(2026, 7, 1), 10_100.0),
        ]

        self.assertEqual(
            update_daily_data.select_period_anchor(history, date(2026, 6, 30)),
            10_000.0,
        )

    def test_uses_the_first_trading_close_when_the_period_start_predates_listing(self) -> None:
        history = [
            (date(2026, 7, 8), 10_000.0),
            (date(2026, 7, 9), 10_200.0),
        ]

        self.assertEqual(
            update_daily_data.select_period_anchor(history, date(2026, 6, 30)),
            10_000.0,
        )


class ListingDateTest(TestCase):
    def test_accepts_only_api_listing_dates_in_yyyymmdd_format(self) -> None:
        self.assertEqual(update_daily_data.api_listing_date("20260731"), "20260731")
        self.assertEqual(update_daily_data.api_listing_date("2026-07-31"), "")
        self.assertEqual(update_daily_data.api_listing_date(None), "")
