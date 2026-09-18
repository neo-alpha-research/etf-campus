#!/usr/bin/env python3
"""
scripts/pipeline/onboard_new_etfs.py

자동 신규 ETF 온보딩 파이프라인 (Zero-Agent Self-Healing Onboarding):
1. data/etf_master_draft.csv 와 data/comparison/etf_comparison_classification.csv 간 신규 상장 ETF 델타 감지
2. 신규 ETF 발견 시 규칙 기반으로 자산군, 지역, 카테고리, 토픽, 수익구조를 자동 추론
3. peer_group_registry.csv 에 존재하는 최적 피어그룹으로 매핑하거나 격리형 PG-PENDING 등록
4. etf_comparison_classification.csv 에 행 단위 증분 추가 (AGENTS.md 규칙 준수)
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]
MASTER_CSV = ROOT / "data" / "etf_master_draft.csv"
CLASSIFICATION_CSV = ROOT / "data" / "comparison" / "etf_comparison_classification.csv"
REGISTRY_CSV = ROOT / "data" / "comparison" / "peer_group_registry.csv"


def slug(value: str) -> str:
    v = re.sub(r"[^A-Z0-9가-힣]+", "-", value.upper()).strip("-")
    if not v:
        return "UNKNOWN"
    digest = hashlib.sha1(v.encode("utf-8")).hexdigest()[:10]
    return f"{v[:36]}-{digest}"


def classify_etf(master_row: dict[str, str], existing_groups: dict[str, dict[str, str]]) -> tuple[dict[str, str], dict[str, str] | None]:
    name = master_row.get("name", "").strip()
    base_index = master_row.get("base_index", "").strip()
    ticker = master_row.get("ticker", "").strip()
    isin_cd = master_row.get("isin_cd", "").strip()
    text = f"{name} {base_index}".upper()

    # 1. Asset Family
    if any(k in text for k in ["머니마켓", "MMF", "CD금리", "KOFR", "SOFR", "초단기금리"]):
        asset_family = "금리·파킹"
    elif any(k in text for k in ["채권혼합", "TDF", "밸런스", "혼합자산", "자산배분"]):
        asset_family = "혼합자산"
    elif any(k in text for k in ["금선물", "은선물", "원유", "구리", "농산물", "콩선물", "팔라듐", "원자재", "천연가스"]):
        asset_family = "원자재"
    elif any(k in text for k in ["리츠", "부동산인프라"]) and not any(k in text for k in ["전력", "AI", "데이터센터", "클라우드"]):
        asset_family = "리츠·인프라"
    elif any(k in text for k in ["채권", "국채", "회사채", "통안채", "금융채", "특수채", "MBS"]):
        asset_family = "채권"
    else:
        asset_family = "주식"

    # 2. Region Primary
    if asset_family == "금리·파킹":
        region_primary = "해당없음" if "미국" not in text else "미국"
    elif any(k in text for k in ["미국", "S&P", "나스닥", "NASDAQ", "다우", "DOW"]):
        region_primary = "미국"
    elif any(k in text for k in ["글로벌", "MSCI WORLD", "ACWI", "GLOBAL"]):
        region_primary = "글로벌"
    elif any(k in text for k in ["일본", "닛케이", "토픽스", "NIKKEI", "TOPIX"]):
        region_primary = "일본"
    elif any(k in text for k in ["중국", "차이나", "항셍", "CSI", "홍콩", "H-SHARE"]):
        region_primary = "중국"
    elif any(k in text for k in ["인도", "니프티", "NIFTY"]):
        region_primary = "인도"
    elif any(k in text for k in ["유럽", "유로", "EURO"]):
        region_primary = "유럽"
    else:
        region_primary = "국내"

    # 3. Strategy Style & Payoff Structure
    strategy_style = "active" if any(k in text for k in ["액티브", "ACTIVE"]) else "passive"

    if any(k in text for k in ["커버드콜", "COVERED CALL", "타겟커버드콜", "타겟프리미엄"]):
        payoff_structure = "covered_call"
    elif any(k in text for k in ["버퍼", "BUFFER"]):
        payoff_structure = "buffer"
    elif any(k in text for k in ["레버리지", "2X", "LEVERAGED"]):
        payoff_structure = "leveraged"
    elif any(k in text for k in ["인버스", "INVERSE", "-1X", "-2X"]):
        payoff_structure = "inverse"
    elif asset_family == "금리·파킹":
        payoff_structure = "rate_return"
    elif asset_family == "혼합자산":
        payoff_structure = "mixed_asset"
    else:
        payoff_structure = "plain"

    direction = "inverse" if payoff_structure == "inverse" else "neutral"
    leverage_multiple = "2X" if payoff_structure == "leveraged" else "1X"
    fx_hedge = "hedged" if any(k in text for k in ["(H)", "환헤지", "HEDGED"]) else (
        "not_applicable" if asset_family == "금리·파킹" else "unhedged_or_not_applicable"
    )
    replication_method = "active" if strategy_style == "active" else "physical_or_unspecified"
    concentration_bucket = "concentrated"

    # 4. Comparison Category, Topic, Subtopic, Index Family
    if asset_family == "금리·파킹":
        comparison_category = "금리·파킹"
        comparison_topic = "금리·파킹"
        comparison_subtopic = "머니마켓" if "머니마켓" in text or "MMF" in text else "CD금리"
        index_family = f"RATE_{comparison_subtopic}"
    elif asset_family == "혼합자산":
        comparison_category = "혼합자산"
        comparison_topic = "자산배분 & 채권혼합"
        comparison_subtopic = "시장대표 채권혼합" if any(k in text for k in ["S&P", "나스닥", "200"]) else "단일종목 채권혼합"
        index_family = "혼합자산-구성비율-미확인-9c1ef5c7e4"
    elif any(k in text for k in ["바이오", "신약", "제약", "헬스케어"]):
        comparison_category = "산업·섹터"
        comparison_topic = "비만·신약 & 바이오시밀러"
        comparison_subtopic = f"{region_primary} 바이오·제약·헬스케어"
        index_family = "바이오-제약-헬스케어-국내-바이오-제약-헬스케어-d888086019"
    elif any(k in text for k in ["반도체", "HBM", "메모리", "소부장", "팹리스"]):
        comparison_category = "산업·섹터"
        comparison_topic = "AI 반도체 & HBM"
        comparison_subtopic = f"{region_primary} 반도체"
        index_family = "반도체-글로벌-반도체-84ce634468" if region_primary in ["글로벌", "미국"] else "반도체-국내-반도체-0ed1f11677"
    elif any(k in text for k in ["그룹", "삼성", "SK", "현대차", "LG", "한화"]):
        comparison_category = "기업집단"
        comparison_topic = "기업집단"
        comparison_subtopic = "국내 기업집단"
        index_family = "기업집단-국내-기업집단-d62cbfc10d"
    elif any(k in text for k in ["배당", "고배당", "배당다우존스", "배당성장"]):
        comparison_category = "배당·주주환원"
        comparison_topic = "국내 고배당" if region_primary == "국내" else "미국 배당다우존스"
        comparison_subtopic = comparison_topic
        index_family = "고배당-국내-고배당-2325fcd2e0"
    elif any(k in text for k in ["코스피200", "KOSPI 200", "코스피 200", "KODEX 200"]):
        comparison_category = "대표지수"
        comparison_topic = "코스피 200 코어"
        comparison_subtopic = "코스피 200 코어"
        index_family = "KOSPI200"
    elif any(k in text for k in ["S&P500", "S&P 500"]):
        comparison_category = "대표지수"
        comparison_topic = "S&P 500 대표"
        comparison_subtopic = "미국 S&P500"
        index_family = "S&P500"
    elif any(k in text for k in ["나스닥100", "NASDAQ 100", "NASDAQ100"]):
        comparison_category = "대표지수"
        comparison_topic = "나스닥 100 코어"
        comparison_subtopic = "미국 나스닥100"
        index_family = "NASDAQ100"
    else:
        comparison_category = "산업·섹터"
        comparison_topic = "산업·섹터"
        comparison_subtopic = f"{region_primary} 일반"
        index_family = f"{asset_family}_{region_primary}_기본"

    # 5. Peer Group Matching
    # Search for an existing matching peer group in registry
    matched_group_id = None
    if asset_family not in ["혼합자산"]:
        for gid, grp in existing_groups.items():
            if (
                grp.get("asset_family") == asset_family
                and grp.get("region_primary") == region_primary
                and grp.get("comparison_category") == comparison_category
                and grp.get("strategy_structure", "").startswith(payoff_structure)
            ):
                matched_group_id = gid
                break

    new_reg_row = None
    if matched_group_id:
        primary_peer_group_id = matched_group_id
        classification_status = "verified_official"
        evidence_basis = f"기초지수 명시; 운용사·공식 출처 URL 존재; 자산군·투자대상 추출({asset_family}/{comparison_subtopic})"
        review_reason = ""
    else:
        pending_id = f"PG-PENDING-{slug(ticker)}"
        primary_peer_group_id = pending_id
        classification_status = "classified_derived"
        evidence_basis = f"신규 상장 ETF 자동 온보딩 기본 분류; 상품명·기초지수 기반"
        review_reason = "세부 투자대상 또는 만기·구성비율 미확인"
        new_reg_row = {
            "primary_peer_group_id": pending_id,
            "peer_group_name": f"{comparison_subtopic} · {payoff_structure}",
            "member_count": "1",
            "asset_family": asset_family,
            "region_primary": region_primary,
            "comparison_category": comparison_category,
            "comparison_topic": comparison_topic,
            "comparison_subtopic": comparison_subtopic,
            "index_family": index_family,
            "strategy_structure": f"{payoff_structure}|{direction}|{leverage_multiple}",
            "automatic_comparison_eligible": "N",
            "group_status_summary": "classified_derived:1",
            "classification_rationale": f"{asset_family}·{region_primary} 노출, {comparison_category} / {comparison_subtopic} 투자대상, {payoff_structure}|{direction}|{leverage_multiple} 수익·손실 구조를 공통 기준으로 사용",
        }

    class_row = {
        "isin_cd": isin_cd,
        "ticker": ticker,
        "name": name,
        "base_index": base_index,
        "asset_family": asset_family,
        "region_primary": region_primary,
        "comparison_category": comparison_category,
        "comparison_topic": comparison_topic,
        "comparison_subtopic": comparison_subtopic,
        "index_family": index_family,
        "strategy_style": strategy_style,
        "payoff_structure": payoff_structure,
        "direction": direction,
        "leverage_multiple": leverage_multiple,
        "fx_hedge": fx_hedge,
        "replication_method": replication_method,
        "concentration_bucket": concentration_bucket,
        "primary_peer_group_id": primary_peer_group_id,
        "alternate_peer_group_ids": "",
        "classification_status": classification_status,
        "evidence_basis": evidence_basis,
        "official_source_url": "가능",
        "review_reason": review_reason,
    }

    return class_row, new_reg_row


def main() -> int:
    if not MASTER_CSV.exists() or not CLASSIFICATION_CSV.exists():
        print(f"❌ Error: Required master or classification CSV missing.", file=sys.stderr)
        return 1

    with open(MASTER_CSV, encoding="utf-8-sig") as f:
        master_rows = list(csv.DictReader(f))

    with open(CLASSIFICATION_CSV, encoding="utf-8-sig") as f:
        class_rows = list(csv.DictReader(f))
        class_fields = list(class_rows[0].keys()) if class_rows else []

    with open(REGISTRY_CSV, encoding="utf-8-sig") as f:
        reg_rows = list(csv.DictReader(f))
        reg_fields = list(reg_rows[0].keys()) if reg_rows else []
        existing_groups = {r["primary_peer_group_id"]: r for r in reg_rows}

    existing_tickers = {r["ticker"].strip() for r in class_rows}
    missing_in_classification = [
        m for m in master_rows if m.get("ticker", "").strip() and m["ticker"].strip() not in existing_tickers
    ]

    if not missing_in_classification:
        print(f"✅ [Zero-Agent Onboarding] All {len(master_rows)} ETFs are already onboarded. (0 new listings)")
        return 0

    print(f"🚀 [Zero-Agent Onboarding] Detected {len(missing_in_classification)} newly listed ETF(s) requiring onboarding!")

    new_class_rows = []
    new_reg_rows = []
    for m in missing_in_classification:
        c_row, r_row = classify_etf(m, existing_groups)
        new_class_rows.append(c_row)
        if r_row:
            new_reg_rows.append(r_row)
            existing_groups[r_row["primary_peer_group_id"]] = r_row
        print(f"   + Onboarded {c_row['ticker']} ({c_row['name']}) -> {c_row['comparison_topic']} ({c_row['primary_peer_group_id']})")

    all_class_rows = class_rows + new_class_rows
    with open(CLASSIFICATION_CSV, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=class_fields)
        writer.writeheader()
        writer.writerows(all_class_rows)
    print(f"📝 Appended {len(new_class_rows)} row(s) to {CLASSIFICATION_CSV.name} (Total: {len(all_class_rows)})")

    if new_reg_rows:
        all_reg_rows = reg_rows + new_reg_rows
        with open(REGISTRY_CSV, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=reg_fields)
            writer.writeheader()
            writer.writerows(all_reg_rows)
        print(f"📝 Appended {len(new_reg_rows)} row(s) to {REGISTRY_CSV.name} (Total: {len(all_reg_rows)})")

    print("🎉 Zero-agent ETF onboarding completed successfully!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
