import csv
import json
import os
import time
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

BASE = 'https://apis.data.go.kr/1160100/service/GetSecuritiesProductInfoService/getETFPriceInfo'
TICKERS = {'395160', '0093A0', '446770', '491010'}
START, END = date(2025, 7, 31), date(2026, 7, 31)
OUT = Path(__file__).resolve().parents[1] / 'data' / 'page3_price_history.csv'


def fetch(day):
    key = os.environ['DATA_GO_KR_SERVICE_KEY']
    found = []
    for page in (1, 2):
        query = urllib.parse.urlencode({
            'serviceKey': key,
            'resultType': 'json',
            'basDt': day.strftime('%Y%m%d'),
            'numOfRows': '1000',
            'pageNo': str(page),
        })
        for attempt in range(3):
            try:
                with urllib.request.urlopen(BASE + '?' + query, timeout=25) as response:
                    body = json.loads(response.read().decode())['response']['body']
                break
            except Exception:
                if attempt == 2:
                    raise
                time.sleep(1.5 * (attempt + 1))
        rows = (body.get('items') or {}).get('item') or []
        found.extend((day.isoformat(), row.get('srtnCd'), row.get('clpr')) for row in rows if row.get('srtnCd') in TICKERS)
        if page * 1000 >= int(body.get('totalCount', 0)):
            break
    return found


def main():
    if not os.environ.get('DATA_GO_KR_SERVICE_KEY'):
        raise SystemExit('DATA_GO_KR_SERVICE_KEY is required')
    records = []
    current = START
    dates = []
    while current <= END:
        if current.weekday() < 5:
            dates.append(current)
        current += timedelta(days=1)
    for index, current in enumerate(dates, 1):
        records.extend(fetch(current))
        if index % 50 == 0:
            print(f'{index}/{len(dates)} weekday dates collected', flush=True)
        time.sleep(0.08)
    records = sorted(set(records))
    with OUT.open('w', encoding='utf-8-sig', newline='') as stream:
        writer = csv.writer(stream)
        writer.writerow(['date', 'ticker', 'close'])
        writer.writerows(records)
    coverage = {ticker: sum(1 for _, code, _ in records if code == ticker) for ticker in sorted(TICKERS)}
    print('saved', OUT)
    print('coverage', coverage)


if __name__ == '__main__':
    main()
