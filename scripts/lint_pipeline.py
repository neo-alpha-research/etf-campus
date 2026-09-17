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
import os
import re
import subprocess
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


def check_failure_modes_coverage(
    checks: list[tuple[str, Any, str]] | set[str] | int,
    doc_content: str | None = None,
) -> list[str]:
    """메타 게이트: ALL_CHECKS의 FM ID 집합과 docs/known_failure_modes.md의 ID 집합이 완전히 일치해야 합니다."""
    errors = []
    if doc_content is None:
        doc_path = REPO_ROOT / "docs" / "known_failure_modes.md"
        if not doc_path.exists():
            return ["docs/known_failure_modes.md not found. Cannot verify failure modes coverage."]
        doc_content = doc_path.read_text(encoding="utf-8")

    # Extract FM IDs from checks
    if isinstance(checks, set):
        checks_fms = checks
    elif isinstance(checks, int):
        # Backward-compatible if called with int count (e.g. legacy test)
        doc_fms = set(re.findall(r"^##\s*\[(FM-\d+)\]", doc_content, re.MULTILINE))
        if checks < len(doc_fms):
            return [f"Linter checks count ({checks}) is less than documented failure modes ({len(doc_fms)})."]
        return []
    else:
        checks_fms = set()
        for item in checks:
            desc = item[2] if len(item) > 2 else item[0]
            for m in re.findall(r"\b(FM-\d+)\b", str(desc)):
                checks_fms.add(m)

    # Extract FM IDs from doc
    doc_fms = set(re.findall(r"^##\s*\[(FM-\d+)\]", doc_content, re.MULTILINE))

    missing_in_checks = sorted(doc_fms - checks_fms)
    missing_in_doc = sorted(checks_fms - doc_fms)

    if missing_in_checks:
        errors.append(f"검사 누락: 문서에 정의되었으나 린터 검사가 구현되지 않은 실패 유형 {missing_in_checks}")
    if missing_in_doc:
        errors.append(f"문서 누락: 린터 검사에 등록되었으나 문서에 기술되지 않은 실패 유형 {missing_in_doc}")

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
    """FM-007: market_source_index_daily의 버전 키 기반 PK 및 충돌 절 방지.
    0024 및 이후 모든 migrations/*.sql (번호 >= 0024), 그리고
    functions/**/*.js 중 market_source_index_daily를 포함한 모든 파일을 동적으로 전수 스캔합니다.
    (0022 등 확정된 과거 이력 마이그레이션은 명시적 예외로 제외)
    """
    errors = []

    # 1. functions/**/*.js 중 market_source_index_daily를 포함하는 모든 파일 스캔
    functions_dir = REPO_ROOT / "functions"
    if functions_dir.exists():
        for js_file in sorted(functions_dir.rglob("*.js")):
            try:
                content = js_file.read_text(encoding="utf-8")
            except Exception:
                continue
            if "market_source_index_daily" in content:
                errors.extend(check_versioned_pk_unversioned_query_in_text(content, str(js_file.relative_to(REPO_ROOT))))

    # 2. migrations/*.sql 중 번호 >= 0024인 모든 파일 동적 스캔 (0022 등 확정된 과거 이력은 명시적 제외)
    # 반드시 0024는 존재해야 하며, 0024 이후의 어떤 마이그레이션에서도 versioned PK가 재도입되면 안 됨
    mig_dir = REPO_ROOT / "migrations"
    if mig_dir.exists():
        has_0024 = False
        for sql_file in sorted(mig_dir.glob("*.sql")):
            m = re.match(r"^(\d{4})_", sql_file.name)
            if not m:
                continue
            num = int(m.group(1))
            if num < 24:
                # 확정된 과거 레거시 마이그레이션 (0007, 0022 등) 명시적 제외
                continue
            if num == 24:
                has_0024 = True
            try:
                content = sql_file.read_text(encoding="utf-8")
            except Exception:
                continue
            errors.extend(check_versioned_pk_unversioned_query_in_text(content, str(sql_file.relative_to(REPO_ROOT))))

        if not has_0024:
            errors.append("Migration 0024_single_version_market_source_index_daily.sql does not exist (violates FM-007).")

    return errors


