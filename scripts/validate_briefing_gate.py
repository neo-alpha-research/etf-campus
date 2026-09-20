#!/usr/bin/env python3
"""
Pre-Deploy Briefing Quality Gate (배포 전 마켓 브리핑 품질 게이트)
----------------------------------------------------------------
GitHub Actions 파이프라인에서 OSMU 생성/배포 직전에 실행되며,
당일 마켓 브리핑 페이로드의 데이터 무결성을 Pydantic v2 스키마 계약에 따라 검증합니다.

핵심 원칙:
1. Fail-Closed: 12대 거시 지표 Set 불일치, 펀드플로우 5/5 미만, 결측치 발견 시 즉시 exit(1)로 배포 차단.
2. Zero-Hallucination: 임의의 추정치나 거래대금 기반 날조(가짜 폴백)를 전면 박멸.
3. Observability: 단순 PASS 판정이 아닌, 12개 지표와 펀드플로우 수치를 콘솔에 전수 출력.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.schemas.briefing_contract import (
    CANONICAL_MACRO_CODES,
    BriefingContract,
    validate_briefing_payload,
)
from scripts.schemas.contract_constants import MACRO_MAX_DAILY_CHANGE_PCT

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


MAX_SPIKE_PCT = 15.0
MIN_ETF_COUNT = 950


def get_target_bas_dt() -> str:
    master_path = Path("data/etf_master_draft.csv")
    if not master_path.exists():
        print(f"[Gate] ❌ Error: {master_path} 파일이 존재하지 않습니다.", file=sys.stderr)
        sys.exit(1)

    with master_path.open("r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        row = next(reader, None)
        if not row or not row.get("bas_dt"):
            print("[Gate] ❌ Error: etf_master_draft.csv에서 bas_dt를 읽을 수 없습니다.", file=sys.stderr)
            sys.exit(1)
        raw_dt = str(row["bas_dt"]).strip()
        if len(raw_dt) == 8 and raw_dt.isdigit():
            return f"{raw_dt[:4]}-{raw_dt[4:6]}-{raw_dt[6:8]}"
        return raw_dt


def fetch_briefing_payload(bas_dt: str) -> tuple[dict[str, Any] | None, str]:
    """
    브리핑 페이로드를 단일 SSOT 원칙에 따라 조회합니다:
    1. 로컬 정본 산출물 (data/briefing_payload_latest.json)
    2. Cloudflare KV 원격 캐시
    3. Cloudflare D1 원격 데이터베이스
    """
    # 1. Primary: 로컬 정본 산출물 (Zero-D1 Read Dependency)
    for path in (Path(f"data/briefing_payload_{bas_dt}.json"), Path("data/briefing_payload_latest.json")):
        if path.exists():
            try:
                with path.open("r", encoding="utf-8") as f:
                    data = json.load(f)
                    raw = data.get("briefing") or data
                    as_of = str(raw.get("asOfDate") or raw.get("as_of_date") or "").strip()
                    if as_of == bas_dt:
                        return raw, f"local_canonical_artifact ({path.name})"
            except Exception as e:
                print(f"[Gate] 로컬 정본 파일 읽기 오류 안내 ({path.name}): {e}", file=sys.stderr)

    # 2. Secondary: Cloudflare KV 원격 캐시
    kv_cmd = f'npx wrangler kv key get --namespace-id 278805f22a4948b3b9b6c66e8a6a1466 "market-briefing:v0:payload:{bas_dt}:v1" --remote'
    try:
        p_kv = subprocess.run(
            kv_cmd,
            shell=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=15,
        )
        if p_kv.returncode == 0 and p_kv.stdout:
            stdout = p_kv.stdout.strip()
            s_idx = stdout.find("{")
            e_idx = stdout.rfind("}")
            if s_idx != -1 and e_idx != -1:
                body = json.loads(stdout[s_idx : e_idx + 1])
                raw = body.get("briefing") or body
                as_of = str(raw.get("asOfDate") or raw.get("as_of_date") or "").strip()
                if as_of == bas_dt:
                    return raw, "kv_remote"
    except Exception as e:
        print(f"[Gate] KV 직접 조회 시도 중 안내: {e}", file=sys.stderr)

    # 3. Tertiary: Cloudflare D1 직접 쿼리
    sql = (
        f"SELECT as_of_date, general_etf_count, general_total_aum, "
        f"kospi_change_pct, kosdaq_change_pct, "
        f"general_aum_weighted_return_pct, metrics_json "
        f"FROM market_briefings WHERE as_of_date = '{bas_dt}' LIMIT 1;"
    )
    cmd = f'npx wrangler d1 execute etf-prices --remote --json --command "{sql}"'
    try:
        p = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=25,
        )
        if p.returncode == 0 and p.stdout:
            stdout = p.stdout.strip()
            s_idx = stdout.find("[")
            e_idx = stdout.rfind("]")
            if s_idx != -1 and e_idx != -1:
                d1_data = json.loads(stdout[s_idx : e_idx + 1])
                if d1_data and isinstance(d1_data, list) and d1_data[0].get("results"):
                    row = d1_data[0]["results"][0]
                    metrics = json.loads(row.get("metrics_json") or "{}")
                    metrics["asOfDate"] = row.get("as_of_date")
                    metrics["generalEtfCount"] = row.get("general_etf_count")
                    metrics["generalTotalAum"] = row.get("general_total_aum")
                    metrics["generalAumWeightedReturnPct"] = row.get("general_aum_weighted_return_pct")
                    return metrics, "d1_remote"
    except Exception as e:
        print(f"[Gate] D1 직접 조회 시도 중 안내: {e}", file=sys.stderr)

    return None, "none"


def main() -> int:
    parser = argparse.ArgumentParser(description="Pre-Deploy Briefing Quality Gate")
    parser.add_argument("--date", type=str, help="Target as_of_date (YYYY-MM-DD)")
    args = parser.parse_args()

    bas_dt = args.date if args.date else get_target_bas_dt()
    print("=" * 70)
    print("🛡️ [Quality Gate] Pre-Deploy Market Briefing Schema & Integrity Gate")
    print(f"Target As-Of-Date : {bas_dt}")
    print(f"Strict Contract   : Macro 12 Exact Set, FundFlow In/Out >= 5, ETFs >= {MIN_ETF_COUNT}")
    print("=" * 70)

    payload, source = fetch_briefing_payload(bas_dt)
    if not payload:
        print(f"\n❌ [GATE FAIL] Target date ({bas_dt}) briefing payload not found across any source.", file=sys.stderr)
        print("  -> Build step (build_local_briefing_payload.py) did not run or failed.", file=sys.stderr)
        return 1

    print(f"📦 [Gate] Loaded payload from: {source}")

    # Pydantic v2 Schema Contract Validation (Fail-Closed)
    is_valid, errors, contract = validate_briefing_payload(payload)

    if not is_valid or contract is None:
        print(f"\n❌ [GATE FAIL] BRIEFING SCHEMA CONTRACT VIOLATIONS DETECTED ({len(errors)} errors):", file=sys.stderr)
        for err in errors:
            print(f"  * {err}", file=sys.stderr)
        print("\n🚫 [BLOCKED] Production deployment aborted to prevent publishing defective data.", file=sys.stderr)
        return 1

    # Financial Sanity Spikes Check
    spikes: list[str] = []
    for m in contract.market_indices:
        allowed = MACRO_MAX_DAILY_CHANGE_PCT.get(m.code, MACRO_MAX_DAILY_CHANGE_PCT.get("DEFAULT", 15.0))
        if abs(m.change_pct) > allowed:
            spikes.append(f"{m.code} 등락률 {m.change_pct:+.2f}% (허용 한계: ±{allowed}%)")

    default_limit = MACRO_MAX_DAILY_CHANGE_PCT.get("DEFAULT", 15.0)
    if abs(contract.aum_weighted_return_pct) > default_limit:
        spikes.append(f"시장 가중수익률 {contract.aum_weighted_return_pct:+.2f}% (허용 한계: ±{default_limit}%)")

    if spikes:
        print(f"\n❌ [GATE FAIL] ABNORMAL FINANCIAL SPIKES DETECTED ({len(spikes)} items):", file=sys.stderr)
        for sp in spikes:
            print(f"  * {sp}", file=sys.stderr)
        print("\n🚫 [BLOCKED] Production deployment aborted for market data sanity.", file=sys.stderr)
        return 1

    # Print Full Observations (Transparent Engineering Verification)
    print("\n" + "-" * 70)
    print(f"📊 [GATE OBSERVATIONS] 기준일자: {contract.as_of_date}")
    print(f"  - 일반 ETF 종목수: {contract.general_etf_count:,}개")
    print(f"  - 총 순자산(AUM) : {contract.general_total_aum / 1e12:,.1f}조원")
    print(f"  - 시장 가중수익률 : {contract.aum_weighted_return_pct:+.2f}%")
    print("-" * 70)
    print(f"🌐 [12대 글로벌 거시 지표 관측값 (12/12 Set Verified)]")
    for m in contract.market_indices:
        print(f"  * {m.code:<8s} ({m.label:<10s}): {m.value:>12,.2f} ({m.change_pct:>+6.2f}%) [기준일: {m.as_of_date}]")
    print("-" * 70)
    print(f"💰 [스마트머니 당일 실질 순유입 Top 5]")
    for i, f in enumerate(contract.top_inflows[:5], 1):
        print(f"  * #{i} {f.ticker} {f.name:<25s}: {f.net_flow / 1e8:>+10,.1f}억원")
    print(f"💸 [스마트머니 당일 실질 순유출 Top 5]")
    for i, f in enumerate(contract.top_outflows[:5], 1):
        print(f"  * #{i} {f.ticker} {f.name:<25s}: {f.net_flow / 1e8:>+10,.1f}억원")
    print("=" * 70)
    print("✅ [GATE PASS] ALL DATA INTEGRITY & FINANCIAL SANITY CONTRACTS VERIFIED!")
    print("🚀 [APPROVED] Proceeding to production OSMU generation & deployment.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
