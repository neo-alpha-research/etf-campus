from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path

CONFIG = Path(r'C:\Users\kibae\AppData\Roaming\xdg.config\.wrangler\config\default.toml')
ACCOUNT_ID = 'dd71905c19e313be635507cee431306d'
DATABASE_ID = '11c4e874-fba2-4e34-91d0-808892284c86'
URL = f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/d1/database/{DATABASE_ID}/query'
text = CONFIG.read_text(encoding='utf-8')
token = re.search(r'oauth_token\s*=\s*"([^"]+)"', text).group(1)

def query(sql: str):
    req = urllib.request.Request(URL, data=json.dumps({'sql': sql}).encode(), method='POST', headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as response:
        payload = json.loads(response.read().decode())
    return payload['result'][0]['results']

tables = [row['name'] for row in query("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name;")]
for table in tables:
    cols = query(f'PRAGMA table_info({table});')
    print(json.dumps({'table': table, 'columns': [col['name'] for col in cols]}, ensure_ascii=True))
