import csv
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase

from scripts.validate_lead_magnet_release import validate_dataset


def write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=["reference_date", "ticker"])
        writer.writeheader()
        writer.writerows(rows)


class LeadMagnetReleaseValidationTest(TestCase):
    def make_dataset(self, root: Path, as_of: str = "20260810") -> Path:
        dataset = root / as_of
        dataset.mkdir()
        for page, metrics, validation in (
            ("page1", "page1_performance_metrics.csv", "page1_performance_validation.json"),
            ("page2", "page2_metrics.csv", "page2_validation.json"),
            ("page3", "page3_performance_metrics.csv", "page3_performance_validation.json"),
        ):
            write_csv(dataset / metrics, [{"reference_date": "2026-08-10", "ticker": page}])
            (dataset / validation).write_text(
                json.dumps({"as_of": "2026-08-10", "status": "pass"}), encoding="utf-8"
            )
        return dataset

    def test_accepts_three_consistent_metric_sets(self) -> None:
        with TemporaryDirectory() as directory:
            errors, evidence = validate_dataset(self.make_dataset(Path(directory)), "20260810")
        self.assertEqual(errors, [])
        self.assertEqual([item["status"] for item in evidence], ["pass", "pass", "pass"])

    def test_blocks_mixed_reference_dates(self) -> None:
        with TemporaryDirectory() as directory:
            dataset = self.make_dataset(Path(directory))
            write_csv(dataset / "page2_metrics.csv", [{"reference_date": "2026-08-09", "ticker": "page2"}])
            errors, evidence = validate_dataset(dataset, "20260810")
        self.assertIn("PDF_DATASET_MISMATCH", errors)
        self.assertEqual(evidence[1]["status"], "failed")

    def test_blocks_missing_source_artifact(self) -> None:
        with TemporaryDirectory() as directory:
            dataset = self.make_dataset(Path(directory))
            (dataset / "page3_performance_validation.json").unlink()
            errors, evidence = validate_dataset(dataset, "20260810")
        self.assertIn("UNSOURCED_DISPLAY_VALUE", errors)
        self.assertEqual(evidence[2]["status"], "missing_required_artifact")
