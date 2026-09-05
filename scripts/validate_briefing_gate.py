#!/usr/bin/env python3
"""
Pre-Deploy Briefing Quality Gate (배포 전 마켓 브리핑 품질 게이트)
----------------------------------------------------------------
production 배포(market-briefing-production.yml) 트리거 직전에 실행되며,
D1 및 브리핑 API/데이터 소스의 데이터 무결성을 10대 핵심 체크리스트로 정밀 검증합니다.
하나라도 실패 시 exit(1)로 배포를 선제 차단하여 결함 데이터 노출을 원천 방지합니다.

검증 체크리스트 (10대 무결성 기준):
  1. as_of_date 날짜 일치 (etf_master_draft.csv의 bas_dt와 일치)
  2. general_etf_count 종목 수 (최소 800개 이상)
  3. KOSPI 등락률 누락 여부 (IS NOT NULL)
  4. KOSDAQ 등락률 누락 여부 (IS NOT NULL)
  5. general_total_aum 정상 수치 (양수 및 정상 규모)
  6. peer_groups 테마 수 (최소 3개 이상)
  7. asset_classes 자산군 수 (최소 4개 이상)
  8. top_inflows 실질 순유입 데이터 존재 여부 (최소 1건 이상)
  9. KOSPI/KOSDAQ 일간 등락률 이상 스파이크 (±15% 이내)
  10. ETF 시장 가중수익률 이상 스파이크 (±15% 이내)
"""

import sys
import os
import csv
import json
import urllib.request
import urllib.error
import subprocess
from pathlib import Path

MAX_SPIKE_PCT = 15.0
MIN_ETF_COUNT = 800
MIN_PEER_GROUPS = 3
MIN_ASSET_CLASSES = 4

def get_target_bas_dt() -> str:
    master_path = Path("data/etf_master_draft.csv")
    if not master_path.exists():
        print(f"[Gate] ❌ Error: {master_path} 파일이 존재하지 않습니다.")
        sys.exit(1)
    
    with master_path.open("r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        row = next(reader, None)
        if not row or not row.get("bas_dt"):
            print("[Gate] ❌ Error: etf_master_draft.csv에서 bas_dt를 읽을 수 없습니다.")
            sys.exit(1)
        raw_dt = str(row["bas_dt"]).strip()
        if len(raw_dt) == 8 and raw_dt.isdigit():
            return f"{raw_dt[:4]}-{raw_dt[4:6]}-{raw_dt[6:8]}"
        return raw_dt

def fetch_briefing_payload(bas_dt: str) -> dict | None:
    # 1. Wrangler D1 직접 쿼리 (Cloudflare 토큰 또는 wrangler 로그인 환경)
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
            data = json.loads(p.stdout)
            if data and isinstance(data, list) and data[0].get("results"):
                row = data[0]["results"][0]
                metrics = json.loads(row.get("metrics_json") or "{}")
                return {
                    "asOfDate": row.get("as_of_date"),
                    "generalEtfCount": row.get("general_etf_count"),
                    "generalTotalAum": row.get("general_total_aum"),
                    "kospiChangePct": row.get("kospi_change_pct"),
                    "kosdaqChangePct": row.get("kosdaq_change_pct"),
                    "generalAumWeightedReturnPct": row.get("general_aum_weighted_return_pct"),
                    "peerGroups": metrics.get("peer_groups") or metrics.get("peerGroups") or [],
                    "assetClasses": (
                        metrics.get("asset_classes")
                        or metrics.get("assetClasses")
                        or (metrics.get("market_scale") or {}).get("categories")
                        or (metrics.get("market_scale") or {}).get("composition")
                        or []
                    ),
                    "periodicFlows": metrics.get("periodic_flows") or metrics.get("periodicFlows") or metrics.get("fund_flow") or metrics.get("fundFlow") or {},
                    "source": "d1_remote"
                }
    except Exception as e:
        print(f"[Gate] D1 직접 조회 시도 중 안내 (HTTP API로 폴백): {e}")

    # 2. Pages / Publisher API fallback
    urls_to_try = [
        f"https://etf-campus.pages.dev/api/briefings/{bas_dt}",
        "https://etf-campus.pages.dev/api/briefings/latest",
    ]

    for url in urls_to_try:
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ETF-Campus-Quality-Gate/1.0"
            })
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    body = json.loads(resp.read().decode("utf-8"))
                    raw = body.get("briefing") or body
                    as_of_date = raw.get("asOfDate") or raw.get("as_of_date")
                    # latest 조회 시 타겟 날짜와 일치하는지 확인
                    if as_of_date != bas_dt:
                        continue

                    pulse = raw.get("pulse") or {}
                    indices = raw.get("marketIndices") or []
                    kospi = next((i for i in indices if i.get("code") == "KOSPI"), {})
                    kosdaq = next((i for i in indices if i.get("code") == "KOSDAQ"), {})
                    
                    return {
                        "asOfDate": as_of_date,
                        "generalEtfCount": pulse.get("generalEtfCount") or raw.get("generalEtfCount") or raw.get("general_etf_count"),
                        "generalTotalAum": pulse.get("generalTotalAum") or raw.get("generalTotalAum") or raw.get("general_total_aum"),
                        "kospiChangePct": kospi.get("change_pct") if kospi.get("change_pct") is not None else raw.get("kospiChangePct"),
                        "kosdaqChangePct": kosdaq.get("change_pct") if kosdaq.get("change_pct") is not None else raw.get("kosdaqChangePct"),
                        "generalAumWeightedReturnPct": pulse.get("generalAumWeightedReturnPct") if pulse.get("generalAumWeightedReturnPct") is not None else raw.get("generalAumWeightedReturnPct"),
                        "peerGroups": raw.get("peerGroups") or raw.get("peer_groups") or [],
                        "assetClasses": raw.get("assetClasses") or raw.get("asset_classes") or [],
                        "periodicFlows": raw.get("periodicFlows") or raw.get("periodic_flows") or raw.get("fundFlow") or raw.get("fund_flow") or {},
                        "source": "api_endpoint"
                    }
        except Exception as e:
            print(f"[Gate] API {url} 조회 실패 안내: {e}")
            continue

    return None

