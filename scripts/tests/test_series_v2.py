import csv
import glob
import json
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

SERIES_V2_DIR = ROOT_DIR / "public" / "data" / "series" / "v2"
DIST_CSV = ROOT_DIR / "data" / "distributions" / "etf_distribution_events.csv"
SAMPLE_TICKERS = ["069500", "360750", "133690", "488770", "161510"]


class TestSeriesV2(unittest.TestCase):
    def test_series_v2_fields_exist(self):
        """Test 1: Verify all required fields exist in v2 series files and manifest."""
        manifest_path = SERIES_V2_DIR / "manifest.json"
        self.assertTrue(manifest_path.exists(), "manifest.json must exist")
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        self.assertIn("asOf", manifest, "manifest must contain asOf")
        self.assertIn("tickers", manifest, "manifest must contain tickers map")

        required_fields = ["ticker", "startDate", "dates", "close", "tr", "netTr", "hasDistribution", "filled", "asOf"]

        for ticker in SAMPLE_TICKERS:
            full_path = SERIES_V2_DIR / f"{ticker}.json"
            recent_path = SERIES_V2_DIR / f"{ticker}.recent.json"

            self.assertTrue(full_path.exists(), f"{ticker}.json must exist")
            self.assertTrue(recent_path.exists(), f"{ticker}.recent.json must exist")

            with open(full_path, "r", encoding="utf-8") as f:
                full_data = json.load(f)
            with open(recent_path, "r", encoding="utf-8") as f:
                recent_data = json.load(f)

            for field in required_fields:
                self.assertIn(field, full_data, f"Field '{field}' missing in {ticker}.json")
                self.assertIn(field, recent_data, f"Field '{field}' missing in {ticker}.recent.json")

            self.assertEqual(full_data["ticker"], ticker)
            self.assertEqual(recent_data["ticker"], ticker)
            self.assertLessEqual(len(recent_data["dates"]), 250)
            self.assertIsInstance(full_data["filled"], list)
            self.assertIsInstance(recent_data["filled"], list)

    def test_series_v2_array_lengths_match(self):
        """Test 2: Verify array lengths of dates, close, tr, and netTr are strictly equal."""
        for ticker in SAMPLE_TICKERS:
            for suffix in [".json", ".recent.json"]:
                path = SERIES_V2_DIR / f"{ticker}{suffix}"
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)

                n_dates = len(data["dates"])
                self.assertEqual(len(data["close"]), n_dates, f"close length mismatch in {ticker}{suffix}")
                self.assertEqual(len(data["tr"]), n_dates, f"tr length mismatch in {ticker}{suffix}")
                self.assertEqual(len(data["netTr"]), n_dates, f"netTr length mismatch in {ticker}{suffix}")
                self.assertGreater(n_dates, 0, f"dates array should not be empty in {ticker}{suffix}")

                # Check that filled indices are within [0, n_dates - 1]
                for idx in data["filled"]:
                    self.assertIsInstance(idx, int)
                    self.assertTrue(0 <= idx < n_dates)

    def test_series_v2_has_distribution_ledger_fidelity(self):
        """Test 3: Verify hasDistribution matches data/distributions/etf_distribution_events.csv ledger exactly."""
        tickers_with_dist = set()
        if DIST_CSV.exists():
            with open(DIST_CSV, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for r in reader:
                    t = r.get("ticker") or r.get("code") or r.get("itemcode")
                    if t:
                        tickers_with_dist.add(t.strip())

        tr_files = glob.glob(str(SERIES_V2_DIR / "*.recent.json"))[:50]
        self.assertGreater(len(tr_files), 0)

        for tf in tr_files:
            ticker = Path(tf).name.replace(".recent.json", "").strip()
            with open(tf, "r", encoding="utf-8") as f:
                data = json.load(f)

            expected = ticker in tickers_with_dist
            self.assertEqual(
                data["hasDistribution"],
                expected,
                f"Fidelity mismatch for {ticker}: hasDistribution is {data['hasDistribution']} but ledger says {expected}",
            )

    def test_series_v2_locf_gap_filling(self):
        """Test 4: Verify that internal calendar gaps are filled with LOCF and recorded in filled array."""
        from scripts.generate_series_v2 import generate_series_v2

        with tempfile.TemporaryDirectory() as tmp_dir:
            fake_root = Path(tmp_dir) / "repo"
            fake_tr_dir = fake_root / "public" / "data" / "returns" / "tr_index"
            fake_tr_dir.mkdir(parents=True)

            # ETF A has complete dates: Day 1, Day 2, Day 3
            etf_a = {
                "points": [
                    {"date": "2026-01-02", "close": 10000, "tr_index": 10000, "net_tr_index": 10000},
                    {"date": "2026-01-05", "close": 10200, "tr_index": 10200, "net_tr_index": 10200},
                    {"date": "2026-01-06", "close": 10300, "tr_index": 10300, "net_tr_index": 10300},
                ]
            }
            # ETF B is suspended on Day 2 (2026-01-05 missing): Day 1, Day 3
            etf_b = {
                "points": [
                    {"date": "2026-01-02", "close": 20000, "tr_index": 20000, "net_tr_index": 20000},
                    {"date": "2026-01-06", "close": 20500, "tr_index": 20500, "net_tr_index": 20500},
                ]
            }

            with open(fake_tr_dir / "AAA.json", "w", encoding="utf-8") as f:
                json.dump(etf_a, f)
            with open(fake_tr_dir / "BBB.json", "w", encoding="utf-8") as f:
                json.dump(etf_b, f)

            generate_series_v2(fake_root)

            out_b = fake_root / "public" / "data" / "series" / "v2" / "BBB.json"
            self.assertTrue(out_b.exists())
            with open(out_b, "r", encoding="utf-8") as f:
                data_b = json.load(f)

            # BBB should now have 3 dates: 2026-01-02, 2026-01-05 (filled), 2026-01-06
            self.assertEqual(data_b["dates"], ["2026-01-02", "2026-01-05", "2026-01-06"])
            # 2026-01-05 should be LOCF from 2026-01-02 (20000)
            self.assertEqual(data_b["close"], [20000, 20000, 20500])
            self.assertEqual(data_b["tr"], [20000, 20000, 20500])
            # filled index should be [1]
            self.assertEqual(data_b["filled"], [1])

    def test_series_v2_quarantine_manifest(self):
        """Verify that tickers with corporate action anomalies are marked quarantined in manifest and fail-closed when requested."""
        from scripts.generate_series_v2 import generate_series_v2

        with tempfile.TemporaryDirectory() as tmp_dir:
            fake_root = Path(tmp_dir) / "repo"
            fake_tr_dir = fake_root / "public" / "data" / "returns" / "tr_index"
            fake_tr_dir.mkdir(parents=True)
            fake_ca_dir = fake_root / "data" / "corporate_actions"
            fake_ca_dir.mkdir(parents=True)
            fake_ca_csv = fake_ca_dir / "etf_corporate_actions.csv"

            # Corporate actions ledger with split for ticker SPLIT_ETF on 2026-07-31
            with open(fake_ca_csv, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(["action_id", "ticker", "action_type", "effective_date", "ratio_numerator", "ratio_denominator", "source_id", "verification_status"])
                writer.writerow(["ca_01", "SPLIT_ETF", "stock_split", "2026-07-31", "2", "1", "krx_test", "official_verified"])

            # SPLIT_ETF has unadjusted cliff on 2026-07-31 (10000 -> 5000: -50%)
            split_etf = {
                "points": [
                    {"date": "2026-07-30", "close": 10000, "tr_index": 10000, "net_tr_index": 10000},
                    {"date": "2026-07-31", "close": 5000, "tr_index": 5000, "net_tr_index": 5000},
                ]
            }
            # CLEAN_ETF has normal price
            clean_etf = {
                "points": [
                    {"date": "2026-07-30", "close": 10000, "tr_index": 10000, "net_tr_index": 10000},
                    {"date": "2026-07-31", "close": 10100, "tr_index": 10100, "net_tr_index": 10100},
                ]
            }

            with open(fake_tr_dir / "SPLIT_ETF.json", "w", encoding="utf-8") as f:
                json.dump(split_etf, f)
            with open(fake_tr_dir / "CLEAN_ETF.json", "w", encoding="utf-8") as f:
                json.dump(clean_etf, f)

            # When generate_series_v2 runs without fail_on_quarantine
            generate_series_v2(fake_root, fail_on_quarantine=False)

            manifest_path = fake_root / "public" / "data" / "series" / "v2" / "manifest.json"
            self.assertTrue(manifest_path.exists())
            with open(manifest_path, "r", encoding="utf-8") as f:
                manifest = json.load(f)

            self.assertIn("SPLIT_ETF", manifest["tickers"])
            q_entry = manifest["tickers"]["SPLIT_ETF"]
            self.assertIsInstance(q_entry, dict)
            self.assertEqual(q_entry["status"], "quarantined")
            self.assertIn("stock_split", q_entry["reason"])

            # When fail_on_quarantine is True (or omitted, default True), it must raise RuntimeError
            with self.assertRaises(RuntimeError) as exc_info:
                generate_series_v2(fake_root, fail_on_quarantine=True)
            self.assertIn("Gate Fail-Closed", str(exc_info.exception))

            # Omitting argument must default to fail-closed True
            with self.assertRaises(RuntimeError) as exc_info_default:
                generate_series_v2(fake_root)
            self.assertIn("Gate Fail-Closed", str(exc_info_default.exception))


if __name__ == "__main__":
    unittest.main()


