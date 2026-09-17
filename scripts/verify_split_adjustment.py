import os
import glob
import json
import csv
import sys

def verify_splits():
    ca_file = 'data/corporate_actions/etf_corporate_actions.csv'
    actions = []
    if os.path.exists(ca_file):
        with open(ca_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for r in reader:
                if r.get('ticker'):
                    actions.append(r)
    print(f"[Corporate Actions] Total registered corporate actions: {len(actions)}")

    tr_files = glob.glob('public/data/returns/tr_index/*.json')
    large_drops = []

    for tf in tr_files:
        ticker = os.path.basename(tf).replace('.json', '')
        with open(tf, 'r', encoding='utf-8') as f:
            data = json.load(f)
        points = data.get('points', [])
        for i in range(1, len(points)):
            prev_close = points[i - 1]['close']
            curr_close = points[i]['close']
            if prev_close and prev_close > 0:
                change = (curr_close - prev_close) / prev_close
                if abs(change) >= 0.40:
                    large_drops.append({
                        'ticker': ticker,
                        'prev_date': points[i - 1]['date'],
                        'date': points[i]['date'],
                        'prev_close': prev_close,
                        'curr_close': curr_close,
                        'change_pct': round(change * 100, 2)
                    })

    print(f"[Split/Merge Audit] Found {len(large_drops)} daily price jumps/drops >= 40% across {len(tr_files)} ETFs.")
    if large_drops:
        print("Details of >= 40% 1-day jumps/drops:")
        for d in large_drops:
            print(f"  Ticker {d['ticker']}: {d['prev_date']} ({d['prev_close']}) -> {d['date']} ({d['curr_close']}), Change: {d['change_pct']}%")
    else:
        print("  All ETF close price series are clean: 0 unadjusted cliff drops found.")

    return large_drops

if __name__ == '__main__':
    drops = verify_splits()