def validate_briefing_quality(briefing: dict, expected_date: str) -> list[str]:
    errors = []

    # 1. 날짜 일치
    as_of_date = briefing.get("asOfDate")
    if not as_of_date or as_of_date != expected_date:
        errors.append(f"[#1 날짜 불일치] 브리핑 날짜({as_of_date}) != 기대 기준일({expected_date})")

    # 2. 종목 수 검증
    etf_count = briefing.get("generalEtfCount") or 0
    if etf_count < MIN_ETF_COUNT:
        errors.append(f"[#2 종목수 부족] 일반 ETF {etf_count}개 (최소 기준: {MIN_ETF_COUNT}개)")

    # 3. KOSPI 등락률 누락 검증
    kospi_ret = briefing.get("kospiChangePct")
    if kospi_ret is None:
        errors.append("[#3 KOSPI 누락] KOSPI 일간 등락률 데이터가 null입니다.")
    elif abs(float(kospi_ret)) > MAX_SPIKE_PCT:
        errors.append(f"[#9 KOSPI 스파이크] KOSPI 등락률 {kospi_ret}% (허용 한계: ±{MAX_SPIKE_PCT}%)")

    # 4. KOSDAQ 등락률 누락 검증
    kosdaq_ret = briefing.get("kosdaqChangePct")
    if kosdaq_ret is None:
        errors.append("[#4 KOSDAQ 누락] KOSDAQ 일간 등락률 데이터가 null입니다.")
    elif abs(float(kosdaq_ret)) > MAX_SPIKE_PCT:
        errors.append(f"[#9 KOSDAQ 스파이크] KOSDAQ 등락률 {kosdaq_ret}% (허용 한계: ±{MAX_SPIKE_PCT}%)")

    # 5. AUM 정상 범위 검증
    aum = briefing.get("generalTotalAum") or 0
    if aum <= 0:
        errors.append(f"[#5 AUM 이상] 총 순자산(AUM) 수치가 비정상(0 이하): {aum}")

    # 6. 테마 그룹 검증
    peer_groups = briefing.get("peerGroups") or []
    if len(peer_groups) < MIN_PEER_GROUPS:
        errors.append(f"[#6 테마 부족] peerGroups {len(peer_groups)}개 (최소 기준: {MIN_PEER_GROUPS}개)")

    # 7. 자산군 그룹 검증
    asset_classes = briefing.get("assetClasses") or []
    if len(asset_classes) < MIN_ASSET_CLASSES:
        errors.append(f"[#7 자산군 부족] assetClasses {len(asset_classes)}개 (최소 기준: {MIN_ASSET_CLASSES}개)")

    # 8. 실질 순유입 TOP 데이터 검증
    flows = briefing.get("periodicFlows") or {}
    daily_flows = flows.get("dailyFundFlows") or flows.get("daily_fund_flows") or flows.get("general") or {}
    inflows = daily_flows.get("topInflows") or daily_flows.get("top_inflows") or []
    if len(inflows) == 0:
        errors.append("[#8 자금유입 누락] 당일 실질 순유입 TOP5 종목 데이터가 비어 있습니다.")

    # 10. ETF 가중수익률 이상 스파이크 검증
    etf_ret = briefing.get("generalAumWeightedReturnPct")
    if etf_ret is not None and abs(float(etf_ret)) > MAX_SPIKE_PCT:
        errors.append(f"[#10 ETF수익률 스파이크] 시장 가중수익률 {etf_ret}% (허용 한계: ±{MAX_SPIKE_PCT}%)")

    return errors

