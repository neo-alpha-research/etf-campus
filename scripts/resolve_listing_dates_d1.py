#!/usr/bin/env python3
"""Resolve ETF listing dates using D1 etf_prices table.

This script fetches the first close date from `etf_prices`, compares it with
`etf_listing_dates`, and generates an SQL script to update the listing dates.
"""

from __future__ import annotations

import json
import re
import urllib.request
import subprocess
import argparse
from pathlib import Path
from datetime import datetime, timezone

CONFIG = Path(r'C:\Users\kibae\AppData\Roaming\xdg.config\.wrangler\config\default.toml')
ACCOUNT_ID = 'dd71905c19e313be635507cee431306d'
DATABASE_ID = '11c4e874-fba2-4e34-91d0-808892284c86'
URL = f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/d1/database/{DATABASE_ID}/query'

SQL = """
WITH stats AS (
  SELECT ticker, 
         MIN(date) AS first_available_price_date,
         MAX(date) AS price_coverage_end,
         COUNT(*) AS row_count
  FROM etf_prices
  WHERE close IS NOT NULL
  GROUP BY ticker
)
SELECT eld.ticker, eld.isin, eld.listing_date, eld.listing_date_status,
       eld.first_traded_date, eld.first_traded_date_source,
       s.first_available_price_date, s.price_coverage_end, s.row_count
FROM etf_listing_dates eld
LEFT JOIN stats s ON eld.ticker = s.ticker;
"""

def sql_literal(value: str | None) -> str:
    return "NULL" if not value else "'" + value.replace("'", "''") + "'"

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("data/backups/resolve_price_coverage.sql"))
    parser.add_argument("--apply", action="store_true", help="Apply the SQL using wrangler")
    args = parser.parse_args()

    text = CONFIG.read_text(encoding='utf-8')
    token = re.search(r'oauth_token\s*=\s*"([^"]+)"', text).group(1)
    
    print("Fetching data from D1...")
    request = urllib.request.Request(
        URL, 
        data=json.dumps({'sql': SQL}).encode('utf-8'), 
        method='POST', 
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = json.loads(response.read().decode('utf-8'))
    
    if not payload.get('success'):
        print(f"Error fetching data: {json.dumps(payload, ensure_ascii=False)}")
        return 1
        
    rows = payload['result'][0]['results']
    print(f"Fetched {len(rows)} ETFs from D1.")
    
    updates = []
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    
    for row in rows:
        ticker = row['ticker']
        current_listing_date = row['listing_date']
        current_first_traded_date = row.get('first_traded_date')
        current_first_traded_source = row.get('first_traded_date_source')
        first_avail = row['first_available_price_date']
        cov_end = row['price_coverage_end']
        
        if not first_avail:
            continue
            
        status = 'partial'
        
        # If listing_date is known and first_available_price_date is within 7 days of listing_date,
        # we can assume we have complete coverage from the start.
        if current_listing_date and first_avail <= current_listing_date:
            status = 'complete'
        elif current_listing_date:
            # Let's see how big the gap is. If it's a huge gap, it's definitely partial.
            # Convert to date objects
            try:
                ld = datetime.strptime(current_listing_date, "%Y-%m-%d").date()
                fa = datetime.strptime(first_avail, "%Y-%m-%d").date()
                if (fa - ld).days <= 10:
                    status = 'complete'
            except:
                pass
                
        set_clauses = [
            f"ticker = {sql_literal(ticker)}",
            f"first_available_price_date = {sql_literal(first_avail)}",
            f"price_coverage_start = {sql_literal(first_avail)}",
            f"price_coverage_end = {sql_literal(cov_end)}",
            f"price_coverage_status = {sql_literal(status)}",
            f"updated_at = {sql_literal(generated_at)}"
        ]
        
        sql = f"INSERT INTO etf_price_coverage (ticker, first_available_price_date, price_coverage_start, price_coverage_end, price_coverage_status, updated_at) " \
              f"VALUES ({sql_literal(ticker)}, {sql_literal(first_avail)}, {sql_literal(first_avail)}, {sql_literal(cov_end)}, {sql_literal(status)}, {sql_literal(generated_at)}) " \
              f"ON CONFLICT(ticker) DO UPDATE SET " \
              f"first_available_price_date = excluded.first_available_price_date, " \
              f"price_coverage_start = excluded.price_coverage_start, " \
              f"price_coverage_end = excluded.price_coverage_end, " \
              f"price_coverage_status = excluded.price_coverage_status, " \
              f"updated_at = excluded.updated_at;"
              
        updates.append(sql)

        # Update etf_listing_dates ONLY if we can confirm complete coverage
        if status == 'complete':
            updates.append(f"UPDATE etf_listing_dates SET first_traded_date = {sql_literal(first_avail)}, first_traded_date_source = 'price_coverage_complete' WHERE ticker = {sql_literal(ticker)};")
        elif (
            current_first_traded_date
            and current_first_traded_source in {"ETF 가격 데이터의 최초 close 확인", "price_coverage_complete"}
        ):
            # A prior incomplete D1 snapshot was incorrectly promoted as the
            # actual first trading date.  Do not retain that fabricated value
            # once coverage is known to be partial.
            updates.append(
                f"UPDATE etf_listing_dates SET first_traded_date = NULL, first_traded_date_source = NULL "
                f"WHERE ticker = {sql_literal(ticker)};"
            )

    if not updates:
        print("No updates needed.")
        return 0
        
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('w', encoding='utf-8') as f:
        f.write("\n".join(updates))
        
    print(f"Generated {len(updates)} UPDATE statements to {args.output}")
    
    if args.apply:
        print(f"Applying SQL to D1...")
        cmd = ["npx.cmd", "wrangler", "d1", "execute", "etf-prices", "--remote", "--file", str(args.output)]
        subprocess.run(cmd, check=True)
        print("Successfully applied updates to D1.")

    return 0

if __name__ == "__main__":
    raise SystemExit(main())
