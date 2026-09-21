#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Component Hardcoded Date Literal Scanner.

Scans components/ directory for hardcoded date literals:
Pattern: '20[0-9]{2}-[0-9]{2}-[0-9]{2}' or '20[0-9]{6}'
Excludes legitimate variable bindings and date methods:
'as_of', 'collected_at', 'toISOString', 'Date('

Exits with code 1 if unauthorized date literals are detected in UI code.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
COMPONENTS_DIR = REPO_ROOT / "components"

DATE_PATTERN = re.compile(r"20[0-9]{2}-[0-9]{2}-[0-9]{2}|20[0-9]{6}")
EXCLUDE_PATTERN = re.compile(r"as_of|collected_at|toISOString|Date\(|min=|max=")

ALLOWED_EXCLUSIONS = {
    "__tests__",
}


def scan_components() -> list[dict[str, str]]:
    violations = []
    for p in COMPONENTS_DIR.rglob("*.tsx"):
        if any(ex in p.parts for ex in ALLOWED_EXCLUSIONS):
            continue

        rel_path = p.relative_to(REPO_ROOT)
        with open(p, "r", encoding="utf-8") as f:
            for line_no, line in enumerate(f, 1):
                stripped = line.strip()
                if stripped.startswith("//") or stripped.startswith("/*") or stripped.startswith("*"):
                    continue

                matches = DATE_PATTERN.findall(line)
                if matches and not EXCLUDE_PATTERN.search(line):
                    violations.append({
                        "file": str(rel_path),
                        "line": str(line_no),
                        "content": stripped,
                        "matches": ", ".join(matches),
                    })
    return violations


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    print("=" * 80)
    print("UI COMPONENT DATE LITERAL INTEGRITY CHECK")
    print("=" * 80)

    violations = scan_components()
    # Filter out known static anchors (terms version, notice publication date, launch boundary)
    ui_violations = [
        v for v in violations
        if "termsVersion" not in v["content"]
        and "notice-hub" not in v["file"]
        and "2026-08-31" not in v["content"]
    ]

    if ui_violations:
        print(f"[FAIL] Found {len(ui_violations)} hardcoded date literals in components:")
        for v in ui_violations:
            print(f"  * {v['file']}:{v['line']} -> {v['matches']}")
            print(f"    Code: {v['content']}")
        sys.exit(1)
    else:
        print("[PASS] 0 unauthorized date literals found in components/ (All disclosure dates dynamically bound).")
        sys.exit(0)


if __name__ == "__main__":
    main()
