import json
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from scripts.verify_split_adjustment import verify_splits


class TestVerifySplitAdjustment(unittest.TestCase):
    def setUp(self):
        # Create temp dir within project or standard temp
        self.temp_dir = tempfile.mkdtemp()
        self.series_dir = os.path.join(self.temp_dir, "series")
        self.ca_file = os.path.join(self.temp_dir, "etf_corporate_actions.csv")
        self.master_file = os.path.join(self.temp_dir, "etf_master.csv")
        self.dist_file = os.path.join(self.temp_dir, "etf_distribution_events.csv")
        os.makedirs(self.series_dir, exist_ok=True)

        # Base master: 069500 (1X), 122630 (2X), 489030 (Covered Call)
        with open(self.master_file, "w", encoding="utf-8-sig") as f:
            f.write("ticker,name\n")
            f.write("069500,KODEX 200\n")
            f.write("122630,KODEX 레버리지\n")
            f.write("489030,PLUS 고배당주위클리커버드콜\n")

        # Empty corporate actions
        with open(self.ca_file, "w", encoding="utf-8-sig") as f:
            f.write("action_id,etf_id,ticker,action_type,effective_date,ratio_numerator,ratio_denominator,source_id,verification_status,supersedes_action_id,updated_at,note\n")

        # Empty distributions
        with open(self.dist_file, "w", encoding="utf-8-sig") as f:
            f.write("event_id,etf_id,ticker,etf_name,issuer_ex_date,krx_apply_date,ex_date,record_date,pay_date,distribution_per_share_krw,distribution_type,event_status,currency,ex_rights_reference_price_krw,issuer_source_id,krx_source_id,issuer_amount_verified,krx_ex_date_verified,verification_status,verification_note,supersedes_event_id,source_collected_at,updated_at\n")

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
            dist_file=self.dist_file,
        )
        self.assertEqual(len(cat2), 1)
        self.assertEqual(cat2[0]["ticker"], "069500")

    def test_distribution_ex_date_recognized_in_ledger(self):
        # Register an official distribution event (103 KRW) on 2026-07-30
        with open(self.dist_file, "a", encoding="utf-8-sig") as f:
            f.write("ev_1,etf_1,489030,PLUS 고배당주위클리커버드콜,2026-07-30,2026-07-30,2026-07-30,2026-07-31,2026-08-04,103,ordinary_cash,paid,KRW,,issuer_1,,true,false,partial,note,,2026-09-01,2026-09-17\n")

        # Price drops due to distribution on 2026-07-30
        p_dist = os.path.join(self.series_dir, "489030.json")
        with open(p_dist, "w", encoding="utf-8") as f:
            json.dump({"points": [{"date": "2026-07-29", "close": 10000}, {"date": "2026-07-30", "close": 9897}]}, f)

        cat1, cat2, cat3, cat4 = verify_splits(
            series_dir=self.series_dir,
            ca_file=self.ca_file,
            master_file=self.master_file,
            dist_file=self.dist_file,
        )
        self.assertEqual(len(cat2), 0)
        self.assertEqual(len(cat3), 0)
        self.assertEqual(len(cat1), 1)
        self.assertEqual(cat1[0]["ticker"], "489030")
        self.assertIn("Verified distribution ex-date", cat1[0]["reason"])


if __name__ == "__main__":
    unittest.main()
