import unittest
from unittest import TestCase
import sys
from pathlib import Path

# Add repo root to path
ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.verify_zero_hallucination import normalize_date_str, verify_integrity


class VerifyZeroHallucinationTest(TestCase):
    def test_normalize_date_str(self):
        self.assertEqual(normalize_date_str("2026-09-04"), "2026-09-04")
        self.assertEqual(normalize_date_str("20260904"), "2026-09-04")
        self.assertEqual(normalize_date_str("2026.09.04"), "2026-09-04")
        self.assertEqual(normalize_date_str("2026/09/04"), "2026-09-04")
        self.assertIsNone(normalize_date_str(None))
        self.assertIsNone(normalize_date_str(""))
        self.assertIsNone(normalize_date_str("invalid_date"))
        self.assertIsNone(normalize_date_str("123"))

    def test_verify_integrity_passes_on_current_data(self):
        result = verify_integrity()
        self.assertTrue(result, "verify_integrity should return True on valid repository datasets")


if __name__ == "__main__":
    unittest.main()
