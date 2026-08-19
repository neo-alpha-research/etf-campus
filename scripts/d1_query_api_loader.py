from __future__ import annotations

import json
import re
import sys
import time
import urllib.request
from pathlib import Path

PROJECT = Path(r'D:\ETFCampus')
CONFIG = Path(r'C:\Users\kibae\AppData\Roaming\xdg.config\.wrangler\config\default.toml')
ACCOUNT_ID = 'dd71905c19e313be635507cee431306d'
DATABASE_ID = '11c4e874-fba2-4e34-91d0-808892284c86'
URL = f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/d1/database/{DATABASE_ID}/query'


def token() -> str:
    text = CONFIG.read_text(encoding='utf-8')
    match = re.search(r'oauth_token\s*=\s*"([^"]+)"', text)
    if not match:
        raise RuntimeError('oauth token not found')
    return match.group(1)


def query(sql: str) -> dict:
    body = json.dumps({'sql': sql}).encode('utf-8')
    request = urllib.request.Request(
        URL,
        data=body,
        method='POST',
        headers={
            'Authorization': f'Bearer {token()}',
            'Content-Type': 'application/json',
        },
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = json.loads(response.read().decode('utf-8'))
    if not payload.get('success'):
        raise RuntimeError(json.dumps(payload, ensure_ascii=False))
    return payload


def statements(path: Path) -> list[str]:
    text = path.read_text(encoding='utf-8-sig')
    text = re.sub(r'^\s*(BEGIN TRANSACTION|COMMIT)\s*;?', '', text, flags=re.I | re.M)
    return [part.strip() for part in text.split(';') if part.strip()]

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'test'
    if mode == 'test':
        payload = query('SELECT COUNT(*) AS total FROM etf_listing_dates;')
        print(json.dumps(payload, ensure_ascii=False))
    elif mode == 'test-two':
        sqls = statements(PROJECT / 'data' / 'listing_dates' / 'd1_seed_chunks' / 'listing_dates_001.sql')[:2]
        payload = query(';\n'.join(sqls) + ';')
        print(json.dumps(payload, ensure_ascii=False))
    elif mode == 'load':
        for chunk_number in range(1, 25):
            path = PROJECT / 'data' / 'listing_dates' / 'd1_seed_chunks' / f'listing_dates_{chunk_number:03d}.sql'
            sqls = statements(path)
            print(f'chunk {chunk_number:03d}: {len(sqls)} statements', flush=True)
            for index, sql in enumerate(sqls, 1):
                query(sql + ';')
                if index % 10 == 0:
                    print(f'chunk {chunk_number:03d}: {index}/{len(sqls)}', flush=True)
                time.sleep(0.15)
            print(f'chunk {chunk_number:03d}: done', flush=True)
        print('all chunks completed', flush=True)
