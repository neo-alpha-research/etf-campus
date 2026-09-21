"""Run the deterministic distribution refresh after the daily ETF price snapshot.

The script intentionally never publishes data itself. It runs the existing
collection, reconciliation, return-generation and validation commands in a
fixed order, records an audit report, and exits non-zero on the first failure.
The GitHub workflow decides whether the resulting changed files are tested and
committed.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PYTHON = sys.executable
KST = timezone(timedelta(hours=9))
LOCK_PATH = ROOT / "data" / "distributions" / ".daily_distribution_update.lock"
REPORT_PATH = ROOT / "data" / "distributions" / "reports" / "daily_distribution_update_latest.json"
OFFICIAL_SOURCE_REPORT_PATH = ROOT / "data" / "distributions" / "reports" / "official_source_collection_latest.json"


def command_steps(skip_collect: bool) -> list[tuple[str, list[str]]]:
    steps: list[tuple[str, list[str]]] = []
    if not skip_collect:
        steps.extend(
            [
                ("seibro_distribution_collection", [PYTHON, "scripts/collect_seibro_distributions.py", "--days", "90"]),
                ("distribution_registry_seed", [PYTHON, "scripts/collect_distribution_registry.py", "seed"]),
                ("official_source_collection", [PYTHON, "scripts/collect_distribution_sources.py", "run"]),
                ("distribution_registry_discovery", [PYTHON, "scripts/collect_distribution_registry.py", "discover"]),
                ("registry_detail_collection", [PYTHON, "scripts/collect_distribution_sources.py", "collect"]),
            ]
        )
    steps.extend(
        [
            ("candidate_parse", [PYTHON, "scripts/build_distribution_candidates.py", "run"]),
            ("kind_notice_reconciliation", [PYTHON, "scripts/reconcile_kind_distribution_notices.py", "run"]),
            ("kind_event_reconciliation", [PYTHON, "scripts/reconcile_kind_distribution_events.py", "run"]),
            ("distribution_detail_summaries", [PYTHON, "scripts/build_distribution_summaries.py"]),
            ("estimated_distribution_returns", [PYTHON, "scripts/calculate_estimated_distribution_returns.py"]),
            ("verified_total_return_history", [PYTHON, "scripts/calculate_total_return_history.py"]),
            ("return_display_status", [PYTHON, "scripts/build_return_display_status.py"]),
            ("source_validation", [PYTHON, "scripts/collect_distribution_sources.py", "validate"]),
            ("candidate_validation", [PYTHON, "scripts/build_distribution_candidates.py", "validate"]),
            ("kind_notice_validation", [PYTHON, "scripts/reconcile_kind_distribution_notices.py", "validate"]),
            ("kind_event_validation", [PYTHON, "scripts/reconcile_kind_distribution_events.py", "validate"]),
            ("zero_hallucination_validation", [PYTHON, "scripts/verify_zero_hallucination.py"]),
        ]
    )
    return steps


def write_report(report: dict) -> None:
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = REPORT_PATH.with_suffix(".tmp")
    temporary.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, REPORT_PATH)


def acquire_lock() -> None:
    LOCK_PATH.parent.mkdir(parents=True, exist_ok=True)
    try:
        with LOCK_PATH.open("x", encoding="utf-8") as handle:
            handle.write(f"pid={os.getpid()} started_at={datetime.now(KST).isoformat()}\n")
    except FileExistsError as error:
        raise RuntimeError(f"daily distribution update is already running: {LOCK_PATH}") from error


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the daily distribution update pipeline.")
    parser.add_argument(
        "--skip-collect",
        action="store_true",
        help="Skip network collection and only rebuild/validate existing source data.",
    )
    args = parser.parse_args()

    started = datetime.now(KST)
    report: dict[str, object] = {
        "run_id": started.strftime("daily-distribution-%Y%m%d-%H%M%S"),
        "started_at_kst": started.isoformat(),
        "status": "running",
        "skip_collect": bool(args.skip_collect),
        "steps": [],
    }
    acquire_lock()
    try:
        for name, command in command_steps(args.skip_collect):
            step_started = time.monotonic()
            process = subprocess.run(
                command,
                cwd=ROOT,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                check=False,
            )
            output = process.stdout[-12000:]
            step = {
                "name": name,
                "command": command,
                "exit_code": process.returncode,
                "duration_seconds": round(time.monotonic() - step_started, 3),
                "output_tail": output,
            }
            report["steps"].append(step)
            if process.returncode != 0:
                report["status"] = "failed"
                report["failed_step"] = name
                report["finished_at_kst"] = datetime.now(KST).isoformat()
                write_report(report)
                print(json.dumps({
                    "status": "failed",
                    "failed_step": name,
                    "exit_code": process.returncode,
                    "diagnostic_report": str(REPORT_PATH.relative_to(ROOT)),
                    "official_source_report": str(OFFICIAL_SOURCE_REPORT_PATH.relative_to(ROOT)) if name == "official_source_collection" else None,
                }, ensure_ascii=False))
                print(output)
                raise RuntimeError(f"distribution update failed at {name}")

        report["status"] = "passed"
        report["finished_at_kst"] = datetime.now(KST).isoformat()
        write_report(report)
        print(json.dumps({"status": "passed", "report": str(REPORT_PATH.relative_to(ROOT))}, ensure_ascii=False))
    finally:
        LOCK_PATH.unlink(missing_ok=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"daily distribution update failed: {error}", file=sys.stderr)
        raise
