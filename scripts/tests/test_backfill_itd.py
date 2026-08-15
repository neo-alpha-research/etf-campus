import argparse
import csv
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "backfill_itd.py"
spec = importlib.util.spec_from_file_location("backfill_itd", MODULE_PATH)
backfill_itd = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = backfill_itd
assert spec.loader is not None
spec.loader.exec_module(backfill_itd)


class BackfillItdTests(unittest.TestCase):
    def test_price_return_requires_two_positive_prices(self):
        self.assertEqual(backfill_itd.calculate_price_return(110.0, 100.0), 10.0)
        self.assertIsNone(backfill_itd.calculate_price_return(100.0, 0.0))
        self.assertIsNone(backfill_itd.calculate_price_return(None, 100.0))
        self.assertIsNone(backfill_itd.calculate_price_return(100.0, None))

    def test_official_history_uses_first_actual_trade_after_listing_date(self):
        with tempfile.TemporaryDirectory() as directory:
            data_dir = Path(directory) / "data"
            data_dir.mkdir()
            (data_dir / "etf_master_draft.csv").write_text(
                "isin_cd,ticker,name,close,bas_dt,listing_date,listing_date_source,listing_date_status\n"
                "KR7000000001,000001,테스트 ETF,110,20260814,2020-09-25,KRX KIND,verified_official\n",
                encoding="utf-8",
            )
            (data_dir / "etf_returns_draft.csv").write_text("ticker,name,r_itd\n000001,테스트 ETF,\n", encoding="utf-8")
            (data_dir / "listing_prices.json").write_text(json.dumps({"000001": 100}), encoding="utf-8")
            history = data_dir / "history.csv"
            history.write_text(
                "ticker,date,close,source,collected_at\n"
                "000001,2020-09-28,100,KRX Open API,2026-08-15T00:00:00+09:00\n"
                "000001,2026-08-14,110,KRX Open API,2026-08-15T00:00:00+09:00\n",
                encoding="utf-8",
            )
            audit = data_dir / "quality" / "itd_coverage_audit.csv"
            checkpoint = data_dir / "quality" / "itd_backfill_checkpoint.json"
            args = argparse.Namespace(
                data_dir=str(data_dir), audit_output=str(audit), checkpoint=str(checkpoint),
                history_csv=str(history), ticker=[], pre_2010_only=False, dry_run=False,
            )
            stats = backfill_itd.process(args)
            self.assertEqual(stats["itd_calculated"], 1)
            with (data_dir / "etf_returns_draft.csv").open(encoding="utf-8", newline="") as handle:
                row = next(csv.DictReader(handle))
            self.assertEqual(row["itd_anchor_date"], "2020-09-28")
            self.assertEqual(row["r_itd"], "10")
            with audit.open(encoding="utf-8", newline="") as handle:
                audit_row = next(csv.DictReader(handle))
            self.assertEqual(audit_row["actual_first_trading_date"], "2020-09-28")
            self.assertEqual(audit_row["itd_calculation_status"], "calculated")

    def test_corporate_action_signal_holds_return_for_review(self):
        points = [
            backfill_itd.PricePoint("2020-01-02", 100.0, "KRX", ""),
            backfill_itd.PricePoint("2020-01-03", 220.0, "KRX", ""),
        ]
        self.assertEqual(backfill_itd.detect_corporate_action(points), "corporate_action_pending")

    def test_pre_2010_filter_only_selects_legacy_listings(self):
        with tempfile.TemporaryDirectory() as directory:
            data_dir = Path(directory) / "data"
            data_dir.mkdir()
            (data_dir / "etf_master_draft.csv").write_text(
                "isin_cd,ticker,name,close,bas_dt,listing_date\n"
                "KR7000000001,000001,과거 ETF,110,20260814,2009-12-30\n"
                "KR7000000002,000002,신규 ETF,110,20260814,2020-01-02\n",
                encoding="utf-8",
            )
            (data_dir / "etf_returns_draft.csv").write_text("ticker,name\n000001,과거 ETF\n000002,신규 ETF\n", encoding="utf-8")
            (data_dir / "listing_prices.json").write_text("{}", encoding="utf-8")
            args = argparse.Namespace(
                data_dir=str(data_dir), audit_output=str(data_dir / "quality" / "audit.csv"),
                checkpoint=str(data_dir / "quality" / "checkpoint.json"), history_csv=None,
                ticker=[], pre_2010_only=True, dry_run=True,
            )
            stats = backfill_itd.process(args)
            self.assertEqual(stats["total"], 1)
            self.assertEqual(stats["pre_2010"], 1)


if __name__ == "__main__":
    unittest.main()
