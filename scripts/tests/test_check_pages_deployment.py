#!/usr/bin/env python3
"""
scripts/tests/test_check_pages_deployment.py

Cloudflare Pages 배포 검증 게이트 단위 테스트 및 검출력 실증 (Failure Detection Verification).
전체 SHA 완전 일치 강제, 접두 일치 차단, CLI 실패 즉시 fail-closed, created_on 명시 정렬,
building 차단, failure 즉시 차단, preview 배포 혼입 방지, success 통과를 검증합니다.
"""

from __future__ import annotations

import unittest
from unittest.mock import MagicMock, patch
from scripts.check_pages_deployment import evaluate_deployments, fetch_pages_deployments, wait_for_pages_deployment


class TestCheckPagesDeployment(unittest.TestCase):
    def setUp(self):
        self.target_sha = "3a70df713897c9f3c8c634cc792833c5fc721a56"

    def test_detects_and_blocks_prefix_match_only(self):
        """지시 4 회귀 테스트: 앞 7자리만 같고 전체 SHA가 다른 경우 차단 (전체 SHA 완전 일치 강제)."""
        prefix_only_sha = self.target_sha[:7] + "000000000000000000000000000000000"
        fixture_prefix = [
            {
                "id": "deploy-prefix",
                "environment": "production",
                "deployment_trigger": {
                    "metadata": {
                        "commit_hash": prefix_only_sha,
                        "branch": "main",
                    }
                },
                "latest_stage": {
                    "name": "deploy",
                    "status": "success",
                },
            }
        ]
        status, msg, details = evaluate_deployments(fixture_prefix, self.target_sha)
        self.assertEqual(status, "WAITING_DEPLOYMENT", "7자리 접두만 같고 전체 SHA가 다른 배포는 절대 통과해서는 안 됩니다.")
        self.assertEqual(details["commit_hash"], prefix_only_sha)

    def test_detects_and_blocks_building_status(self):
        """실제 9/16 사고 상황: SHA는 일치하지만 Pages 빌드가 진행 중(building)인 경우 차단."""
        fixture_building = [
            {
                "id": "deploy-001",
                "environment": "production",
                "deployment_trigger": {
                    "metadata": {
                        "commit_hash": self.target_sha,
                        "branch": "main",
                    }
                },
                "latest_stage": {
                    "name": "build",
                    "status": "building",
                },
            }
        ]
        status, msg, details = evaluate_deployments(fixture_building, self.target_sha)
        self.assertEqual(status, "WAITING_BUILD", "building 상태에서는 절대 통과(SUCCESS)해서는 안 됩니다.")
        self.assertIn("still in progress", msg)
        self.assertEqual(details["stage_status"], "building")

    def test_detects_and_aborts_immediately_on_failure(self):
        """실제 9/16 사고 상황: Pages 빌드가 failure로 끝난 경우 4분 대기 없이 즉시 FAILURE 반환."""
        fixture_failure = [
            {
                "id": "deploy-002",
                "environment": "production",
                "deployment_trigger": {
                    "metadata": {
                        "commit_hash": self.target_sha,
                        "branch": "main",
                    }
                },
                "latest_stage": {
                    "name": "build",
                    "status": "failure",
                },
            }
        ]
        status, msg, details = evaluate_deployments(fixture_failure, self.target_sha)
        self.assertEqual(status, "FAILURE", "failure 상태에서는 즉시 실패(FAILURE) 판정해야 합니다.")
        self.assertIn("Aborting immediately", msg)
        self.assertEqual(details["stage_status"], "failure")

    def test_passes_on_production_success(self):
        """정상 상황: production 환경에서 commit_hash 일치하고 latest_stage.status == success인 경우 통과."""
        fixture_success = [
            {
                "id": "deploy-003",
                "environment": "production",
                "deployment_trigger": {
                    "metadata": {
                        "commit_hash": self.target_sha,
                        "branch": "main",
                    }
                },
                "latest_stage": {
                    "name": "deploy",
                    "status": "success",
                },
            }
        ]
        status, msg, details = evaluate_deployments(fixture_success, self.target_sha)
        self.assertEqual(status, "SUCCESS", "production 환경의 success 배포는 정상 통과해야 합니다.")
        self.assertEqual(details["commit_hash"], self.target_sha)
        self.assertEqual(details["stage_status"], "success")
        self.assertEqual(details["environment"], "production")

    def test_isolates_preview_deployment_from_production_gate(self):
        """피처 브랜치(feat/*) preview 배포가 최신(.[0])이어도 production 배포만 엄격히 필터링."""
        fixture_mixed = [
            {
                "id": "deploy-preview-999",
                "environment": "preview",
                "created_on": "2026-09-17T12:00:00Z",
                "deployment_trigger": {
                    "metadata": {
                        "commit_hash": self.target_sha,
                        "branch": "feat/compare-timeseries-chart",
                    }
                },
                "latest_stage": {
                    "name": "deploy",
                    "status": "success",
                },
            },
            {
                "id": "deploy-prod-888",
                "environment": "production",
                "created_on": "2026-09-17T11:00:00Z",
                "deployment_trigger": {
                    "metadata": {
                        "commit_hash": "old_sha_1234567890abcdef1234567890abcdef",
                        "branch": "main",
                    }
                },
                "latest_stage": {
                    "name": "deploy",
                    "status": "success",
                },
            },
        ]
        status, msg, details = evaluate_deployments(fixture_mixed, self.target_sha)
        self.assertEqual(status, "WAITING_DEPLOYMENT", "preview 배포의 success에 현혹되지 않고 production을 대기해야 합니다.")
        self.assertEqual(details["environment"], "production")
        self.assertEqual(details["commit_hash"], "old_sha_1234567890abcdef1234567890abcdef")

    def test_selects_latest_production_by_created_on_sorting(self):
        """지시 4 회귀 테스트: wrangler 결과가 created_on 역순으로 들어와도 최신 production을 올바르게 선택."""
        fixture_unordered = [
            # 오래된 배포 (older, but success)
            {
                "id": "deploy-older",
                "environment": "production",
                "created_on": "2026-09-17T10:00:00Z",
                "deployment_trigger": {
                    "metadata": {
                        "commit_hash": self.target_sha,
                        "branch": "main",
                    }
                },
                "latest_stage": {
                    "name": "deploy",
                    "status": "success",
                },
            },
            # 최신 배포 (newer, still building)
            {
                "id": "deploy-newer",
                "environment": "production",
                "created_on": "2026-09-17T11:30:00Z",
                "deployment_trigger": {
                    "metadata": {
                        "commit_hash": self.target_sha,
                        "branch": "main",
                    }
                },
                "latest_stage": {
                    "name": "build",
                    "status": "building",
                },
            },
        ]
        status, msg, details = evaluate_deployments(fixture_unordered, self.target_sha)
        self.assertEqual(details["deployment_id"], "deploy-newer", "created_on 기준 최신 배포를 선택해야 합니다.")
        self.assertEqual(status, "WAITING_BUILD", "최신 배포가 building이면 WAITING_BUILD여야 합니다.")

    @patch("subprocess.run")
    def test_cli_failure_propagates_error_immediately(self, mock_run: MagicMock):
        """지시 4 회귀 테스트: wrangler CLI 실행 실패(인증 오류 등) 시 빈 배열로 삼키지 않고 즉시 예외 전파 및 중단."""
        mock_proc = MagicMock()
        mock_proc.returncode = 1
        mock_proc.stderr = "Authentication error (code 10000)"
        mock_run.return_value = mock_proc

        with self.assertRaises(RuntimeError) as ctx:
            fetch_pages_deployments("test-project")
        self.assertIn("Authentication error", str(ctx.exception))

        # wait_for_pages_deployment 호출 시에도 지연 없이 즉시 1 반환
        exit_code = wait_for_pages_deployment("test-project", self.target_sha, timeout_seconds=60, poll_interval=10)
        self.assertEqual(exit_code, 1, "CLI 실패 시 폴링 없이 즉시 1로 종료해야 합니다.")

    def test_passes_on_wrangler_table_format(self):
        """Wrangler CLI 테이블 직렬화 스키마(Id, Environment, Branch, Source, Status=Active) 통과 검증."""
        fixture_table = [
            {
                "Id": "4a8c6383-b7ad-4db4-8fbd-e70d36dda6bd",
                "Environment": "Production",
                "Branch": "main",
                "Source": self.target_sha[:7],
                "Deployment": "https://4a8c6383.etf-campus.pages.dev",
                "Status": "Active",
                "Build": "https://dash.cloudflare.com/pages/view/etf-campus/4a8c6383",
            }
        ]
        status, msg, details = evaluate_deployments(fixture_table, self.target_sha)
        self.assertEqual(status, "SUCCESS", "wrangler table 직렬화 출력(Active status)은 통과해야 합니다.")
        self.assertEqual(details["stage_status"], "active")
        self.assertEqual(details["environment"], "production")

    def test_blocks_on_wrangler_table_failed(self):
        """Wrangler CLI 테이블 직렬화 스키마에서 Status=Failed 시 즉시 FAILURE 차단 검증."""
        fixture_table_failed = [
            {
                "Id": "fail-12345",
                "Environment": "Production",
                "Branch": "main",
                "Source": self.target_sha[:7],
                "Deployment": "https://fail.etf-campus.pages.dev",
                "Status": "Failed",
                "Build": "https://dash.cloudflare.com/pages/view/etf-campus/fail",
            }
        ]
        status, msg, details = evaluate_deployments(fixture_table_failed, self.target_sha)
        self.assertEqual(status, "FAILURE", "wrangler table 직렬화 출력(Failed status)은 즉시 차단해야 합니다.")


if __name__ == "__main__":
    unittest.main()
