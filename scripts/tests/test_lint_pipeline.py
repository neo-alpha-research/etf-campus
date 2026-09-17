#!/usr/bin/env python3
"""
scripts/tests/test_lint_pipeline.py

Pipeline Integrity Linter (scripts/lint_pipeline.py) 회귀 테스트 스위트.
docs/known_failure_modes.md에 등록된 6대 실패 모드(FM-001 ~ FM-006)의
실제 관측 사례(Code Snippet)를 린터가 반드시 검출함을 단위 테스트로 증명합니다.
"""

from __future__ import annotations

import re
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

# Ensure root directory is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.lint_pipeline import (
    ALL_CHECKS,
    BASELINE_EXEMPT_MIGRATIONS,
    check_git_log_subprocesses_in_text,
    check_import_error_swallowing_in_code,
    check_daily_market_git_add_in_text,
    check_hardcoded_dates_or_counts_on_text,
    check_macro_indices_ssot_in_text,
    check_migrations_sequence_for_filenames,
    check_versioned_pk_unversioned_query_in_text,
    check_untracked_pipeline_files_in_status,
    check_migration_workflow_deployment_gate_in_text,
    check_cron_workflows_on_default_branch,
    check_destructive_migrations_baseline_in_text,
    check_failure_modes_coverage,
    strip_sql_comments,
)