def check_untracked_pipeline_files_in_status(status_lines: list[str]) -> list[str]:
    """FM-008: untracked 파이프라인 파일 및 워크플로 탐지 (단위 테스트 가능한 순수 함수)."""
    errors = []
    for line in status_lines:
        line_clean = line.strip()
        if not line_clean.startswith("??"):
            continue
        path = line_clean[2:].strip().replace("\\", "/")
        if path.startswith((".github/workflows/", "scripts/")) and "_oneoff/" not in path:
            errors.append(f"untracked 파이프라인 파일: {path} (커밋 전까지 CI/스케줄에서 실행되지 않음 - violates FM-008)")
    return errors


def check_cron_workflows_on_default_branch(
    origin_ref: str = "origin/main",
    wf_dir: Path | None = None,
    origin_wfs: set[str] | None = None,
) -> list[str]:
    """FM-010: cron 스케줄을 가진 워크플로가 default branch(origin/main)에 존재하는지 검증 (Fail-Closed)."""
    errors = []
    target_dir = wf_dir if wf_dir is not None else (REPO_ROOT / ".github" / "workflows")
    if not target_dir.exists():
        return errors

    if origin_wfs is None:
        try:
            res = subprocess.run(
                ["git", "ls-tree", "--name-only", origin_ref, ".github/workflows/"],
                capture_output=True,
                text=True,
                cwd=str(REPO_ROOT),
            )
            if res.returncode != 0:
                return [
                    f"FM-010 Fail-Closed: Cannot inspect workflows on {origin_ref} "
                    f"(git ls-tree exited {res.returncode}: {res.stderr.strip()}). "
                    f"Ref must be available to verify cron workflow scheduling."
                ]
            origin_wfs = {Path(p.strip()).name for p in res.stdout.splitlines() if p.strip()}
        except Exception as e:
            return [f"FM-010 Fail-Closed: Exception inspecting workflows on {origin_ref}: {e}"]

    for wf_path in sorted(target_dir.glob("*.yml")):
        try:
            content = wf_path.read_text(encoding="utf-8")
        except Exception:
            continue
        if "cron:" in content and wf_path.name not in origin_wfs:
            errors.append(
                f"{wf_path.name} has cron schedule but is not present on {origin_ref}. "
                f"GitHub Actions scheduled triggers will NOT run until committed to default branch (violates FM-010)."
            )
    return errors


def check_untracked_pipeline_files() -> list[str]:
    """FM-008: 커밋되지 않은 워크플로/스크립트는 CI에서 실행되지 않는다 (로컬 pre-push 집행)."""
    try:
        res = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True, cwd=str(REPO_ROOT))
        if res.returncode != 0:
            return [f"git status failed: {res.stderr.strip()}"]
        return check_untracked_pipeline_files_in_status(res.stdout.splitlines())
    except Exception as e:
        return [f"Failed to run git status: {e}"]


def check_migration_workflow_deployment_gate_in_text(content: str, filename: str = "workflow") -> list[str]:
    """FM-009: d1-migrations.yml에 check_pages_deployment.py 게이트 실행 명령이 마이그레이션 스텝 앞에 존재하는지 검증."""
    errors = []
    mig_match = re.search(r"\bwrangler\s+d1\s+migrations\s+apply\b", content)
    if mig_match:
        mig_idx = mig_match.start()
        # 단순히 스텝 제목(name:)에 스크립트명이 언급된 것이 아니라, 실제 python 실행 명령이 존재하는지 정규식 검사
        gate_exec_match = re.search(r"\bpython3?\s+(?:scripts/)?check_pages_deployment\.py\b", content)
        if not gate_exec_match:
            errors.append(
                f"{filename}: Missing actual execution command 'python scripts/check_pages_deployment.py' "
                f"before D1 migrations (violates FM-009)."
            )
        elif gate_exec_match.start() > mig_idx:
            errors.append(
                f"{filename}: 'python scripts/check_pages_deployment.py' gate appears AFTER migration apply step (violates FM-009)."
            )
    return errors


