#!/usr/bin/env python3
"""
scripts/check_pages_deployment.py

Cloudflare Pages 배포 검증 게이트 (Production Deployment Gate).
D1 파괴적 마이그레이션 적용 전, 현재 커밋의 Pages 코드가 production 환경에
정상 빌드/배포(status == 'success') 완료되었는지 엄격히 검증합니다.

FM-009 방어 핵심 메커니즘:
1. Preview 배포와 격리하여 반드시 `environment == "production"` 배포만 필터링합니다.
2. `commit_hash == expected_sha` AND `latest_stage.status == "success"` 둘 다 만족할 때만 통과합니다.
3. `latest_stage.status == "failure"`인 경우 추가 대기 없이 즉시 Fail-Closed(exit 1) 종료합니다.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from typing import Any


def evaluate_deployments(
    deployments: list[dict[str, Any]], expected_sha: str
) -> tuple[str, str, dict[str, Any]]:
    """배포 목록과 기대 SHA를 대조하여 게이트 판정 결과를 반환합니다 (순수 함수).

    Returns:
        tuple[status, message, details]
        status in ("SUCCESS", "FAILURE", "WAITING_BUILD", "WAITING_DEPLOYMENT", "NO_PROD")
    """
    prod_deployments = [d for d in deployments if d.get("environment") == "production"]
    if not prod_deployments:
        return "NO_PROD", "No production deployment found in deployment list.", {}

    latest_prod = prod_deployments[0]
    trigger_metadata = latest_prod.get("deployment_trigger", {}).get("metadata", {})
    commit_hash = trigger_metadata.get("commit_hash", "") or latest_prod.get("short_id", "")
    latest_stage = latest_prod.get("latest_stage", {})
    stage_name = latest_stage.get("name", "")
    stage_status = latest_stage.get("status", "")

    details = {
        "commit_hash": commit_hash,
        "environment": latest_prod.get("environment", "unknown"),
        "stage_name": stage_name,
        "stage_status": stage_status,
        "deployment_id": latest_prod.get("id", ""),
        "created_on": latest_prod.get("created_on", ""),
    }

    # 1. 기대 SHA와 일치하는 경우
    if commit_hash == expected_sha or (expected_sha and commit_hash.startswith(expected_sha[:7])):
        if stage_status == "failure":
            msg = (
                f"Production deployment for commit {commit_hash} FAILED at stage '{stage_name}'. "
                f"Aborting immediately (fail-closed)."
            )
            return "FAILURE", msg, details
        if stage_status == "success":
            msg = (
                f"Production deployment verified for commit {commit_hash} "
                f"(stage: {stage_name}, status: {stage_status})."
            )
            return "SUCCESS", msg, details
        # building, queued, active, etc.
        msg = (
            f"Production deployment for commit {commit_hash} is still in progress "
            f"(stage: {stage_name}, status: {stage_status})."
        )
        return "WAITING_BUILD", msg, details

    # 2. 아직 이전 배포만 존재하는 경우
    msg = (
        f"Latest production deployment is {commit_hash} (stage: {stage_name}, status: {stage_status}), "
        f"waiting for expected commit {expected_sha}."
    )
    return "WAITING_DEPLOYMENT", msg, details


def fetch_pages_deployments(project_name: str) -> list[dict[str, Any]]:
    """wrangler CLI를 실행하여 Pages 배포 목록 JSON을 가져옵니다."""
    cmd = ["npx", "wrangler", "pages", "deployment", "list", "--project-name", project_name, "--json"]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(res.stdout)
        if isinstance(data, list):
            return data
        return []
    except subprocess.CalledProcessError as e:
        print(f"⚠️ wrangler pages deployment list failed (exit {e.returncode}): {e.stderr}", file=sys.stderr)
        return []
    except json.JSONDecodeError as e:
        print(f"⚠️ Failed to parse wrangler deployment JSON output: {e}", file=sys.stderr)
        return []


def wait_for_pages_deployment(
    project_name: str,
    expected_sha: str,
    timeout_seconds: int = 240,
    poll_interval: int = 10,
) -> int:
    """Production Pages 배포가 완료될 때까지 폴링합니다."""
    print(f"🔍 [Deployment Gate] Verifying Cloudflare Pages production deployment for commit: {expected_sha}")
    print(f"   Project: {project_name}, Timeout: {timeout_seconds}s, Poll Interval: {poll_interval}s")

    start_time = time.time()
    attempt = 0

    while True:
        attempt += 1
        elapsed = int(time.time() - start_time)
        if elapsed > timeout_seconds:
            print(
                f"❌ [Deployment Gate Timeout] Pages production deployment did not succeed within {timeout_seconds}s "
                f"(expected commit: {expected_sha}).",
                file=sys.stderr,
            )
            return 1

        deployments = fetch_pages_deployments(project_name)
        status, msg, details = evaluate_deployments(deployments, expected_sha)

        if status == "SUCCESS":
            print(f"✅ [Deployment Gate] {msg}")
            print(f"   - Commit Hash: {details.get('commit_hash')}")
            print(f"   - Environment: {details.get('environment')}")
            print(f"   - Stage Name:  {details.get('stage_name')}")
            print(f"   - Stage Status:{details.get('stage_status')}")
            return 0

        if status == "FAILURE":
            print(f"❌ [Deployment Gate Immediate Abort] {msg}", file=sys.stderr)
            print(f"   - Commit Hash: {details.get('commit_hash')}", file=sys.stderr)
            print(f"   - Environment: {details.get('environment')}", file=sys.stderr)
            print(f"   - Stage Name:  {details.get('stage_name')}", file=sys.stderr)
            print(f"   - Stage Status:{details.get('stage_status')}", file=sys.stderr)
            return 1

        print(f"⏳ [Waiting {elapsed}s/{timeout_seconds}s (attempt {attempt})] {msg}")
        time.sleep(poll_interval)


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify Cloudflare Pages production deployment before migration")
    parser.add_argument("--project-name", default="etf-campus", help="Cloudflare Pages project name")
    parser.add_argument("--expected-sha", default=os.environ.get("GITHUB_SHA", ""), help="Target git commit SHA")
    parser.add_argument("--timeout", type=int, default=240, help="Max wait time in seconds")
    parser.add_argument("--interval", type=int, default=10, help="Polling interval in seconds")
    args = parser.parse_args()

    if not args.expected_sha:
        print("❌ --expected-sha argument or GITHUB_SHA environment variable is required.", file=sys.stderr)
        return 1

    return wait_for_pages_deployment(
        project_name=args.project_name,
        expected_sha=args.expected_sha,
        timeout_seconds=args.timeout,
        poll_interval=args.interval,
    )


if __name__ == "__main__":
    sys.exit(main())
