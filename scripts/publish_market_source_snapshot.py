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

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from lib.indices import (
    CANONICAL_MACRO_CODES,
    normalize_index_code,
    get_index_label,
    validate_canonical_macro_codes,
)

KST = dt.timezone(dt.timedelta(hours=9))
MAX_ETFS_PER_BATCH = 100
DEFAULT_ENDPOINT = "https://etf-campus.pages.dev/api/internal/ingest-market-source"


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
    
    # Read peer group / topic mapping from comparison classification (PRIMARY SSOT) and review draft (fallback)
    class_map = {}
    
    comparison_path = Path("data/comparison/etf_comparison_classification.csv")
    if comparison_path.exists():
        with comparison_path.open("r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                ticker = (row.get("ticker") or "").strip().upper()
                topic = (row.get("comparison_topic") or "").strip()
                if topic and topic not in ["미확인 주식전략", "미분류"]:
                    class_map[ticker] = topic

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
        
        # Canonical asset class: trust etf_master_draft.csv directly as SSOT
        raw_ac = str(row.get("asset_class") or "").strip()
        if raw_ac == "주식" or not raw_ac:
            raw_ac = "주식-해외" if re.search(r"미국|글로벌|중국|일본|유럽|베트남|인도|아시아|차이나|월드|나스닥|S&P|다우", name, re.I) else "주식-국내"
        final_ac = raw_ac
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


def signed_post(
    endpoint: str,
    secret: str,
    payload: dict[str, Any],
    retry_delays: tuple[float, ...] = (5.0, 10.0, 20.0, 30.0, 40.0),
) -> dict[str, Any]:
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    max_attempts = len(retry_delays) + 1

    for attempt in range(1, max_attempts + 1):
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
            # Retry only on server errors (5xx) where deployment or transient lag might recover
            if error.code >= 500 and attempt < max_attempts:
                delay = retry_delays[attempt - 1]
                print(f"⚠️ Ingest returned HTTP {error.code} on attempt {attempt}/{max_attempts}. Retrying in {delay}s... ({detail})", file=sys.stderr)
                time.sleep(delay)
                continue
            raise RuntimeError(f"Market source ingest returned HTTP {error.code}: {detail}") from error
        except urllib.error.URLError as error:
            if attempt < max_attempts:
                delay = retry_delays[attempt - 1]
                print(f"⚠️ Network error on attempt {attempt}/{max_attempts}: {error}. Retrying in {delay}s...", file=sys.stderr)
                time.sleep(delay)
                continue
            raise



def chunks(records: list[dict[str, Any]], size: int) -> list[list[dict[str, Any]]]:
    return [records[index:index + size] for index in range(0, len(records), size)]


def main() -> None:
    parser = argparse.ArgumentParser(description="Publish existing daily ETF snapshot into the market-source hub")
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--endpoint", default=os.environ.get("MARKET_SOURCE_INGEST_ENDPOINT", DEFAULT_ENDPOINT))
    parser.add_argument("--git-commit-sha", default=os.environ.get("GITHUB_SHA", ""))
    parser.add_argument("--skip-trigger", action="store_true", help="Deprecated: downstream publisher worker retired")
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
        if not raw_code:
            continue
        canon_code = normalize_index_code(raw_code)
        canon_name = get_index_label(canon_code)
        # Map back to D1 ingest payload format with canonical code
        indices.append({
            "code": canon_code,
            "name": canon_name,
            "asOfDate": item.get("as_of_date", as_of_date),
            "close": item.get("value", 0.0),
            "changePoints": item.get("changePoints", 0.0),
            "changePct": item.get("change", 0.0),
            "volumeValue": item.get("volumeValue", 0.0) if item.get("volumeValue") is not None else None,
        })

    # Strict validation: CANONICAL_MACRO_CODES must be 100% complete for D1 ingestion
    is_valid_canon, missing_codes = validate_canonical_macro_codes(indices)
    if not is_valid_canon:
        raise RuntimeError(f"D1 snapshot ingestion blocked: missing canonical macro codes {sorted(missing_codes)}")

    # Enforce date validation on KOSPI and KOSDAQ
    kospi_kosdaq = [idx for idx in indices if idx["code"] in ("KOSPI", "KOSDAQ")]
    if len(kospi_kosdaq) < 2:
        raise RuntimeError("Validated snapshot must contain both KOSPI and KOSDAQ.")
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
    if final.get("status") not in ("ready", "already_ready"):
        raise RuntimeError(f"Unexpected finalization response: {final}")
    print(json.dumps({"status": "ready", "as_of_date": as_of_date, "source_version": source_version, "accepted": accepted, "event_id": final.get("eventId")}, ensure_ascii=False))



if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Market source snapshot publishing failed: {error}", file=sys.stderr)
        raise
