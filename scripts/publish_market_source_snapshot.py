"""Publish a validated daily ETF master CSV as a canonical D1 market-source snapshot.

This script intentionally makes no ETF-price API call. The existing daily refresh has
already reconciled KRX and FSC ETF data and written data/etf_master_draft.csv.
Only KOSPI/KOSDAQ values are requested from the existing KRX credential because they
are part of the source snapshot contract, then the payload is signed into the Pages API.
"""

from __future__ import annotations

import argparse
import base64
import csv
import datetime as dt
import hashlib
import hmac
import json
import math
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

KST = dt.timezone(dt.timedelta(hours=9))
MAX_ETFS_PER_BATCH = 40
DEFAULT_ENDPOINT = "https://etf-campus.pages.dev/api/internal/ingest-market-source"
# KRX_INDEX_URLS = {
#     "KOSPI": "https://data-dbg.krx.co.kr/svc/apis/idx/kospi_dd_trd",
#     "KOSDAQ": "https://data-dbg.krx.co.kr/svc/apis/idx/kosdaq_dd_trd",
# }


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required; configure it as an existing GitHub Actions secret.")
    return value


def compact_number(value: object) -> float:
    text = str(value or "").replace(",", "").strip()
    number = float(text)
    if not math.isfinite(number):
        raise ValueError(f"not finite: {value}")
    return number


def iso_date(value: str) -> str:
    if len(value) != 8 or not value.isdigit():
        raise ValueError(f"Expected YYYYMMDD, received {value!r}")
    return f"{value[:4]}-{value[4:6]}-{value[6:]}"


def normalize_risk_type(value: str) -> str:
    mapping = {"normal": "normal", "leverage": "leveraged", "leveraged": "leveraged", "inverse": "inverse"}
    return mapping.get(str(value or "").strip().lower(), "unknown")


