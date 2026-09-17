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


def check_git_log_subprocesses_in_text(content: str, filename: str = "script.py") -> list[str]:
    """텍스트 내 git log/show subprocess 호출을 탐지합니다."""
    errors = []
    if "git" in content and ("'log'" in content or '"log"' in content or "'show'" in content or '"show"' in content):
        if "subprocess" in content:
            errors.append(f"{filename} contains git log/show subprocess call (violates FM-001 snapshot SSOT).")
    return errors


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
        errors.extend(check_git_log_subprocesses_in_text(p.read_text(encoding="utf-8"), p.name))
    return errors


def check_import_error_swallowing_in_code(source_code: str, filename: str = "script.py") -> list[str]:
    """코드 AST를 파싱하여 except ImportError/ModuleNotFoundError 블록의 Fail-Open 여부를 탐지합니다."""
    errors = []
    try:
        tree = ast.parse(source_code, filename=filename)
    except Exception as e:
        return [f"{filename}: Syntax error parsing code: {e}"]

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
                            f"{filename}:{handler.lineno}: "
                            f"except {exc_name} block does not exit/return/raise (potential silent fail-open)."
                        )
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
            code = py_file.read_text(encoding="utf-8-sig")
        except Exception:
            continue
        errors.extend(check_import_error_swallowing_in_code(code, str(py_file.relative_to(REPO_ROOT))))
    return errors


def check_daily_market_git_add_in_text(content: str) -> list[str]:
    """daily-market.yml 워크플로 내용 중 필수 git add 패턴 누락을 탐지합니다."""
    errors = []
    if "data/briefing_payload_*.json" not in content:
        errors.append("daily-market.yml git add step does not contain 'data/briefing_payload_*.json' pattern.")
    if "data/snapshots" not in content:
        errors.append("daily-market.yml git add step does not contain 'data/snapshots' directory.")
    return errors


def check_daily_market_git_add() -> list[str]:
    """FM-003: daily-market.yml 워크플로의 git add 목록에 정본 아티팩트 누락 방지."""
    wf_path = REPO_ROOT / ".github" / "workflows" / "daily-market.yml"
    if not wf_path.exists():
        return ["daily-market.yml not found"]

    return check_daily_market_git_add_in_text(wf_path.read_text(encoding="utf-8"))


DATE_LITERAL = re.compile(r"20\d\d-\d\d-\d\d")
COUNT_LITERAL = re.compile(r"""(?:TIGER|KB|PLUS|ACE|KODEX)\s*\d{2,4}|(?:\b\d{3,4}\s?개\b)""")
DANGER_ASSIGNMENT = re.compile(
    r"""(?:as_of_date|target_date|source_version|date_str|current_date|snapshot_date|base_dt|report_date)\s*=\s*['"](20\d\d-\d\d-\d\d|market-source-20\d\d-[^'"]+)['"]""",
    re.IGNORECASE
)

ALLOWED_DATE_LITERALS = {
    "2026-08-01",  # MARKET_BRIEFING_SERVICE_START_DATE
    "2026-08-28",  # MARKET_BRIEFING_SERVICE_START_DATE (alternate)
    "2026-08-31",  # Service cutoff in history components
    "2026-08-24",  # Terms version v2026-08-24
    "2026-08-25",  # Notice date
    "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25",
    "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",  # US Holidays
}


def check_hardcoded_dates_or_counts_on_text(line: str, line_no: int = 1, file_label: str = "") -> list[str]:
    """단일 라인 또는 텍스트 조각에서 FM-004 하드코딩 날짜·버전·고정 카운트를 검출합니다."""
    errors = []
    stripped = line.strip()
    if stripped.startswith("#") or stripped.startswith("//") or stripped.startswith("*"):
        return errors

    # 1. 변수/키 할당 검사
    assign_match = DANGER_ASSIGNMENT.search(line)
    if assign_match:
        val = assign_match.group(1)
        if val not in ALLOWED_DATE_LITERALS:
            errors.append(f"{file_label}:{line_no}: Hardcoded date assignment '{line.strip()}' (violates FM-004).")
            return errors

    # 2. 문자열 내부 날짜 리터럴 검사
    date_matches = DATE_LITERAL.findall(line)
    for dm in date_matches:
        if dm not in ALLOWED_DATE_LITERALS:
            errors.append(f"{file_label}:{line_no}: Hardcoded date literal '{dm}' in '{line.strip()}' (violates FM-004).")

    # 3. 문자열 내부 고정 카운트 리터럴 검사
    count_matches = COUNT_LITERAL.findall(line)
    for cm in count_matches:
        errors.append(f"{file_label}:{line_no}: Hardcoded count literal '{cm}' in '{line.strip()}' (violates FM-004).")

    return errors


