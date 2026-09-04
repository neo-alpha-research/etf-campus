#!/usr/bin/env python3
"""Holdings Composition Audit Engine.

Continuously monitors the portfolio constituents of all domestic ETFs against
master classification attributes to detect classification anomalies, severe drifts,
and potential pension regulatory violations.

Strictly follows directives:
1. Pure Anomaly Detection: Never directly modifies master classification.
2. Exit Code 0: Does not disrupt CI/CD deployment pipelines on detected drift.
3. Minimal Commit Policy: Full measurement CSV is ignored in git and stored only
   as GitHub Actions artifact; only 1-line summary audit history and last anomaly
   tracking JSON are committed.
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import os
import re
import subprocess
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

# Ensure scripts/rules is in sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
sys.path.insert(0, str(SCRIPT_DIR))

from holdings_asset_classifier import (
    classify_holding,
    measure_holdings_composition,
    evaluate_asset_dominance_and_applicability,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("holdings_audit")

# ---------------------------------------------------------------------------
# 1. Audit Thresholds & Constants (Rationale documented per Directive)
# ---------------------------------------------------------------------------
DERIVATIVE_EXCLUSION_PCT = 20.0  # 일반 ETF 유동성 관리용 선물은 통상 10% 미만 (20% 이상은 파생구조로 간주 제외)
CASH_MARGIN_PCT = 90.0           # 증거금 구조 판정. holdings_count <= 5 와 함께 적용 (선물 증거금 현금 왜곡 제외)
DOMINANT_THRESHOLD_PCT = 60.0    # 50% 경계 진동으로 인한 거짓 경보 차단 (60% 이상 집중 시에만 순수 오분류 판정)
SAFE_ASSET_EQUITY_LIMIT_PCT = 40.0 # 퇴직연금감독규정상 전통 안전자산(채권혼합) 주식 한도 (40% 초과 시 경계 초과)
SAFE_ASSET_MIXED50_LIMIT_PCT = 50.0# 채권혼합50 인가 상품 주식 한도 (50% 초과 시 극단 드리프트)
SAFE_ASSET_RISK_PCT = 70.0       # 감독규정 안전자산 요건을 명백히 벗어나는 수준 (위험자산 70% 초과 시 적발)
UNKNOWN_LIMIT_PCT = 10.0         # 실측 신뢰 하한 (unknown 10% 초과 시 판정 제외)

API_MAX_CONCURRENCY = 8          # Pages Function / D1 부하 보호를 위한 최대 동시 요청 수
API_FAILURE_RATE_THRESHOLD = 0.05  # API 실패율 5% 초과 시 신뢰 불가로 간주하여 경보 발령 및 베이스라인 동결
API_TIMEOUT_SECONDS = 12         # 단일 종목 API 타임아웃
API_RETRY_COUNT = 3              # 단일 종목 API 재시도 횟수


# ---------------------------------------------------------------------------
# 2. Asset Class Normalization & Dominant Discrepancy Evaluation
# ---------------------------------------------------------------------------
def normalize_asset_class(ac: str) -> str:
    """Normalize master asset_class strings to internal asset categories."""
    ac = (ac or "").strip()
    if ac in ("주식-국내", "주식-해외", "주식"):
        return "equity"
    if ac in ("채권", "금리·파킹"):
        return "bond"
    if ac in ("리츠·인프라", "리츠"):
        return "reit"
    if ac in ("원자재",):
        return "commodity"
    if ac in ("혼합·자산배분", "혼합자산", "혼합"):
        return "mixed"
    return ac


def is_dominant_discrepancy(master_asset_class: str, etf_name: str, dominant_asset: str) -> bool:
    """Evaluate whether the empirical dominant asset indicates a true master misclassification.

    Exclusion Rules per Directive Step 82 §2:
    - Master '혼합·자산배분' or name contains 'TDF', 'TRF', '혼합': Multi-asset allocation by design.
    - Dominant asset is 'cash': Cash collateral or money market liquidity, not a distinct master asset class.
    - Master '리츠·인프라': In KRX taxonomy, encompasses both REITs and Infrastructure corporate equities.
    """
    mac = (master_asset_class or "").strip()
    name = str(etf_name or "")

    # Multi-asset & lifecycle ETFs excluded per Step 82 §2
    if mac in ("혼합·자산배분", "혼합자산", "혼합"):
        return False
    if any(kw in name for kw in ["TDF", "TRF", "혼합"]):
        return False

    # Cash is collateral / liquidity, never an ETF master asset class
    if dominant_asset == "cash":
        return False

    norm_dom = normalize_asset_class(dominant_asset)
    norm_master = normalize_asset_class(mac)

    # KRX '리츠·인프라' category legitimately holds either REITs or infrastructure stocks
    if norm_master == "reit" and norm_dom in ("reit", "equity"):
        return False

    return norm_dom != norm_master


def extract_target_equity_pct(name: str) -> float | None:
    """Extract design target equity percentage from mixed ETF name."""
    n = str(name or "")
    if any(kw in n for kw in ["채권혼합50", "혼합50", "국채혼합50", "TRF5050"]):
        return 50.0
    if "TRF3070" in n:
        return 30.0
    if "TRF5050" in n:
        return 50.0
    if "TRF7030" in n:
        return 70.0
    m = re.search(r"채권혼합\s*(\d{1,2})", n)
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            pass
    return None


# ---------------------------------------------------------------------------
# 3. Holdings API Fetcher
# ---------------------------------------------------------------------------
def fetch_ticker_holdings(
    ticker: str, retries: int = API_RETRY_COUNT
) -> tuple[str, list[dict[str, Any]] | None, int | None, str | None]:
    """Fetch holdings for a single ticker with retries.
    
    Returns:
        (ticker, holdings_list, holding_count, as_of_date)
    """
    url = f"https://etf-campus.pages.dev/api/holdings/{ticker}"
    req = urllib.request.Request(
        url, headers={"User-Agent": "Mozilla/5.0 (ETF-Campus-Holdings-Audit)"}
    )

    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=API_TIMEOUT_SECONDS) as res:
                data = json.loads(res.read().decode("utf-8"))
                holdings = data.get("holdings", [])
                cnt = data.get("holding_count", len(holdings))
                as_of = data.get("as_of_date") or data.get("bas_dt")
                return ticker, holdings, cnt, as_of
        except Exception as e:
            if attempt == retries:
                logger.warning(f"[{ticker}] Fetch failed after {retries} attempts: {e}")
                return ticker, None, None, None
            time.sleep(0.5 * attempt)
    return ticker, None, None, None


# ---------------------------------------------------------------------------
# 4. Core Audit Execution
# ---------------------------------------------------------------------------
def run_holdings_audit(
    master_path: Path,
    history_csv: Path,
    last_anomaly_json: Path,
    output_csv: Path,
    report_dir: Path,
    cache_json: Path | None = None,
    create_issue: bool = False,
    force_weekly_reminder: bool = False,
) -> dict[str, Any]:
    """Run full universe holdings audit and return summary metrics."""
    kst_tz = timezone(timedelta(hours=9))
    now_kst = datetime.now(kst_tz)
    run_date_str = now_kst.strftime("%Y-%m-%d")

    # 1. Load Master ETFs
    if not master_path.exists():
        raise FileNotFoundError(f"Master CSV not found at {master_path}")

    with open(master_path, "r", encoding="utf-8-sig") as f:
        master_rows = list(csv.DictReader(f))
    total_etfs = len(master_rows)
    logger.info(f"Loaded {total_etfs} ETFs from {master_path}")

    # 2. Fetch or Load Raw Holdings
    raw_data: dict[str, dict[str, Any]] = {}
    if cache_json and cache_json.exists():
        logger.info(f"Loading raw holdings cache from {cache_json}")
        with open(cache_json, "r", encoding="utf-8") as f:
            raw_data = json.load(f)

    tickers_to_fetch = [r["ticker"] for r in master_rows if r["ticker"] not in raw_data]
    if tickers_to_fetch:
        logger.info(
            f"Fetching {len(tickers_to_fetch)} ETFs with max_workers={API_MAX_CONCURRENCY}..."
        )
        completed = 0
        with ThreadPoolExecutor(max_workers=API_MAX_CONCURRENCY) as executor:
            future_to_ticker = {
                executor.submit(fetch_ticker_holdings, t): t for t in tickers_to_fetch
            }
            for future in as_completed(future_to_ticker):
                ticker, holdings, cnt, as_of = future.result()
                raw_data[ticker] = {
                    "holdings": holdings,
                    "holding_count": cnt,
                    "as_of_date": as_of,
                    "success": holdings is not None,
                }
                completed += 1
                if completed % 200 == 0 or completed == len(tickers_to_fetch):
                    logger.info(f"Fetch progress: {completed}/{len(tickers_to_fetch)}")

        if cache_json:
            cache_json.parent.mkdir(parents=True, exist_ok=True)
            with open(cache_json, "w", encoding="utf-8") as f:
                json.dump(raw_data, f, ensure_ascii=False)

    # 3. Check API Failure Rate
    api_failed_count = sum(1 for v in raw_data.values() if not v.get("success"))
    failure_rate = api_failed_count / total_etfs if total_etfs > 0 else 0.0
    logger.info(
        f"API fetch finished: {total_etfs - api_failed_count} succeeded, {api_failed_count} failed (failure rate: {failure_rate:.1%})"
    )

    # Determine latest as_of_date
    as_of_dates = [v.get("as_of_date") for v in raw_data.values() if v.get("as_of_date")]
    as_of_date_str = max(as_of_dates) if as_of_dates else run_date_str

    # 4. Process Holdings & Evaluate Anomalies
    applicable_count = 0
    excluded_derivative_count = 0
    excluded_synthetic_count = 0
    excluded_unknown_count = 0

    anomaly_dominant_list = []
    anomaly_drift_list = []
    anomaly_safe_asset_list = []

    max_drift_pct = 0.0
    max_drift_ticker = ""

    measured_records = []

    for row in master_rows:
        ticker = row["ticker"]
        name = row["name"]
        asset_class = row.get("asset_class", "").strip()
        pension_limit = row.get("pension_limit", "").strip()
        is_synthetic = "합성" in name

        fetch_info = raw_data.get(ticker, {})
        holdings = fetch_info.get("holdings")
        cnt = fetch_info.get("holding_count")

        actual_cnt = cnt if cnt is not None else (len(holdings) if holdings else 0)

        rec = {
            "ticker": ticker,
            "name": name,
            "current_asset_class": asset_class,
            "is_synthetic": "Y" if is_synthetic else "N",
            "holdings_count": actual_cnt if holdings is not None else "",
            "measured_equity_pct": "",
            "measured_bond_pct": "",
            "measured_reit_pct": "",
            "measured_commodity_pct": "",
            "measured_cash_pct": "",
            "measured_derivative_pct": "",
            "measured_unknown_pct": "",
            "measured_coverage_pct": "",
            "measured_applicable": "N",
            "measured_skip_reason": "",
            "dominant_measured_asset": "",
            "dominant_pct": "",
            "notes": "",
        }

        pension_eligible = row.get("pension_eligible", "").strip()
        risk_type = row.get("risk_type", "").strip()

        if is_synthetic:
            excluded_synthetic_count += 1
            rec["measured_applicable"] = "N"
            rec["measured_skip_reason"] = "합성구조"
            rec["notes"] = "OTC swap replication"

            # Safeguard rule for Synthetic ETFs (퇴직연금감독규정 제12조)
            if risk_type in ("leverage", "inverse") and pension_eligible == "가능":
                anomaly_safe_asset_list.append({
                    "ticker": ticker,
                    "name": name,
                    "current_asset_class": asset_class,
                    "pension_limit": pension_limit,
                    "reason": "합성 레버리지/인버스 상품의 퇴직연금 편입 가능 오기재",
                })
            elif asset_class in ("원자재", "주식-국내", "주식-해외") and "100%" in pension_limit:
                anomaly_safe_asset_list.append({
                    "ticker": ticker,
                    "name": name,
                    "current_asset_class": asset_class,
                    "pension_limit": pension_limit,
                    "reason": "합성 위험자산형 ETF의 100% 안전자산 오기재",
                })
        elif holdings is None:
            rec["measured_applicable"] = "N"
            rec["measured_skip_reason"] = "수집실패"
            rec["notes"] = "API returned None"
        elif actual_cnt == 0:
            rec["measured_applicable"] = "N"
            rec["measured_skip_reason"] = "홀딩스0건"
            rec["notes"] = "API returned 0 constituents"
        else:
            # Empirical measurement
            m = measure_holdings_composition(holdings)
            unk_pct = m["measured_unknown_pct"]
            cov_pct = m["measured_coverage_pct"]
            cash_pct = m["measured_cash_pct"]
            deriv_pct = m["measured_derivative_pct"]
            equity_pct = m["measured_equity_pct"]
            risk_basket_pct = m["measured_risk_basket_pct"]

            rec["measured_equity_pct"] = equity_pct
            rec["measured_bond_pct"] = m["measured_bond_pct"]
            rec["measured_reit_pct"] = m["measured_reit_pct"]
            rec["measured_commodity_pct"] = m["measured_commodity_pct"]
            rec["measured_cash_pct"] = cash_pct
            rec["measured_derivative_pct"] = deriv_pct
            rec["measured_unknown_pct"] = unk_pct
            rec["measured_coverage_pct"] = cov_pct

            # Gross derivative calculation to prevent long/short futures cancellation in hedged ETFs
            gross_deriv = sum(
                abs(float(h.get("weight_pct", 0.0)))
                for h in holdings
                if classify_holding(str(h.get("name")), str(h.get("item_code")))[0] == "derivative"
            )

            # Evaluate applicability
            app, skip_reason, dom_asset, dom_pct = evaluate_asset_dominance_and_applicability(
                m, is_synthetic=False
            )

            # Check gross derivative exposure threshold
            if gross_deriv >= DERIVATIVE_EXCLUSION_PCT:
                app = "N"
                skip_reason = "파생구조"
                dom_asset = ""
                dom_pct = 0.0

            rec["measured_applicable"] = app
            rec["measured_skip_reason"] = skip_reason
            rec["dominant_measured_asset"] = dom_asset
            rec["dominant_pct"] = dom_pct

            if skip_reason in ("파생구조", "파생구조(증거금)"):
                excluded_derivative_count += 1
            elif skip_reason == "unknown초과":
                excluded_unknown_count += 1
            else:
                applicable_count += 1

                # -----------------------------------------------------------
                # Anomaly Metric 1: Dominant asset vs Master asset_class
                # -----------------------------------------------------------
                # Threshold: dominant >= DOMINANT_THRESHOLD_PCT and unknown <= UNKNOWN_LIMIT_PCT
                if (
                    dom_asset != "혼합"
                    and dom_pct >= DOMINANT_THRESHOLD_PCT
                    and unk_pct <= UNKNOWN_LIMIT_PCT
                ):
                    if is_dominant_discrepancy(asset_class, name, dom_asset):
                        anomaly_dominant_list.append(
                            {
                                "ticker": ticker,
                                "name": name,
                                "current_asset_class": asset_class,
                                "dominant_asset": dom_asset,
                                "dominant_pct": dom_pct,
                                "unknown_pct": unk_pct,
                                "reason": f"Dominant {dom_asset}({dom_pct}%) != master {asset_class}",
                            }
                        )

                # -----------------------------------------------------------
                # Anomaly Metric 2: Regulatory Safe Asset Equity Boundary Drift
                # -----------------------------------------------------------
                # Focuses on statutory safe asset boundary (40% for general, 50% for 채권혼합50)
                if "100%" in pension_limit and "TDF" not in name:
                    has_50_brand = any(kw in name for kw in ["채권혼합50", "혼합50", "국채혼합50", "TRF5050"])
                    target_limit = SAFE_ASSET_MIXED50_LIMIT_PCT if has_50_brand else SAFE_ASSET_EQUITY_LIMIT_PCT
                    drift = equity_pct - target_limit

                    if drift > max_drift_pct:
                        max_drift_pct = round(drift, 2)
                        max_drift_ticker = ticker

                    if equity_pct >= SAFE_ASSET_EQUITY_LIMIT_PCT:
                        # Differentiate status:
                        # - Normal 채권혼합50 within target 50% is 'accepted'
                        # - Extreme drift exceeding 50% is 'known_open' requiring regulatory review
                        severity = "EXTREME_OVER_50" if equity_pct > SAFE_ASSET_MIXED50_LIMIT_PCT else ("NORMAL_50_BOUND" if has_50_brand else "BREACH_OVER_40")
                        initial_status = "accepted" if severity == "NORMAL_50_BOUND" else "known_open"
                        review_note = "채권혼합50 인가 상품 (정상 편입 범위 40~50%)" if initial_status == "accepted" else "안전자산 주식 비중 50% 초과 극단 드리프트"

                        anomaly_drift_list.append(
                            {
                                "ticker": ticker,
                                "name": name,
                                "current_asset_class": asset_class,
                                "pension_limit": pension_limit,
                                "target_equity_pct": target_limit,
                                "measured_equity_pct": equity_pct,
                                "drift_pct": round(drift, 2),
                                "severity": severity,
                                "initial_status": initial_status,
                                "review_note": review_note,
                                "reason": f"Safe asset holds {equity_pct}% equity (limit {target_limit}%)",
                            }
                        )

                # -----------------------------------------------------------
                # Anomaly Metric 3: Safe Asset with Measured Risk > 70%
                # -----------------------------------------------------------
                # Exempt registered TDFs per 감독규정시행세칙 제5조의2
                if pension_limit == "100% (안전자산)" and "TDF" not in name:
                    if risk_basket_pct > SAFE_ASSET_RISK_PCT:
                        anomaly_safe_asset_list.append(
                            {
                                "ticker": ticker,
                                "name": name,
                                "current_asset_class": asset_class,
                                "pension_limit": pension_limit,
                                "measured_risk_pct": risk_basket_pct,
                                "unknown_pct": unk_pct,
                                "reason": f"Safe asset holds {risk_basket_pct}% risk basket (> 70%)",
                            }
                        )

        measured_records.append(rec)

    # 5. Write Full Measured Composition CSV (for CI artifact, gitignored)
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    if measured_records:
        fieldnames = list(measured_records[0].keys())
        with open(output_csv, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(measured_records)
        logger.info(f"Saved full measured composition ({len(measured_records)} rows) to {output_csv}")

    # 6. Update holdings_audit_history.csv (1 row appended per run)
    coverage_pct = round((applicable_count / total_etfs) * 100.0, 1) if total_etfs > 0 else 0.0

    history_csv.parent.mkdir(parents=True, exist_ok=True)
    history_headers = [
        "run_date",
        "as_of_date",
        "total_etfs",
        "applicable",
        "coverage_pct",
        "excluded_derivative",
        "excluded_synthetic",
        "excluded_unknown",
        "api_failed",
        "anomaly_dominant",
        "anomaly_drift",
        "anomaly_safe_asset",
        "max_drift_pct",
        "max_drift_ticker",
    ]

    history_exists = history_csv.exists() and history_csv.stat().st_size > 0
    history_row = {
        "run_date": run_date_str,
        "as_of_date": as_of_date_str,
        "total_etfs": total_etfs,
        "applicable": applicable_count,
        "coverage_pct": f"{coverage_pct}%",
        "excluded_derivative": excluded_derivative_count,
        "excluded_synthetic": excluded_synthetic_count,
        "excluded_unknown": excluded_unknown_count,
        "api_failed": api_failed_count,
        "anomaly_dominant": len(anomaly_dominant_list),
        "anomaly_drift": len(anomaly_drift_list),
        "anomaly_safe_asset": len(anomaly_safe_asset_list),
        "max_drift_pct": max_drift_pct,
        "max_drift_ticker": max_drift_ticker,
    }

    with open(history_csv, "a", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=history_headers)
        if not history_exists:
            writer.writeheader()
        writer.writerow(history_row)
    logger.info(f"Appended audit summary row to {history_csv}")

    # 7. Evaluate Last Anomaly Baseline with Governance Status (resolved / accepted / known_open)
    is_first_run = not last_anomaly_json.exists()
    last_data: dict[str, Any] = {}
    if not is_first_run:
        try:
            with open(last_anomaly_json, "r", encoding="utf-8") as f:
                last_data = json.load(f)
        except Exception as e:
            logger.warning(f"Failed to read {last_anomaly_json}, treating as first run: {e}")
            is_first_run = True

    existing_anomalies: dict[str, dict[str, Any]] = last_data.get("anomalies", {})

    # Build today's active anomalies dictionary
    today_active_map: dict[str, dict[str, Any]] = {}

    for it in anomaly_dominant_list:
        today_active_map[it["ticker"]] = {
            "category": "dominant",
            "item": it,
            "default_status": "known_open",
            "default_note": "실측 지배 자산군과 마스터 불일치 (순수 오분류 검토 필요)",
        }

    for it in anomaly_drift_list:
        today_active_map[it["ticker"]] = {
            "category": "boundary_drift",
            "item": it,
            "default_status": it.get("initial_status", "known_open"),
            "default_note": it.get("review_note", "안전자산 규정 경계 초과"),
        }

    for it in anomaly_safe_asset_list:
        today_active_map[it["ticker"]] = {
            "category": "safe_asset",
            "item": it,
            "default_status": "known_open",
            "default_note": it.get("reason", "안전자산 내 위험자산 70% 초과"),
        }

    new_anomalies: list[dict[str, Any]] = []
    updated_anomalies_map: dict[str, dict[str, Any]] = {}

    # Check active anomalies against previous baseline
    for ticker, info in today_active_map.items():
        prev = existing_anomalies.get(ticker)
        if prev:
            current_status = prev.get("status", info["default_status"])
            if current_status == "resolved":
                current_status = info["default_status"]
            review_note = prev.get("review_note") or info["default_note"]
            first_detected = prev.get("first_detected", run_date_str)

            updated_anomalies_map[ticker] = {
                "ticker": ticker,
                "name": info["item"]["name"],
                "category": info["category"],
                "status": current_status,
                "first_detected": first_detected,
                "last_seen": run_date_str,
                "review_note": review_note,
                "details": info["item"],
            }
        else:
            new_item = {
                "ticker": ticker,
                "name": info["item"]["name"],
                "category": info["category"],
                "status": info["default_status"],
                "first_detected": run_date_str,
                "last_seen": run_date_str,
                "review_note": info["default_note"],
                "details": info["item"],
            }
            updated_anomalies_map[ticker] = new_item
            if info["default_status"] == "known_open":
                new_anomalies.append(new_item)

    # Check previously tracked anomalies that are now resolved
    resolved_count = 0
    for ticker, prev in existing_anomalies.items():
        if ticker not in today_active_map:
            if prev.get("status") != "resolved":
                updated_anomalies_map[ticker] = {
                    **prev,
                    "status": "resolved",
                    "resolved_at": run_date_str,
                    "review_note": f"{prev.get('review_note', '')} (정상 분류 또는 비중 복구로 해결됨)",
                }
                resolved_count += 1
            else:
                updated_anomalies_map[ticker] = prev

    open_items = [v for v in updated_anomalies_map.values() if v.get("status") == "known_open"]
    accepted_items = [v for v in updated_anomalies_map.values() if v.get("status") == "accepted"]
    resolved_items = [v for v in updated_anomalies_map.values() if v.get("status") == "resolved"]

    baseline_payload = {
        "updated_at": run_date_str,
        "summary": {
            "total_tracked": len(updated_anomalies_map),
            "total_open": len(open_items),
            "total_accepted": len(accepted_items),
            "total_resolved": len(resolved_items),
            "new_today": len(new_anomalies),
        },
        "anomalies": updated_anomalies_map,
    }

    # 8. Detailed Anomaly Report (Only created if active anomalies exist, gitignored)
    if today_active_map:
        report_dir.mkdir(parents=True, exist_ok=True)
        anomaly_report_path = report_dir / f"holdings_anomaly_{run_date_str.replace('-', '')}.json"
        with open(anomaly_report_path, "w", encoding="utf-8") as f:
            json.dump({
                "run_date": run_date_str,
                "as_of_date": as_of_date_str,
                "total_etfs": total_etfs,
                "coverage_pct": coverage_pct,
                "new_anomalies": new_anomalies,
                "known_open": open_items,
                "accepted": accepted_items,
                "resolved": resolved_items,
                "max_drift_pct": max_drift_pct,
                "max_drift_ticker": max_drift_ticker,
            }, f, ensure_ascii=False, indent=2)
        logger.info(f"Created detailed anomaly report at {anomaly_report_path}")

    # 9. GitHub Issue Creation Policy
    # Conditions:
    # A) 100% API failure -> Issue: Outage alert, DO NOT update baseline
    # B) Failure rate > 5% -> Issue: Failure alarm, DO NOT update baseline (prevent baseline corruption)
    # C) First run -> Record baseline without issue
    # D) New anomalies > 0 -> Issue: 신규 이상 N건
    # E) Weekly Reminder (Monday) -> Issue: 주간 미해결 이상 N건 리마인더
    should_save_baseline = True
    is_monday = (now_kst.weekday() == 0) or force_weekly_reminder

    if create_issue:
        if api_failed_count == total_etfs:
            logger.error("API total failure (100%). Creating outage issue...")
            create_github_issue(
                title=f"[홀딩스 감시] {run_date_str} 홀딩스 API 전량 응답 없음 (100% 실패)",
                body=(
                    f"## ⚠️ 홀딩스 API 전량 호출 실패 경보\n\n"
                    f"- **실행일시**: {run_date_str}\n"
                    f"- **검사 대상**: {total_etfs}개 ETF 전체\n"
                    f"- **현상**: Cloudflare D1 / Pages Function 홀딩스 API가 전량 응답하지 않았습니다.\n"
                    f"- **베이스라인 보호**: 결측 데이터로 인한 오탐 방지를 위해 `holdings_anomaly_last.json` 갱신을 생략했습니다.\n"
                    f"- **조치**: Cloudflare D1 데이터베이스 및 Pages Function 상태를 확인하십시오."
                ),
            )
            should_save_baseline = False

        elif failure_rate > API_FAILURE_RATE_THRESHOLD:
            logger.warning(f"API failure rate {failure_rate:.1%} exceeds 5%. Creating failure alert issue...")
            create_github_issue(
                title=f"[홀딩스 감시] {run_date_str} 홀딩스 API 부분 수집 실패 경보 (실패율 {failure_rate:.1%})",
                body=(
                    f"## ⚠️ 홀딩스 API 부분 수집 실패 경보\n\n"
                    f"- **실행일시**: {run_date_str}\n"
                    f"- **실패 종목 수**: {api_failed_count}건 / {total_etfs}건 ({failure_rate:.1%})\n"
                    f"- **현상**: API 수집 실패율이 신뢰 허용치(5%)를 초과하여 금일 감시 결과의 신뢰도가 훼손되었습니다.\n"
                    f"- **베이스라인 보호**: 일시적 누락으로 인한 거짓 경보 및 베이스라인 오염을 방지하기 위해 금일 감시 결과는 베이스라인에 반영하지 않았습니다.\n"
                    f"- **조치**: 일시적 네트워크 장애 또는 특정 운용사 홀딩스 응답 규격을 확인하십시오."
                ),
            )
            should_save_baseline = False

        elif is_first_run:
            logger.info("First run detected. Baseline recorded in last_anomaly.json without creating issues.")

        elif new_anomalies:
            logger.info(f"Detected {len(new_anomalies)} newly surfaced anomalies. Creating GitHub Issue...")
            issue_body = build_issue_body(
                run_date_str=run_date_str,
                new_anomalies=new_anomalies,
                max_drift_pct=max_drift_pct,
                max_drift_ticker=max_drift_ticker,
            )
            create_github_issue(
                title=f"[홀딩스 감시] {run_date_str} 신규 이상 {len(new_anomalies)}건 (미해결 open)",
                body=issue_body,
            )

        elif is_monday and open_items:
            logger.info(f"Monday weekly reminder: {len(open_items)} known_open items pending review...")
            reminder_body = build_weekly_reminder_body(
                run_date_str=run_date_str,
                open_items=open_items,
            )
            create_github_issue(
                title=f"[홀딩스 감시] 주간 미해결 이상 {len(open_items)}건 정기 리마인더 ({run_date_str})",
                body=reminder_body,
            )
        else:
            logger.info("No newly surfaced anomalies and no scheduled reminders. Issue creation skipped.")

    # Save baseline JSON only if data is healthy
    if should_save_baseline:
        last_anomaly_json.parent.mkdir(parents=True, exist_ok=True)
        with open(last_anomaly_json, "w", encoding="utf-8") as f:
            json.dump(baseline_payload, f, ensure_ascii=False, indent=2)
        logger.info(f"Updated anomaly baseline ({len(open_items)} open, {len(accepted_items)} accepted) at {last_anomaly_json}")

    print("\n" + "=" * 80)
    print("HOLDINGS COMPOSITION AUDIT RUN SUMMARY")
    print("=" * 80)
    print(f"  Run Date            : {run_date_str} (as-of: {as_of_date_str})")
    print(f"  Total ETFs          : {total_etfs}")
    print(f"  Coverage            : {coverage_pct}% ({applicable_count}/{total_etfs} applicable)")
    print(f"  Excluded Breakdown  : {total_etfs - applicable_count}/{total_etfs}")
    print(f"    - Derivative      : {excluded_derivative_count}")
    print(f"    - Synthetic       : {excluded_synthetic_count}")
    print(f"    - Unknown > 10%   : {excluded_unknown_count}")
    print(f"  API Failures        : {api_failed_count} ({failure_rate:.1%})")
    print(f"  Anomaly Dominant    : {len(anomaly_dominant_list)}")
    print(f"  Anomaly Boundary    : {len(anomaly_drift_list)} (Known Open: {len(open_items)}, Accepted: {len(accepted_items)})")
    print(f"  Anomaly Safe Asset  : {len(anomaly_safe_asset_list)}")
    print(f"  Max Boundary Drift  : {max_drift_pct}%p on {max_drift_ticker}")
    print(f"  Baseline Governance : Open: {len(open_items)}, Accepted: {len(accepted_items)}, Resolved: {len(resolved_items)}")
    print(f"  First Run Baseline  : {is_first_run}")
    print("=" * 80)

    return history_row


def build_issue_body(
    run_date_str: str,
    new_anomalies: list[dict[str, Any]],
    max_drift_pct: float,
    max_drift_ticker: str,
) -> str:
    """Build markdown table body for GitHub issue."""
    lines = [
        f"## 🔍 홀딩스 실측 감시 신규 이상 징후 보고 ({run_date_str})",
        "",
        "홀딩스 실측 정기 감사 파이프라인에서 직전 실행 대비 **새로 탐지된 미해결 이상 종목(known_open)** 목록입니다.",
        "운영자는 아래 종목의 자산군 및 약관을 확인한 후 마스터 수정 여부를 판단하십시오.",
        "",
        "| 티커 | 종목명 | 유형 | 마스터 분류 | 실측치 / 한도 | 비고 |",
        "| :--- | :--- | :--- | :--- | :--- | :--- |",
    ]

    for it in new_anomalies:
        cat = it.get("category", "")
        details = it.get("details", {})
        if cat == "dominant":
            val_str = f"{details.get('dominant_asset')} {details.get('dominant_pct')}%"
        elif cat == "boundary_drift":
            val_str = f"주식 {details.get('measured_equity_pct')}% (한도 {details.get('target_equity_pct')}%, 괴리 {details.get('drift_pct')}%p)"
        else:
            val_str = f"위험자산 {details.get('measured_risk_pct')}%"

        lines.append(
            f"| `{it['ticker']}` | {it['name']} | {cat} | {details.get('current_asset_class', '')} | {val_str} | {it.get('review_note', '')} |"
        )

    lines.extend([
        "",
        "---",
        f"- **참고: 최대 경계 드리프트**: `{max_drift_ticker}` ({max_drift_pct}%p 괴리)",
        "- **조치 안내**: 마스터 `asset_class` 수정이 필요한 경우 `data/etf_master_draft.csv` 수정 후 `pension_regulatory_engine.py`를 실행하십시오.",
        "- **정상 인가 확인 시**: `holdings_anomaly_last.json`에서 해당 종목의 status를 `accepted`로 변경하고 커밋하십시오.",
    ])

    return "\n".join(lines)


def build_weekly_reminder_body(
    run_date_str: str,
    open_items: list[dict[str, Any]],
) -> str:
    """Build markdown table body for weekly unresolved reminder issue."""
    lines = [
        f"## ⏰ 홀딩스 실측 감시 주간 미해결 이상 종목 리마인더 ({run_date_str})",
        "",
        f"현재 감시 베이스라인에서 **미해결 상태(known_open)**로 유지 중인 이상 종목 {len(open_items)}건의 정기 점검 알림입니다.",
        "오류가 방치되지 않도록 검토 후 마스터를 수정하거나 `accepted`로 상태를 전환하십시오.",
        "",
        "| 티커 | 종목명 | 최초 탐지일 | 유형 | 실측치 / 한도 | 상태 | 비고 |",
        "| :--- | :--- | :--- | :--- | :--- | :--- | :--- |",
    ]

    for it in open_items:
        cat = it.get("category", "")
        details = it.get("details", {})
        if cat == "dominant":
            val_str = f"{details.get('dominant_asset')} {details.get('dominant_pct')}%"
        elif cat == "boundary_drift":
            val_str = f"주식 {details.get('measured_equity_pct')}% (한도 {details.get('target_equity_pct')}%, 괴리 {details.get('drift_pct')}%p)"
        else:
            val_str = f"위험자산 {details.get('measured_risk_pct')}%"

        lines.append(
            f"| `{it['ticker']}` | {it['name']} | {it.get('first_detected', '')} | {cat} | {val_str} | **{it.get('status')}** | {it.get('review_note', '')} |"
        )

    lines.extend([
        "",
        "---",
        "- **해결(Resolved)**: 마스터 데이터 수정 후 다음 감사 실행 시 자동으로 `resolved` 처리됩니다.",
        "- **수용(Accepted)**: 약관상 적법한 사유가 확인된 경우 `holdings_anomaly_last.json`에서 status를 `accepted`로 변경하십시오.",
    ])

    return "\n".join(lines)


def create_github_issue(title: str, body: str) -> None:
    """Create GitHub Issue using gh CLI."""
    try:
        cmd = [
            "gh",
            "issue",
            "create",
            "--title",
            title,
            "--body",
            body,
            "--label",
            "holdings-anomaly",
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        logger.info(f"GitHub Issue created successfully: {res.stdout.strip()}")
    except Exception as e:
        logger.warning(f"Failed to create GitHub Issue via gh CLI: {e}")


# ---------------------------------------------------------------------------
# 5. CLI Entrypoint
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Run daily holdings composition audit.")
    parser.add_argument(
        "--master",
        type=Path,
        default=REPO_ROOT / "data/etf_master_draft.csv",
        help="Path to master ETF CSV",
    )
    parser.add_argument(
        "--history",
        type=Path,
        default=REPO_ROOT / "data/reports/holdings_audit_history.csv",
        help="Path to audit history summary CSV",
    )
    parser.add_argument(
        "--last-anomaly",
        type=Path,
        default=REPO_ROOT / "data/reports/holdings_anomaly_last.json",
        help="Path to last anomaly baseline tracking JSON",
    )
    parser.add_argument(
        "--output-csv",
        type=Path,
        default=REPO_ROOT / "data/regulatory/holdings_measured_composition.csv",
        help="Path to output full measured composition CSV",
    )
    parser.add_argument(
        "--report-dir",
        type=Path,
        default=REPO_ROOT / "data/reports",
        help="Directory to save detailed anomaly reports",
    )
    parser.add_argument(
        "--cache-json",
        type=Path,
        default=None,
        help="Optional path to local holdings raw cache JSON for testing",
    )
    parser.add_argument(
        "--create-issue",
        action="store_true",
        help="Enable GitHub Issue creation via gh CLI if anomalies detected",
    )
    parser.add_argument(
        "--force-weekly-reminder",
        action="store_true",
        help="Force execution of weekly reminder issue creation for open items",
    )
    args = parser.parse_args()

    try:
        run_holdings_audit(
            master_path=args.master,
            history_csv=args.history,
            last_anomaly_json=args.last_anomaly,
            output_csv=args.output_csv,
            report_dir=args.report_dir,
            cache_json=args.cache_json,
            create_issue=args.create_issue,
            force_weekly_reminder=args.force_weekly_reminder,
        )
    except Exception as e:
        logger.error(f"Audit failed with unexpected error: {e}", exc_info=True)
        # Script errors or missing input files exit with code 1
        sys.exit(1)

    # Successful completion always exits with code 0 per directive
    sys.exit(0)


if __name__ == "__main__":
    main()
