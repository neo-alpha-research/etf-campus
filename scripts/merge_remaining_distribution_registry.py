"""Merge the remaining-23 distribution registry into the main registry."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "data" / "distributions" / "distribution_source_registry.json"
EXTRA = ROOT / "data" / "distributions" / "distribution_source_registry_remaining_23.json"


def main() -> None:
    main_payload = json.loads(MAIN.read_text(encoding="utf-8"))
    extra_payload = json.loads(EXTRA.read_text(encoding="utf-8"))
    merged = {**main_payload}
    by_key = {source["source_key"]: source for source in main_payload.get("sources", [])}
    replaced = 0
    for source in extra_payload.get("sources", []):
        key = source["source_key"]
        if key in by_key:
            replaced += 1
        by_key[key] = source
    merged["sources"] = list(by_key.values())
    merged["schema_version"] = "1.1"
    merged["merged_remaining_23_at"] = "2026-08-16"
    MAIN.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"main_source_count": len(main_payload.get("sources", [])), "merged_source_count": len(merged["sources"]), "added_source_count": len(extra_payload.get("sources", [])) - replaced, "replaced_source_count": replaced}, ensure_ascii=False))


if __name__ == "__main__":
    main()
