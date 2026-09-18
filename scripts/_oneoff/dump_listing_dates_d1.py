#!/usr/bin/env python3
"""Export etf_listing_dates from D1 to CSV."""
from __future__ import annotations
import csv
import json
import re
import urllib.request
from pathlib import Path

CONFIG = Path(r'C:\Users\kibae\AppData\Roaming\xdg.config\.wrangler\config\default.toml')
ACCOUNT_ID = 'dd71905c19e313be635507cee431306d'
DATABASE_ID = '11c4e874-fba2-4e34-91d0-808892284c86'
URL = f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/d1/database/{DATABASE_ID}/query'

def main():
    text = CONFIG.read_text(encoding='utf-8')
    token = re.search(r'oauth_token\s*=\s*"([^"]+)"', text).group(1)
    
    req = urllib.request.Request(
        URL, 
        data=json.dumps({'sql': 'SELECT * FROM etf_listing_dates;'}).encode(), 
        method='POST', 
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req, timeout=60) as response:
        payload = json.loads(response.read().decode())
    
    rows = payload['result'][0]['results']
    if not rows:
        print("No rows found.")
        return 0
        
    out_path = Path("data/listing-ledger/etf_listing_dates.csv")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    
    fields = list(rows[0].keys())
    with out_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Exported {len(rows)} rows to {out_path}")

if __name__ == "__main__":
    main()
