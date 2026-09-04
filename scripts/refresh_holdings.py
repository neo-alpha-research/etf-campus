#!/usr/bin/env python3
"""Daily ETF Holdings Scraper and Cloudflare D1 Batch Exporter.

Fetches daily portfolio holdings (constituents) for all ETFs in ETF Campus
from official financial portal endpoints, generates D1 batch SQL chunk files,
and eliminates the need to commit 1,167 JSON files to Git on every daily run.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

MASTER_CSV_PATH = "data/etf_master_draft.csv"
OUTPUT_DIR = "public/data/holdings"
SQL_CHUNKS_DIR = "temp_holdings_chunks"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Referer": "https://stock.naver.com/",
}


def fetch_holdings_for_ticker(ticker: str) -> tuple[str, dict | None]:
    """Fetch portfolio constituent holdings for a single ETF ticker."""
    import requests

    url = f"https://stock.naver.com/api/domestic/detail/{ticker}/ETFComponent"
    try:
        r = requests.get(url, headers=HEADERS, timeout=10)
        if r.status_code != 200:
            return ticker, None

        items = r.json()
        if not items or not isinstance(items, list):
            return ticker, None

        holdings = []
        as_of_date = None

        for item in items:
            name = item.get("componentName")
            if not name:
                continue

            if not as_of_date and item.get("referenceDate"):
                as_of_date = item.get("referenceDate")

            weight_raw = item.get("weight")
            try:
                weight_pct = float(weight_raw) if weight_raw is not None else 0.0
            except (ValueError, TypeError):
                weight_pct = 0.0

            shares_raw = item.get("cuUnitQuantity")
            try:
                shares = int(float(shares_raw)) if shares_raw is not None else None
            except (ValueError, TypeError):
                shares = None

            item_code = item.get("componentItemCode") or item.get("componentReutersCode")

            holdings.append({
                "name": name.strip(),
                "weight_pct": round(weight_pct, 2),
                "shares": shares,
                "item_code": item_code,
            })

        # Sort by weight_pct descending
        holdings.sort(key=lambda x: x["weight_pct"], reverse=True)

        if not holdings:
            return ticker, None

        payload = {
            "ticker": ticker,
            "as_of_date": as_of_date or time.strftime("%Y-%m-%d"),
            "holdings": holdings,
        }
        return ticker, payload
    except Exception:
        return ticker, None


def generate_d1_sql_chunks(
    records: list[dict],
    output_dir: Path,
    chunk_size: int = 100,
) -> list[Path]:
    """Write D1 batch SQL chunk files."""
    output_dir.mkdir(parents=True, exist_ok=True)
    chunk_files: list[Path] = []

    for i in range(0, len(records), chunk_size):
        chunk = records[i : i + chunk_size]
        chunk_idx = (i // chunk_size) + 1
        file_path = output_dir / f"holdings_chunk_{chunk_idx:03d}.sql"

        with file_path.open("w", encoding="utf-8") as f:
            for item in chunk:
                ticker = item["ticker"]
                as_of_date = item["as_of_date"]
                holdings = item["holdings"]
                holding_count = len(holdings)
                top1_weight = holdings[0]["weight_pct"] if holdings else 0.0

                # Cloudflare D1 enforces a strict 100KB SQL statement limit (SQLITE_TOOBIG).
                # To prevent mega-index funds (1,500+ items) from exceeding the limit,
                # we preserve the true total count in holding_count and cap the stored JSON
                # constituents array to the top 300 holdings (max ~30KB).
                stored_holdings = holdings[:300]
                holdings_json_str = json.dumps(
                    stored_holdings, ensure_ascii=False
                ).replace("'", "''")

                sql = (
                    f"INSERT INTO etf_holdings "
                    f"(ticker, as_of_date, holdings_json, holding_count, top1_weight, updated_at) "
                    f"VALUES ('{ticker}', '{as_of_date}', '{holdings_json_str}', "
                    f"{holding_count}, {top1_weight}, datetime('now')) "
                    f"ON CONFLICT(ticker) DO UPDATE SET "
                    f"as_of_date=excluded.as_of_date, "
                    f"holdings_json=excluded.holdings_json, "
                    f"holding_count=excluded.holding_count, "
                    f"top1_weight=excluded.top1_weight, "
                    f"updated_at=datetime('now');\n"
                )
                f.write(sql)

        chunk_files.append(file_path)

    return chunk_files


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--master-csv",
        type=Path,
        default=Path(MASTER_CSV_PATH),
        help="Path to ETF master draft CSV",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(OUTPUT_DIR),
        help="Path to static holdings directory",
    )
    parser.add_argument(
        "--sql-dir",
        type=Path,
        default=Path(SQL_CHUNKS_DIR),
        help="Directory to write SQL batch chunks",
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=100,
        help="Number of ETFs per SQL chunk",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=25,
        help="Concurrent worker threads",
    )
    parser.add_argument(
        "--no-json",
        action="store_true",
        help="Skip writing individual JSON files to disk",
    )
    parser.add_argument(
        "--apply-d1-local",
        action="store_true",
        help="Execute generated SQL chunks against local D1 database",
    )
    parser.add_argument(
        "--apply-d1-remote",
        action="store_true",
        help="Execute generated SQL chunks against remote Cloudflare D1 database",
    )
    parser.add_argument(
        "--tickers",
        nargs="*",
        help="Optional subset of tickers to fetch (for testing)",
    )

    args = parser.parse_args()

    tickers: list[str] = []
    if args.tickers:
        tickers = args.tickers
    else:
        try:
            with args.master_csv.open("r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    t = row.get("ticker")
                    if t:
                        tickers.append(t.strip())
        except FileNotFoundError:
            print(f"Master CSV not found at {args.master_csv}")
            return 1

    # Deduplicate while preserving order
    tickers = list(dict.fromkeys(tickers))
    total = len(tickers)
    print(f"Starting holdings collection for {total} ETFs...")

    if not args.no_json:
        args.output_dir.mkdir(parents=True, exist_ok=True)

    start_time = time.time()
    successful_records: list[dict] = []

    with ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        results = executor.map(fetch_holdings_for_ticker, tickers)
        for ticker, data in results:
            if data and data.get("holdings"):
                successful_records.append(data)
                if not args.no_json:
                    out_path = args.output_dir / f"{ticker}.json"
                    with out_path.open("w", encoding="utf-8") as out_f:
                        json.dump(data, out_f, ensure_ascii=False, indent=2)

    elapsed = time.time() - start_time
    saved_count = len(successful_records)
    print(
        f"Fetched {saved_count}/{total} ETF holdings "
        f"({saved_count / total * 100:.1f}%) in {elapsed:.2f}s."
    )

    # Generate SQL chunks
    chunk_files = generate_d1_sql_chunks(
        successful_records, args.sql_dir, chunk_size=args.chunk_size
    )
    print(
        f"Generated {len(chunk_files)} SQL chunk files in {args.sql_dir} "
        f"({args.chunk_size} ETFs/chunk)."
    )

    # Optional local/remote D1 execution
    if args.apply_d1_local or args.apply_d1_remote:
        flag = "--remote" if args.apply_d1_remote else "--local"
        print(f"Applying {len(chunk_files)} chunks to D1 ({flag})...")
        for idx, chunk_file in enumerate(chunk_files, 1):
            cmd = [
                "npx",
                "--yes",
                "wrangler@4.124.0",
                "d1",
                "execute",
                "etf-prices",
                flag,
                f"--file={chunk_file}",
            ]
            print(f"  [{idx}/{len(chunk_files)}] Executing {chunk_file.name}...")
            res = subprocess.run(
                cmd,
                capture_output=True,
                encoding="utf-8",
                errors="replace",
                shell=True,
            )
            if res.returncode != 0:
                print(f"  [Error] executing {chunk_file.name}: {res.stderr}")
                return res.returncode
        print("[OK] Successfully applied all holdings chunks to D1.")

    return 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    raise SystemExit(main())
