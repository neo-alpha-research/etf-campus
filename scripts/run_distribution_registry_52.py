"""Run the first-wave 52-ETF issuer distribution collection pipeline.

This is a reproducible operator command for web-display distribution history.
It intentionally does not promote candidates to verified TR events.

Examples:
  python scripts/run_distribution_registry_52.py --dry-run
  python scripts/run_distribution_registry_52.py --sleep 0.5
  python scripts/run_distribution_registry_52.py --force --sleep 0.5
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from build_distribution_candidates import parse_supported_sources, validate as validate_candidates  # noqa: E402
from build_distribution_summaries import main as build_summaries  # noqa: E402
from collect_distribution_registry import (  # noqa: E402
    discover_targets,
    load_registry,
    read_csv,
    seed_registry_targets,
)
from collect_distribution_sources import TARGETS_PATH, collect_sources  # noqa: E402

REPORT_DIR = ROOT / "data" / "distributions" / "reports"
CANDIDATE_PATH = ROOT / "data" / "distributions" / "etf_distribution_event_candidates.csv"
EVIDENCE_PATH = ROOT / "data" / "distributions" / "etf_distribution_event_evidence.csv"
SUMMARY_PATH = ROOT / "data" / "distributions" / "etf_distribution_summaries.json"


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def registry_tickers() -> set[str]:
    return {ticker for source in load_registry() for ticker in source.get("tickers", [])}


def registry_root_ids() -> set[str]:
    return {f"issuer:registry:{source['source_key']}:root" for source in load_registry()}


def registry_source_ids() -> set[str]:
    rows = read_csv(TARGETS_PATH)
    return {
        row.get("source_id", "")
        for row in rows
        if row.get("source_id") and row.get("source_document_key", "").startswith("registry:")
    }


def load_count(path: Path, key: str | None = None) -> int:
    if not path.exists():
        return 0
    if path.suffix == ".json":
        payload = json.loads(path.read_text(encoding="utf-8"))
        if key:
            return int(payload.get(key, 0))
        return len(payload) if isinstance(payload, list) else 1
    import csv
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return sum(1 for _ in csv.DictReader(handle))


def run(args: argparse.Namespace) -> dict[str, object]:
    tickers = registry_tickers()
    if len(tickers) != 52:
        raise RuntimeError(f"first-wave registry must contain 52 unique tickers, got {len(tickers)}")

    result: dict[str, object] = {
        "runStartedAt": now(),
        "registryTickerCount": len(tickers),
        "dryRun": args.dry_run,
        "steps": [],
    }

    if args.dry_run:
        result["targetSourceCount"] = len(registry_source_ids() | registry_root_ids())
        result["message"] = "dry-run: no network collection or output mutation performed"
        return result

    seeded = seed_registry_targets()
    result["steps"].append({"name": "registry_seed", "result": seeded})

    roots = registry_root_ids()
    root_collection = collect_sources(force=args.force, sleep_seconds=args.sleep, source_ids=roots)
    result["steps"].append({"name": "registry_root_collection", "result": root_collection})

    discovered = discover_targets()
    result["steps"].append({"name": "registry_detail_discovery", "result": discovered})

    all_registry_sources = registry_source_ids()
    detail_collection = collect_sources(force=args.force, sleep_seconds=args.sleep, source_ids=all_registry_sources)
    result["steps"].append({"name": "registry_detail_collection", "result": detail_collection})

    parsed = parse_supported_sources()
    result["steps"].append({"name": "candidate_parse", "result": parsed})

    validation = validate_candidates()
    result["steps"].append({"name": "candidate_validate", "result": validation})
    if validation.get("error_count", 0):
        raise RuntimeError(f"candidate validation failed: {validation['error_count']} errors")

    build_summaries()
    result["outputCounts"] = {
        "candidateRows": load_count(CANDIDATE_PATH),
        "evidenceRows": load_count(EVIDENCE_PATH),
        "summaryTickers": load_count(SUMMARY_PATH, "summaryCount"),
    }
    result["runCompletedAt"] = now()
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Run first-wave 52 ETF distribution registry pipeline")
    parser.add_argument("--dry-run", action="store_true", help="Validate registry count without network or file mutation")
    parser.add_argument("--force", action="store_true", help="Re-fetch already collected registry documents")
    parser.add_argument("--sleep", type=float, default=0.5, help="Delay between official source requests")
    args = parser.parse_args()
    try:
        report = run(args)
        REPORT_DIR.mkdir(parents=True, exist_ok=True)
        report_path = REPORT_DIR / f"registry_52_run_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        report["reportPath"] = report_path.relative_to(ROOT).as_posix()
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        failure = {"status": "failed", "error": f"{type(error).__name__}: {error}", "failedAt": now()}
        print(json.dumps(failure, ensure_ascii=False, indent=2))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
