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

    def test_finds_the_first_snapshot_on_or_after_listing_date(self) -> None:
        snapshot = {"069500": {"srtnCd": "069500", "clpr": "10000"}}

        with patch.object(
            update_daily_data,
            "fetch_krx_snapshot",
            side_effect=[{}, snapshot],
        ) as fetch:
            result = update_daily_data.krx_on_or_after(
                "secret",
                date(2026, 7, 26),
                {},
            )

        self.assertEqual(result, ("20260727", snapshot))
        self.assertEqual(fetch.call_count, 2)

    def test_groups_listing_close_queries_by_listing_date(self) -> None:
        snapshot = {
            "069500": {"srtnCd": "069500", "clpr": "10000"},
            "114800": {"srtnCd": "114800", "clpr": "20000"},
        }
        listing_dates = {
            "069500": date(2026, 7, 27),
            "114800": date(2026, 7, 27),
        }

        with patch.object(
            update_daily_data,
            "krx_on_or_after",
            return_value=("20260727", snapshot),
        ) as fetch:
            closes = update_daily_data.resolve_listing_closes(
                listing_dates,
                source="KRX Open API",
                krx_auth_key="secret",
                service_key="",
                krx_cache={},
                public_cache={},
            )

        self.assertEqual(closes, {"069500": 10_000.0, "114800": 20_000.0})
        fetch.assert_called_once()

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


class KrxSnapshotTest(TestCase):
    def test_normalizes_krx_etf_daily_trade_fields(self) -> None:
        payload = {
            "OutBlock_1": [
                {
                    "BAS_DD": "20260731",
                    "ISU_CD": "069500",
                    "ISU_NM": "SAMPLE ETF",
                    "TDD_CLSPRC": "12,345",
                    "FLUC_RT": "1.25",
                    "ACC_TRDVAL": "9,876,543",
                    "INVSTASST_NETASST_TOTAMT": "123,456,789",
                    "IDX_IND_NM": "Sample Index",
                }
            ]
        }

        snapshot = update_daily_data.normalize_krx_snapshot(payload)

        self.assertEqual(
            snapshot["069500"],
            {
                "srtnCd": "069500",
                "itmsNm": "SAMPLE ETF",
                "clpr": "12345",
                "fltRt": "1.25",
                "trPrc": "9876543",
                "nPptTotAmt": "123456789",
                "bssIdxIdxNm": "Sample Index",
                "basDt": "20260731",
            },
        )

    def test_rejects_a_snapshot_that_is_materially_incomplete(self) -> None:
        self.assertFalse(update_daily_data.snapshot_is_complete({"A": {}}, 10))
        self.assertTrue(
            update_daily_data.snapshot_is_complete(
                {str(index): {} for index in range(9)},
                10,
            )
        )

    def test_preserves_the_verified_aum_when_krx_net_assets_are_blank(self) -> None:
        self.assertEqual(
            update_daily_data.resolve_aum_value(
                {"nPptTotAmt": ""},
                {"aum": "123456789000"},
            ),
            "123456789000",
        )

    def test_uses_the_current_krx_aum_when_it_is_valid(self) -> None:
        self.assertEqual(
            update_daily_data.resolve_aum_value(
                {"nPptTotAmt": "234,567,890,000"},
                {"aum": "123456789000"},
            ),
            "234567890000",
        )
