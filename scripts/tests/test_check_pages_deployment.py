#!/usr/bin/env python3
"""
scripts/tests/test_check_pages_deployment.py

Cloudflare Pages 배포 검증 게이트 단위 테스트 및 검출력 실증 (Failure Detection Verification).
[관측값 픽스처 규율 준수]:
모든 테스트는 실제 Cloudflare REST API 응답을 캡처한 scripts/tests/fixtures/pages_deployments_sample.json을
기반으로 수행되며, 40자 전체 SHA 완전 일치 강제, 접두 일치 차단, API 오류 즉시 fail-closed,
created_on 명시 정렬, building 차단, failure 즉시 차단, preview 배포 혼입 방지, success 통과를 검증합니다.
"""

from __future__ import annotations

import copy
import io
import json
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch
import urllib.error

from scripts.check_pages_deployment import (
    evaluate_deployments,
    fetch_pages_deployments,
    wait_for_pages_deployment,
)

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "pages_deployments_sample.json"


def load_fixture() -> list[dict]:
    with open(FIXTURE_PATH, encoding="utf-8") as f:
        return json.load(f)


class TestCheckPagesDeployment(unittest.TestCase):
    def setUp(self):
        self.raw_deployments = load_fixture()
        # Find the real production deployment in fixture
        self.real_prod = next(
            d for d in self.raw_deployments
            if d.get("environment") == "production" and d.get("latest_stage", {}).get("status") == "success"
        )
        self.target_sha = self.real_prod["deployment_trigger"]["metadata"]["commit_hash"]
        self.assertEqual(len(self.target_sha), 40, "Target SHA in real fixture must be 40 chars")

    def test_passes_on_real_observed_production_deployment(self):
        """관측된 실제 REST API 응답 원본에서 현재 production success 배포를 정상 통과 검증."""
        status, msg, details = evaluate_deployments(self.raw_deployments, self.target_sha)
        self.assertEqual(status, "SUCCESS", "실제 Cloudflare API 응답에서 production success 배포는 통과해야 합니다.")
        self.assertEqual(details["commit_hash"], self.target_sha)
        self.assertEqual(details["stage_status"], "success")
        self.assertEqual(details["environment"], "production")

    def test_detects_and_blocks_prefix_match_only(self):
        """지시 2 회귀 테스트: 앞 7자리(또는 39자리)만 같고 전체 40자 SHA가 다른 경우 절대 통과 불허."""
        wrong_sha = self.target_sha[:-1] + ("0" if self.target_sha[-1] != "0" else "1")
        status, msg, details = evaluate_deployments(self.raw_deployments, wrong_sha)
        self.assertEqual(status, "WAITING_DEPLOYMENT", "접두가 일치하더라도 전체 40자 SHA가 다르면 절대 통과할 수 없습니다.")

    def test_detects_and_blocks_short_sha_prefix(self):
        """7자리 short SHA를 expected_sha로 넘겨도 40자 완전 일치가 아니면 통과 불허."""
        short_sha = self.target_sha[:7]
        status, msg, details = evaluate_deployments(self.raw_deployments, short_sha)
        self.assertEqual(status, "WAITING_DEPLOYMENT", "7자리 축약 SHA는 완전 일치하지 않으므로 차단되어야 합니다.")

    def test_detects_and_blocks_building_status(self):
        """실제 9/16 사고 상황: SHA는 일치하지만 Pages 빌드가 진행 중(building/queued)인 경우 차단."""
        fixture = copy.deepcopy(self.raw_deployments)
        target_item = next(
            d for d in fixture
            if d.get("deployment_trigger", {}).get("metadata", {}).get("commit_hash") == self.target_sha
        )
        target_item["latest_stage"]["status"] = "building"
        status, msg, details = evaluate_deployments(fixture, self.target_sha)
        self.assertEqual(status, "WAITING_BUILD", "building 상태에서는 절대 통과(SUCCESS)해서는 안 됩니다.")
        self.assertIn("still in progress", msg)
        self.assertEqual(details["stage_status"], "building")

    def test_detects_and_aborts_immediately_on_failure(self):
        """실제 9/16 사고 상황: Pages 빌드가 failure로 끝난 경우 4분 대기 없이 즉시 FAILURE 반환."""
        fixture = copy.deepcopy(self.raw_deployments)
        target_item = next(
            d for d in fixture
            if d.get("deployment_trigger", {}).get("metadata", {}).get("commit_hash") == self.target_sha
        )
        target_item["latest_stage"]["status"] = "failure"
        status, msg, details = evaluate_deployments(fixture, self.target_sha)
        self.assertEqual(status, "FAILURE", "failure 상태에서는 즉시 실패(FAILURE) 판정해야 합니다.")
        self.assertIn("Aborting immediately", msg)
        self.assertEqual(details["stage_status"], "failure")

    def test_isolates_preview_deployment_from_production_gate(self):
        """피처 브랜치(preview) 배포가 아무리 최신이어도 production 배포만 엄격히 격리 채택."""
        fixture = copy.deepcopy(self.raw_deployments)
        preview_item = {
            "id": "deploy-preview-fake",
            "environment": "preview",
            "created_on": "2099-01-01T00:00:00Z",
            "deployment_trigger": {
                "metadata": {
                    "commit_hash": "unrelated_sha_0000000000000000000000000000",
                    "branch": "feat/some-feature",
                }
            },
            "latest_stage": {
                "name": "deploy",
                "status": "success",
            },
        }
        fixture.insert(0, preview_item)
        status, msg, details = evaluate_deployments(fixture, self.target_sha)
        self.assertEqual(status, "SUCCESS")
        self.assertEqual(details["environment"], "production")

    def test_selects_latest_production_by_created_on_sorting(self):
        """실제 관측 데이터 순서가 역순으로 뒤섞여 있어도 created_on 기준 최신 배포를 올바르게 선택."""
        fixture = copy.deepcopy(self.raw_deployments)
        fixture.reverse()
        status, msg, details = evaluate_deployments(fixture, self.target_sha)
        self.assertEqual(details["commit_hash"], self.target_sha, "created_on 기준 최신 배포를 선택해야 합니다.")
        self.assertEqual(status, "SUCCESS")

    @patch("urllib.request.urlopen")
    def test_api_http_error_fails_closed_immediately(self, mock_urlopen: MagicMock):
        """Cloudflare REST API HTTP 오류(401/403/5xx) 발생 시 응답 본문 출력 후 즉시 예외 발생 및 Fail-Closed."""
        err_response = io.BytesIO(b'{"success":false,"errors":[{"code":10000,"message":"Authentication error"}]}')
        mock_urlopen.side_effect = urllib.error.HTTPError(
            url="https://api.cloudflare.com/...",
            code=403,
            msg="Forbidden",
            hdrs={},
            fp=err_response,
        )

        with self.assertRaises(RuntimeError) as ctx:
            fetch_pages_deployments("test-project", "mock-account", "mock-token")
        self.assertIn("HTTP 403", str(ctx.exception))
        self.assertIn("Authentication error", str(ctx.exception))

        exit_code = wait_for_pages_deployment(
            "test-project",
            self.target_sha,
            account_id="mock-account",
            api_token="mock-token",
            timeout_seconds=60,
            poll_interval=10,
        )
        self.assertEqual(exit_code, 1, "API HTTP 오류 시 폴링 없이 즉시 1로 종료해야 합니다.")

    def test_short_sha_rejected_at_entrypoint_with_zero_polling(self):
        """지시 2 회귀 테스트 ①: 7자리 단축 SHA 입력 시 폴링 0회로 진입점에서 즉시 fail-closed 오류(exit 1)."""
        with patch("scripts.check_pages_deployment.fetch_pages_deployments") as mock_fetch:
            exit_code = wait_for_pages_deployment(
                "test-project",
                "e9914f3",  # 7-char short SHA
                account_id="mock-account",
                api_token="mock-token",
                timeout_seconds=60,
            )
            self.assertEqual(exit_code, 1)
            mock_fetch.assert_not_called()

    def test_39_char_sha_rejected_at_entrypoint_with_zero_polling(self):
        """지시 2 회귀 테스트 ②: 39자리 불완전 SHA 입력 시 폴링 0회로 진입점에서 즉시 fail-closed 오류(exit 1)."""
        with patch("scripts.check_pages_deployment.fetch_pages_deployments") as mock_fetch:
            exit_code = wait_for_pages_deployment(
                "test-project",
                "e9914f368c056ae51d273e0a5e59565e902febe",  # 39 chars
                account_id="mock-account",
                api_token="mock-token",
                timeout_seconds=60,
            )
            self.assertEqual(exit_code, 1)
            mock_fetch.assert_not_called()


if __name__ == "__main__":
    unittest.main()
