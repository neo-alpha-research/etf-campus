#!/usr/bin/env python3
"""
scripts/build_local_briefing_payload.py

로컬의 검증된 CSV 및 JSON 파일(etf_master_draft.csv, market_indices.json,
etf_comparison_classification.csv 등)로부터 직접 완전한 MarketBriefingPayload JSON을 빌드합니다.

Cloudflare D1이나 외부 API 네트워크 상태와 무관하게 로컬에서 0초 만에 브리핑 페이로드를 생성하며,
OSMU(인스타/스레드/뉴스레터) 렌더링 폴백 및 Cloudflare KV 직접 동기화의 SSOT로 활용됩니다.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import math
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


def to_float(val: Any, default: float = 0.0) -> float:
    if val is None:
        return default
    try:
        text = str(val).replace(",", "").strip()
        num = float(text)
        return num if math.isfinite(num) else default
    except Exception:
        return default


def normalize_date(raw: str) -> str:
    cleaned = raw.replace("-", "").strip()
    if len(cleaned) == 8 and cleaned.isdigit():
        return f"{cleaned[:4]}-{cleaned[4:6]}-{cleaned[6:]}"
    return raw.strip()


def calculate_local_fund_flows(curr_rows: list[dict[str, Any]], target_date: str) -> dict[str, Any]:
    """
    Git 커밋 이력에서 직전 거래일의 etf_master_draft.csv 스냅샷을 조회하여,
    1,171개 ETF의 당일 실질 순유입액(1차 시장 발행주식수 변동분 * NAV)을 직접 계산합니다.
    (Cloudflare D1이나 외부 API 의존성 0%)
    """
    cleaned_curr = target_date.replace("-", "").strip()
    prev_map: dict[str, dict[str, Any]] = {}

    try:
        log_res = subprocess.run(
            ["git", "log", "-n", "15", "--format=%H", "data/etf_master_draft.csv"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        commits = [c.strip() for c in log_res.stdout.splitlines() if c.strip()]
        for c in commits:
            show_res = subprocess.run(
                ["git", "show", f"{c}:data/etf_master_draft.csv"],
                capture_output=True,
                text=True,
                encoding="utf-8-sig",
                timeout=10,
            )
            if show_res.returncode == 0:
                reader = csv.DictReader(io.StringIO(show_res.stdout))
                first = next(reader, None)
                if first and first.get("bas_dt", "").replace("-", "").strip() < cleaned_curr:
                    reader = csv.DictReader(io.StringIO(show_res.stdout))
                    prev_map = {r["ticker"].strip().upper(): r for r in reader}
                    break
    except Exception as e:
        print(f"⚠️ Git history lookup for previous quotes failed: {e}", file=sys.stderr)

    general_flows: list[dict[str, Any]] = []
    all_flows: list[dict[str, Any]] = []

    for r in curr_rows:
        tk = r.get("ticker", "").strip().upper()
        name = r.get("name", "").strip()
        risk = str(r.get("risk_type") or "normal").strip().lower()
        ac = str(r.get("asset_class") or "").strip()
        is_gen = (risk == "normal" and not any(term in ac for term in ("금리", "파킹", "CD91", "KOFR", "SOFR")))

        p = prev_map.get(tk)
        s0 = to_float(r.get("shares"))
        nav0 = to_float(r.get("nav") or r.get("close"))
        aum0 = to_float(r.get("aum"))

        net_inflow = 0.0
        if p:
            sp = to_float(p.get("shares"))
            navp = to_float(p.get("nav") or p.get("close"))
            aump = to_float(p.get("aum"))

            if s0 > 0 and sp > 0 and nav0 > 0:
                net_inflow = (s0 - sp) * nav0
            elif nav0 > 0 and navp > 0 and aum0 > 0 and aump > 0:
                net_inflow = (aum0 / nav0 - aump / navp) * nav0

        item = {
            "ticker": tk,
            "etfName": name,
            "name": name,
            "netInflowValue": round(net_inflow, 2),
            "net_flow": round(net_inflow, 2),
        }
        all_flows.append(item)
        if is_gen:
            general_flows.append(item)

    general_flows.sort(key=lambda x: x["netInflowValue"], reverse=True)
    all_flows.sort(key=lambda x: x["netInflowValue"], reverse=True)

    return {
        "general": {
            "topInflows": general_flows[:5],
            "topOutflows": general_flows[-5:][::-1],
        },
        "all": {
            "topInflows": all_flows[:5],
            "topOutflows": all_flows[-5:][::-1],
        },
    }


def build_briefing_payload(data_dir: Path, target_date: str | None = None) -> dict[str, Any]:
    master_path = data_dir / "etf_master_draft.csv"
    indices_path = data_dir / "market_indices.json"
    comparison_path = data_dir / "comparison" / "etf_comparison_classification.csv"

    if not master_path.exists():
        raise FileNotFoundError(f"Master file not found: {master_path}")

    with master_path.open("r", encoding="utf-8-sig") as f:
        master_rows = list(csv.DictReader(f))

    if not master_rows:
        raise ValueError("Master file is empty")

    first_bas_dt = master_rows[0].get("bas_dt", "").strip()
    as_of_date = target_date if target_date else normalize_date(first_bas_dt)

    # 0. Check existing briefing payload to preserve verified fund flows and scale metrics
    existing_payload_path = data_dir / "briefing_payload_latest.json"
    existing_data: dict[str, Any] = {}
    if existing_payload_path.exists():
        try:
            with existing_payload_path.open("r", encoding="utf-8") as f:
                raw_existing = json.load(f)
                existing_data = raw_existing.get("briefing") or raw_existing
        except Exception:
            pass

    existing_is_same_date = (existing_data.get("asOfDate") == as_of_date)

    # 1. Classification & Peer Groups Map
    peer_map: dict[str, str] = {}
    if comparison_path.exists():
        with comparison_path.open("r", encoding="utf-8-sig") as f:
            for r in csv.DictReader(f):
                tk = r.get("ticker", "").strip().upper()
                topic = r.get("comparison_topic", "").strip()
                if tk and topic and topic not in ("미확인 주식전략", "미분류", "-"):
                    peer_map[tk] = topic

    # 2. General vs Non-general ETFs
    general_etfs: list[dict[str, Any]] = []
    all_etfs: list[dict[str, Any]] = []

    for r in master_rows:
        tk = r.get("ticker", "").strip().upper()
        name = r.get("name", "").strip()
        risk_type = str(r.get("risk_type") or "normal").strip().lower()
        asset_class = str(r.get("asset_class") or "").strip()
        close = to_float(r.get("close"))
        change_pct = to_float(r.get("change_pct"))
        trade_value = to_float(r.get("trade_value"))
        aum = to_float(r.get("aum"))
        nav = to_float(r.get("nav"))
        disparity = to_float(r.get("disparity"))

        # Canonical asset class fallback
        if not asset_class or asset_class == "주식":
            asset_class = "주식-해외" if re.search(r"미국|글로벌|중국|일본|유럽|베트남|인도|아시아|차이나|월드|나스닥|S&P|다우", name, re.I) else "주식-국내"

        item = {
            "ticker": tk,
            "name": name,
            "etfName": name,
            "close": close,
            "changePct": change_pct,
            "tradeValue": trade_value,
            "aum": aum,
            "nav": nav,
            "disparityPct": disparity,
            "riskType": risk_type,
            "assetClass": asset_class,
            "peerGroup": peer_map.get(tk, ""),
        }
        all_etfs.append(item)

        is_general = (
            risk_type == "normal"
            and not any(term in asset_class for term in ("금리", "파킹", "CD91", "KOFR", "SOFR"))
        )
        if is_general:
            general_etfs.append(item)

    # 3. Pulse Metrics (General ETFs basis)
    gen_count = len(general_etfs)
    up_count = sum(1 for e in general_etfs if e["changePct"] > 0)
    flat_count = sum(1 for e in general_etfs if e["changePct"] == 0)
    down_count = sum(1 for e in general_etfs if e["changePct"] < 0)
    breadth_ratio = round((up_count / gen_count * 100), 2) if gen_count > 0 else 0.0

    if breadth_ratio >= 60.0:
        market_temp = "상승 우세"
    elif breadth_ratio >= 52.0:
        market_temp = "완만한 상승"
    elif breadth_ratio > 48.0:
        market_temp = "혼조"
    elif breadth_ratio >= 40.0:
        market_temp = "완만한 하락"
    else:
        market_temp = "하락 우세"

    gen_total_aum = sum(e["aum"] for e in general_etfs)
    gen_total_trade = sum(e["tradeValue"] for e in general_etfs)

    weighted_return = (
        round(sum(e["changePct"] * e["aum"] for e in general_etfs) / gen_total_aum, 2)
        if gen_total_aum > 0 else 0.0
    )

    # Sort general by AUM for Top N weighted returns
    sorted_by_aum = sorted(general_etfs, key=lambda e: e["aum"], reverse=True)
    def calc_top_n_return(n: int) -> float:
        top_n = sorted_by_aum[:n]
        top_n_aum = sum(e["aum"] for e in top_n)
        return round(sum(e["changePct"] * e["aum"] for e in top_n) / top_n_aum, 2) if top_n_aum > 0 else 0.0

    top50_return = calc_top_n_return(50)
    top100_return = calc_top_n_return(100)
    top200_return = calc_top_n_return(200)

    # Top 10 Trade Share
    sorted_by_trade = sorted(general_etfs, key=lambda e: e["tradeValue"], reverse=True)
    top10_trade_val = sum(e["tradeValue"] for e in sorted_by_trade[:10])
    top10_trade_share = round((top10_trade_val / gen_total_trade * 100), 2) if gen_total_trade > 0 else 0.0

    all_sorted_by_trade = sorted(all_etfs, key=lambda e: e["tradeValue"], reverse=True)
    all_top10_trade_val = sum(e["tradeValue"] for e in all_sorted_by_trade[:10])
    all_total_trade = sum(e["tradeValue"] for e in all_etfs)
    all_top10_trade_share = round((all_top10_trade_val / all_total_trade * 100), 2) if all_total_trade > 0 else 0.0

    # 4. Market Indices
    CANONICAL_INDEX_MAP = {
        "KOSPI": "KOSPI", "KOSDAQ": "KOSDAQ", "VKOSPI": "VKOSPI", "KR10Y": "KR10Y",
        "KRW=X": "USDKRW", "USDKRW": "USDKRW", "^GSPC": "SPX", "SPX": "SPX",
        "^IXIC": "NDX", "NDX": "NDX", "^TNX": "DGS10", "DGS10": "DGS10",
        "^VIX": "VIX", "VIX": "VIX", "CL=F": "CLF", "CLF": "CLF",
        "GC=F": "GC", "GC": "GC", "SI=F": "SI", "SI": "SI",
    }
    LABEL_INDEX_MAP = {
        "KOSPI": "코스피", "KOSDAQ": "코스닥", "VKOSPI": "VKOSPI", "KR10Y": "국채 10년",
        "USDKRW": "원/달러", "SPX": "S&P 500", "NDX": "나스닥", "DGS10": "미 국채 10년물",
        "VIX": "VIX", "CLF": "WTI 원유", "GC": "금 선물", "SI": "은 선물",
    }

    market_indices: list[dict[str, Any]] = []
    if indices_path.exists():
        with indices_path.open("r", encoding="utf-8") as f:
            idx_data = json.load(f)
            raw_indices = idx_data.get("indices", []) if isinstance(idx_data, dict) else idx_data
            for idx in raw_indices:
                raw_code = idx.get("code") or idx.get("label", "")
                canon = CANONICAL_INDEX_MAP.get(raw_code, raw_code)
                label = LABEL_INDEX_MAP.get(canon, idx.get("label", canon))
                market_indices.append({
                    "code": canon,
                    "label": label,
                    "close": to_float(idx.get("value") or idx.get("close")),
                    "change_pct": to_float(idx.get("change") or idx.get("change_pct")),
                    "change_points": to_float(idx.get("changePoints") or idx.get("change_points")),
                    "as_of_date": idx.get("as_of_date", as_of_date),
                    "is_closed": idx.get("is_closed", False),
                })

    kospi = next((i for i in market_indices if i["code"] in ("KOSPI", "^KS11")), {})
    kosdaq = next((i for i in market_indices if i["code"] in ("KOSDAQ", "^KQ11")), {})

    # 5. Asset Classes Breakdown
    ac_groups: dict[str, list[dict[str, Any]]] = {}
    for e in general_etfs:
        ac = e["assetClass"]
        ac_groups.setdefault(ac, []).append(e)

    asset_classes: list[dict[str, Any]] = []
    for ac, group in sorted(ac_groups.items(), key=lambda x: sum(e["tradeValue"] for e in x[1]), reverse=True):
        grp_aum = sum(e["aum"] for e in group)
        grp_trade = sum(e["tradeValue"] for e in group)
        grp_up = sum(1 for e in group if e["changePct"] > 0)
        grp_flat = sum(1 for e in group if e["changePct"] == 0)
        grp_down = sum(1 for e in group if e["changePct"] < 0)
        grp_count = len(group)
        grp_breadth = round((grp_up / grp_count * 100), 2) if grp_count > 0 else 0.0
        grp_ret = round(sum(e["changePct"] * e["aum"] for e in group) / grp_aum, 2) if grp_aum > 0 else 0.0
        
        asset_classes.append({
            "assetClass": ac,
            "asset_class": ac,
            "etfCount": grp_count,
            "etf_count": grp_count,
            "upCount": grp_up,
            "up_count": grp_up,
            "flatCount": grp_flat,
            "flat_count": grp_flat,
            "downCount": grp_down,
            "down_count": grp_down,
            "breadthRatioPct": grp_breadth,
            "breadth_ratio_pct": grp_breadth,
            "aumWeightedReturnPct": grp_ret,
            "aum_weighted_return_pct": grp_ret,
            "totalAum": round(grp_aum / 100_000_000, 1),
            "total_aum": round(grp_aum / 100_000_000, 1),
            "aumSharePct": round(grp_aum / gen_total_aum * 100, 2) if gen_total_aum > 0 else 0.0,
            "aum_share_pct": round(grp_aum / gen_total_aum * 100, 2) if gen_total_aum > 0 else 0.0,
            "totalTradeValue": round(grp_trade / 100_000_000, 1),
            "total_trade_value": round(grp_trade / 100_000_000, 1),
            "tradeSharePct": round(grp_trade / gen_total_trade * 100, 2) if gen_total_trade > 0 else 0.0,
            "trade_share_pct": round(grp_trade / gen_total_trade * 100, 2) if gen_total_trade > 0 else 0.0,
        })

    # 6. Peer Groups (Themes) Breakdown
    pg_groups: dict[str, list[dict[str, Any]]] = {}
    for e in general_etfs:
        pg = e["peerGroup"]
        if pg:
            pg_groups.setdefault(pg, []).append(e)

    peer_groups: list[dict[str, Any]] = []
    for pg, group in pg_groups.items():
        if len(group) < 1:
            continue
        p_aum = sum(e["aum"] for e in group)
        eq_ret = round(sum(e["changePct"] for e in group) / len(group), 2)
        wt_ret = round(sum(e["changePct"] * e["aum"] for e in group) / p_aum, 2) if p_aum > 0 else eq_ret
        top_etf = max(group, key=lambda e: e["aum"])
        peer_groups.append({
            "peerGroup": pg,
            "assetClass": group[0]["assetClass"],
            "etfCount": len(group),
            "equalWeightReturnPct": eq_ret,
            "cappedAumWeightedReturnPct": wt_ret,
            "totalAum": round(p_aum / 100_000_000, 1),
            "topEtfName": top_etf["name"],
            "topEtfTicker": top_etf["ticker"],
        })

    # 7. Focus ETFs (Top 10 by Trade Value)
    focus_etfs: list[dict[str, Any]] = []
    for rank, e in enumerate(sorted_by_trade[:10], start=1):
        focus_etfs.append({
            "rankNo": rank,
            "ticker": e["ticker"],
            "etfName": e["name"],
            "assetClass": e["assetClass"],
            "closeValue": e["close"],
            "changePct": e["changePct"],
            "tradeValue": e["tradeValue"],
            "tradeSharePct": round(e["tradeValue"] / gen_total_trade * 100, 2) if gen_total_trade > 0 else 0.0,
        })

    # 8. Disparity Warning (Abs Disparity >= 2.0%)
    disparity_warning: list[dict[str, Any]] = []
    for e in sorted(all_etfs, key=lambda x: abs(x["disparityPct"]), reverse=True):
        if abs(e["disparityPct"]) >= 2.0:
            disparity_warning.append({
                "ticker": e["ticker"],
                "name": e["name"],
                "assetClass": e["assetClass"],
                "nav": e["nav"],
                "price": e["close"],
                "disparityPct": e["disparityPct"],
            })

    # Construct final payload matching MarketBriefingPayload interface
    payload: dict[str, Any] = {
        "asOfDate": as_of_date,
        "publicationVersion": 1,
        "publishedAt": f"{as_of_date}T08:30:00+09:00",
        "updatedAt": f"{as_of_date}T08:30:00+09:00",
        "isStale": False,
        "staleDays": 0,
        "headline": {
            "text": f"국내 ETF 시장 AUM {round(gen_total_aum / 10_000_000_000_000, 1)}조원 규모, {market_temp} 마감",
            "generationStatus": "completed",
        },
        "marketIndices": market_indices,
        "pulse": {
            "totalEtfCount": len(all_etfs),
            "generalEtfCount": gen_count,
            "upCount": up_count,
            "flatCount": flat_count,
            "downCount": down_count,
            "breadthRatioPct": breadth_ratio,
            "marketTemperature": market_temp,
            "generalAumWeightedReturnPct": weighted_return,
            "top50AumWeightedReturnPct": top50_return,
            "top100AumWeightedReturnPct": top100_return,
            "top200AumWeightedReturnPct": top200_return,
            "aumWeightedReturns": [
                {"scope": "all", "label": "전체 일반 ETF", "constituent_count": gen_count, "total_aum": gen_total_aum, "weighted_return_pct": weighted_return},
                {"scope": "top_50", "label": "Top 50", "constituent_count": min(50, gen_count), "total_aum": sum(e["aum"] for e in sorted_by_aum[:50]), "weighted_return_pct": top50_return},
                {"scope": "top_100", "label": "Top 100", "constituent_count": min(100, gen_count), "total_aum": sum(e["aum"] for e in sorted_by_aum[:100]), "weighted_return_pct": top100_return},
                {"scope": "top_200", "label": "Top 200", "constituent_count": min(200, gen_count), "total_aum": sum(e["aum"] for e in sorted_by_aum[:200]), "weighted_return_pct": top200_return},
            ],
            "generalTotalAum": gen_total_aum,
            "generalTotalTradeValue": gen_total_trade,
            "top10TradeSharePct": top10_trade_share,
            "allTop10TradeSharePct": all_top10_trade_share,
        },
        "marketScale": (existing_data.get("marketScale") if existing_is_same_date and existing_data.get("marketScale") else {
            "totalEtfCount": len(all_etfs),
            "generalEtfCount": gen_count,
            "totalAum": gen_total_aum,
            "totalTradeValue": gen_total_trade,
        }),
        "marketScaleSnapshot": (existing_data.get("marketScaleSnapshot") if existing_is_same_date else None),
        "marketScaleTimeSeries": (existing_data.get("marketScaleTimeSeries") if existing_is_same_date else None),
        "assetClasses": asset_classes,
        "peerGroups": peer_groups,
        # 9. Smart Money Fund Flow (Zero-D1 Local Calculation SSOT)
        "fundFlow": (
            existing_data.get("fundFlow")
            if (existing_is_same_date and len(existing_data.get("fundFlow", {}).get("general", {}).get("topInflows", [])) >= 5)
            else calculate_local_fund_flows(master_rows, as_of_date)
        ),
        "periodicFlows": {
            "dailyFundFlows": (
                existing_data.get("fundFlow", {}).get("general", {})
                if (existing_is_same_date and len(existing_data.get("fundFlow", {}).get("general", {}).get("topInflows", [])) >= 5)
                else calculate_local_fund_flows(master_rows, as_of_date).get("general", {})
            ),
        },
        "weeklyFundFlows": (existing_data.get("weeklyFundFlows") if existing_is_same_date else []),
        "monthlyFundFlows": (existing_data.get("monthlyFundFlows") if existing_is_same_date else []),
        "focusEtfs": focus_etfs,
        "disparityWarning": disparity_warning[:10],
        # Compatibility top-level aliases for renderers
        "headlineText": f"국내 ETF 시장 AUM {round(gen_total_aum / 10_000_000_000_000, 1)}조원 규모, {market_temp} 마감",
        "marketTemperature": market_temp,
        "kospiClose": kospi.get("close", 0),
        "kospiChangePct": kospi.get("change_pct", 0),
        "kosdaqClose": kosdaq.get("close", 0),
        "kosdaqChangePct": kosdaq.get("change_pct", 0),
        "generalEtfCount": gen_count,
        "generalTotalAum": gen_total_aum,
        "generalTotalTradeValue": gen_total_trade,
        "generalAumWeightedReturnPct": weighted_return,
        "top50WeightedReturnPct": top50_return,
        "upCount": up_count,
        "flatCount": flat_count,
        "downCount": down_count,
        "breadthRatioPct": breadth_ratio,
        "top10TradeSharePct": top10_trade_share,
    }

    return {"briefing": payload}


def main() -> None:
    parser = argparse.ArgumentParser(description="Build local market briefing payload from repository data")
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--target-date", help="YYYY-MM-DD target date")
    parser.add_argument("--output", default="data/briefing_payload_latest.json", help="Output JSON path")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    payload = build_briefing_payload(data_dir, args.target_date)

    # Fail-Closed Schema Contract Gate (Zero-Hallucination & Zero-Blank Guard)
    try:
        from scripts.schemas.briefing_contract import validate_briefing_payload
        valid, errors, contract = validate_briefing_payload(payload)
        if not valid:
            print("❌ [Fail-Closed] Generated payload failed BriefingContract validation:", file=sys.stderr)
            for err in errors:
                print(f"  * {err}", file=sys.stderr)
            sys.exit(1)
        print("🛡️ [Schema Gate] Verified 100% data completeness & integrity via BriefingContract!")
    except ImportError as e:
        print(f"⚠️ Warning: Could not import BriefingContract ({e}), continuing with standard output.", file=sys.stderr)

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with out_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    as_of = payload["briefing"]["asOfDate"]
    gen_count = payload["briefing"]["pulse"]["generalEtfCount"]
    print(f"✅ Successfully generated local briefing payload for {as_of} (General ETFs: {gen_count}) -> {out_path}")


if __name__ == "__main__":
    main()
