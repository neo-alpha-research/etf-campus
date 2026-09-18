import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path

from scripts.verify_split_adjustment import verify_splits


class TestVerifySplitAdjustment(unittest.TestCase):
    def setUp(self):
        # Create temp dir within project or standard temp
        self.temp_dir = tempfile.mkdtemp()
        self.series_dir = os.path.join(self.temp_dir, "series")
        self.ca_file = os.path.join(self.temp_dir, "etf_corporate_actions.csv")
        self.master_file = os.path.join(self.temp_dir, "etf_master.csv")
        os.makedirs(self.series_dir, exist_ok=True)

        # Base master: 069500 (1X), 122630 (2X)
        with open(self.master_file, "w", encoding="utf-8-sig") as f:
            f.write("ticker,name\n")
            f.write("069500,KODEX 200\n")
            f.write("122630,KODEX 레버리지\n")

        # Empty corporate actions
        with open(self.ca_file, "w", encoding="utf-8-sig") as f:
            f.write("action_id,etf_id,ticker,action_type,effective_date,ratio_numerator,ratio_denominator,source_id,verification_status,supersedes_action_id,updated_at,note\n")

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_clean_series_passes(self):
        # 069500 (1X) within 30%, 122630 (2X) with a 46% move (within 60%)
        p_1x = os.path.join(self.series_dir, "069500.json")
        with open(p_1x, "w", encoding="utf-8") as f:
            json.dump({"points": [{"date": "2026-07-30", "close": 10000}, {"date": "2026-07-31", "close": 12000}]}, f)

        p_2x = os.path.join(self.series_dir, "122630.json")
        with open(p_2x, "w", encoding="utf-8") as f:
            json.dump({"points": [{"date": "2026-07-30", "close": 10000}, {"date": "2026-07-31", "close": 14600}]}, f)

        cat1, cat2, cat3, cat4 = verify_splits(
            series_dir=self.series_dir,
            ca_file=self.ca_file,
            master_file=self.master_file,
        )
        self.assertEqual(len(cat2), 0)
        self.assertEqual(len(cat3), 0)
        self.assertEqual(len(cat4), 1)  # 122630's +46% verified market move

    def test_cat3_catches_1x_exceeding_30_pct(self):
        # 069500 (1X) with 35% jump (exceeds 30% legal limit)
        p_1x = os.path.join(self.series_dir, "069500.json")
        with open(p_1x, "w", encoding="utf-8") as f:
            json.dump({"points": [{"date": "2026-07-30", "close": 10000}, {"date": "2026-07-31", "close": 13500}]}, f)

        cat1, cat2, cat3, cat4 = verify_splits(
            series_dir=self.series_dir,
            ca_file=self.ca_file,
            master_file=self.master_file,
        )
        self.assertEqual(len(cat3), 1)
        self.assertEqual(cat3[0]["ticker"], "069500")
        self.assertEqual(cat3[0]["change_pct"], 35.0)

    def test_cat3_catches_2x_exceeding_60_pct(self):
        # 122630 (2X) with 65% jump (exceeds 60% legal limit)
        p_2x = os.path.join(self.series_dir, "122630.json")
        with open(p_2x, "w", encoding="utf-8") as f:
            json.dump({"points": [{"date": "2026-07-30", "close": 10000}, {"date": "2026-07-31", "close": 16500}]}, f)

        cat1, cat2, cat3, cat4 = verify_splits(
            series_dir=self.series_dir,
            ca_file=self.ca_file,
            master_file=self.master_file,
        )
        self.assertEqual(len(cat3), 1)
        self.assertEqual(cat3[0]["ticker"], "122630")
        self.assertEqual(cat3[0]["change_pct"], 65.0)

    def test_cat2_catches_unadjusted_corporate_action(self):
        # Register a 1:2 split in ledger
        with open(self.ca_file, "a", encoding="utf-8-sig") as f:
            f.write("act_1,etf_1,069500,stock_split,2026-07-31,2,1,KIND_01,official_verified,,,1:2 split\n")

        # Raw price drops by 50% (unadjusted cliff)
        p_1x = os.path.join(self.series_dir, "069500.json")
        with open(p_1x, "w", encoding="utf-8") as f:
            json.dump({"points": [{"date": "2026-07-30", "close": 20000}, {"date": "2026-07-31", "close": 10000}]}, f)

        cat1, cat2, cat3, cat4 = verify_splits(
            series_dir=self.series_dir,
            ca_file=self.ca_file,
            master_file=self.master_file,
        )
        self.assertEqual(len(cat2), 1)
        self.assertEqual(cat2[0]["ticker"], "069500")


if __name__ == "__main__":
    unittest.main()