def check_migration_workflow_deployment_gate() -> list[str]:
    """FM-009: 파괴적 스키마 변경 전 코드 배포 확인 게이트 검증."""
    wf_path = REPO_ROOT / ".github" / "workflows" / "d1-migrations.yml"
    if not wf_path.exists():
        return [".github/workflows/d1-migrations.yml does not exist (violates FM-009)."]
    content = wf_path.read_text(encoding="utf-8")
    return check_migration_workflow_deployment_gate_in_text(content, str(wf_path.relative_to(REPO_ROOT)))


def strip_sql_comments(sql: str) -> str:
    """SQL 본문에서 문자열 리터럴('...' 및 "...")을 온전히 보존하면서
    라인 주석(-- ...) 및 블록 주석(/* ... */)을 안전하게 제거합니다.
    문자열 내부의 '--' 또는 '/* */'를 주석으로 오인하여 잘라내는 오탐을 방지합니다.
    """
    literals: list[str] = []

    def repl_literal(match: re.Match) -> str:
        literals.append(match.group(0))
        return f"__SQL_LITERAL_{len(literals) - 1}__"

    # 1. 작은따옴표 문자열 ('' 이스케이프 포함) 및 큰따옴표 문자열 치환
    literal_pattern = re.compile(r"'(?:''|[^'])*'|\"(?:\"\"|[^\"])*\"")
    masked_sql = literal_pattern.sub(repl_literal, sql)

    # 2. 블록 주석 제거 (/* ... */)
    masked_sql = re.sub(r"/\*.*?\*/", "", masked_sql, flags=re.DOTALL)

    # 3. 라인 주석 제거 (-- ...)
    masked_sql = re.sub(r"--[^\r\n]*", "", masked_sql)

    # 4. 문자열 리터럴 복원
    for idx, lit in enumerate(literals):
        masked_sql = masked_sql.replace(f"__SQL_LITERAL_{idx}__", lit)

    return masked_sql


# 0001~0024: baseline 인프라 도입 이전 레거시 마이그레이션
# 0025: migration_baselines 테이블 자체를 신설한 마이그레이션
# 0026: 0024 사후 정정 마이그레이션 (baseline 인프라 확립 완료)
BASELINE_EXEMPT_MIGRATIONS = {f"{i:04d}" for i in range(1, 27)}


def check_destructive_migrations_baseline_in_text(content: str, filename: str = "migration.sql") -> list[str]:
    """FM-011: 파괴적 스키마/데이터 변경(DROP TABLE, ALTER TABLE, DELETE FROM 등) 시 migration_baselines 기록 여부 검증 (순수 함수).
    주석을 제거한 순수 실행 SQL 본문에서 DROP/ALTER TABLE 또는 DELETE FROM 탐지 시
    INSERT INTO migration_baselines, pre_count, post_count 3개 요소가 모두 존재하는지 전수 검증합니다.
    """
    errors = []
    clean_sql = strip_sql_comments(content)
    is_destructive = bool(re.search(r"\b(DROP\s+TABLE|ALTER\s+TABLE|DELETE\s+FROM)\b", clean_sql, re.IGNORECASE))
    if is_destructive:
        missing_elements = []
        if not re.search(r"\bINSERT\s+INTO\s+migration_baselines\b", clean_sql, re.IGNORECASE):
            missing_elements.append("INSERT INTO migration_baselines")
        if not re.search(r"\bpre_count\b", clean_sql, re.IGNORECASE):
            missing_elements.append("pre_count")
        if not re.search(r"\bpost_count\b", clean_sql, re.IGNORECASE):
            missing_elements.append("post_count")

        if missing_elements:
            errors.append(
                f"{filename}: Destructive migration contains schema alteration/drop/delete without complete baseline recording. "
                f"Missing required elements in executable SQL: {', '.join(missing_elements)} (violates FM-011). "
                f"Follow docs/migration_template.sql."
            )
    return errors


