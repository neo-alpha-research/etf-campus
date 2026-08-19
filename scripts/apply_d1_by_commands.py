from __future__ import annotations

import os
import re
import subprocess
import sys
import time
from pathlib import Path

PROJECT = Path(r'D:\ETFCampus')
CHUNK_DIR = PROJECT / 'data' / 'listing_dates' / 'd1_seed_chunks'
BATCH_SIZE = 1


def run_command(sql: str) -> None:
    env = os.environ.copy()
    env.setdefault('PYTHONIOENCODING', 'utf-8')
    command = [
        'npx.cmd', 'wrangler', 'd1', 'execute', 'etf-prices',
        '--remote', '--command', sql, '--yes'
    ]
    completed = subprocess.run(
        command,
        cwd=PROJECT,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding='utf-8',
        errors='replace',
        timeout=90,
    )
    if completed.returncode != 0:
        print(completed.stdout[-4000:], flush=True)
        raise SystemExit(f'failed with exit code {completed.returncode}')


def statements(text: str) -> list[str]:
    text = re.sub(r'^\s*(BEGIN TRANSACTION|COMMIT)\s*;?', '', text, flags=re.I | re.M)
    parts = [part.strip() for part in text.split(';') if part.strip()]
    return parts


for chunk_number in range(1, 25):
    path = CHUNK_DIR / f'listing_dates_{chunk_number:03d}.sql'
    sql_statements = statements(path.read_text(encoding='utf-8-sig'))
    print(f'chunk {chunk_number:03d}: {len(sql_statements)} statements', flush=True)
    for start in range(0, len(sql_statements), BATCH_SIZE):
        batch = ';\n'.join(sql_statements[start:start + BATCH_SIZE]) + ';'
        run_command(batch)
        time.sleep(0.2)
    print(f'chunk {chunk_number:03d}: done', flush=True)

print('all chunks completed', flush=True)
