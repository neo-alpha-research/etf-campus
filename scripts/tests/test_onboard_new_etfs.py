import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'pipeline')))
from onboard_new_etfs import classify_etf, slug


class TestOnboardNewEtfs(unittest.TestCase):
    def setUp(self):
        self.existing_groups = {
            'PG-EQUITY-US-TECH': {
                'primary_peer_group_id': 'PG-EQUITY-US-TECH',
                'asset_family': '주식',
                'region_primary': '미국',
                'comparison_category': '산업·섹터',
                'strategy_structure': 'plain|neutral|1X',
            },
            'PG-RATE-KR-PARKING': {
                'primary_peer_group_id': 'PG-RATE-KR-PARKING',
                'asset_family': '금리·파킹',
                'region_primary': '해당없음',
                'comparison_category': '금리·파킹',
                'strategy_structure': 'rate_return|neutral|1X',
            }
        }

    def test_classify_parking_etf(self):
        row = {
            'ticker': '999001',
            'name': 'ACE CD금리액티브(합성)',
            'base_index': 'KAP CD금리 지수',
            'isin_cd': 'KR7999001001',
        }
        class_row, reg_row = classify_etf(row, self.existing_groups)
        self.assertEqual(class_row['asset_family'], '금리·파킹')
        self.assertEqual(class_row['region_primary'], '해당없음')
        self.assertEqual(class_row['payoff_structure'], 'rate_return')
        self.assertEqual(class_row['primary_peer_group_id'], 'PG-RATE-KR-PARKING')
        self.assertIsNone(reg_row)

    def test_classify_semiconductor_etf(self):
        row = {
            'ticker': '999002',
            'name': 'KODEX 미국AI반도체핵심공정',
            'base_index': 'S&P US Semiconductor',
            'isin_cd': 'KR7999002001',
        }
        class_row, reg_row = classify_etf(row, self.existing_groups)
        self.assertEqual(class_row['asset_family'], '주식')
        self.assertEqual(class_row['region_primary'], '미국')
        self.assertEqual(class_row['comparison_topic'], 'AI 반도체 & HBM')
        self.assertEqual(class_row['primary_peer_group_id'], 'PG-EQUITY-US-TECH')

    def test_classify_new_unmatched_etf_creates_isolated_pending_group(self):
        row = {
            'ticker': '999003',
            'name': 'SOL 미국원유선물인버스(H)',
            'base_index': 'S&P GSCI Crude Oil Inverse',
            'isin_cd': 'KR7999003001',
        }
        class_row, reg_row = classify_etf(row, {})
        self.assertEqual(class_row['asset_family'], '원자재')
        self.assertEqual(class_row['payoff_structure'], 'inverse')
        self.assertEqual(class_row['direction'], 'inverse')
        self.assertTrue(class_row['primary_peer_group_id'].startswith('PG-PENDING-999003'))
        self.assertIsNotNone(reg_row)
        self.assertEqual(reg_row['automatic_comparison_eligible'], 'N')

    def test_slug_deterministic(self):
        s1 = slug('0137V0')
        s2 = slug('0137V0')
        self.assertEqual(s1, s2)
        self.assertTrue(s1.startswith('0137V0-'))


if __name__ == '__main__':
    unittest.main()