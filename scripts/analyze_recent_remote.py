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
SELECT ticker, isin, listing_date, first_traded_date, listing_date_status, verification_note
FROM etf_listing_dates
WHERE listing_date >= '2026-05-17'
ORDER BY listing_date, ticker;
"""
text = CONFIG.read_text(encoding='utf-8')
token = re.search(r'oauth_token\s*=\s*"([^"]+)"', text).group(1)
request = urllib.request.Request(URL, data=json.dumps({'sql': SQL}).encode('utf-8'), method='POST', headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
with urllib.request.urlopen(request, timeout=60) as response:
    payload = json.loads(response.read().decode('utf-8'))
rows = payload['result'][0]['results']
same = [row for row in rows if row.get('listing_date') and row.get('first_traded_date') and row['listing_date'] == row['first_traded_date']]
different = [row for row in rows if row.get('listing_date') and row.get('first_traded_date') and row['listing_date'] != row['first_traded_date']]
missing = [row for row in rows if not row.get('first_traded_date')]
print(json.dumps({'count': len(rows), 'with_first_traded_date': len(same) + len(different), 'without_first_traded_date': len(missing), 'same_date': len(same), 'different_date': len(different), 'different_rows': different, 'missing_first_rows': missing}, ensure_ascii=True, indent=2))
