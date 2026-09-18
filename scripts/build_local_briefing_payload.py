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

from lib.indices import (
    CANONICAL_MACRO_CODES,
    normalize_index_code,
    get_index_label,
)
from lib.calendar import is_trading_day

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


def calculate_local_fund_flows(curr_rows: list[dict[str, Any]], target_date: str) -> tuple[dict[str, Any], str]:
    cleaned_curr = target_date.replace("-", "").strip()
    prev_map: dict[str, dict[str, Any]] = {}
    detected_prev_date = ""

    # 1. Sole SSOT: check data/snapshots/ directory
    snapshots_dir = Path("data/snapshots")
    if snapshots_dir.exists():
        candidates = []
        for p in snapshots_dir.glob("master_*.csv"):
            m = re.search(r"master_(\d{4}-?\d{2}-?\d{2})\.csv", p.name)
            if m:
                snap_date = m.group(1).replace("-", "")
                if snap_date < cleaned_curr:
                    candidates.append((snap_date, p))
        if candidates:
            candidates.sort(key=lambda x: x[0], reverse=True)
            best_snap_date, best_path = candidates[0]
            try:
                with best_path.open("r", encoding="utf-8-sig") as f:
                    reader = csv.DictReader(f)
                    prev_map = {r["ticker"].strip().upper(): r for r in reader}
                    detected_prev_date = f"{best_snap_date[:4]}-{best_snap_date[4:6]}-{best_snap_date[6:]}"
                    print(f"📦 [Fund Flow] Loaded previous snapshot from file: {best_path} ({detected_prev_date})")
            except Exception as e:
                print(f"⚠️ Error reading snapshot file {best_path}: {e}", file=sys.stderr)

    if not prev_map:
        print(f"⚠️ [Fund Flow] No prior trading day snapshot found in data/snapshots/ for date < {cleaned_curr}.", file=sys.stderr)

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

    flow_dict = {
        "general": {
            "topInflows": general_flows[:5],
            "topOutflows": general_flows[-5:][::-1],
        },
        "all": {
            "topInflows": all_flows[:5],
            "topOutflows": all_flows[-5:][::-1],
        },
    }
    return flow_dict, detected_prev_date


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
    topic_family_map: dict[str, str] = {}
    ticker_family_map: dict[str, str] = {}
    if comparison_path.exists():
        with comparison_path.open("r", encoding="utf-8-sig") as f:
            for r in csv.DictReader(f):
                tk = r.get("ticker", "").strip().upper()
                topic = r.get("comparison_topic", "").strip()
                fam = r.get("asset_family", "").strip()
                if tk and topic and topic not in ("미확인 주식전략", "미분류", "-"):
                    peer_map[tk] = topic
                    if fam and topic not in topic_family_map:
                        topic_family_map[topic] = fam
                if tk and fam:
                    ticker_family_map[tk] = fam

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

        # Canonical asset class fallback using SSOT comparison classification
        comp_fam = ticker_family_map.get(tk)
        if comp_fam in ("원자재", "채권", "혼합자산", "금리·파킹"):
            asset_class = comp_fam
        elif not asset_class or asset_class == "주식":
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
 
    # 4. Market Indices (Using SSOT lib.indices and lib.calendar)
    market_indices: list[dict[str, Any]] = []
    us_macro_codes = {"SPX", "NDX", "VIX", "DGS10", "CLF", "GC", "SI"}
    krx_macro_codes = {"KOSPI", "KOSDAQ", "VKOSPI", "KR10Y"}

    if indices_path.exists():
        with indices_path.open("r", encoding="utf-8") as f:
            idx_data = json.load(f)
            raw_indices = idx_data.get("indices", []) if isinstance(idx_data, dict) else idx_data
            for idx in raw_indices:
                raw_code = idx.get("code") or idx.get("label", "")
                canon = normalize_index_code(raw_code)
                label = get_index_label(canon)

                is_closed_by_calendar = False
                if canon in us_macro_codes and not is_trading_day("US", as_of_date):
                    is_closed_by_calendar = True
                elif canon in krx_macro_codes and not is_trading_day("KRX", as_of_date):
                    is_closed_by_calendar = True

                is_closed = bool(idx.get("is_closed") or is_closed_by_calendar)

                market_indices.append({
                    "code": canon,
                    "label": label,
                    "close": to_float(idx.get("value") or idx.get("close")),
                    "change_pct": to_float(idx.get("change") or idx.get("change_pct")),
                    "change_points": to_float(idx.get("changePoints") or idx.get("change_points")),
                    "as_of_date": idx.get("as_of_date", as_of_date),
                    "is_closed": is_closed,
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
        canon_ac = topic_family_map.get(pg)
        if not canon_ac or canon_ac == "주식":
            canon_ac = group[0]["assetClass"]
        peer_groups.append({
            "peerGroup": pg,
            "assetClass": canon_ac,
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

    # 8. Disparity Warning (General ETFs only, trade_value >= 10,000,000 KRW, Domestic >= 1.0%, Overseas >= 3.0%)
    disparity_warning: list[dict[str, Any]] = []
    for e in general_etfs:
        disp = e.get("disparityPct")
        trade_val = e.get("tradeValue") or 0.0
        # 저유동성 및 거래정지 종목 제외 (최소 거래대금 1,000만원 이상)
        if disp is None or trade_val < 10_000_000:
            continue
        
        asset_cls = e.get("assetClass", "")
        threshold = 1.0 if "국내" in asset_cls else 3.0
        if abs(disp) >= threshold:
            disparity_warning.append({
                "ticker": e["ticker"],
                "name": e["name"],
                "etfName": e["name"],
                "assetClass": asset_cls,
                "nav": e["nav"],
                "price": e["close"],
                "disparityPct": disp,
            })
    disparity_warning.sort(key=lambda x: abs(x["disparityPct"]), reverse=True)

    # 8.5 Archive current master snapshot for robust file-based lookups (4 columns: ticker, shares, nav, bas_dt)
    try:
        snapshots_dir = data_dir / "snapshots"
        snapshots_dir.mkdir(parents=True, exist_ok=True)
        current_snap_file = snapshots_dir / f"master_{as_of_date}.csv"
        
        # Write slim snapshot (~30KB vs 500KB)
        with current_snap_file.open("w", encoding="utf-8-sig", newline="") as sf:
            writer = csv.DictWriter(sf, fieldnames=["ticker", "shares", "nav", "bas_dt"])
            writer.writeheader()
            for r in master_rows:
                writer.writerow({
                    "ticker": r.get("ticker", "").strip().upper(),
                    "shares": str(r.get("shares", "0")).strip(),
                    "nav": str(r.get("nav") or r.get("close") or "0").strip(),
                    "bas_dt": str(r.get("bas_dt", as_of_date)).strip(),
                })
        print(f"💾 [Snapshot] Archived daily slim snapshot ({len(master_rows)} rows): {current_snap_file}")

        # Retain only latest 7 snapshots, prune older files
        snap_files = sorted(snapshots_dir.glob("master_*.csv"))
        if len(snap_files) > 7:
            for old_snap in snap_files[:-7]:
                try:
                    old_snap.unlink()
                    print(f"🧹 [Snapshot Prune] Pruned older snapshot: {old_snap.name}")
                except Exception as prune_err:
                    print(f"⚠️ Failed to prune snapshot {old_snap}: {prune_err}", file=sys.stderr)
    except Exception as e:
        print(f"❌ [FATAL] Failed to archive master snapshot: {e}", file=sys.stderr)
        sys.exit(1)

    # 9. Smart Money Fund Flow (Zero-D1 Local Calculation SSOT)
    local_flows, detected_prev_date = calculate_local_fund_flows(master_rows, as_of_date)
    has_valid_existing = bool(
        existing_is_same_date
        and len(existing_data.get("fundFlow", {}).get("general", {}).get("topInflows", [])) >= 5
    )
    final_fund_flow = existing_data.get("fundFlow") if has_valid_existing else local_flows
    final_prev_as_of = existing_data.get("prevAsOfDate") or detected_prev_date

    # Market Scale 4-Category Snapshot (Local canonical calculation)
    all_total_aum = sum(e["aum"] for e in all_etfs)
    all_total_trade = sum(e["tradeValue"] for e in all_etfs)
    scale_cats: dict[str, list[dict[str, Any]]] = {"general": [], "parking": [], "leveraged": [], "inverse": []}
    for e in all_etfs:
        rt = e["riskType"]
        ac = e["assetClass"]
        nm = e["name"]
        if rt in ("leverage", "leveraged"):
            scale_cats["leveraged"].append(e)
        elif rt == "inverse":
            scale_cats["inverse"].append(e)
        elif any(term in ac for term in ("금리", "파킹", "CD91", "KOFR", "SOFR")) or any(term in nm for term in ("CD금리", "KOFR", "SOFR", "머니마켓", "단기채권", "파킹")):
            scale_cats["parking"].append(e)
        else:
            scale_cats["general"].append(e)

    cat_labels = {
        "general": "일반 실물 ETF",
        "parking": "파킹·단기자금",
        "leveraged": "레버리지",
        "inverse": "인버스",
    }
    categories_list = []
    for c_key in ["general", "parking", "leveraged", "inverse"]:
        c_items = scale_cats[c_key]
        c_aum = sum(item["aum"] for item in c_items)
        c_trade = sum(item["tradeValue"] for item in c_items)
        categories_list.append({
            "category": c_key,
            "label": cat_labels[c_key],
            "aum": round(c_aum / 100_000_000, 1),
            "aumSharePct": round(c_aum / all_total_aum * 100, 1) if all_total_aum > 0 else 0.0,
            "tradeValue": round(c_trade / 100_000_000, 1),
            "tradeSharePct": round(c_trade / all_total_trade * 100, 1) if all_total_trade > 0 else 0.0,
            "turnoverPct": round(c_trade / c_aum * 100, 2) if c_aum > 0 else 0.0,
            "etfCount": len(c_items),
        })

    local_market_scale_snapshot = {
        "totalEtfCount": len(all_etfs),
        "generalEtfCount": len(scale_cats["general"]),
        "totalAum": round(all_total_aum / 100_000_000, 1),
        "totalTradeValue": round(all_total_trade / 100_000_000, 1),
        "marketTurnoverPct": round(all_total_trade / all_total_aum * 100, 2) if all_total_aum > 0 else 0.0,
        "categories": categories_list,
        "composition": [
            {"type": c["category"], "label": c["label"], "aum": c["aum"], "pct": c["aumSharePct"], "count": c["etfCount"]}
            for c in categories_list
        ],
    }

    # Construct final payload matching MarketBriefingPayload interface
    payload: dict[str, Any] = {
        "asOfDate": as_of_date,
        "prevAsOfDate": final_prev_as_of,
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
        "marketScaleSnapshot": (
            existing_data.get("marketScaleSnapshot")
            if (existing_is_same_date and existing_data.get("marketScaleSnapshot") and len(existing_data["marketScaleSnapshot"].get("categories", [])) > 0)
            else local_market_scale_snapshot
        ),
        "marketScaleTimeSeries": (existing_data.get("marketScaleTimeSeries") if existing_is_same_date else existing_data.get("marketScaleTimeSeries")),
        "assetClasses": asset_classes,
        "peerGroups": peer_groups,
        "fundFlow": final_fund_flow,
        "periodicFlows": {
            "dailyFundFlows": final_fund_flow.get("general", {}),
        },
        "weeklyFundFlows": (existing_data.get("weeklyFundFlows") or []),
        "monthlyFundFlows": (existing_data.get("monthlyFundFlows") or []),
        "focusEtfs": focus_etfs,
        "disparityWarning": disparity_warning,
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
        print(f"❌ [FATAL] BriefingContract import failed: {e}", file=sys.stderr)
        print("   Schema validation is strictly mandatory for canonical payload generation. Aborting.", file=sys.stderr)
        sys.exit(1)

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    as_of = payload["briefing"]["asOfDate"]
    date_out_path = out_path.parent / f"briefing_payload_{as_of}.json"

    # 1. Immutable daily canonical artifact
    with date_out_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    # 2. Latest pointer artifact
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    gen_count = payload["briefing"]["pulse"]["generalEtfCount"]
    print(f"✅ Successfully generated local briefing payload for {as_of} (General ETFs: {gen_count}) -> {date_out_path} & {out_path}")


if __name__ == "__main__":
    main()
