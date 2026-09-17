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

# Ensure root directory is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.lint_pipeline import (
    ALL_CHECKS,
    check_git_log_subprocesses_in_text,
    check_import_error_swallowing_in_code,
    check_daily_market_git_add_in_text,
    check_hardcoded_dates_or_counts_on_text,
    check_macro_indices_ssot_in_text,
    check_migrations_sequence_for_filenames,
    check_versioned_pk_unversioned_query_in_text,
    check_untracked_pipeline_files_in_status,
    check_migration_workflow_deployment_gate_in_text,
    check_failure_modes_coverage,
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

    def test_meta_failure_modes_coverage(self):
        """메타 게이트: 린터 검사 수(CHECKS) >= docs/known_failure_modes.md 고유 항목 수."""
        # 현재 실제 문서 기준 검증
        errors = check_failure_modes_coverage(len(ALL_CHECKS))
        self.assertEqual(len(errors), 0, "현재 린터 검사 수가 문서화된 실패 유형 수를 충족해야 합니다.")

        # 검사 수가 부족한 경우 메타 차단 시뮬레이션
        mock_doc = "## [FM-001] A\n## [FM-002] B\n## [FM-003] C\n## [FM-004] D\n"
        insufficient_errors = check_failure_modes_coverage(2, mock_doc)
        self.assertGreater(len(insufficient_errors), 0, "검사 수가 부족할 때 메타 검사가 실패해야 합니다.")

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
        """FM-009: D1 마이그레이션 전 Pages 배포 확인 게이트 누락 탐지 검증."""
        # 1. 실제 발생했던 취약 워크플로 (배포 확인 게이트 없이 바로 마이그레이션 적용)
        vulnerable_workflow = """
        - name: Apply unapplied D1 migrations
          run: npx wrangler d1 migrations apply etf-prices --remote
        """
        errs = check_migration_workflow_deployment_gate_in_text(vulnerable_workflow, "vulnerable.yml")
        self.assertGreater(len(errs), 0, "배포 확인 게이트가 없는 워크플로는 검출되어야 합니다.")

        # 2. 방어된 정상 워크플로 (Wait for Pages deployment 스텝이 먼저 실행됨)
        safe_workflow = """
        - name: Wait for Pages deployment of current SHA
          run: echo "check deployment"
        - name: Apply unapplied D1 migrations
          run: npx wrangler d1 migrations apply etf-prices --remote
        """
        safe_errs = check_migration_workflow_deployment_gate_in_text(safe_workflow, "safe.yml")
        self.assertEqual(len(safe_errs), 0, "배포 게이트가 선행된 워크플로는 통과해야 합니다.")


if __name__ == "__main__":
    unittest.main()

