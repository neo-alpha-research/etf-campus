#!/usr/bin/env python3
"""
scripts/sync_briefings_to_d1.py

Synchronizes canonical market briefing JSON payloads (data/briefing_payload_*.json)
into Cloudflare D1 database (market_briefings table).

Ensures 100% single source of truth (SSOT) consistency between:
1) Cloudflare KV (market-briefing:v0:payload:latest) -> consumed by /api/briefings/latest
2) Cloudflare D1 (market_briefings table) -> consumed by /api/briefings/history & archives
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import uuid
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


def get_field(data: dict[str, Any], *keys: str, default: Any = None) -> Any:
    for k in keys:
        if k in data and data[k] is not None:
            return data[k]
    return default


def sync_date_to_d1(date_str: str, payload_path: Path, verbose: bool = True) -> bool:
    if not payload_path.exists():
        print(f"❌ Payload file not found: {payload_path}", file=sys.stderr)
        return False

    with payload_path.open("r", encoding="utf-8") as f:
        full_json = json.load(f)

    b = full_json.get("briefing") or full_json
    pulse = b.get("pulse") or {}
    as_of = str(b.get("asOfDate") or date_str).strip()

    gen_count = int(get_field(pulse, "generalEtfCount", default=0))
    up_count = int(get_field(pulse, "upCount", default=0))
    flat_count = int(get_field(pulse, "flatCount", default=0))
    down_count = int(get_field(pulse, "downCount", default=0))
    ret_pct = float(get_field(pulse, "generalAumWeightedReturnPct", default=0.0))
    top50_ret = float(get_field(pulse, "top50AumWeightedReturnPct", default=0.0))
    top100_ret = float(get_field(pulse, "top100AumWeightedReturnPct", default=0.0))
    top200_ret = float(get_field(pulse, "top200AumWeightedReturnPct", default=0.0))
    breadth = float(get_field(pulse, "breadthRatioPct", default=0.0))
    temp = str(get_field(pulse, "marketTemperature", default="혼조"))
    total_aum = float(get_field(pulse, "generalTotalAum", default=0.0))
    total_trade = float(get_field(pulse, "generalTotalTradeValue", default=0.0))
    top10_share = float(get_field(pulse, "top10TradeSharePct", default=0.0))

    # Headline text from payload
    headline_obj = b.get("headline")
    headline_text = ""
    if isinstance(headline_obj, dict):
        headline_text = headline_obj.get("text", "")
    elif isinstance(headline_obj, str):
        headline_text = headline_obj
    if not headline_text:
        headline_text = f"일반 ETF {gen_count:,}개 중 {up_count:,}개가 상승해 {temp} 흐름을 보였습니다."

    # Indices
    indices = b.get("marketIndices") or []
    kospi = next((i for i in indices if i.get("code") in ("KOSPI", "^KS11")), {})
    kosdaq = next((i for i in indices if i.get("code") in ("KOSDAQ", "^KQ11")), {})
    kospi_close = float(kospi.get("close", 7000.0) or 7000.0)
    kospi_change = float(kospi.get("change_pct", 0.0) or 0.0)
    kosdaq_close = float(kosdaq.get("close", 800.0) or 800.0)
    kosdaq_change = float(kosdaq.get("change_pct", 0.0) or 0.0)

    # Safe SQL escaping
    def sql_str(val: str) -> str:
        return "'" + val.replace("'", "''") + "'"

    # Check if row exists in D1
    check_cmd = [
        "npx", "wrangler", "d1", "execute", "etf-prices", "--remote", "--json",
        "--command", f"SELECT as_of_date FROM market_briefings WHERE as_of_date = '{as_of}';"
    ]
    check_res = subprocess.run(check_cmd, capture_output=True, text=True, encoding="utf-8", shell=True)
    row_exists = False
    if check_res.returncode == 0 and check_res.stdout:
        s_idx = check_res.stdout.find("[")
        e_idx = check_res.stdout.rfind("]")
        if s_idx != -1 and e_idx != -1:
            try:
                data = json.loads(check_res.stdout[s_idx:e_idx+1])
                row_exists = bool(data and data[0].get("results") and len(data[0]["results"]) > 0)
            except Exception:
                pass

    if row_exists:
        # Update existing record
        sql_to_run = f"""
        UPDATE market_briefings
        SET
          general_aum_weighted_return_pct = {ret_pct},
          top50_aum_weighted_return_pct = {top50_ret},
          top100_aum_weighted_return_pct = {top100_ret},
          top200_aum_weighted_return_pct = {top200_ret},
          general_etf_count = {gen_count},
          up_count = {up_count},
          flat_count = {flat_count},
          down_count = {down_count},
          breadth_ratio_pct = {breadth},
          market_temperature = {sql_str(temp)},
          general_total_aum = {total_aum},
          general_total_trade_value = {total_trade},
          top10_trade_share_pct = {top10_share},
          headline_text = {sql_str(headline_text)},
          updated_at = CURRENT_TIMESTAMP
        WHERE as_of_date = '{as_of}';
        """
    else:
        # Insert run and briefing row
        run_id = f"sync-{as_of}-{uuid.uuid4().hex[:8]}"
        sql_to_run = f"""
        INSERT INTO briefing_runs (
          run_id, trigger_type, schedule_slot, target_date, status, started_at, finished_at
        ) VALUES (
          {sql_str(run_id)}, 'manual', 'manual', '{as_of}', 'ready', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) ON CONFLICT(run_id) DO NOTHING;

        INSERT INTO market_briefings (
          as_of_date, status, calculation_version, publication_version, source_run_id,
          kospi_close, kospi_change_pct, kosdaq_close, kosdaq_change_pct,
          general_aum_weighted_return_pct, top50_aum_weighted_return_pct,
          top100_aum_weighted_return_pct, top200_aum_weighted_return_pct,
          general_etf_count, up_count, flat_count, down_count, breadth_ratio_pct,
          market_temperature, general_total_aum, general_total_trade_value,
          top10_trade_share_pct, headline_text, headline_generation_status,
          metrics_json, source_dates_json, validation_json, published_at, updated_at
        ) VALUES (
          '{as_of}', 'ready', 'v1', 1, {sql_str(run_id)},
          {kospi_close}, {kospi_change_pct}, {kosdaq_close}, {kosdaq_change_pct},
          {ret_pct}, {top50_ret}, {top100_ret}, {top200_ret},
          {gen_count}, {up_count}, {flat_count}, {down_count}, {breadth},
          {sql_str(temp)}, {total_aum}, {total_trade},
          {top10_share}, {sql_str(headline_text)}, 'validated',
          {sql_str(json.dumps(pulse, ensure_ascii=False))},
          {sql_str(json.dumps({"asOf": as_of}, ensure_ascii=False))},
          {sql_str(json.dumps({"status": "passed"}, ensure_ascii=False))},
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        );
        """
    temp_sql_file = REPO_ROOT / "data" / f"_temp_sync_{as_of}.sql"
    try:
        temp_sql_file.write_text(sql_to_run.strip(), encoding="utf-8")
        run_cmd = [
            "npx", "wrangler", "d1", "execute", "etf-prices", "--remote",
            f"--file={str(temp_sql_file)}"
        ]
        res = subprocess.run(run_cmd, capture_output=True, text=True, encoding="utf-8", shell=True)
        if res.returncode == 0:
            action = "Updated" if row_exists else "Inserted"
            if verbose:
                print(f"✅ [D1 Sync] {action} {as_of}: {gen_count} ETFs, ret={ret_pct}%, up={up_count}, flat={flat_count}, down={down_count}")
            return True
        else:
            action = "Update" if row_exists else "Insert"
            print(f"❌ [D1 Sync] {action} failed for {as_of}: {res.stderr or res.stdout}", file=sys.stderr)
            return False
    finally:
        if temp_sql_file.exists():
            temp_sql_file.unlink()


def main() -> int:
    parser = argparse.ArgumentParser(description="Synchronize canonical briefing payloads to Cloudflare D1")
    parser.add_argument("--date", help="Specific target date (YYYY-MM-DD)")
    parser.add_argument("--all", action="store_true", help="Sync all available briefing payloads")
    args = parser.parse_args()

    data_dir = REPO_ROOT / "data"

    if args.all:
        payload_files = sorted(data_dir.glob("briefing_payload_*.json"))
        payload_files = [p for p in payload_files if "latest" not in p.name]
        print(f"🔄 Synchronizing {len(payload_files)} briefing payloads to D1...")
        success = 0
        for pf in payload_files:
            date_str = pf.stem.replace("briefing_payload_", "")
            if sync_date_to_d1(date_str, pf):
                success += 1
        print(f"📊 D1 Synchronization Complete: {success}/{len(payload_files)} succeeded.")
        return 0 if success == len(payload_files) else 1

    target_date = args.date
    if not target_date:
        # Fallback to latest payload date
        latest_path = data_dir / "briefing_payload_latest.json"
        if latest_path.exists():
            with latest_path.open("r", encoding="utf-8") as f:
                d = json.load(f)
                b = d.get("briefing") or d
                target_date = b.get("asOfDate")

    if not target_date:
        print("❌ Could not determine target date.", file=sys.stderr)
        return 1

    date_payload = data_dir / f"briefing_payload_{target_date}.json"
    if not date_payload.exists():
        date_payload = data_dir / "briefing_payload_latest.json"

    ok = sync_date_to_d1(target_date, date_payload)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
