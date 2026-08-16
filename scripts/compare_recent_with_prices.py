from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path

CONFIG = Path(r'C:\Users\kibae\AppData\Roaming\xdg.config\.wrangler\config\default.toml')
ACCOUNT_ID = 'dd71905c19e313be635507cee431306d'
DATABASE_ID = '11c4e874-fba2-4e34-91d0-808892284c86'
URL = f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/d1/database/{DATABASE_ID}/query'
SQL = """
WITH recent AS (
  SELECT ticker, isin, listing_date, listing_date_status
  FROM etf_listing_dates
  WHERE listing_date >= '2026-05-17'
), first_close AS (
  SELECT ticker, MIN(date) AS first_close_date
  FROM etf_prices
  WHERE close IS NOT NULL
  GROUP BY ticker
)
SELECT recent.ticker, recent.isin, recent.listing_date, first_close.first_close_date,
       recent.listing_date_status,
       CASE WHEN first_close.first_close_date IS NULL THEN 'missing_first_close'
            WHEN recent.listing_date = first_close.first_close_date THEN 'same'
            ELSE 'different' END AS comparison
FROM recent
LEFT JOIN first_close ON first_close.ticker = recent.ticker
ORDER BY recent.listing_date, recent.ticker;
"""
text = CONFIG.read_text(encoding='utf-8')
token = re.search(r'oauth_token\s*=\s*"([^"]+)"', text).group(1)
request = urllib.request.Request(URL, data=json.dumps({'sql': SQL}).encode('utf-8'), method='POST', headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
with urllib.request.urlopen(request, timeout=60) as response:
    payload = json.loads(response.read().decode('utf-8'))
if not payload.get('success'):
    raise SystemExit(json.dumps(payload, ensure_ascii=True))
rows = payload['result'][0]['results']
summary = {
    'count': len(rows),
    'same': sum(1 for row in rows if row['comparison'] == 'same'),
    'different': sum(1 for row in rows if row['comparison'] == 'different'),
    'missing_first_close': sum(1 for row in rows if row['comparison'] == 'missing_first_close'),
    'different_rows': [row for row in rows if row['comparison'] == 'different'],
    'missing_rows': [row for row in rows if row['comparison'] == 'missing_first_close'],
}
print(json.dumps(summary, ensure_ascii=True, indent=2))