def check_destructive_migrations_baseline() -> list[str]:
    """FM-011: 파괴적 D1 마이그레이션 적용 시 migration_baselines 사전/사후 행수 기록 강제."""
    errors = []
    mig_dir = REPO_ROOT / "migrations"
    if not mig_dir.exists():
        return errors

    for sql_file in sorted(mig_dir.glob("*.sql")):
        m = re.match(r"^(\d{4})_", sql_file.name)
        if not m:
            continue
        prefix = m.group(1)
        if prefix in BASELINE_EXEMPT_MIGRATIONS:
            continue
        try:
            content = sql_file.read_text(encoding="utf-8")
        except Exception:
            continue
        errors.extend(check_destructive_migrations_baseline_in_text(content, sql_file.name))

    return errors


# FM-012: 작업 트리 전체 평문 시크릿 스캔 제외 디렉터리 SSOT
# 빌드/패키지 캐시 디렉터리 한정 제외. _archive/ 및 OSMU_Archive/는 스캔에 반드시 포함되어야 합니다.
SECRET_SCAN_DIR_EXEMPT = {
    ".git", "node_modules", ".next", "out", ".venv", "__pycache__",
    "coverage", ".wrangler", "dist",
}

# Firebase 공개 클라이언트 식별자는 보안 시크릿이 아닌 공개 모바일 앱 번들 식별자이므로 스캔 예외로 허용합니다.
SECRET_SCAN_EXEMPT = {"android/app/google-services.json"}

SECRET_PATTERNS = [
    ("Google API Key", re.compile(r"AIzaSy[A-Za-z0-9_-]{33}")),
    ("Gemini CLI Session Token", re.compile(r"AQ\.Ab8[A-Za-z0-9_-]{40,}")),
    ("Telegram Bot Token", re.compile(r"[0-9]{9,11}:AA[A-Za-z0-9_-]{33}")),
    ("Meta / Threads Access Token", re.compile(r"(?:THAAN|IGAAd)[A-Za-z0-9_-]{50,}")),
]


def check_working_tree_secrets_in_text(content: str, filename: str) -> list[str]:
    """단일 파일 텍스트에서 시크릿 패턴 검출 (순수 함수).
    보안을 위해 위반 메시지에 키 전문을 출력하지 않고 앞 12자만 마스킹하여 반환합니다.
    """
    norm_path = filename.replace("\\", "/")
    if norm_path in SECRET_SCAN_EXEMPT or norm_path.endswith("android/app/google-services.json"):
        return []

    errors = []
    for line_no, line in enumerate(content.splitlines(), start=1):
        for pattern_name, regex in SECRET_PATTERNS:
            m = regex.search(line)
            if m:
                matched_secret = m.group(0)
                masked_preview = matched_secret[:12] + "..."
                errors.append(
                    f"{filename}:{line_no}: 시크릿 패턴 '{pattern_name}' 검출 "
                    f"(앞 12자: {masked_preview}, violates FM-012)"
                )
    return errors


def check_working_tree_secrets() -> list[str]:
    """FM-012: 작업 트리 전체(추적·미추적 무관) 평문 시크릿 탐지."""
    errors = []

    for root, dirs, files in os.walk(REPO_ROOT):
        # Prune excluded directories in-place using module-level SSOT constant
        dirs[:] = [d for d in dirs if d not in SECRET_SCAN_DIR_EXEMPT]

        for fname in sorted(files):
            file_path = Path(root) / fname
            rel_path = file_path.relative_to(REPO_ROOT).as_posix()

            if rel_path in SECRET_SCAN_EXEMPT:
                continue

            # Cloudflare Wrangler(wrangler dev) 및 Node 로컬 개발 전용 환경설정 파일은
            # .gitignore 및 .githooks/pre-commit에서 이미 원천 차단되므로 로컬 작업 트리 스캔에서 제외
            # (접두 매칭으로 인한 오탐 제외 방지를 위해 정확 집합 + .env.* / .dev.vars.* 패턴으로 한정)
            if fname in {".env", ".dev.vars"} or fname.startswith(".env.") or fname.startswith(".dev.vars."):
                continue


            try:
                stat = file_path.stat()
                # 1MB 초과 대용량 데이터 파일은 텍스트 파싱 부하 방지 및 정적 시크릿 저장 용도가 아니므로 제외
                if stat.st_size > 1_048_576:
                    continue

                with open(file_path, "rb") as f:
                    chunk = f.read(8192)
                    # 첫 8KB에 NUL 바이트가 포함된 바이너리 파일은 skip
                    if b"\x00" in chunk:
                        continue
                    rest = f.read()
                    full_bytes = chunk + rest
                    text = full_bytes.decode("utf-8", errors="replace")

                file_errs = check_working_tree_secrets_in_text(text, rel_path)
                errors.extend(file_errs)
            except (OSError, UnicodeDecodeError):
                continue

    return errors


