import csv
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase

from scripts.create_lead_magnet_snapshot import create_snapshot


def write_csv(path: Path, fields: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


class LeadMagnetSnapshotTest(TestCase):
    def test_creates_isolated_staging_snapshot_and_manifest(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory)
            data_dir = root / "data"
            data_dir.mkdir()
            write_csv(
                data_dir / "etf_master_draft.csv",
                ["isin_cd", "ticker", "name", "aum", "bas_dt"],
                [
                    {
                        "isin_cd": "KR7000000001",
                        "ticker": "000001",
                        "name": "테스트 ETF",
                        "aum": "10000000000",
                        "bas_dt": "20260810",
                    }
                ],
            )
            write_csv(
                data_dir / "etf_returns_draft.csv",
                ["ticker", "name", "close_20260810", "r_1m"],
                [{"ticker": "000001", "name": "테스트 ETF", "close_20260810": "10000", "r_1m": "1.25"}],
            )

            snapshot = create_snapshot(data_dir, root / "lead_magnet")

            self.assertEqual(snapshot.name, "20260810")
            self.assertTrue((snapshot / "etf_master_snapshot.csv").is_file())
            self.assertTrue((snapshot / "etf_returns_snapshot.csv").is_file())
            manifest = json.loads((snapshot / "source_manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["as_of_date"], "20260810")
            self.assertEqual(manifest["quality_summary"]["direct_aum_nonzero_count"], 1)
            self.assertEqual(manifest["snapshot_kind"], "processed_official_data_bootstrap")

    def test_rejects_mixed_master_dates(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory)
            data_dir = root / "data"
            data_dir.mkdir()
            write_csv(
                data_dir / "etf_master_draft.csv",
                ["ticker", "bas_dt"],
                [{"ticker": "000001", "bas_dt": "20260810"}, {"ticker": "000002", "bas_dt": "20260809"}],
            )
            write_csv(
                data_dir / "etf_returns_draft.csv",
                ["ticker", "close_20260810"],
                [{"ticker": "000001", "close_20260810": "10000"}],
            )

            with self.assertRaisesRegex(ValueError, "exactly one bas_dt"):
                create_snapshot(data_dir, root / "lead_magnet")