class TestPipelineLinterRegression(unittest.TestCase):
    """실제 발생했던 7대 장애 모드(FM-001 ~ FM-007) 재현 스니펫 검출 검증."""

    def test_fm001_detects_git_log_subprocesses(self):
        """FM-001: CI shallow clone에서 실패하는 git log/show subprocess 호출 탐지 검증."""
        # 2026-09-17 실제 발생했던 취약 코드 조각
        faulty_snippet = (
            "import subprocess\n"
            "log_res = subprocess.run(['git', 'log', '-n', '10', '--format=%H', 'data/etf_master_draft.csv'])\n"
            "show_res = subprocess.run(['git', 'show', f'{c}:data/etf_master_draft.csv'])\n"
        )
        errors = check_git_log_subprocesses_in_text(faulty_snippet, "build_local_briefing_payload.py")
        self.assertGreater(len(errors), 0, "FM-001 subprocess git log 호출이 검출되어야 합니다.")
        self.assertTrue(any("FM-001" in err or "git log/show" in err for err in errors))

        # 안전한 스냅샷 조회 코드
        safe_snippet = (
            "with open('data/snapshots/2026-09-16.csv') as f:\n"
            "    data = f.read()\n"
        )
        safe_errors = check_git_log_subprocesses_in_text(safe_snippet, "build_local_briefing_payload.py")
        self.assertEqual(len(safe_errors), 0, "정상적인 파일 읽기 코드는 오탐되지 않아야 합니다.")

    def test_fm002_detects_silent_import_error_swallowing(self):
        """FM-002: ImportError를 삼키고 경고만 찍은 뒤 속행하는 Fail-Open 코드 탐지 검증."""
        # 2026-09-17 실제 발생했던 취약 코드 조각
        faulty_snippet = (
            "import sys\n"
            "try:\n"
            "    from scripts.schemas.briefing_contract import BriefingContract\n"
            "except ImportError as e:\n"
            "    print(f'Warning: Could not import BriefingContract ({e}), proceeding with basic safety check.', file=sys.stderr)\n"
            "    # return 1 없음 -> 무검증 KV 업로드 속행\n"
        )
        errors = check_import_error_swallowing_in_code(faulty_snippet, "sync_osmu_kv.py")
        self.assertGreater(len(errors), 0, "FM-002 silent ImportError 삼키기가 검출되어야 합니다.")
        self.assertTrue(any("fail-open" in err or "does not exit/return/raise" in err for err in errors))

        # 정상 준수 코드 (sys.exit(1))
        compliant_exit = (
            "import sys\n"
            "try:\n"
            "    from scripts.schemas.briefing_contract import BriefingContract\n"
            "except ImportError as e:\n"
            "    print('Fatal import error', file=sys.stderr)\n"
            "    sys.exit(1)\n"
        )
        self.assertEqual(len(check_import_error_swallowing_in_code(compliant_exit, "test.py")), 0)

        # 정상 준수 코드 (return 1)
        compliant_return = (
            "def main():\n"
            "    try:\n"
            "        from scripts.schemas.briefing_contract import BriefingContract\n"
            "    except ImportError as e:\n"
            "        return 1\n"
        )
        self.assertEqual(len(check_import_error_swallowing_in_code(compliant_return, "test.py")), 0)

        # 정상 준수 코드 (대체 라이브러리 fallback import)
        compliant_fallback = (
            "try:\n"
            "    from curl_cffi import requests\n"
            "except ImportError:\n"
            "    import urllib.request\n"
        )
        self.assertEqual(len(check_import_error_swallowing_in_code(compliant_fallback, "test.py")), 0)

    def test_fm003_detects_git_add_exclusion(self):
        """FM-003: daily-market.yml git add 목록에서 정본 아티팩트 누락 탐지 검증."""
        # 2026-09-17 실제 발생했던 briefing_payload_*.json 누락 워크플로
        faulty_workflow = (
            "      - name: Commit and push changes\n"
            "        run: |\n"
            "          for file in data/snapshots data/briefing_payload_latest.json data/etf_master_draft.csv; do\n"
            "            if [ -e \"$file\" ]; then git add \"$file\"; fi\n"
            "          done\n"
        )
        errors = check_daily_market_git_add_in_text(faulty_workflow)
        self.assertGreater(len(errors), 0, "briefing_payload_*.json 패턴 누락이 검출되어야 합니다.")
        self.assertTrue(any("data/briefing_payload_*.json" in err for err in errors))

        # snapshots 디렉터리 누락 워크플로
        missing_snapshots = (
            "          git add data/briefing_payload_*.json data/briefing_payload_latest.json\n"
        )
        errors_snap = check_daily_market_git_add_in_text(missing_snapshots)
        self.assertTrue(any("data/snapshots" in err for err in errors_snap))

        # 정상 준수 워크플로
        compliant_workflow = (
            "          for file in data/snapshots data/briefing_payload_*.json data/briefing_payload_latest.json; do\n"
            "            if [ -e \"$file\" ]; then git add \"$file\"; fi\n"
            "          done\n"
        )
        self.assertEqual(len(check_daily_market_git_add_in_text(compliant_workflow)), 0)

    def test_fm004_detects_hardcoded_dates_and_counts(self):
        """FM-004: 파이프라인 및 워크플로 내 하드코딩 날짜·버전·고정 카운트 탐지 검증."""
        # 1. 실제 발생: 파이프라인 변수 할당
        err1 = check_hardcoded_dates_or_counts_on_text('as_of_date = "2026-09-16"', 1, "test.py")
        self.assertGreater(len(err1), 0, "as_of_date 하드코딩이 검출되어야 합니다.")

        # 2. 실제 발생: 소스 버전 할당
        err2 = check_hardcoded_dates_or_counts_on_text('source_version = "market-source-2026-09-16-bd9450dcf8ddb141"', 2, "test.py")
        self.assertGreater(len(err2), 0, "source_version 날짜 하드코딩이 검출되어야 합니다.")

        # 3. 실제 발생: 워크플로 input default 날짜
        err3 = check_hardcoded_dates_or_counts_on_text('default: "2026-09-16"', 9, "d1-migrations.yml")
        self.assertGreater(len(err3), 0, "워크플로 default 날짜 하드코딩이 검출되어야 합니다.")

        # 4. 실제 발생: UI 툴팁 정적 날짜
        err4 = check_hardcoded_dates_or_counts_on_text('title={`공시 기준 (2026-09-06)`}', 5, "Tooltip.tsx")
        self.assertGreater(len(err4), 0, "UI 템플릿 내 정적 날짜 리터럴이 검출되어야 합니다.")

        # 5. 실제 발생: UI 가이드 고정 개수
        err5 = check_hardcoded_dates_or_counts_on_text('text="전수 유니버스 4개사(TIGER 231·KB 143)"', 10, "Guide.tsx")
        self.assertGreater(len(err5), 0, "운용사 고정 종목수 리터럴이 검출되어야 합니다.")

        # 6. 화이트리스트 날짜는 통과 (서비스 개시일, 휴일 등)
        self.assertEqual(len(check_hardcoded_dates_or_counts_on_text('MARKET_START = "2026-08-01"', 1, "config.ts")), 0)
        self.assertEqual(len(check_hardcoded_dates_or_counts_on_text('HOLIDAY = "2026-12-25"', 1, "holidays.py")), 0)

        # 7. 주석 라인은 통과
        self.assertEqual(len(check_hardcoded_dates_or_counts_on_text('# as_of_date = "2026-09-16"', 1, "test.py")), 0)
        self.assertEqual(len(check_hardcoded_dates_or_counts_on_text('// title = 2026-09-16', 1, "test.ts")), 0)

    def test_fm005_detects_macro_indices_ssot_violations(self):
        """FM-005: 지표 식별자 다중 매핑 및 SSOT 위반 탐지 검증."""
        # 2026-09-17 실제 발생: 파편화된 로컬 매핑 딕셔너리
        faulty_builder_code = (
            "CANONICAL_INDEX_MAP = {'^GSPC': 'SPX', '^IXIC': 'NDX'}\n"
            "LABEL_INDEX_MAP = {'SPX': 'S&P 500'}\n"
        )
        valid_ssot = (
            "CANONICAL_MACRO_CODES = set()\n"
            "RAW_SOURCE_TO_CANONICAL = {}\n"
            "CANONICAL_TO_LABEL = {}\n"
            "def normalize_index_code(code): pass\n"
        )
        errors = check_macro_indices_ssot_in_text(valid_ssot, faulty_builder_code)
        self.assertGreater(len(errors), 0, "중복 매핑 딕셔너리가 검출되어야 합니다.")
        self.assertTrue(any("CANONICAL_INDEX_MAP" in err for err in errors))

        # SSOT 파일에 필수 심볼 누락
        incomplete_ssot = "CANONICAL_MACRO_CODES = set()\n"
        ssot_errors = check_macro_indices_ssot_in_text(incomplete_ssot, "")
        self.assertGreater(len(ssot_errors), 0, "SSOT 필수 심볼 누락이 검출되어야 합니다.")

    def test_fm006_detects_migration_sequence_and_naming_errors(self):
        """FM-006: D1 마이그레이션 네이밍 및 중복 번호 탐지 검증."""
        # 1. 4자리 접두사 누락
        invalid_naming = ["0001_init.sql", "expand_table.sql"]
        errors_name = check_migrations_sequence_for_filenames(invalid_naming)
        self.assertGreater(len(errors_name), 0, "4자리 번호 접두사 누락 파일이 검출되어야 합니다.")

        # 2. 신규 중복 번호 (0023 중복)
        duplicate_files = ["0022_expand.sql", "0023_purge_a.sql", "0023_purge_b.sql"]
        errors_dup = check_migrations_sequence_for_filenames(duplicate_files)
        self.assertGreater(len(errors_dup), 0, "중복 마이그레이션 번호가 검출되어야 합니다.")

        # 3. 과거 레거시 0012 허용 및 정상 시퀀스
        compliant_files = ["0012_a.sql", "0012_b.sql", "0022_expand.sql", "0023_purge.sql", "0024_single.sql"]
        self.assertEqual(len(check_migrations_sequence_for_filenames(compliant_files)), 0)

    def test_fm007_detects_versioned_pk_and_conflict(self):
        """FM-007: market_source_index_daily의 버전 키 기반 PK 및 충돌 절 방지 검증."""
        # 1. 실제 발생: market_source_index_daily 테이블 생성 시 PK에 source_version 포함
        faulty_ddl = (
            "CREATE TABLE market_source_index_daily (\n"
            "  as_of_date TEXT NOT NULL,\n"
            "  source_version TEXT NOT NULL,\n"
            "  index_code TEXT NOT NULL,\n"
            "  PRIMARY KEY (as_of_date, source_version, index_code)\n"
            ");\n"
        )
        errors_ddl = check_versioned_pk_unversioned_query_in_text(faulty_ddl, "0023_purge.sql")
        self.assertGreater(len(errors_ddl), 0, "버전이 포함된 PK DDL이 검출되어야 합니다.")
        self.assertTrue(any("FM-007" in err or "versioned PK" in err for err in errors_ddl))

        # 2. 실제 발생: Ingest 코드 내 ON CONFLICT(as_of_date, source_version, index_code)
        faulty_ingest = (
            "INSERT INTO market_source_index_daily (as_of_date, source_version, index_code) VALUES (?, ?, ?)\n"
            "ON CONFLICT(as_of_date, source_version, index_code) DO UPDATE SET close_value=excluded.close_value;\n"
        )
        errors_ingest = check_versioned_pk_unversioned_query_in_text(faulty_ingest, "ingest-market-source.js")
        self.assertGreater(len(errors_ingest), 0, "버전이 포함된 ON CONFLICT 절이 검출되어야 합니다.")
        self.assertTrue(any("FM-007" in err or "ON CONFLICT" in err for err in errors_ingest))

        # 3. 정상 준수 DDL (PK: as_of_date, index_code)
        compliant_ddl = (
            "CREATE TABLE market_source_index_daily (\n"
            "  as_of_date TEXT NOT NULL,\n"
            "  source_version TEXT NOT NULL,\n"
            "  index_code TEXT NOT NULL,\n"
            "  PRIMARY KEY (as_of_date, index_code)\n"
            ");\n"
        )
        self.assertEqual(len(check_versioned_pk_unversioned_query_in_text(compliant_ddl, "0024.sql")), 0)

        # 4. 정상 준수 Ingest (ON CONFLICT(as_of_date, index_code))
        compliant_ingest = (
            "INSERT INTO market_source_index_daily (as_of_date, source_version, index_code) VALUES (?, ?, ?)\n"
            "ON CONFLICT(as_of_date, index_code) DO UPDATE SET close_value=excluded.close_value;\n"
        )
        self.assertEqual(len(check_versioned_pk_unversioned_query_in_text(compliant_ingest, "ingest.js")), 0)

        # 5. 지시 3 회귀 테스트: 미래 마이그레이션(0025)에서 versioned PK가 재도입되는 케이스 차단
        fake_0025_ddl = (
            "ALTER TABLE market_source_index_daily ADD COLUMN test_col TEXT;\n"
            "CREATE TABLE market_source_index_daily (\n"
            "  as_of_date TEXT NOT NULL,\n"
            "  source_version TEXT NOT NULL,\n"
            "  index_code TEXT NOT NULL,\n"
            "  PRIMARY KEY (as_of_date, source_version, index_code)\n"
            ");\n"
        )
        errors_0025 = check_versioned_pk_unversioned_query_in_text(fake_0025_ddl, "0025_fake_migration.sql")
        self.assertGreater(len(errors_0025), 0, "미래 마이그레이션 0025의 versioned PK DDL이 반드시 검출되어야 합니다.")
        self.assertTrue(any("FM-007" in err or "versioned PK" in err for err in errors_0025))

    def test_meta_failure_modes_coverage(self):
        """메타 게이트: ALL_CHECKS의 FM ID 집합과 docs/known_failure_modes.md의 ID 집합이 1:1 완전 일치해야 함."""
        # 1. 실제 현재 상태 일치 검증
        errors = check_failure_modes_coverage(ALL_CHECKS)
        self.assertEqual(len(errors), 0, f"현재 린터 검사 집합과 문서 집합이 완전히 일치해야 합니다: {errors}")

        # 2. 지시 3 회귀 테스트: 문서에만 미등록 FM-999가 추가된 경우 (검사 누락 탐지 실증)
        doc_with_fm999 = (
            "## [FM-001] A\n## [FM-002] B\n## [FM-003] C\n## [FM-004] D\n## [FM-005] E\n"
            "## [FM-006] F\n## [FM-007] G\n## [FM-008] H\n## [FM-009] I\n## [FM-010] J\n## [FM-011] K\n## [FM-999] Unknown\n"
        )
        missing_check_errs = check_failure_modes_coverage(ALL_CHECKS, doc_with_fm999)
        self.assertGreater(len(missing_check_errs), 0, "문서에만 FM-999가 있으면 '검사 누락'이 검출되어야 합니다.")
        self.assertTrue(any("검사 누락" in e and "FM-999" in e for e in missing_check_errs))

        # 3. 지시 3 회귀 테스트: 린터에만 미문서화 FM-999가 추가된 경우 (문서 누락 탐지 실증)
        checks_with_extra = set(["FM-001", "FM-002", "FM-003", "FM-004", "FM-005", "FM-006", "FM-007", "FM-008", "FM-009", "FM-010", "FM-011", "FM-999"])
        missing_doc_errs = check_failure_modes_coverage(checks_with_extra, None)
        self.assertGreater(len(missing_doc_errs), 0, "린터에만 FM-999가 있으면 '문서 누락'이 검출되어야 합니다.")
        self.assertTrue(any("문서 누락" in e and "FM-999" in e for e in missing_doc_errs))

    def test_catalog_file_snippets_integrity(self):
        """docs/known_failure_modes.md에 등록된 실제 코드 스니펫들이 린터에 검출되는지 연동 검증."""
        doc_path = REPO_ROOT / "docs" / "known_failure_modes.md"
        self.assertTrue(doc_path.exists(), "docs/known_failure_modes.md 문서가 존재해야 합니다.")

        content = doc_path.read_text(encoding="utf-8")
        
        # FM-001 스니펫 검출
        self.assertIn("subprocess.run(['git', 'log'", content)
        err_fm001 = check_git_log_subprocesses_in_text(content, "known_failure_modes.md")
        self.assertGreater(len(err_fm001), 0, "카탈로그에 등록된 FM-001 스니펫이 검출되어야 합니다.")

        # FM-002 스니펫 검출
        snippet_fm002 = (
            "try:\n"
            "    from scripts.schemas.briefing_contract import BriefingContract\n"
            "except ImportError as e:\n"
            "    print('warning')\n"
        )
        err_fm002 = check_import_error_swallowing_in_code(snippet_fm002, "contract.py")
        self.assertGreater(len(err_fm002), 0, "카탈로그에 등록된 FM-002 스니펫이 검출되어야 합니다.")

        # FM-007 스니펫 검출
        self.assertIn("PRIMARY KEY (as_of_date, source_version, index_code)", content)
        snippet_fm007 = "market_source_index_daily PRIMARY KEY (as_of_date, source_version, index_code)"
        err_fm007 = check_versioned_pk_unversioned_query_in_text(snippet_fm007, "known_failure_modes.md")
        self.assertGreater(len(err_fm007), 0, "카탈로그에 등록된 FM-007 스니펫이 검출되어야 합니다.")

    def test_fm008_detects_untracked_pipeline_files(self):
        """FM-008: untracked 워크플로 및 파이프라인 스크립트 탐지 검증."""
        # 실제 발생했던 untracked 케이스
        status_lines = [
            "?? .github/workflows/threads-daily-post.yml",
            "?? scripts/threads/generate_thread.py",
            "?? scripts/threads/threads_bank.json",
            "?? public/data/screener.json",
            "?? scripts/_oneoff/verify_step0.py",
            " M .gitattributes",
        ]
        errors = check_untracked_pipeline_files_in_status(status_lines)
        self.assertEqual(len(errors), 3, "워크플로 1개와 scripts 2개만 검출되어야 합니다.")
        self.assertTrue(any("threads-daily-post.yml" in e for e in errors))
        self.assertTrue(any("generate_thread.py" in e for e in errors))
        self.assertTrue(any("threads_bank.json" in e for e in errors))
        # _oneoff 격리 파일 및 public/data는 예외로 통과해야 함
        self.assertFalse(any("_oneoff" in e for e in errors))
        self.assertFalse(any("screener.json" in e for e in errors))

    def test_fm009_detects_missing_pages_deployment_gate(self):
        """FM-009: D1 마이그레이션 전 check_pages_deployment.py 게이트 실행 누락 탐지 검증."""
        # 1. 실제 발생했던 취약 워크플로 (게이트 스크립트 실행 없이 바로 마이그레이션 적용)
        vulnerable_workflow = """
        - name: Apply unapplied D1 migrations
          run: npx wrangler d1 migrations apply etf-prices --remote
        """
        errs = check_migration_workflow_deployment_gate_in_text(vulnerable_workflow, "vulnerable.yml")
        self.assertGreater(len(errs), 0, "check_pages_deployment.py 게이트가 없는 워크플로는 검출되어야 합니다.")

        # 2. 방어된 정상 워크플로 (check_pages_deployment.py 스크립트가 선행 실행됨)
        safe_workflow = """
        - name: Wait for Pages deployment of current SHA
          run: python scripts/check_pages_deployment.py --expected-sha "abc"
        - name: Apply unapplied D1 migrations
          run: npx wrangler d1 migrations apply etf-prices --remote
        """
        safe_errs = check_migration_workflow_deployment_gate_in_text(safe_workflow, "safe.yml")
        self.assertEqual(len(safe_errs), 0, "check_pages_deployment.py가 선행된 워크플로는 통과해야 합니다.")

        # 3. 지시 3 회귀 테스트: 스텝 제목(name:)에만 check_pages_deployment.py가 있고 실제 python 실행 명령이 누락된 경우 차단
        title_only_workflow = """
        - name: Wait for Pages deployment of current SHA (check_pages_deployment.py)
          run: echo "Not invoking python script"
        - name: Apply unapplied D1 migrations
          run: npx wrangler d1 migrations apply etf-prices --remote
        """
        title_errs = check_migration_workflow_deployment_gate_in_text(title_only_workflow, "title_only.yml")
        self.assertGreater(len(title_errs), 0, "스텝 제목에만 파일명이 있고 python 실행이 없는 경우 검출되어야 합니다.")
        self.assertTrue(any("Missing actual execution command" in e for e in title_errs))

    def test_fm010_detects_cron_workflow_not_on_default_branch(self):
        """FM-010: cron 스케줄을 가진 워크플로가 default branch(origin/main)에 없는 경우 탐지 및 Fail-Closed 검증."""
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            tmppath = Path(tmpdir)
            # 워크플로 2개 생성: 하나는 cron 포함, 하나는 PR 전용
            cron_wf = tmppath / "threads-daily-post.yml"
            cron_wf.write_text("on:\n  schedule:\n    - cron: '0 22 * * *'\n", encoding="utf-8")

            pr_wf = tmppath / "ci-fast.yml"
            pr_wf.write_text("on:\n  pull_request:\n", encoding="utf-8")

            # 1. origin_wfs에 threads-daily-post.yml이 없는 경우 -> 검출 실증
            origin_wfs_missing = {"ci-fast.yml"}
            errs = check_cron_workflows_on_default_branch(
                origin_ref="origin/main",
                wf_dir=tmppath,
                origin_wfs=origin_wfs_missing,
            )
            self.assertEqual(len(errs), 1, "origin에 없는 cron 워크플로가 검출되어야 합니다.")
            self.assertIn("threads-daily-post.yml", errs[0])
            self.assertIn("violates FM-010", errs[0])

            # 2. origin_wfs에 존재하는 경우 -> 통과 실증
            origin_wfs_present = {"threads-daily-post.yml", "ci-fast.yml"}
            clean_errs = check_cron_workflows_on_default_branch(
                origin_ref="origin/main",
                wf_dir=tmppath,
                origin_wfs=origin_wfs_present,
            )
            self.assertEqual(len(clean_errs), 0, "origin에 등록된 cron 워크플로는 정상 통과해야 합니다.")

    @patch("subprocess.run")
    def test_fm010_fail_closed_on_git_ls_tree_failure(self, mock_run: MagicMock):
        """FM-010 지시 2 회귀 테스트: git ls-tree 실패 시 fail-open(빈배열)하지 않고 Fail-Closed 오류 반환."""
        mock_proc = MagicMock()
        mock_proc.returncode = 128
        mock_proc.stderr = "fatal: Not a valid object name origin/main"
        mock_run.return_value = mock_proc

        errs = check_cron_workflows_on_default_branch("origin/main")
        self.assertGreater(len(errs), 0, "git ls-tree 실패 시 fail-closed 오류가 발생해야 합니다.")
        self.assertIn("FM-010 Fail-Closed", errs[0])

    def test_fm011_detects_destructive_migration_without_baseline(self):
        """FM-011 지시 3 회귀 테스트: 파괴적 스키마 변경 마이그레이션의 migration_baselines 기록 누락 탐지 검증."""
        # 1. 취약 DDL: DROP TABLE 포함하지만 migration_baselines 기록 누락
        vulnerable_ddl = """
        DROP TABLE market_source_index_daily;
        CREATE TABLE market_source_index_daily (
          as_of_date TEXT NOT NULL,
          index_code TEXT NOT NULL,
          PRIMARY KEY (as_of_date, index_code)
        );
        """
        errs = check_destructive_migrations_baseline_in_text(vulnerable_ddl, "0027_destructive.sql")
        self.assertGreater(len(errs), 0, "migration_baselines 기록이 없는 파괴적 마이그레이션은 검출되어야 합니다.")
        self.assertTrue(any("FM-011" in e for e in errs))

        # 2. 정상 DDL: migration_baselines 기록 포함
        compliant_ddl = """
        INSERT INTO migration_baselines (migration_name, target_table, pre_count, post_count, details)
        VALUES ('0027_destructive', 'market_source_index_daily', 10, -1, 'started');
        DROP TABLE market_source_index_daily;
        CREATE TABLE market_source_index_daily (id INTEGER PRIMARY KEY);
        UPDATE migration_baselines SET post_count = 10 WHERE migration_name = '0027_destructive';
        """
        compliant_errs = check_destructive_migrations_baseline_in_text(compliant_ddl, "0027_destructive.sql")
        self.assertEqual(len(compliant_errs), 0, "migration_baselines 기록이 포함된 마이그레이션은 통과해야 합니다.")

        # 3. 비파괴적 DDL: CREATE TABLE IF NOT EXISTS만 있는 경우 통과
        safe_ddl = "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY);"
        safe_errs = check_destructive_migrations_baseline_in_text(safe_ddl, "0028_safe.sql")
        self.assertEqual(len(safe_errs), 0, "비파괴적 마이그레이션은 통과해야 합니다.")

        # 4. 지시 3 회귀 테스트: 주석(-- 및 /* */)에만 baselines 텍스트가 존재하는 경우 차단
        comment_only_ddl = """
        -- INSERT INTO migration_baselines (migration_name, target_table, pre_count, post_count) VALUES ('0027', 'tbl', 10, 10);
        /* INSERT INTO migration_baselines (pre_count, post_count) VALUES (10, 10); */
        DROP TABLE market_source_index_daily;
        CREATE TABLE market_source_index_daily (id INTEGER PRIMARY KEY);
        """
        comment_errs = check_destructive_migrations_baseline_in_text(comment_only_ddl, "0027_comment_only.sql")
        self.assertGreater(len(comment_errs), 0, "주석에만 baseline이 작성된 경우 차단되어야 합니다.")
        self.assertTrue(any("FM-011" in e for e in comment_errs))

        # 5. 지시 3 회귀 테스트: post_count 기록 누락 차단
        missing_post_ddl = """
        INSERT INTO migration_baselines (migration_name, target_table, pre_count)
        VALUES ('0027_destructive', 'market_source_index_daily', 10);
        DROP TABLE market_source_index_daily;
        CREATE TABLE market_source_index_daily (id INTEGER PRIMARY KEY);
        """
        post_errs = check_destructive_migrations_baseline_in_text(missing_post_ddl, "0027_missing_post.sql")
        self.assertGreater(len(post_errs), 0, "post_count 기록이 누락된 경우 차단되어야 합니다.")
        self.assertTrue(any("post_count" in e for e in post_errs))

        # 6. 지시 3 후속 회귀 테스트: DELETE FROM만 있고 baselines 기록 없는 마이그레이션 차단 (0023 precedent)
        delete_without_baseline_ddl = """
        DELETE FROM market_source_index_daily WHERE source_version != 'v1';
        """
        delete_errs = check_destructive_migrations_baseline_in_text(delete_without_baseline_ddl, "0027_delete_purge.sql")
        self.assertGreater(len(delete_errs), 0, "DELETE FROM을 포함한 파괴적 마이그레이션은 차단되어야 합니다.")
        self.assertTrue(any("FM-011" in e for e in delete_errs))

        # 7. 지시 3 후속 회귀 테스트: details 문자열 리터럴에 '--'가 포함되고 post_count가 뒤에 오는 정상 마이그레이션 통과 (오탐 방지)
        string_with_dash_ddl = """
        INSERT INTO migration_baselines (migration_name, target_table, pre_count, post_count, details)
        VALUES ('0027_cleanup', 'market_source_index_daily', 100, -1, 'purge raw index codes -- keep only canonical');
        DELETE FROM market_source_index_daily WHERE index_code LIKE '^%';
        UPDATE migration_baselines SET post_count = 80 WHERE migration_name = '0027_cleanup';
        """
        dash_errs = check_destructive_migrations_baseline_in_text(string_with_dash_ddl, "0027_cleanup.sql")
        self.assertEqual(len(dash_errs), 0, "문자열 리터럴 내 '--'가 포함되어도 post_count가 정상 인식되어 통과해야 합니다.")

    def test_strip_sql_comments(self):
        """strip_sql_comments 순수 함수 단위 테스트: 라인 주석 및 블록 주석 제거 검증."""
        sql = (
            "-- single line comment\n"
            "SELECT 1;\n"
            "/* multi-line\n"
            "   block comment */\n"
            "SELECT 2; -- inline comment"
        )
        cleaned = strip_sql_comments(sql)
        self.assertNotIn("single line comment", cleaned)
        self.assertNotIn("multi-line", cleaned)
        self.assertNotIn("inline comment", cleaned)
        self.assertIn("SELECT 1;", cleaned)
        self.assertIn("SELECT 2;", cleaned)

        # 문자열 리터럴 내의 -- 및 /* */ 보존 검증 (오탐 방지)
        sql_with_literal = "INSERT INTO t (col) VALUES ('keep -- not a comment /* neither */'); -- strip this"
        cleaned_literal = strip_sql_comments(sql_with_literal)
        self.assertIn("keep -- not a comment /* neither */", cleaned_literal)
        self.assertNotIn("strip this", cleaned_literal)

    def test_baseline_exempt_migrations(self):
        """BASELINE_EXEMPT_MIGRATIONS 상수 무결성 검증: 0001~0026 면제, 0027부터 엄격 적용."""
        self.assertIn("0001", BASELINE_EXEMPT_MIGRATIONS)
        self.assertIn("0024", BASELINE_EXEMPT_MIGRATIONS)
        self.assertIn("0025", BASELINE_EXEMPT_MIGRATIONS)
        self.assertIn("0026", BASELINE_EXEMPT_MIGRATIONS)
        self.assertNotIn("0027", BASELINE_EXEMPT_MIGRATIONS)


if __name__ == "__main__":
    unittest.main()

