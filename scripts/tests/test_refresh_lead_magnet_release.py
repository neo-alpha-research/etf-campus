from pathlib import Path
from unittest import TestCase

from scripts.refresh_lead_magnet_release import command


class RefreshLeadMagnetReleaseTest(TestCase):
    def test_builds_script_command_without_shell_interpolation(self) -> None:
        result = command("python", "calculate_page1_total_return_metrics.py", "--as-of", "20260810")
        self.assertEqual(result[0], "python")
        self.assertEqual(Path(result[1]).name, "calculate_page1_total_return_metrics.py")
        self.assertEqual(result[2:], ["--as-of", "20260810"])