# FM-013: main 브랜치 WIP/checkpoint 커밋 유입 방지
WIP_COMMIT_PATTERN = re.compile(r"^(?:\S+\s+)?(wip|checkpoint|temp)[\(:]", re.IGNORECASE)

# 과거 브랜치 역병합 사고로 인해 main에 기포함된 과거 기준점 커밋 (Section 0 관측 사례: da0bccda, 444dce37)
# 0001~0026 마이그레이션 baseline 면제(FM-011)와 동일하게, FM-013 제정 이전 과거 이력은 기준선으로 보존합니다.
WIP_HISTORICAL_BASELINE_COMMITS = {"da0bccda", "80620aa4", "444dce37"}


def check_wip_commit_subjects(subjects: list[str]) -> list[str]:
    """커밋 한 줄 목록(hash message)에서 wip/checkpoint/temp 패턴 검출 (단위 테스트 가능한 순수 함수)."""
    errors = []
    for line in subjects:
        line_clean = line.strip()
        if not line_clean:
            continue
        if WIP_COMMIT_PATTERN.search(line_clean):
            errors.append(
                f"WIP commit detected: '{line_clean}' (violates FM-013 / 규율 10). "
                f"Squash or reword wip/checkpoint/temp commits before integrating into main."
            )
    return errors


def check_wip_commits_on_main(origin_ref: str = "origin/main", count: int = 30) -> list[str]:
    """FM-013: main 브랜치 최근 커밋에서 wip/checkpoint/temp 패턴 커밋 차단."""
    try:
        res = subprocess.run(
            ["git", "log", origin_ref, "--oneline", f"-n{count}"],
            capture_output=True,
            text=True,
            cwd=str(REPO_ROOT),
        )
        if res.returncode != 0:
            res = subprocess.run(
                ["git", "log", "main", "--oneline", f"-n{count}"],
                capture_output=True,
                text=True,
                cwd=str(REPO_ROOT),
            )
            if res.returncode != 0:
                return [f"FM-013 Fail-Closed: Cannot inspect git log on {origin_ref}: {res.stderr.strip()}"]

        lines = [line.strip() for line in res.stdout.splitlines() if line.strip()]
        non_baseline_lines = [
            line for line in lines
            if not any(line.startswith(c) for c in WIP_HISTORICAL_BASELINE_COMMITS)
        ]
        return check_wip_commit_subjects(non_baseline_lines)
    except Exception as e:
        return [f"FM-013 Fail-Closed: Exception inspecting git log: {e}"]


