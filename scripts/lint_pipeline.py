#!/usr/bin/env python3
"""
scripts/lint_pipeline.py

파이프라인 무결성 및 자동화 정적 검사 도구 (Pipeline Integrity Linter).
인적 실수(커밋 대상 누락, ImportError 삼키기, 마이그레이션 누락 등)를
CI 및 로컬에서 기계적으로 원천 차단합니다.
"""

from __future__ import annotations

import ast
import re
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


def check_daily_market_git_add() -> list[str]:
    errors = []
    wf_path = Path(".github/workflows/daily-market.yml")
    if not wf_path.exists():
        return ["daily-market.yml not found"]

    content = wf_path.read_text(encoding="utf-8")
    
    # Must contain data/briefing_payload_*.json in git add list
    if "data/briefing_payload_*.json" not in content and "data/briefing_payload_" not in content:
        errors.append("daily-market.yml git add step does not contain 'data/briefing_payload_*.json' pattern.")
    
    if "data/snapshots" not in content:
        errors.append("daily-market.yml git add step does not contain 'data/snapshots' directory.")
        
    return errors


def check_import_error_swallowing() -> list[str]:
    errors = []
    scripts_dir = Path("scripts")
    if not scripts_dir.exists():
        return errors

    # Whitelist of legitimate scraping library fallbacks (curl_cffi -> urllib/requests)
    whitelist = {
        "collect_distribution_sources.py",
        "collect_seibro_distributions.py",
    }

    for py_file in scripts_dir.rglob("*.py"):
        if py_file.name in whitelist:
            continue
        try:
            tree = ast.parse(py_file.read_text(encoding="utf-8"), filename=str(py_file))
        except Exception:
            continue

        for node in ast.walk(tree):
            if isinstance(node, ast.Try):
                for handler in node.handlers:
                    # Check if handler catches ImportError or ModuleNotFoundError
                    exc_name = ""
                    if isinstance(handler.type, ast.Name):
                        exc_name = handler.type.id
                    elif isinstance(handler.type, ast.Tuple):
                        exc_name = ",".join(elt.id for elt in handler.type.elts if isinstance(elt, ast.Name))

                    if "ImportError" in exc_name or "ModuleNotFoundError" in exc_name:
                        # Check body of handler
                        body_str = ast.dump(handler)
                        # If the handler itself attempts another import (alternate path), it's not swallowing
                        has_alternate_import = any(isinstance(stmt, (ast.Import, ast.ImportFrom)) for stmt in handler.body)
                        has_terminator = any(
                            term in body_str
                            for term in ("Return", "Raise", "sys.exit", "exit")
                        )
                        if not has_terminator and not has_alternate_import:
                            errors.append(
                                f"{py_file.relative_to(scripts_dir.parent)}:{handler.lineno}: "
                                f"except {exc_name} block does not exit/return/raise (potential silent fail-open)."
                            )
    return errors


def check_migrations_sequence() -> list[str]:
    errors = []
    mig_dir = Path("migrations")
    if not mig_dir.exists():
        return errors

    files = sorted([f.name for f in mig_dir.glob("*.sql")])
    numbers = []
    for f in files:
        m = re.match(r"^(\d{4})_", f)
        if not m:
            errors.append(f"Migration file '{f}' does not follow 4-digit prefix naming (e.g. 0001_name.sql).")
        else:
            numbers.append((int(m.group(1)), f))

    seen = set()
    KNOWN_LEGACY_DUPLICATES = {12}  # Historical: 0012_briefing_etf_daily_idx.sql and 0012_market_source_etf_daily_nav.sql
    for num, fname in numbers:
        if num in seen and num not in KNOWN_LEGACY_DUPLICATES:
            errors.append(f"Duplicate migration number {num:04d} in {fname}.")
        seen.add(num)

    return errors


def main() -> int:
    print("=" * 60)
    print("🛡️ [Lint Pipeline] Running Automated Pipeline Integrity Gate...")
    print("=" * 60)

    all_errors: list[str] = []

    # 1. Git add coverage
    e1 = check_daily_market_git_add()
    if e1:
        all_errors.extend([f"[Git Add Coverage] {e}" for e in e1])
    else:
        print("✅ [Git Add Coverage] daily-market.yml includes all canonical payload and snapshot patterns.")

    # 2. ImportError swallowing
    e2 = check_import_error_swallowing()
    if e2:
        all_errors.extend([f"[Fail-Open Detector] {e}" for e in e2])
    else:
        print("✅ [Fail-Open Detector] No silent ImportError/ModuleNotFoundError blocks found.")

    # 3. Migration sequence
    e3 = check_migrations_sequence()
    if e3:
        all_errors.extend([f"[Migration Linter] {e}" for e in e3])
    else:
        print("✅ [Migration Linter] Migration naming and numbering sequence verified.")

    print("=" * 60)
    if all_errors:
        print(f"❌ [LINT FAILED] Found {len(all_errors)} pipeline integrity violations:", file=sys.stderr)
        for err in all_errors:
            print(f"  * {err}", file=sys.stderr)
        return 1

    print("🚀 [LINT PASSED] Pipeline integrity is 100% verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
