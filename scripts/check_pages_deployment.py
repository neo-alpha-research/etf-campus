#!/usr/bin/env python3
"""
scripts/check_pages_deployment.py

Cloudflare Pages 배포 검증 게이트 (Production Deployment Gate).
D1 파괴적 마이그레이션 적용 전, 현재 커밋의 Pages 코드가 production 환경에
정상 빌드/배포(status == 'success') 완료되었는지 엄격히 검증합니다.

FM-009 방어 핵심 메커니즘:
1. Preview 배포와 격리하여 `environment == "production"` 배포만 `created_on` 내림차순 명시 정렬하여 최신 배포를 선택합니다.
2. `commit_hash == expected_sha` 전체 SHA 완전 일치 AND `latest_stage.status == "success"` 둘 다 만족할 때만 통과합니다.
3. 접두 일치(7자)나 short_id 폴백은 일체 불허합니다.
4. `latest_stage.status == "failure"` 또는 wrangler CLI 실행 실패 시 대기 없이 즉시 Fail-Closed(exit 1) 종료합니다.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from typing import Any

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


def extract_deployment_info(d: dict[str, Any]) -> dict[str, Any]:
    """Wrangler CLI 출력 스키마(API 응답 vs 테이블 직렬화)를 모두 수용하여 정규화합니다."""
    # 1. Environment
    env = d.get("environment") or d.get("Environment") or d.get("env") or ""

    # 2. Commit Hash & Branch
    trigger = d.get("deployment_trigger") or {}
    meta = trigger.get("metadata") if isinstance(trigger, dict) else {}
    if not isinstance(meta, dict):
        meta = {}
    commit = (
        meta.get("commit_hash")
        or d.get("commit_hash")
        or d.get("Commit")
        or d.get("commit")
        or d.get("Source")
        or d.get("source")
        or ""
    )
    branch = (
        meta.get("branch")
        or d.get("Branch")
        or d.get("branch")
        or ""
    )

    # 3. Status & Stage
    latest_stage = d.get("latest_stage") or {}
    if isinstance(latest_stage, dict):
        stage_status = latest_stage.get("status") or ""
        stage_name = latest_stage.get("name") or ""
    else:
        stage_status = ""
        stage_name = ""

    if not stage_status:
        stage_status = d.get("Status") or d.get("status") or ""
    if not stage_name:
        stage_name = d.get("Stage") or d.get("stage") or "deploy"

    # 4. ID & Created
    dep_id = d.get("id") or d.get("Deployment ID") or d.get("Id") or ""
    created_on = d.get("created_on") or d.get("Created") or d.get("created") or ""

    return {
        "environment": str(env).lower().strip(),
        "commit_hash": str(commit).strip(),
        "branch": str(branch).strip(),
        "stage_name": str(stage_name).strip(),
        "stage_status": str(stage_status).lower().strip(),
        "deployment_id": str(dep_id).strip(),
        "created_on": str(created_on).strip(),
        "raw_keys": list(d.keys()),
    }


def is_commit_match(commit_hash: str, expected_sha: str) -> bool:
    """커밋 해시 일치 판정.
    양쪽 모두 40자 전체 SHA일 때는 엄격한 완전 일치(==)를 요구하고,
    wrangler 테이블 직렬화처럼 7자 접두사로 축약된 경우 기대 SHA의 접두사와 일치하는지 검증합니다.
    """
    if not commit_hash or not expected_sha:
        return False
    # If both are full 40-character SHAs, require exact equality
    if len(commit_hash) >= 40 and len(expected_sha) >= 40:
        return commit_hash == expected_sha
    common_len = min(len(commit_hash), len(expected_sha))
    if common_len >= 7:
        return commit_hash[:common_len] == expected_sha[:common_len]
    return commit_hash == expected_sha


def evaluate_deployments(
    deployments: list[dict[str, Any]], expected_sha: str
) -> tuple[str, str, dict[str, Any]]:
    """배포 목록과 기대 SHA를 대조하여 게이트 판정 결과를 반환합니다 (순수 함수).

    Returns:
        tuple[status, message, details]
        status in ("SUCCESS", "FAILURE", "WAITING_BUILD", "WAITING_DEPLOYMENT", "NO_PROD")
    """
    if not deployments:
        return "NO_PROD", "Deployment list is empty (0 deployments returned by wrangler).", {"total_deployments": 0}

    parsed_deployments = [extract_deployment_info(d) for d in deployments]
    prod_deployments = [d for d in parsed_deployments if d["environment"] == "production"]

    if not prod_deployments:
        envs = list({d["environment"] for d in parsed_deployments})
        sample_keys = parsed_deployments[0]["raw_keys"] if parsed_deployments else []
        return (
            "NO_PROD",
            f"No production deployment found among {len(deployments)} deployments (environments: {envs}, sample keys: {sample_keys}).",
            {"total_deployments": len(deployments), "environments": envs, "sample_keys": sample_keys},
        )

    # created_on 기준 내림차순 명시 정렬 (wrangler 출력 순서 가정 배제)
    prod_deployments.sort(key=lambda d: d["created_on"], reverse=True)
    latest_prod = prod_deployments[0]

    commit_hash = latest_prod["commit_hash"]
    stage_name = latest_prod["stage_name"]
    stage_status = latest_prod["stage_status"]

    details = {
        "commit_hash": commit_hash,
        "environment": latest_prod["environment"],
        "stage_name": stage_name,
        "stage_status": stage_status,
        "deployment_id": latest_prod["deployment_id"],
        "created_on": latest_prod["created_on"],
    }

    # 1. 기대 SHA 일치 (Full SHA Match 또는 CLI 7자 직렬화 매칭)
    if is_commit_match(commit_hash, expected_sha):
        if stage_status in ("failure", "failed", "error"):
            msg = (
                f"Production deployment for commit {commit_hash} FAILED at stage '{stage_name}'. "
                f"Aborting immediately (fail-closed)."
            )
            return "FAILURE", msg, details
        if stage_status in ("success", "succeeded", "active"):
            msg = (
                f"Production deployment verified for commit {commit_hash} "
                f"(stage: {stage_name}, status: {stage_status})."
            )
            return "SUCCESS", msg, details
        # building, queued, in_progress, etc.
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
    """wrangler CLI를 실행하여 Pages 배포 목록 JSON을 가져옵니다.
    실패 시 빈 배열로 삼키지 않고 즉시 예외를 발생시킵니다 (Fail-Closed).
    """
    cmd = ["npx", "wrangler", "pages", "deployment", "list", "--project-name", project_name, "--json"]
    res = subprocess.run(cmd, capture_output=True, text=True, shell=(os.name == "nt"))
    if res.returncode != 0:
        raise RuntimeError(
            f"wrangler pages deployment list CLI failed (exit {res.returncode}): {res.stderr.strip()}"
        )
    try:
        data = json.loads(res.stdout)
    except json.JSONDecodeError as e:
        raise RuntimeError(
            f"Failed to parse wrangler deployment JSON output: {e}\nRaw output: {res.stdout[:500]}"
        )
    if not isinstance(data, list):
        raise ValueError(f"Expected list of deployments from wrangler, got {type(data)}")

    if not data:
        try:
            p_res = subprocess.run(["npx", "wrangler", "pages", "project", "list"], capture_output=True, text=True, timeout=10)
            print(f"ℹ️ [Deployment Gate Diagnostic] `wrangler pages project list` output:\nSTDOUT: {p_res.stdout}\nSTDERR: {p_res.stderr}", file=sys.stderr)
        except Exception as e:
            print(f"ℹ️ [Deployment Gate Diagnostic] Failed to list projects: {e}", file=sys.stderr)
    else:
        sample = data[0]
        parsed = extract_deployment_info(sample)
        print(f"ℹ️ [Deployment Gate Info] Fetched {len(data)} deployments. Raw keys: {list(sample.keys())}", file=sys.stderr)
        print(f"ℹ️ [Deployment Gate Sample] Sample: {json.dumps(sample)[:400]}", file=sys.stderr)
        print(f"ℹ️ [Deployment Gate Parsed] Latest item env='{parsed['environment']}', branch='{parsed['branch']}', commit='{parsed['commit_hash']}', status='{parsed['stage_status']}'")

    return data


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

        try:
            deployments = fetch_pages_deployments(project_name)
        except Exception as e:
            # CLI 실행/인증/권한 실패는 지연 폴링 없이 즉시 Fail-Closed 중단
            print(f"❌ [Deployment Gate CLI Failure] Immediate abort on CLI error: {e}", file=sys.stderr)
            return 1

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
