import json
import csv
from pathlib import Path

def verify_themes():
    themes = [
      { 'name': '대표지수', 'tickers': ['069500', '229200', '245340', '360750', '133690'] },
      { 'name': '국내 AI·반도체', 'tickers': ['396500', '091160', '0167A0', '395160', '469150'] },
      { 'name': '미국 AI·반도체', 'tickers': ['381180', '446770', '390390', '423170', '0151S0'] },
      { 'name': '미국 빅테크', 'tickers': ['381170', '465580', '485540', '481190', '314250'] },
      { 'name': '국내외 고배당', 'tickers': ['458730', '161510', '472150', '441640', '498410'] },
      { 'name': '한국·미국 채권', 'tickers': ['453850', '484790', '385560', '439870', '365780'] },
      { 'name': '한국·미국 파킹형', 'tickers': ['459580', '423160', '357870', '456610', '455030'] },
    ]

    master_tickers = set()
    with open('data/etf_master_draft.csv', encoding='utf-8-sig') as f:
        for row in csv.DictReader(f):
            master_tickers.add(row['ticker'])

    print('=== 1. Recommended Theme 5-Item Full Verification ===')
    all_themes_5 = True
    for t in themes:
        valid = [x for x in t['tickers'] if x in master_tickers]
        status = 'PASS (5 items)' if len(valid) == 5 else f'FAIL ({len(valid)} items)'
        print(f"[{status}] {t['name']}: {valid}")
        if len(valid) != 5:
            all_themes_5 = False

    print(f"\nFinal Result: {'ALL 7 THEMES HAVE EXACTLY 5 VALID ITEMS (PASS)' if all_themes_5 else 'FAIL'}\n")

if __name__ == '__main__':
    verify_themes()
