import sys
from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase

import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from check_data_freshness import (
    latest_trading_day,
    load_holidays,
    main,
    read_bas_dt,
)

HEADER = "isin_cd,ticker,name,bas_dt\n"


def write_master(directory: Path, bas_dt: str) -> Path:
    path = directory / "master.csv"
    path.write_text(f"{HEADER}KR7069500007,069500,KODEX 200,{bas_dt}\n", encoding="utf-8")
    return path


class LatestTradingDayTest(TestCase):
    def test_uses_previous_weekday_on_a_normal_trading_day(self) -> None:
        # 2026-08-07 is a Friday; the last closed session is Thursday.
        self.assertEqual(latest_trading_day(date(2026, 8, 7), set()), date(2026, 8, 6))

    def test_skips_the_weekend(self) -> None:
        # Monday looks back to Friday, Saturday still looks back to Friday.
        self.assertEqual(latest_trading_day(date(2026, 8, 10), set()), date(2026, 8, 7))
        self.assertEqual(latest_trading_day(date(2026, 8, 8), set()), date(2026, 8, 7))

    def test_skips_a_listed_holiday(self) -> None:
        # Monday 2026-08-10 closed: Tuesday must look back to the prior Friday.
        expected = latest_trading_day(date(2026, 8, 11), {"20260810"})
        self.assertEqual(expected, date(2026, 8, 7))

    def test_skips_consecutive_holidays(self) -> None:
        holidays = {"20260810", "20260811", "20260812"}
        self.assertEqual(latest_trading_day(date(2026, 8, 13), holidays), date(2026, 8, 7))


class LoadHolidaysTest(TestCase):
    def test_ignores_comments_and_blank_lines(self) -> None:
        with TemporaryDirectory() as tmp:
            path = Path(tmp) / "holidays.txt"
            path.write_text("# 주석\n\n20260101\n20260303  # 대체공휴일\n", encoding="utf-8")
            self.assertEqual(load_holidays(path), {"20260101", "20260303"})

    def test_missing_file_is_treated_as_no_holidays(self) -> None:
        self.assertEqual(load_holidays(Path("does-not-exist.txt")), set())

    def test_rejects_malformed_dates(self) -> None:
        with TemporaryDirectory() as tmp:
            path = Path(tmp) / "holidays.txt"
            path.write_text("2026-01-01\n", encoding="utf-8")
            with self.assertRaises(ValueError):
                load_holidays(path)


class ShippedHolidayFileTest(TestCase):
    """Guard the checked-in calendar against typos on the yearly update."""

    PATH = Path("data/market_holidays.txt")

    def test_parses_and_contains_no_weekend_entries(self) -> None:
        holidays = load_holidays(self.PATH)
        self.assertTrue(holidays, "휴장일 목록이 비어 있습니다.")
        weekend = sorted(
            d for d in holidays
            if date(int(d[:4]), int(d[4:6]), int(d[6:])).weekday() >= 5
        )
        # Weekends are excluded automatically; listing one signals a wrong date.
        self.assertEqual(weekend, [], f"주말 날짜가 섞여 있습니다: {weekend}")

    def test_covers_the_2026_lunar_new_year_and_chuseok_closures(self) -> None:
        holidays = load_holidays(self.PATH)
        for expected in ("20260216", "20260217", "20260218", "20260924", "20260925"):
            self.assertIn(expected, holidays)

    def test_treats_2026_chuseok_monday_as_a_trading_day(self) -> None:
        # 2026 추석 연휴는 토요일과만 겹쳐 대체공휴일이 없다.
        holidays = load_holidays(self.PATH)
        self.assertNotIn("20260928", holidays)
        self.assertEqual(latest_trading_day(date(2026, 9, 29), holidays), date(2026, 9, 28))


class ReadBasDtTest(TestCase):
    def test_reads_the_first_row(self) -> None:
        with TemporaryDirectory() as tmp:
            path = write_master(Path(tmp), "20260806")
            self.assertEqual(read_bas_dt(path), "20260806")


class MainTest(TestCase):
    def run_main(self, bas_dt: str, today: str, holidays: str = "") -> int:
        import io
        from contextlib import redirect_stderr, redirect_stdout

        with TemporaryDirectory() as tmp:
            directory = Path(tmp)
            master = write_master(directory, bas_dt)
            holiday_file = directory / "holidays.txt"
            holiday_file.write_text(holidays, encoding="utf-8")

            argv = sys.argv
            sys.argv = [
                "check_data_freshness.py",
                "--master", str(master),
                "--holidays", str(holiday_file),
                "--today", today,
            ]
            f_out = io.StringIO()
            f_err = io.StringIO()
            try:
                with redirect_stdout(f_out), redirect_stderr(f_err):
                    return main()
            finally:
                sys.argv = argv

    def test_passes_when_snapshot_matches_last_trading_day(self) -> None:
        # Friday morning holding Thursday's close is the healthy steady state.
        self.assertEqual(self.run_main(bas_dt="20260806", today="20260807"), 0)

    def test_passes_over_the_weekend(self) -> None:
        self.assertEqual(self.run_main(bas_dt="20260807", today="20260808"), 0)

    def test_fails_after_a_single_missed_trading_day(self) -> None:
        # Friday still holding Wednesday's close: Thursday was missed.
        self.assertEqual(self.run_main(bas_dt="20260805", today="20260807"), 1)

    def test_holiday_entry_prevents_a_false_alarm(self) -> None:
        # Monday closed, so Tuesday holding Friday's close is correct.
        self.assertEqual(
            self.run_main(bas_dt="20260807", today="20260811", holidays="20260810\n"),
            0,
        )
