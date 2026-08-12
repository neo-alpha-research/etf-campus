import argparse, csv, json, os, sys, time, urllib.parse, urllib.request
from datetime import date, timedelta
from pathlib import Path

BASE = 'https://apis.data.go.kr/1160100/service/GetSecuritiesProductInfoService/getETFPriceInfo'
TICKERS = {'458730', '402970', '441640', '490600'}
START, END = date(2025, 7, 31), date(2026, 7, 31)
OUT = Path(__file__).resolve().parents[1] / 'data' / 'income_page2_price_history.csv'

def fetch(day):
    key = os.environ['DATA_GO_KR_SERVICE_KEY']
    found = []
    for page in (1, 2):
        q = urllib.parse.urlencode({'serviceKey':key,'resultType':'json','basDt':day.strftime('%Y%m%d'),'numOfRows':'1000','pageNo':str(page)})
        for attempt in range(3):
            try:
                with urllib.request.urlopen(BASE + '?' + q, timeout=25) as response:
                    body = json.loads(response.read().decode())['response']['body']
                break
            except Exception:
                if attempt == 2: raise
                time.sleep(1.5 * (attempt + 1))
        rows = (body.get('items') or {}).get('item') or []
        found += [(day.isoformat(), r.get('srtnCd'), r.get('clpr')) for r in rows if r.get('srtnCd') in TICKERS]
        if page * 1000 >= int(body.get('totalCount', 0)):
            break
    return found

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--start', default=START.isoformat())
    parser.add_argument('--end', default=END.isoformat())
    args = parser.parse_args()
    if not os.environ.get('DATA_GO_KR_SERVICE_KEY'):
        raise SystemExit('DATA_GO_KR_SERVICE_KEY is required')
    start, end = date.fromisoformat(args.start), date.fromisoformat(args.end)
    days=[]; cur=start
    while cur<=end:
        if cur.weekday()<5: days.append(cur)
        cur += timedelta(days=1)
    existing=[]
    if OUT.exists():
        with OUT.open(encoding='utf-8-sig', newline='') as stream:
            existing=list(csv.reader(stream))[1:]
    records=[]
    for index, day in enumerate(days, 1):
        records += fetch(day)
        if index % 50 == 0: print(f'{index}/{len(days)} business dates collected', flush=True)
        time.sleep(0.08)
    records=[tuple(row) for row in existing] + records
    records=sorted(set(records))
    with OUT.open('w',encoding='utf-8-sig',newline='') as stream:
        writer=csv.writer(stream); writer.writerow(['date','ticker','close'])
        writer.writerows(records)
    coverage={ticker:sum(1 for _,t,_ in records if t==ticker) for ticker in sorted(TICKERS)}
    print('saved', OUT); print('coverage', coverage)

if __name__ == '__main__': main()
