#!/usr/bin/env python3
"""
scripts/check_pages_deployment.py

Cloudflare Pages 배포 검증 게이트 (Production Deployment Gate).
D1 파괴적 마이그레이션 적용 전, 현재 커밋의 Pages 코드가 production 환경에
정상 빌드/배포(latest_stage.status == 'success') 완료되었는지 Cloudflare REST API를
직접 호출하여 40자 전체 SHA 완전 일치로 엄격히 검증합니다.

FM-009 방어 핵심 메커니즘:
1. Cloudflare REST API (GET /accounts/{account_id}/pages/projects/{project}/deployments) 직접 호출.
2. Preview 배포와 격리하여 `environment == "production"` 배포만 `created_on` 내림차순 명시 정렬하여 최신 배포를 선택.
3. `commit_hash == expected_sha` 40자 전체 SHA 완전 일치 AND `latest_stage.status == "success"` 둘 다 만족할 때만 통과.
4. 접두 일치(7자)나 short_id 폴백은 일체 불허 (40자 미만 접두사 매칭 전면 배제).
5. API 호출 실패(401/403/5xx) 및 빌드 실패(failure) 시 대기 없이 즉시 Fail-Closed(exit 1) 종료.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


def resolve_auth_credentials(
    explicit_account_id: str | None = None,
    explicit_token: str | None = None,
) -> tuple[str, str]:
    """Cloudflare 계정 ID 및 API 토큰을 환경 변수 또는 로컬 wrangler 설정에서 추출합니다."""
    account_id = (explicit_account_id or os.environ.get("CLOUDFLARE_ACCOUNT_ID") or "").strip()
    api_token = (
        explicit_token
        or os.environ.get("CLOUDFLARE_API_TOKEN")
        or os.environ.get("CLOUDFLARE_D1_TOKEN")
        or ""
    ).strip()

    # 로컬 개발 환경 편의 폴백: ~/.wrangler/config/default.toml (CI에서는 환경변수가 항상 우선)
    if not api_token or not account_id:
        wrangler_cfg_path = Path(os.path.expanduser(r"~\AppData\Roaming\xdg.config\.wrangler\config\default.toml"))
        if not wrangler_cfg_path.exists():
            wrangler_cfg_path = Path.home() / ".config" / ".wrangler" / "config" / "default.toml"
        if wrangler_cfg_path.exists():
            try:
                cfg_text = wrangler_cfg_path.read_text(encoding="utf-8")
                if not api_token:
                    m_tok = re.search(r'oauth_token\s*=\s*"([^"]+)"', cfg_text)
                    if m_tok:
                        api_token = m_tok.group(1).strip()
                if not account_id:
                    account_id = "dd71905c19e313be635507cee431306d"
            except Exception:
                pass

    return account_id, api_token


def fetch_pages_deployments(
    project_name: str,
    account_id: str,
    api_token: str,
) -> list[dict[str, Any]]:
    """Cloudflare REST API를 호출하여 Pages 배포 목록을 가져옵니다.
    실패(401/403/5xx) 시 첫 시도에서 응답 본문을 그대로 출력하고 즉시 Fail-Closed로 예외를 발생시킵니다.
    """
    if not account_id or not api_token:
        raise RuntimeError(
            "Missing Cloudflare credentials: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set."
        )

    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/pages/projects/{project_name}/deployments"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json",
            "User-Agent": "ETF-Campus-Deployment-Gate/1.0",
        },
        method="GET",
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw_data = resp.read().decode("utf-8")
            data = json.loads(raw_data)
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        print(f"❌ [Deployment Gate API Error] Cloudflare REST API HTTP {e.code}:\n{err_body}", file=sys.stderr)
        raise RuntimeError(f"Cloudflare REST API HTTP {e.code}: {err_body}") from e
    except Exception as e:
        print(f"❌ [Deployment Gate API Error] Connection failed: {e}", file=sys.stderr)
        raise RuntimeError(f"Cloudflare REST API connection error: {e}") from e

    if not data.get("success", False):
        errors = data.get("errors", [])
        raise RuntimeError(f"Cloudflare REST API returned success=False: {errors}")

    results = data.get("result", [])
    if not isinstance(results, list):
        raise ValueError(f"Expected list in API result, got {type(results)}")

    return results


def extract_deployment_info(d: dict[str, Any]) -> dict[str, Any]:
    """Cloudflare REST API 응답 객체를 정규화합니다."""
    env = str(d.get("environment") or "").lower().strip()

    trigger = d.get("deployment_trigger") or {}
    meta = trigger.get("metadata") if isinstance(trigger, dict) else {}
    if not isinstance(meta, dict):
        meta = {}
    commit = str(meta.get("commit_hash") or "").strip()
    branch = str(meta.get("branch") or "").strip()

    latest_stage = d.get("latest_stage") or {}
    if isinstance(latest_stage, dict):
        stage_status = str(latest_stage.get("status") or "").lower().strip()
        stage_name = str(latest_stage.get("name") or "deploy").strip()
    else:
        stage_status = ""
        stage_name = "deploy"

    dep_id = str(d.get("id") or "").strip()
    created_on = str(d.get("created_on") or "").strip()

    return {
        "environment": env,
        "commit_hash": commit,
        "branch": branch,
        "stage_name": stage_name,
        "stage_status": stage_status,
        "deployment_id": dep_id,
        "created_on": created_on,
    }


def evaluate_deployments(
    deployments: list[dict[str, Any]], expected_sha: str
) -> tuple[str, str, dict[str, Any]]:
    """배포 목록과 기대 SHA를 대조하여 게이트 판정 결과를 반환합니다 (순수 함수).

    Returns:
        tuple[status, message, details]
        status in ("SUCCESS", "FAILURE", "WAITING_BUILD", "WAITING_DEPLOYMENT", "NO_PROD")
    """
    if not deployments:
        return "NO_PROD", "Deployment list is empty (0 deployments returned by Cloudflare REST API).", {"total_deployments": 0}

    parsed_deployments = [extract_deployment_info(d) for d in deployments]
    prod_deployments = [d for d in parsed_deployments if d["environment"] == "production"]

    if not prod_deployments:
        envs = list({d["environment"] for d in parsed_deployments})
        return (
            "NO_PROD",
            f"No production deployment found among {len(deployments)} deployments (environments: {envs}).",
            {"total_deployments": len(deployments), "environments": envs},
        )

    # created_on 기준 내림차순 명시 정렬
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

    # 1. 기대 SHA와 40자 전체 완전 일치 (Full SHA Match Only - 접두 일치 불허)
    # REST API 응답에서는 commit_hash가 항상 40자 full SHA로 제공됩니다.
    if commit_hash and commit_hash == expected_sha:
        if stage_status in ("failure", "failed", "error"):
            msg = (
                f"Production deployment for commit {commit_hash} FAILED at stage '{stage_name}'. "
                f"Aborting immediately (fail-closed)."
            )
            return "FAILURE", msg, details
        if stage_status in ("success", "succeeded"):
            # REST API 관측 원본: 2026-09-17 live API 관측 결과 latest_stage.status는 항상 "success"임.
            msg = (
                f"Production deployment verified for commit {commit_hash} "
                f"(stage: {stage_name}, status: {stage_status})."
            )
            return "SUCCESS", msg, details
        # building, queued, initialize, clone_repo, etc.
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


def wait_for_pages_deployment(
    project_name: str,
    expected_sha: str,
    account_id: str | None = None,
    api_token: str | None = None,
    timeout_seconds: int = 240,
    poll_interval: int = 10,
) -> int:
    """Production Pages 배포가 완료될 때까지 폴링합니다."""
    print(f"🔍 [Deployment Gate] Verifying Cloudflare Pages production deployment via REST API for commit: {expected_sha}")
    print(f"   Project: {project_name}, Timeout: {timeout_seconds}s, Poll Interval: {poll_interval}s")

    resolved_account_id, resolved_token = resolve_auth_credentials(account_id, api_token)

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
            deployments = fetch_pages_deployments(project_name, resolved_account_id, resolved_token)
        except Exception as e:
            # API 실행/인증/권한 실패는 지연 폴링 없이 즉시 Fail-Closed 중단
            print(f"❌ [Deployment Gate API Failure] Immediate abort on API error: {e}", file=sys.stderr)
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
    parser = argparse.ArgumentParser(description="Verify Cloudflare Pages production deployment before migration via REST API")
    parser.add_argument("--project-name", default="etf-campus", help="Cloudflare Pages project name")
    parser.add_argument("--expected-sha", default=os.environ.get("GITHUB_SHA", ""), help="Target git commit SHA (40-char)")
    parser.add_argument("--account-id", default=None, help="Cloudflare Account ID")
    parser.add_argument("--api-token", default=None, help="Cloudflare API Token")
    parser.add_argument("--timeout", type=int, default=240, help="Max wait time in seconds")
    parser.add_argument("--interval", type=int, default=10, help="Polling interval in seconds")
    args = parser.parse_args()

    if not args.expected_sha:
        print("❌ --expected-sha argument or GITHUB_SHA environment variable is required.", file=sys.stderr)
        return 1

    return wait_for_pages_deployment(
        project_name=args.project_name,
        expected_sha=args.expected_sha,
        account_id=args.account_id,
        api_token=args.api_token,
        timeout_seconds=args.timeout,
        poll_interval=args.interval,
    )


if __name__ == "__main__":
    sys.exit(main())