def check_exemption_disclosure_in_text(
    doc_content: str,
    required_exemptions: dict[str, set[str]] | None = None,
) -> list[str]:
    """FM-014: 코드 내 면제 대상 원소가 docs/known_failure_modes.md의 [검사 면제 목록 SSOT] 섹션에 공개되어 있는지 검증 (순수 함수)."""
    marker = "## [검사 면제 목록 SSOT]"
    if marker not in doc_content:
        return [f"'{marker}' section missing from failure modes document (violates FM-014)."]

    ssot_section = doc_content.split(marker, 1)[1]

    if required_exemptions is None:
        required_exemptions = {}
        for name, value in list(globals().items()):
            if re.search(r"(_EXEMPT|_BASELINE_|_EXCLUDE|_SKIP|_ALLOWLIST|_WHITELIST)", name) and isinstance(value, (set, frozenset)):
                required_exemptions[name] = set(value)
        if not required_exemptions:
            return ["No exemption constants discovered — FM-014 검사 자체가 무력화됨 (fail-closed)."]
        # FM-012는 상수 외에 .env / .dev.vars 를 코드에서 직접 스킵하므로 명시 추가
        required_exemptions.setdefault("SECRET_SCAN_EXEMPT", set()).update({".env", ".dev.vars"})

    errors = []
    for category, items in sorted(required_exemptions.items()):
        for item in sorted(items):
            if item not in ssot_section:
                errors.append(
                    f"{category} exemption '{item}' is not disclosed in '{marker}' section (violates FM-014)."
                )
    return errors


def check_exemption_disclosure() -> list[str]:
    """FM-014: 코드 내 모든 면제 상수(마이그레이션, 시크릿 스캔, WIP 베이스라인)의 SSOT 문서 공개 여부 검증."""
    doc_path = REPO_ROOT / "docs" / "known_failure_modes.md"
    if not doc_path.exists():
        return ["docs/known_failure_modes.md not found (violates FM-014)."]
    try:
        content = doc_path.read_text(encoding="utf-8")
    except Exception as e:
        return [f"Failed to read docs/known_failure_modes.md: {e}"]
    return check_exemption_disclosure_in_text(content)


# 등록된 전수 검사 목록 (Ordered SSOT)
ALL_CHECKS = [
    ("check_git_log_subprocesses", check_git_log_subprocesses, "FM-001: Git Shallow Clone Subprocess Prohibition"),
    ("check_import_error_swallowing", check_import_error_swallowing, "FM-002: Silent ImportError Swallowing Prevention"),
    ("check_daily_market_git_add", check_daily_market_git_add, "FM-003: Pipeline Git Add Coverage Verification"),
    ("check_hardcoded_dates_or_counts", check_hardcoded_dates_or_counts, "FM-004: Hardcoded Production Dates & Literals Detection"),
    ("check_macro_indices_ssot", check_macro_indices_ssot, "FM-005: Macro Indices SSOT & D1 Canonical Code Adherence"),
    ("check_migrations_sequence", check_migrations_sequence, "FM-006: D1 Migration Sequence & Naming Integrity"),
    ("check_versioned_pk_unversioned_query", check_versioned_pk_unversioned_query, "FM-007: Unversioned Query & Version-Keyed PK Prevention"),
    ("check_untracked_pipeline_files", check_untracked_pipeline_files, "FM-008: Untracked Pipeline & Workflow Files Prevention"),
    ("check_migration_workflow_deployment_gate", check_migration_workflow_deployment_gate, "FM-009: Pre-Migration Deployment Gate Enforcement"),
    ("check_cron_workflows_on_default_branch", check_cron_workflows_on_default_branch, "FM-010: Cron Workflow Default Branch Presence"),
    ("check_destructive_migrations_baseline", check_destructive_migrations_baseline, "FM-011: Destructive Schema Migration Baseline Enforcement"),
    ("check_working_tree_secrets", check_working_tree_secrets, "FM-012: Working Tree Plaintext Secret Detection"),
    ("check_wip_commits_on_main", check_wip_commits_on_main, "FM-013: WIP Commit on Main Branch Prohibition"),
    ("check_exemption_disclosure", check_exemption_disclosure, "FM-014: Exemption Disclosure SSOT Enforcement"),
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

    # Meta-check: Verify CHECKS ID set == known failure modes ID set
    meta_errors = check_failure_modes_coverage(ALL_CHECKS)
    if meta_errors:
        all_errors.extend([f"[Failure Modes Coverage] {e}" for e in meta_errors])
        print(f"❌ [Failure Modes Coverage] FAILED")
    else:
        print(f"✅ [Failure Modes Coverage] PASSED (Checks: {len(ALL_CHECKS)} == Documented Modes)")

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