def canonical_hash(value: object) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def read_master(path: Path) -> tuple[str, list[dict[str, Any]]]:
    import csv, re
    
    # Read classification mapping from comparison classification (PRIMARY SSOT) and review draft (fallback)
    class_map = {}
    asset_class_map = {}
    
    comparison_path = Path("data/comparison/etf_comparison_classification.csv")
    if comparison_path.exists():
        with comparison_path.open("r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                ticker = (row.get("ticker") or "").strip().upper()
                af = (row.get("asset_family") or "").strip()
                reg = (row.get("region_primary") or "").strip()
                if af == "주식":
                    ac = "주식-국내" if reg == "국내" else "주식-해외"
                elif af:
                    ac = af
                else:
                    ac = ""
                
                topic = (row.get("comparison_topic") or "").strip()
                if topic and topic not in ["미확인 주식전략", "미분류"]:
                    class_map[ticker] = topic
                if ac:
                    asset_class_map[ticker] = ac

    draft_path = Path("data/classification/etf_classification_review_draft.csv")
    if draft_path.exists():
        with draft_path.open("r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                ticker = (row.get("ticker") or "").strip().upper()
                if ticker and ticker not in class_map:
                    detail = row.get("final_asset_detail") or row.get("suggested_asset_detail") or ""
                    if detail.strip():
                        class_map[ticker] = detail.strip()
                if ticker and ticker not in asset_class_map:
                    ac = row.get("final_asset_class") or row.get("suggested_asset_class") or ""
                    if ac.strip():
                        asset_class_map[ticker] = ac.strip()

    print(f"Classification map loaded: {len(class_map)} items mapped.")

    with path.open("r", encoding="utf-8-sig") as stream:
        reader = csv.DictReader(stream)
        rows = list(reader)

    if not rows:
        raise RuntimeError(f"CSV {path.name} is empty.")

    dates = {row.get("bas_dt", "").strip() for row in rows if row.get("bas_dt", "").strip()}
    if len(dates) != 1:
        raise RuntimeError(f"Expected exactly one bas_dt in master, found: {dates}")
    as_of_date = dates.pop()
    if len(as_of_date) == 8:
        as_of_date = f"{as_of_date[:4]}-{as_of_date[4:6]}-{as_of_date[6:]}"

    records: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in rows:
        ticker = str(row.get("ticker") or "").strip().upper()
        name = str(row.get("name") or "").strip()
        if not ticker.isascii() or not ticker.isalnum() or len(ticker) != 6 or not name:
            raise RuntimeError(f"Invalid ETF master row: ticker={ticker!r}, name={name!r}")
        if ticker in seen:
            raise RuntimeError(f"Duplicate ETF ticker in master: {ticker}")
        seen.add(ticker)
        close = compact_number(row.get("close"))
        change_pct = compact_number(row.get("change_pct"))
        trade_value = compact_number(row.get("trade_value"))
        aum_value = compact_number(row.get("aum"))
        if close < 0 or trade_value < 0 or aum_value < 0:
            raise RuntimeError(f"Negative monetary value for {ticker}")
        
        raw_ac = str(row.get("asset_class") or "").strip()
        final_ac = asset_class_map.get(ticker, raw_ac) or raw_ac or None
        final_detail = class_map.get(ticker, "")
        records.append({
            "ticker": ticker,
            "name": name,
            "close": close,
            "changePct": change_pct,
            "tradeValue": trade_value,
            "aumValue": aum_value,
            "riskType": normalize_risk_type(str(row.get("risk_type") or "")),
            "assetClass": final_ac,
            "assetDetail": final_detail,
            "navValue": compact_number(row.get("nav")) if row.get("nav") else None,
            "disparityPct": compact_number(row.get("disparity")) if row.get("disparity") else None,
            "shares": int(compact_number(row.get("shares"))) if row.get("shares") else None,
            "isGeneralEtf": 1 if normalize_risk_type(str(row.get("risk_type") or "")) == "normal" and final_ac != "금리·파킹" else 0,
        })
    return as_of_date, sorted(records, key=lambda row: row["ticker"])




def fetch_fred_index(series_id: str, as_of_date: str) -> dict[str, Any] | None:
    # Use cosd to avoid fetching the entire history and timing out
    start_date = (dt.datetime.fromisoformat(as_of_date) - dt.timedelta(days=30)).strftime("%Y-%m-%d")
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}&cosd={start_date}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            data = response.read().decode('utf-8')
    except Exception as e:
        print(f"Warning: Failed to fetch {series_id} from FRED: {e}")
        return None
    
    reader = csv.reader(StringIO(data))
    header = next(reader, None)
    target = None
    prev = None
    for row in reader:
        if len(row) < 2: continue
        date, val = row
        if val == '.': continue
        if date <= as_of_date:
            prev = target
            target = {"date": date, "val": float(val)}
        else:
            break
    if not target or not prev: return None
    
    name_map = {"DGS10": "미국 10년물 금리", "T10Y2Y": "미국 장단기금리차"}
    return {
        "asOfDate": target["date"],
        "indexCode": series_id,
        "indexName": name_map.get(series_id, series_id),
        "closeValue": round(target["val"], 4),
        "changePoints": round(target["val"] - prev["val"], 4),
        "changePct": round((target["val"] - prev["val"]) / prev["val"] * 100, 4) if prev["val"] else 0,
        "volumeValue": 0,
        "sourceHash": "fred"
    }

def fetch_yahoo_index(code: str, as_of_date: str) -> dict[str, Any]:
    from datetime import datetime, timedelta
    from zoneinfo import ZoneInfo
    target_date = datetime.strptime(as_of_date, "%Y-%m-%d")
    period1 = int((target_date - timedelta(days=10)).timestamp())
    period2 = int((target_date + timedelta(days=2)).timestamp())
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{code}?period1={period1}&period2={period2}&interval=1d"
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            data = json.loads(response.read().decode("utf-8"))
    except Exception as e:
        print(f"Warning: Failed to fetch {code} from Yahoo Finance: {e}")
        return None
    
    result = data.get("chart", {}).get("result")
    if not result: return None
    timestamps = result[0].get("timestamp", [])
    closes = result[0].get("indicators", {}).get("quote", [{}])[0].get("close", [])
    
    target_date_str = as_of_date.replace("-", "")
    target_idx = -1
    for i, ts in enumerate(timestamps):
        ts_date = datetime.fromtimestamp(ts, tz=ZoneInfo("UTC")).strftime("%Y%m%d")
        if ts_date <= target_date_str and closes[i] is not None:
            target_idx = i
            
    if target_idx <= 0: return None
    price = closes[target_idx]
    prev_close = closes[target_idx - 1]
    if price is None or prev_close is None: return None
    
    name_map = {"^TNX": "미 국채 10년물", "^VIX": "VIX", "CL=F": "WTI 원유"}
    
    # Do not scale TNX. The value is already a percentage (e.g., 4.74).
    return {
        "asOfDate": f"{ts_date[:4]}-{ts_date[4:6]}-{ts_date[6:]}",
        "indexCode": code.replace("^", "").replace("=", ""),
        "indexName": name_map.get(code, code),
        "closeValue": round(price, 2),
        "changePoints": round(price - prev_close, 2),
        "changePct": round(((price - prev_close) / prev_close) * 100, 2),
        "volumeValue": 0,
        "sourceHash": "yahoo_finance"
    }

def fetch_krx_bond_yield(auth_key: str, as_of_date: str) -> dict:
    import urllib.request, urllib.parse, json
    # Attempt to fetch KTB 10Y Yield from KRX Open API
    url = "https://data-dbg.krx.co.kr/svc/apis/bnd/bnd_dd_trd" # KRX 채권 일별 엔드포인트
    query = urllib.parse.urlencode({"basDd": as_of_date.replace("-", "")})
    request = urllib.request.Request(
        f"{url}?{query}",
        headers={"AUTH_KEY": auth_key, "Accept": "application/json"},
    )
    
    try:
        if auth_key:
            with urllib.request.urlopen(request, timeout=10) as response:
                payload = json.loads(response.read().decode("utf-8"))
                
            rows = payload.get("OutBlock_1") or payload.get("outBlock1") or payload.get("data") or []
            if isinstance(rows, dict):
                rows = [rows]
                
            for row in rows:
                name = str(row.get("ISU_NM") or row.get("isuNm") or "").strip()
                if "국고채" in name and "10년" in name:
                    yield_val = float(row.get("YLD") or row.get("yld") or row.get("TDD_CLSPRC") or 0)
                    if yield_val:
                        return {
                            "asOfDate": as_of_date,
                            "indexCode": "KR10Y",
                            "indexName": "한국 10년물 금리",
                            "closeValue": round(yield_val, 3),
                            "changePoints": 0.0,
                            "changePct": 0.0,
                            "volumeValue": 0,
                            "sourceHash": "krx_open_api"
                        }
    except Exception as e:
        print(f"Warning: KRX Bond Yield API failed ({e}). Falling back to mock data.")

    # Fallback
    return {
        "asOfDate": as_of_date,
        "indexCode": "KR10Y",
        "indexName": "한국 10년물 금리",
        "closeValue": 4.37,
        "changePoints": 0.05,
        "changePct": 1.06,
        "volumeValue": 0,
        "sourceHash": "mock"
    }

#def fetch_krx_index(auth_key: str, code: str, as_of_date: str) -> dict[str, Any]:
#    query = urllib.parse.urlencode({"basDd": as_of_date.replace("-", "")})
#    request = urllib.request.Request(
#        f"{KRX_INDEX_URLS[code]}?{query}",
#        headers={"AUTH_KEY": auth_key, "Accept": "application/json"},
#    )
#    try:
#        with urllib.request.urlopen(request, timeout=20) as response:
#            payload = json.loads(response.read().decode("utf-8"))
#    except urllib.error.HTTPError as error:
#        raise RuntimeError(f"KRX {code} API returned HTTP {error.code}") from error
#    except Exception as error:
#        raise RuntimeError(f"KRX {code} API failed: {type(error).__name__}") from error

#    rows = payload.get("OutBlock_1") or payload.get("outBlock1") or payload.get("data") or []
#    if isinstance(rows, dict):
#        rows = [rows]
#    expected = {"KOSPI": {"KOSPI", "코스피"}, "KOSDAQ": {"KOSDAQ", "코스닥"}}[code]
#    for row in rows:
#        name = str(row.get("IDX_NM") or row.get("idxNm") or row.get("indexName") or "").strip()
#        if name.upper() not in expected and name not in expected:
#            continue
#        basis = str(row.get("BAS_DD") or row.get("basDt") or "").strip()
#        normalized_date = iso_date(basis)
#        return {
#            "code": code,
#            "name": code,
#            "asOfDate": normalized_date,
#            "close": compact_number(row.get("CLSPRC_IDX") or row.get("TDD_CLSPRC") or row.get("clpr")),
#            "changePoints": compact_number(row.get("CMPPREVDD_IDX") or row.get("CMPPREVDD") or row.get("vs") or 0),
#            "changePct": compact_number(row.get("FLUC_RT") or row.get("fltRt")),
#            "volumeValue": compact_number(row.get("ACC_TRDVAL") or row.get("ACC_TRDVOL") or row.get("trqu") or 0),
#        }
#    raise RuntimeError(f"KRX {code} response has no composite index row for {as_of_date}")


def signed_post(endpoint: str, secret: str, payload: dict[str, Any]) -> dict[str, Any]:
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    timestamp = str(int(time.time()))
    message = b"POST\n" + timestamp.encode("ascii") + b"\n" + body
    signature = base64.b64encode(hmac.new(secret.encode("utf-8"), message, hashlib.sha256).digest()).decode("ascii")
    request = urllib.request.Request(
        endpoint,
        data=body,
        headers={
            "Content-Type": "application/json",
            "X-ETF-Ingest-Timestamp": timestamp,
            "X-ETF-Ingest-Signature": signature,
            "User-Agent": "etf-campus-market-source-publisher/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"Market source ingest returned HTTP {error.code}: {detail}") from error


def chunks(records: list[dict[str, Any]], size: int) -> list[list[dict[str, Any]]]:
    return [records[index:index + size] for index in range(0, len(records), size)]


def main() -> None:
    parser = argparse.ArgumentParser(description="Publish existing daily ETF snapshot into the market-source hub")
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--endpoint", default=os.environ.get("MARKET_SOURCE_INGEST_ENDPOINT", DEFAULT_ENDPOINT))
    parser.add_argument("--git-commit-sha", default=os.environ.get("GITHUB_SHA", ""))
    args = parser.parse_args()

    hmac_secret = require_env("PRICE_INGEST_HMAC_SECRET")
    # krx_auth_key = require_env("KRX_OPEN_API_KEY")
    as_of_date, etfs = read_master(Path(args.data_dir) / "etf_master_draft.csv")
    general = [row for row in etfs if row["riskType"] == "normal" and row.get("assetClass") != "금리·파킹"]
    positive_aum = [row for row in general if row["aumValue"] > 0]
    if not general or not positive_aum:
        raise RuntimeError("ETF master quality validation failed: general ETF/AUM coverage is empty.")

    # Validate classification mapping coverage (Step 3 Peer Groups dependency)
    mapped_count = sum(1 for row in general if row.get("assetDetail"))
    mapping_ratio = mapped_count / len(general) if general else 0
    if mapping_ratio < 0.10:
        raise RuntimeError(f"Classification mapping coverage too low: {mapped_count}/{len(general)} ({mapping_ratio:.1%}). Expected at least 10%.")
    aum_coverage_pct = len(positive_aum) / len(general) * 100
    etf_hash = canonical_hash(etfs)

    # Read indices from unified data/market_indices.json instead of fetching directly
    indices = []
    indices_file = Path(args.data_dir) / "market_indices.json"
    with open(indices_file, "r", encoding="utf-8") as f:
        unified_indices = json.load(f).get("indices", [])
        
    for item in unified_indices:
        raw_code = item.get("code") or item.get("label")
        if raw_code not in ("KOSPI", "KOSDAQ"):
            continue
        # Map back to D1 ingest payload format
        indices.append({
            "code": raw_code,
            "name": item.get("label"),
            "asOfDate": item.get("as_of_date", as_of_date),
            "close": item.get("value", 0),
            "changePoints": item.get("changePoints", 0.0),
            "changePct": item.get("change", 0.0),
            "volumeValue": item.get("volumeValue", 0),
        })
        
    # --- DEPRECATED: Old fetching logic ---
    # krx_auth_key = require_env("KRX_OPEN_API_KEY")
    # indices = [fetch_krx_index(krx_auth_key, code, as_of_date) for code in ("KOSPI", "KOSDAQ")]
    # indices.append(fetch_krx_bond_yield(krx_auth_key, as_of_date))
    # for fred_code in ("DGS10", "T10Y2Y"):
    #     fred_data = fetch_fred_index(fred_code, as_of_date)
    #     if fred_data:
    #         indices.append(fred_data)
    # for yf_code in ("^VIX", "CL=F"):
    #     yf_data = fetch_yahoo_index(yf_code, as_of_date)
    #     if yf_data:
    #         indices.append(yf_data)
    # ----------------------------------------
    
    # Still enforce date validation on KOSPI and KOSDAQ
    kospi_kosdaq = [idx for idx in indices if idx["code"] in ("KOSPI", "KOSDAQ")]
    if any(index["asOfDate"] != as_of_date for index in kospi_kosdaq):
        raise RuntimeError("KOSPI/KOSDAQ basis date is not aligned with the validated ETF master date.")
    
    index_hash = canonical_hash(indices)
    source_version = f"market-source-{as_of_date}-{etf_hash[:16]}"
    validation = {
        "status": "passed",
        "etf_row_count": len(etfs),
        "general_etf_count": len(general),
        "aum_coverage_pct": aum_coverage_pct,
        "etf_as_of_date": as_of_date,
        "kospi_as_of_date": indices[0]["asOfDate"],
        "kosdaq_as_of_date": indices[1]["asOfDate"],
        "source": "existing_daily_refresh",
    }

    start = signed_post(args.endpoint, hmac_secret, {
        "action": "start",
        "asOfDate": as_of_date,
        "sourceVersion": source_version,
        "expectedEtfCount": len(etfs),
        "generalEtfCount": len(general),
        "aumCoveragePct": aum_coverage_pct,
        "etfSourceHash": etf_hash,
        "indexSourceHash": index_hash,
        "validation": validation,
        "gitCommitSha": args.git_commit_sha or None,
    })
    # if start.get("status") == "already_ready":
    #     print(json.dumps({"status": "already_ready", "as_of_date": as_of_date, "source_version": source_version}, ensure_ascii=False))
    #     return

    accepted = 0
    for batch in chunks(etfs, MAX_ETFS_PER_BATCH):
        result = signed_post(args.endpoint, hmac_secret, {
            "action": "batch", "asOfDate": as_of_date, "sourceVersion": source_version, "etfs": batch,
        })
        accepted += int(result.get("accepted", 0))
    final = signed_post(args.endpoint, hmac_secret, {
        "action": "finalize", "asOfDate": as_of_date, "sourceVersion": source_version, "indices": indices,
    })
    if final.get("status") != "ready":
        raise RuntimeError(f"Unexpected finalization response: {final}")
    print(json.dumps({"status": "ready", "as_of_date": as_of_date, "source_version": source_version, "accepted": accepted, "event_id": final.get("eventId")}, ensure_ascii=False))

    # Trigger publisher worker to materialize snapshot and compute/publish briefing immediately
    publisher_url = f"https://market-briefing-publisher.neo-alpha-research.workers.dev/internal/publish-date?date={as_of_date}"
    try:
        req = urllib.request.Request(publisher_url, headers={"User-Agent": "ETF-Campus-Publisher-Trigger/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            pub_res = json.loads(resp.read().decode("utf-8"))
            print(f"Briefing publisher triggered successfully for {as_of_date}: {pub_res}")
    except Exception as pub_err:
        print(f"Warning: Publisher worker trigger returned: {pub_err}", file=sys.stderr)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Market source snapshot publishing failed: {error}", file=sys.stderr)
        raise
