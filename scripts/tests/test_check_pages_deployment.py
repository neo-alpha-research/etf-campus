#!/usr/bin/env python3
"""
scripts/tests/test_check_pages_deployment.py

Cloudflare Pages 배포 검증 게이트 단위 테스트 및 검출력 실증 (Failure Detection Verification).
building 상태 차단, failure 즉시 fail-closed 차단, preview 배포 혼입 방지, success 통과를 검증합니다.
"""

from __future__ import annotations

import unittest
from scripts.check_pages_deployment import evaluate_deployments


class TestCheckPagesDeployment(unittest.TestCase):
    def setUp(self):
        self.target_sha = "3a70df713897c9f3c8c634cc792833c5fc721a56"

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
            # 최신 [0]은 preview 배포 (다른 브랜치, success)
            {
                "id": "deploy-preview-999",
                "environment": "preview",
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
            # [1]이 실제 production 배포이나 이전 SHA
            {
                "id": "deploy-prod-888",
                "environment": "production",
                "deployment_trigger": {
                    "metadata": {
                        "commit_hash": "old_sha_1234567890abcdef",
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
        # preview가 success더라도 production이 아직 이전 커밋이므로 WAITING_DEPLOYMENT여야 함
        self.assertEqual(status, "WAITING_DEPLOYMENT", "preview 배포의 success에 현혹되지 않고 production을 대기해야 합니다.")
        self.assertEqual(details["environment"], "production")
        self.assertEqual(details["commit_hash"], "old_sha_1234567890abcdef")


if __name__ == "__main__":
    unittest.main()
