"""Render a dated three-page lead-magnet release into a non-production folder.

The command never overwrites ``output/pdf`` by default.  It first validates
the dated calculated data, renders all pages into a staging directory, merges
them, and validates the resulting PDFs.  Promotion is intentionally a later,
human-approved operation.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

try:
    from scripts.validate_lead_magnet_release import compact_date, validate_dataset, validate_pdfs
except ModuleNotFoundError:  # Direct execution: python scripts/render_lead_magnet_release.py
    from validate_lead_magnet_release import compact_date, validate_dataset, validate_pdfs


ROOT = Path(__file__).resolve().parents[1]
RENDERERS = (
    "create_lead_magnet_page1.py",
    "create_lead_magnet_page2.py",
    "create_lead_magnet_page3.py",
    "merge_lead_magnet_pdf.py",
)


def default_output_dir(root: Path, as_of: str) -> Path:
    return root / "output" / "pdf" / "staging" / as_of


def render_commands(python: str, root: Path) -> list[list[str]]:
    return [[python, str(root / "scripts" / script)] for script in RENDERERS]


def main() -> int:
    parser = argparse.ArgumentParser(description="Render a dated ETF lead-magnet release into staging.")
    parser.add_argument("--as-of", required=True, help="Reference date: YYYYMMDD or YYYY-MM-DD")
    parser.add_argument("--output-dir", type=Path, help="Staging directory; default is output/pdf/staging/YYYYMMDD")
    parser.add_argument("--root", type=Path, default=ROOT, help="Repository root, mainly for controlled test runs")
    args = parser.parse_args()

    as_of = compact_date(args.as_of)
    root = args.root.resolve()
    output_dir = (args.output_dir or default_output_dir(root, as_of)).resolve()
    dataset_dir = root / "data" / "lead_magnet" / "generated" / as_of
    errors, _ = validate_dataset(dataset_dir, as_of)
    if errors:
        raise RuntimeError(f"Release data is not ready: {', '.join(errors)}")

    output_dir.mkdir(parents=True, exist_ok=True)
    environment = os.environ.copy()
    environment["LEAD_MAGNET_AS_OF"] = as_of
    environment["LEAD_MAGNET_OUTPUT_DIR"] = str(output_dir)
    for command in render_commands(sys.executable, root):
        subprocess.run(command, cwd=root, env=environment, check=True)

    pdf_errors, _ = validate_pdfs(output_dir)
    if pdf_errors:
        raise RuntimeError(f"Rendered PDFs are not release-ready: {', '.join(pdf_errors)}")
    print(output_dir / "etf-campus-3-page-etf-lead-magnet.pdf")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