def main():
    # Enforce UTF-8 stdout if supported
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')

    import argparse
    parser = argparse.ArgumentParser(description="Pre-Deploy Briefing Quality Gate")
    parser.add_argument("--date", type=str, help="Target as_of_date (YYYY-MM-DD)")
    args = parser.parse_args()

    bas_dt = args.date if args.date else get_target_bas_dt()
    print("=" * 70)
    print("[Quality Gate] Pre-Deploy Market Briefing Verification")
    print(f"Target As-Of-Date : {bas_dt}")
    print(f"Enforcing Rules   : ETF >= {MIN_ETF_COUNT}, Themes >= {MIN_PEER_GROUPS}, Assets >= {MIN_ASSET_CLASSES}, Spike <= +-{MAX_SPIKE_PCT}%")
    print("=" * 70)

    briefing = fetch_briefing_payload(bas_dt)
    if not briefing:
        print(f"[Gate] [FAIL]: Target date ({bas_dt}) briefing data not found in D1 or API endpoints.")
        print("  -> D1 market briefing ingestion is not completed or missing.")
        sys.exit(1)

    print(f"[Gate] Briefing payload loaded successfully (Source: {briefing.get('source', 'unknown')})")
    errors = validate_briefing_quality(briefing, bas_dt)

    if errors:
        print(f"\n[Gate] [FAIL] QUALITY GATE FAILED ({len(errors)} violations detected):")
        for err in errors:
            print(f"  * {err}")
        print("\n[BLOCKED] Production deployment aborted for data integrity. (Zero-Hallucination Guard)")
        sys.exit(1)

    print("\n[Gate] [PASS] ALL 10 QUALITY CHECKS PASSED!")
    print(f"  - As-Of-Date: {briefing['asOfDate']}")
    print(f"  - General ETFs: {briefing['generalEtfCount']}")
    print(f"  - KOSPI: {briefing['kospiChangePct']}% / KOSDAQ: {briefing['kosdaqChangePct']}%")
    print(f"  - Total AUM: {briefing['generalTotalAum']} / Themes: {len(briefing['peerGroups'])} / AssetClasses: {len(briefing['assetClasses'])}")
    print("\n[APPROVED] Proceeding to production deployment.")
    sys.exit(0)

if __name__ == '__main__':
    main()

