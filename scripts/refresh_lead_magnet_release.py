"""Safely refresh all three lead-magnet pages into a dated staging release."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

try:
    from scripts import calculate_page2_metrics as page2
    from scripts import validate_page3_holdings as page3_holdings
    from scripts.lead_magnet_dates import compact, parse_as_of
except ModuleNotFoundError:
    import calculate_page2_metrics as page2
    import validate_page3_holdings as page3_holdings
    from lead_magnet_dates import compact, parse_as_of


ROOT = Path(__file__).resolve().parents[1]


def command(python: str, script: str, *arguments: str) -> list[str]:
    return [python, str(ROOT / "scripts" / script), *arguments]


def preflight(as_of: str, page2_holdings: Path, page3_holdings_path: Path, page3_strategies: Path) -> None:
    """Validate manual official disclosures before any generated file is touched."""
    page2.configure(as_of, page2_holdings)
    page2.holding_summaries()

    selected = page3_holdings.read_csv(
        ROOT / "data" / "lead_magnet" / "generated" / as_of / "selection_preview.csv"
    )
    holdings = page3_holdings.read_csv(page3_holdings_path)
    strategies = page3_holdings.read_csv(page3_strategies)
    page3_holdings.validate_holdings(selected, holdings, as_of)
    page3_holdings.validate_strategy_changes(selected, strategies)


def main() -> int:
    parser = argparse.ArgumentParser(description="Refresh the three-page ETF lead magnet safely.")
    parser.add_argument("--as-of", required=True, help="Reference date: YYYYMMDD or YYYY-MM-DD")
    parser.add_argument("--page2-holdings-file", type=Path, required=True)
    parser.add_argument("--page3-holdings-file", type=Path, required=True)
    parser.add_argument("--page3-strategies-file", type=Path, required=True)
    parser.add_argument("--collect", action="store_true", help="Collect fresh issuer sources after disclosure preflight passes")
    parser.add_argument(
        "--pdf-python",
        default=sys.executable,
        help="Python executable with pypdf/reportlab; defaults to the current Python",
    )
    args = parser.parse_args()

    as_of = compact(parse_as_of(args.as_of))
    preflight(as_of, args.page2_holdings_file, args.page3_holdings_file, args.page3_strategies_file)

    if args.collect:
        for script in (
            "collect_page1_performance_sources.py",
            "collect_page2_official_sources.py",
            "collect_page3_performance_sources.py",
        ):
            subprocess.run(command(sys.executable, script, "--as-of", as_of), cwd=ROOT, check=True)

    data_steps = (
        ("calculate_page1_total_return_metrics.py", ("--as-of", as_of)),
        ("calculate_page2_metrics.py", ("--as-of", as_of, "--holdings-file", str(args.page2_holdings_file))),
        ("calculate_page3_total_return_metrics.py", ("--as-of", as_of)),
        (
            "validate_page3_holdings.py",
            (
                "--as-of", as_of,
                "--holdings-file", str(args.page3_holdings_file),
                "--strategies-file", str(args.page3_strategies_file),
            ),
        ),
    )
    for script, extra in data_steps:
        subprocess.run(command(sys.executable, script, *extra), cwd=ROOT, check=True)
    subprocess.run(
        command(args.pdf_python, "render_lead_magnet_release.py", "--as-of", as_of),
        cwd=ROOT,
        check=True,
    )

    print(f"Lead-magnet staging release completed: {as_of}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
