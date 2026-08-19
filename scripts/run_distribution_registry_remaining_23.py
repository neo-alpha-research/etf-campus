"""Run the remaining 23-ETF issuer distribution registry pipeline.

Confirmed official sources are collected automatically. Sources marked
``discovery_required`` are seeded for review but are never used as a publish
source until an official URL is confirmed.

Examples:
  python scripts/run_distribution_registry_remaining_23.py --dry-run
  python scripts/run_distribution_registry_remaining_23.py --sleep 0.5
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
DATA_DIR = ROOT / "data" / "distributions"
EXTRA_REGISTRY_PATH = DATA_DIR / "distribution_source_registry_remaining_23.json"
MAIN_REGISTRY_PATH = DATA_DIR / "distribution_source_registry.json"
REPORT_DIR = DATA_DIR / "reports"
TARGETS_PATH = DATA_DIR / "collection_targets.csv"
CANDIDATE_PATH = DATA_DIR / "etf_distribution_event_candidates.csv"
EVIDENCE_PATH = DATA_DIR / "etf_distribution_event_evidence.csv"
SUMMARY_PATH = DATA_DIR / "etf_distribution_summaries.json"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import collect_distribution_registry as registry_runner  # noqa: E402
import collect_distribution_sources as source_collector  # noqa: E402
import distribution_registry_parser as registry_parser  # noqa: E402
from build_distribution_candidates import parse_supported_sources, validate as validate_candidates  # noqa: E402
from build_distribution_summaries import main as build_summaries  # noqa: E402


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def load_extra() -> dict:
    payload = read_json(EXTRA_REGISTRY_PATH)
    if len({ticker for source in payload["sources"] for ticker in source.get("tickers", [])}) != 23:
        raise RuntimeError("remaining registry must contain 23 unique tickers")
    return payload


def configure_merged_parser(extra: dict) -> Path:
    main = read_json(MAIN_REGISTRY_PATH)
    merged_path = DATA_DIR / ".runtime_distribution_registry_merged.json"
    by_key = {source["source_key"]: source for source in main.get("sources", [])}
    for source in extra.get("sources", []):
        by_key[source["source_key"]] = source
    merged = {"schema_version": "runtime", "sources": list(by_key.values())}
    merged_path.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    registry_parser.REGISTRY_PATH = merged_path
    return merged_path


def extra_source_ids(extra: dict) -> set[str]:
    keys = {
        str(source.get("source_key", "")).strip()
        for source in extra["sources"]
        if source.get("status") == "confirmed_official"
    }
    ids = {
        f"issuer:registry:{source['source_key']}:root"
        for source in extra["sources"]
        if source.get("status") == "confirmed_official" and str(source.get("url") or "").strip()
    }
    for row in registry_runner.read_csv(TARGETS_PATH):
        document_key = row.get("source_document_key", "")
        if (
            document_key.startswith("registry:")
            and document_key.split(":", 1)[1] in keys
            and str(row.get("source_url") or "").strip()
        ):
            ids.add(row.get("source_id", ""))
    return {source_id for source_id in ids if source_id}


def count_csv(path: Path) -> int:
    if not path.exists():
        return 0
    return len(registry_runner.read_csv(path))


def run(args: argparse.Namespace) -> dict[str, object]:
    extra = load_extra()
    merged_path = configure_merged_parser(extra)
    result: dict[str, object] = {
        "runStartedAt": now(),
        "registryTickerCount": 23,
        "confirmedSourceCount": sum(1 for source in extra["sources"] if source.get("status") == "confirmed_official"),
        "discoveryRequiredSourceCount": sum(1 for source in extra["sources"] if source.get("status") == "discovery_required"),
        "dryRun": args.dry_run,
        "steps": [],
    }
    try:
        registry_runner.REGISTRY_PATH = EXTRA_REGISTRY_PATH
        if args.dry_run:
            result["targetSourceCount"] = len(extra_source_ids(extra))
            result["message"] = "dry-run: no network collection or output mutation performed"
            return result

        seeded = registry_runner.seed_registry_targets()
        result["steps"].append({"name": "remaining_registry_seed", "result": seeded})
        source_ids = extra_source_ids(extra)
        result["steps"].append({"name": "target_selection", "result": {"source_count": len(source_ids)}})

        roots = {
            f"issuer:registry:{source['source_key']}:root"
            for source in extra["sources"]
            if source.get("status") == "confirmed_official" and str(source.get("url") or "").strip()
        }
        root_collection = source_collector.collect_sources(force=args.force, sleep_seconds=args.sleep, source_ids=roots)
        result["steps"].append({"name": "remaining_registry_root_collection", "result": root_collection})

        discovered = registry_runner.discover_targets()
        result["steps"].append({"name": "remaining_registry_detail_discovery", "result": discovered})

        source_ids = extra_source_ids(extra)
        detail_collection = source_collector.collect_sources(force=args.force, sleep_seconds=args.sleep, source_ids=source_ids)
        result["steps"].append({"name": "remaining_registry_detail_collection", "result": detail_collection})

        parsed = parse_supported_sources()
        result["steps"].append({"name": "candidate_parse", "result": parsed})
        validation = validate_candidates()
        result["steps"].append({"name": "candidate_validate", "result": validation})
        if validation.get("error_count", 0):
            raise RuntimeError(f"candidate validation failed: {validation['error_count']} errors")

        build_summaries()
        result["outputCounts"] = {
            "candidateRows": count_csv(CANDIDATE_PATH),
            "evidenceRows": count_csv(EVIDENCE_PATH),
            "summaryTickers": int(read_json(SUMMARY_PATH).get("summaryCount", 0)),
        }
        result["runCompletedAt"] = now()
        return result
    finally:
        if merged_path.exists():
            merged_path.unlink()


def main() -> int:
    parser = argparse.ArgumentParser(description="Run remaining 23 ETF distribution registry pipeline")
    parser.add_argument("--dry-run", action="store_true", help="Validate registry count without network or file mutation")
    parser.add_argument("--force", action="store_true", help="Re-fetch already collected registry documents")
    parser.add_argument("--sleep", type=float, default=0.5, help="Delay between official source requests")
    args = parser.parse_args()
    try:
        report = run(args)
        REPORT_DIR.mkdir(parents=True, exist_ok=True)
        report_path = REPORT_DIR / f"registry_remaining_23_run_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
        report["reportPath"] = report_path.relative_to(ROOT).as_posix()
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        failure = {"status": "failed", "error": f"{type(error).__name__}: {error}", "failedAt": now()}
        print(json.dumps(failure, ensure_ascii=False, indent=2))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
