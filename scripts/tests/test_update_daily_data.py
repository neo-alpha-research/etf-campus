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
