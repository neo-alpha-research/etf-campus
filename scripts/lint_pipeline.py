#!/usr/bin/env python3
"""
scripts/lint_pipeline.py

파이프라인 무결성 및 자동화 정적 검사 도구 (Pipeline Integrity Linter).
인적 실수(하드코딩 날짜, 커밋 대상 누락, ImportError 삼키기, 마이그레이션 순서 누락 등)를
CI 및 로컬에서 기계적으로 원천 차단합니다.

검사 항목 수(CHECKS)는 docs/known_failure_modes.md에 정의된 실패 유형 수 이상이어야 합니다.
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

REPO_ROOT = Path(__file__).resolve().parent.parent


def check_git_log_subprocesses() -> list[str]:
    """FM-001: CI shallow clone(fetch-depth: 1)에서 실패하는 git log/show subprocess 호출 방지."""
    errors = []
    target_files = [
        REPO_ROOT / "scripts" / "build_local_briefing_payload.py",
        REPO_ROOT / "scripts" / "sync_osmu_kv.py",
    ]
    for p in target_files:
        if not p.exists():
            continue
        content = p.read_text(encoding="utf-8")
        if "git" in content and ("'log'" in content or '"log"' in content or "'show'" in content or '"show"' in content):
            if "subprocess" in content:
                errors.append(f"{p.name} contains git log/show subprocess call (violates FM-001 snapshot SSOT).")
    return errors


def check_import_error_swallowing() -> list[str]:
    """FM-002: ImportError/ModuleNotFoundError 예외를 삼키고 경고만 찍는 Fail-Open 코드 차단."""
    errors = []
    scripts_dir = REPO_ROOT / "scripts"
    if not scripts_dir.exists():
        return errors

    # Whitelist of legitimate scraping library fallbacks (curl_cffi -> urllib/requests)
    whitelist = {
        "collect_distribution_sources.py",
        "collect_seibro_distributions.py",
    }

    for py_file in scripts_dir.rglob("*.py"):
        if py_file.name in whitelist or "_oneoff" in str(py_file):
            continue
        try:
            tree = ast.parse(py_file.read_text(encoding="utf-8"), filename=str(py_file))
        except Exception:
            continue

        for node in ast.walk(tree):
            if isinstance(node, ast.Try):
                for handler in node.handlers:
                    exc_name = ""
                    if isinstance(handler.type, ast.Name):
                        exc_name = handler.type.id
                    elif isinstance(handler.type, ast.Tuple):
                        exc_name = ",".join(elt.id for elt in handler.type.elts if isinstance(elt, ast.Name))

                    if "ImportError" in exc_name or "ModuleNotFoundError" in exc_name:
                        body_str = ast.dump(handler)
                        has_alternate_import = any(isinstance(stmt, (ast.Import, ast.ImportFrom)) for stmt in handler.body)
                        has_terminator = any(
                            term in body_str
                            for term in ("Return", "Raise", "sys.exit", "exit")
                        )
                        if not has_terminator and not has_alternate_import:
                            errors.append(
                                f"{py_file.relative_to(REPO_ROOT)}:{handler.lineno}: "
                                f"except {exc_name} block does not exit/return/raise (potential silent fail-open)."
                            )
    return errors


def check_daily_market_git_add() -> list[str]:
    """FM-003: daily-market.yml 워크플로의 git add 목록에 정본 아티팩트 누락 방지."""
    errors = []
    wf_path = REPO_ROOT / ".github" / "workflows" / "daily-market.yml"
    if not wf_path.exists():
        return ["daily-market.yml not found"]

    content = wf_path.read_text(encoding="utf-8")
    if "data/briefing_payload_*.json" not in content and "data/briefing_payload_" not in content:
        errors.append("daily-market.yml git add step does not contain 'data/briefing_payload_*.json' pattern.")
    
    if "data/snapshots" not in content:
        errors.append("daily-market.yml git add step does not contain 'data/snapshots' directory.")
        
    return errors


def check_hardcoded_dates_or_counts() -> list[str]:
    """FM-004: scripts/, components/, functions/, workers/ 내 하드코딩 날짜 및 스냅샷 버전 리터럴 차단."""
    errors = []
    target_dirs = ["scripts", "components", "functions", "workers"]
    
    # Whitelist of legitimate epoch/service start dates or calendar holidays
    allowed_literals = {
        "2026-08-01",  # MARKET_BRIEFING_SERVICE_START_DATE
        "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25",
        "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",  # Holidays
    }

    # Match dangerous hardcoded assignments: as_of_date = "2026-09-16", target_date = "...", source_version = "market-source-..."
    danger_pattern = re.compile(
        r"""(?:as_of_date|target_date|source_version|date_str|current_date)\s*=\s*['"](20\d\d-\d\d-\d\d|market-source-20\d\d-[^'"]+)['"]""",
        re.IGNORECASE
    )

    for dir_name in target_dirs:
        dir_path = REPO_ROOT / dir_name
        if not dir_path.exists():
            continue

        for file_path in dir_path.rglob("*"):
            # Exclusions: _oneoff, tests, __tests__, migrations, node_modules, and linter itself
            p_str = str(file_path).replace("\\", "/")
            if any(exc in p_str for exc in ["_oneoff/", "tests/", "__tests__/", "migrations/", "node_modules/", "lint_pipeline.py"]):
                continue
            if not file_path.is_file() or file_path.suffix not in [".py", ".ts", ".js", ".tsx"]:
                continue

            try:
                content = file_path.read_text(encoding="utf-8")
            except Exception:
                continue

            for line_no, line in enumerate(content.splitlines(), 1):
                stripped = line.strip()
                if stripped.startswith("#") or stripped.startswith("//") or stripped.startswith("*"):
                    continue
                match = danger_pattern.search(line)
                if match:
                    val = match.group(1)
                    if val not in allowed_literals:
                        errors.append(
                            f"{file_path.relative_to(REPO_ROOT)}:{line_no}: "
                            f"Hardcoded date/version assignment detected: '{line.strip()}' (Move to args or _oneoff/)."
                        )
    return errors


def check_macro_indices_ssot() -> list[str]:
    """FM-005: 12대 정규 지표 SSOT(lib/indices.py) 및 단일 코드 체계 검증."""
    errors = []
    ssot_path = REPO_ROOT / "lib" / "indices.py"
    if not ssot_path.exists():
        return ["lib/indices.py SSOT does not exist."]

    content = ssot_path.read_text(encoding="utf-8")
    for required in ["CANONICAL_MACRO_CODES", "RAW_SOURCE_TO_CANONICAL", "CANONICAL_TO_LABEL", "normalize_index_code"]:
        if required not in content:
            errors.append(f"lib/indices.py is missing required symbol: {required}")

    # Ensure build_local_briefing_payload.py uses lib.indices
    payload_builder = REPO_ROOT / "scripts" / "build_local_briefing_payload.py"
    if payload_builder.exists():
        pb_content = payload_builder.read_text(encoding="utf-8")
        if "from lib.indices import" not in pb_content:
            errors.append("scripts/build_local_briefing_payload.py does not import from lib.indices SSOT.")
        if "CANONICAL_INDEX_MAP = {" in pb_content:
            errors.append("scripts/build_local_briefing_payload.py still contains duplicate CANONICAL_INDEX_MAP.")

    return errors


def check_migrations_sequence() -> list[str]:
    """FM-006: D1 마이그레이션 파일 순서 및 4자리 번호 정합성 검증."""
    errors = []
    mig_dir = REPO_ROOT / "migrations"
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
    KNOWN_LEGACY_DUPLICATES = {12}  # Historical legacy duplicate
    for num, fname in numbers:
        if num in seen and num not in KNOWN_LEGACY_DUPLICATES:
            errors.append(f"Duplicate migration number {num:04d} in {fname}.")
        seen.add(num)

    return errors


def check_failure_modes_coverage(checks_count: int) -> list[str]:
    """검사 자체에 대한 메타 검사: CHECKS 개수 >= docs/known_failure_modes.md의 항목 수."""
    errors = []
    doc_path = REPO_ROOT / "docs" / "known_failure_modes.md"
    if not doc_path.exists():
        return ["docs/known_failure_modes.md not found. Cannot verify failure modes coverage."]

    content = doc_path.read_text(encoding="utf-8")
    fm_items = re.findall(r"^##\s*\[FM-\d+\]", content, re.MULTILINE)
    documented_count = len(fm_items)

    if checks_count < documented_count:
        errors.append(
            f"Linter checks count ({checks_count}) is less than documented failure modes ({documented_count}). "
            f"Every documented failure mode must have an automated linter check."
        )
    return errors


# 등록된 전수 검사 목록 (Ordered SSOT)
ALL_CHECKS = [
    ("check_git_log_subprocesses", check_git_log_subprocesses, "FM-001: Git Shallow Clone Subprocess Prohibition"),
    ("check_import_error_swallowing", check_import_error_swallowing, "FM-002: Silent ImportError Swallowing Prevention"),
    ("check_daily_market_git_add", check_daily_market_git_add, "FM-003: Pipeline Git Add Coverage Verification"),
    ("check_hardcoded_dates_or_counts", check_hardcoded_dates_or_counts, "FM-004: Hardcoded Production Dates & Literals Detection"),
    ("check_macro_indices_ssot", check_macro_indices_ssot, "FM-005: Macro Indices SSOT & D1 Canonical Code Adherence"),
    ("check_migrations_sequence", check_migrations_sequence, "FM-006: D1 Migration Sequence & Naming Integrity"),
]


def main() -> int:
    print("=" * 65)
    print("🛡️ [Lint Pipeline] Running Automated Pipeline Integrity Gate...")
    print("=" * 65)

    all_errors: list[str] = []

    # Run registered checks
    for name, func, desc in ALL_CHECKS:
        errs = func()
        if errs:
            all_errors.extend([f"[{name}] {e}" for e in errs])
            print(f"❌ [{desc}] FAILED ({len(errs)} issues)")
        else:
            print(f"✅ [{desc}] PASSED")

    # Meta-check: Verify CHECKS count >= known failure modes count
    meta_errors = check_failure_modes_coverage(len(ALL_CHECKS))
    if meta_errors:
        all_errors.extend([f"[Failure Modes Coverage] {e}" for e in meta_errors])
        print(f"❌ [Failure Modes Coverage] FAILED")
    else:
        print(f"✅ [Failure Modes Coverage] PASSED (Checks: {len(ALL_CHECKS)} >= Documented Modes)")

    print("=" * 65)
    if all_errors:
        print(f"❌ [LINT FAILED] Found {len(all_errors)} pipeline integrity violations:", file=sys.stderr)
        for err in all_errors:
            print(f"  * {err}", file=sys.stderr)
        return 1

    print("🚀 [LINT PASSED] Pipeline integrity is 100% verified across all failure modes.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
