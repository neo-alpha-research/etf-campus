from pathlib import Path
from unittest import TestCase

from scripts.render_lead_magnet_release import default_output_dir, render_commands


class RenderLeadMagnetReleaseTest(TestCase):
    def test_stages_under_date_specific_directory(self) -> None:
        root = Path("C:/workspace")
        self.assertEqual(
            default_output_dir(root, "20260810"),
            root / "output" / "pdf" / "staging" / "20260810",
        )

    def test_runs_each_page_before_merging(self) -> None:
        commands = render_commands("python", Path("C:/workspace"))
        self.assertEqual([Path(command[-1]).name for command in commands], [
            "create_lead_magnet_page1.py",
            "create_lead_magnet_page2.py",
            "create_lead_magnet_page3.py",
            "merge_lead_magnet_pdf.py",
        ])
