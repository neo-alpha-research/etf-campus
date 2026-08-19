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
KRX_INDEX_URLS = {
    "KOSPI": "https://data-dbg.krx.co.kr/svc/apis/idx/kospi_dd_trd",
    "KOSDAQ": "https://data-dbg.krx.co.kr/svc/apis/idx/kosdaq_dd_trd",
}


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
    with path.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    if not rows:
        raise RuntimeError("ETF master CSV has no rows.")

    dates = {str(row.get("bas_dt") or "").strip() for row in rows}
    if len(dates) != 1:
        raise RuntimeError(f"ETF master contains multiple basis dates: {sorted(dates)}")
    as_of_date = iso_date(next(iter(dates)))

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
        records.append({
            "ticker": ticker,
            "name": name,
            "close": close,
            "changePct": change_pct,
            "tradeValue": trade_value,
            "aumValue": aum_value,
            "riskType": normalize_risk_type(str(row.get("risk_type") or "")),
            "assetClass": str(row.get("asset_class") or "").strip() or None,
        })
    return as_of_date, sorted(records, key=lambda row: row["ticker"])


def fetch_krx_index(auth_key: str, code: str, as_of_date: str) -> dict[str, Any]:
    query = urllib.parse.urlencode({"basDd": as_of_date.replace("-", "")})
    request = urllib.request.Request(
        f"{KRX_INDEX_URLS[code]}?{query}",
        headers={"AUTH_KEY": auth_key, "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"KRX {code} API returned HTTP {error.code}") from error
    except Exception as error:
        raise RuntimeError(f"KRX {code} API failed: {type(error).__name__}") from error

    rows = payload.get("OutBlock_1") or payload.get("outBlock1") or payload.get("data") or []
    if isinstance(rows, dict):
        rows = [rows]
    expected = {"KOSPI": {"KOSPI", "코스피"}, "KOSDAQ": {"KOSDAQ", "코스닥"}}[code]
    for row in rows:
        name = str(row.get("IDX_NM") or row.get("idxNm") or row.get("indexName") or "").strip()
        if name.upper() not in expected and name not in expected:
            continue
        basis = str(row.get("BAS_DD") or row.get("basDt") or "").strip()
        normalized_date = iso_date(basis)
        return {
            "code": code,
            "name": code,
            "asOfDate": normalized_date,
            "close": compact_number(row.get("CLSPRC_IDX") or row.get("TDD_CLSPRC") or row.get("clpr")),
            "changePoints": compact_number(row.get("CMPPREVDD_IDX") or row.get("CMPPREVDD") or row.get("vs") or 0),
            "changePct": compact_number(row.get("FLUC_RT") or row.get("fltRt")),
            "volumeValue": compact_number(row.get("ACC_TRDVAL") or row.get("ACC_TRDVOL") or row.get("trqu") or 0),
        }
    raise RuntimeError(f"KRX {code} response has no composite index row for {as_of_date}")


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
    krx_auth_key = require_env("KRX_OPEN_API_KEY")
    as_of_date, etfs = read_master(Path(args.data_dir) / "etf_master_draft.csv")
    general = [row for row in etfs if row["riskType"] == "normal"]
    positive_aum = [row for row in general if row["aumValue"] > 0]
    if not general or not positive_aum:
        raise RuntimeError("ETF master quality validation failed: general ETF/AUM coverage is empty.")
    aum_coverage_pct = len(positive_aum) / len(general) * 100
    etf_hash = canonical_hash(etfs)

    indices = [fetch_krx_index(krx_auth_key, code, as_of_date) for code in ("KOSPI", "KOSDAQ")]
    if any(index["asOfDate"] != as_of_date for index in indices):
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
    if start.get("status") == "already_ready":
        print(json.dumps({"status": "already_ready", "as_of_date": as_of_date, "source_version": source_version}, ensure_ascii=False))
        return

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


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Market source snapshot publishing failed: {error}", file=sys.stderr)
        raise