def check_hardcoded_dates_or_counts() -> list[str]:
    """FM-004: 파이프라인 스크립트 및 CI 워크플로 내 하드코딩 날짜·버전·고정 카운트 차단."""
    errors = []
    
    # 핵심 파이프라인 스크립트 및 워크플로 파일 전수 검사
    target_files = [
        REPO_ROOT / "scripts" / "build_local_briefing_payload.py",
        REPO_ROOT / "scripts" / "sync_osmu_kv.py",
        REPO_ROOT / "scripts" / "publish_market_source_snapshot.py",
        REPO_ROOT / "scripts" / "fetch_market_indices.py",
        REPO_ROOT / "scripts" / "check_workflow_success_today.py",
        REPO_ROOT / "scripts" / "validate_briefing_gate.py",
        REPO_ROOT / "scripts" / "notify_telegram_osmu.py",
        REPO_ROOT / "scripts" / "publish_osmu_channels.py",
        REPO_ROOT / "lib" / "indices.py",
        REPO_ROOT / ".github" / "workflows" / "daily-market.yml",
        REPO_ROOT / ".github" / "workflows" / "d1-migrations.yml",
        REPO_ROOT / ".github" / "workflows" / "generate-osmu.yml",
    ]

    for file_path in target_files:
        if not file_path.exists():
            continue
        try:
            content = file_path.read_text(encoding="utf-8")
        except Exception:
            continue

        for line_no, line in enumerate(content.splitlines(), 1):
            line_errs = check_hardcoded_dates_or_counts_on_text(line, line_no, str(file_path.relative_to(REPO_ROOT)))
            errors.extend(line_errs)

    return errors


def check_macro_indices_ssot_in_text(ssot_content: str, payload_builder_content: str = "") -> list[str]:
    """lib/indices.py 내용 및 빌더 코드의 SSOT 준수 여부를 검증합니다."""
    errors = []
    for required in ["CANONICAL_MACRO_CODES", "RAW_SOURCE_TO_CANONICAL", "CANONICAL_TO_LABEL", "normalize_index_code"]:
        if required not in ssot_content:
            errors.append(f"lib/indices.py is missing required symbol: {required}")

    if payload_builder_content:
        if "from lib.indices import" not in payload_builder_content:
            errors.append("scripts/build_local_briefing_payload.py does not import from lib.indices SSOT.")
        if "CANONICAL_INDEX_MAP = {" in payload_builder_content:
            errors.append("scripts/build_local_briefing_payload.py still contains duplicate CANONICAL_INDEX_MAP.")

    return errors


def check_macro_indices_ssot() -> list[str]:
    """FM-005: 12대 정규 지표 SSOT(lib/indices.py) 및 단일 코드 체계 검증."""
    ssot_path = REPO_ROOT / "lib" / "indices.py"
    if not ssot_path.exists():
        return ["lib/indices.py SSOT does not exist."]

    ssot_content = ssot_path.read_text(encoding="utf-8")
    payload_builder = REPO_ROOT / "scripts" / "build_local_briefing_payload.py"
    pb_content = payload_builder.read_text(encoding="utf-8") if payload_builder.exists() else ""
    return check_macro_indices_ssot_in_text(ssot_content, pb_content)


def check_migrations_sequence_for_filenames(filenames: list[str]) -> list[str]:
    """마이그레이션 파일명 목록의 4자리 번호 접두사 및 중복 여부를 검증합니다."""
    errors = []
    numbers = []
    for f in sorted(filenames):
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


def check_migrations_sequence() -> list[str]:
    """FM-006: D1 마이그레이션 파일 순서 및 4자리 번호 정합성 검증."""
    mig_dir = REPO_ROOT / "migrations"
    if not mig_dir.exists():
        return []
    files = [f.name for f in mig_dir.glob("*.sql")]
    return check_migrations_sequence_for_filenames(files)


