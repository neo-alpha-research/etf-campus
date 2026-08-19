from __future__ import annotations

import csv
import json
import tempfile
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

from scripts import collect_distribution_registry as registry


class RegistrySeedTest(TestCase):
    def test_skips_definitions_without_an_official_url(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            registry_path = root / "registry.json"
            targets_path = root / "targets.csv"
            registry_path.write_text(json.dumps({"sources": [
                {"source_key": "ready", "issuer": "READY", "url": "https://issuer.example/notices"},
                {"source_key": "pending", "issuer": "PENDING", "url": None, "status": "discovery_required"},
            ]}), encoding="utf-8")
            with targets_path.open("w", encoding="utf-8-sig", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=registry.TARGET_COLUMNS)
                writer.writeheader()
                writer.writerow({"source_id": "issuer:registry:pending:root", "source_url": ""})

            with patch.object(registry, "REGISTRY_PATH", registry_path), patch.object(registry, "TARGETS_PATH", targets_path):
                report = registry.seed_registry_targets()

            rows = registry.read_csv(targets_path)
            source_ids = {row["source_id"] for row in rows}
            self.assertIn("issuer:registry:ready:root", source_ids)
            self.assertNotIn("issuer:registry:pending:root", source_ids)
            self.assertEqual(report["unconfigured_skipped"], 1)