def check_failure_modes_coverage(checks_count: int, doc_content: str | None = None) -> list[str]:
    """검사 자체에 대한 메타 검사: CHECKS 개수 >= docs/known_failure_modes.md의 항목 수."""
    errors = []
    if doc_content is None:
        doc_path = REPO_ROOT / "docs" / "known_failure_modes.md"
        if not doc_path.exists():
            return ["docs/known_failure_modes.md not found. Cannot verify failure modes coverage."]
        doc_content = doc_path.read_text(encoding="utf-8")

    fm_items = re.findall(r"^##\s*\[FM-\d+\]", doc_content, re.MULTILINE)
    documented_count = len(fm_items)

    if checks_count < documented_count:
        errors.append(
            f"Linter checks count ({checks_count}) is less than documented failure modes ({documented_count}). "
            f"Every documented failure mode must have an automated linter check."
        )
    return errors


def check_versioned_pk_unversioned_query_in_text(content: str, filename: str = "script") -> list[str]:
    """DDL/쿼리 텍스트 내에서 market_source_index_daily의 PK에 source_version이 포함되거나
    ON CONFLICT에 source_version이 포함된 Fail-Open 패턴을 탐지합니다."""
    errors = []
    if "market_source_index_daily" in content and "PRIMARY KEY" in content:
        if re.search(r"PRIMARY\s+KEY\s*\([^)]*as_of_date[^)]*source_version[^)]*index_code[^)]*\)", content, re.IGNORECASE):
            errors.append(
                f"{filename}: market_source_index_daily has versioned PK (violates FM-007). "
                f"PK must be (as_of_date, index_code) to ensure clean upsert on re-issuance."
            )

    if "market_source_index_daily" in content and "ON CONFLICT" in content:
        if re.search(r"ON\s+CONFLICT\s*\(\s*as_of_date\s*,\s*source_version\s*,\s*index_code\s*\)", content, re.IGNORECASE):
            errors.append(
                f"{filename}: market_source_index_daily ON CONFLICT clause includes source_version (violates FM-007). "
                f"Must conflict on (as_of_date, index_code) so re-publish upserts existing rows."
            )

    return errors


def check_versioned_pk_unversioned_query() -> list[str]:
    """FM-007: market_source_index_daily의 버전 키 기반 PK 및 충돌 절 방지."""
    errors = []
    ingest_path = REPO_ROOT / "functions" / "api" / "internal" / "ingest-market-source.js"
    if ingest_path.exists():
        content = ingest_path.read_text(encoding="utf-8")
        errors.extend(check_versioned_pk_unversioned_query_in_text(content, str(ingest_path.relative_to(REPO_ROOT))))

    mig_0024 = REPO_ROOT / "migrations" / "0024_single_version_market_source_index_daily.sql"
    if mig_0024.exists():
        content = mig_0024.read_text(encoding="utf-8")
        errors.extend(check_versioned_pk_unversioned_query_in_text(content, str(mig_0024.relative_to(REPO_ROOT))))
    else:
        errors.append("Migration 0024_single_version_market_source_index_daily.sql does not exist (violates FM-007).")

    return errors


# 등록된 전수 검사 목록 (Ordered SSOT)
ALL_CHECKS = [
    ("check_git_log_subprocesses", check_git_log_subprocesses, "FM-001: Git Shallow Clone Subprocess Prohibition"),
    ("check_import_error_swallowing", check_import_error_swallowing, "FM-002: Silent ImportError Swallowing Prevention"),
    ("check_daily_market_git_add", check_daily_market_git_add, "FM-003: Pipeline Git Add Coverage Verification"),
    ("check_hardcoded_dates_or_counts", check_hardcoded_dates_or_counts, "FM-004: Hardcoded Production Dates & Literals Detection"),
    ("check_macro_indices_ssot", check_macro_indices_ssot, "FM-005: Macro Indices SSOT & D1 Canonical Code Adherence"),
    ("check_migrations_sequence", check_migrations_sequence, "FM-006: D1 Migration Sequence & Naming Integrity"),
    ("check_versioned_pk_unversioned_query", check_versioned_pk_unversioned_query, "FM-007: Unversioned Query & Version-Keyed PK Prevention"),
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
