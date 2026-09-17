import os
import glob
import json
import csv

tr_files = glob.glob('public/data/returns/tr_index/*.json')
print(f'tr_index file count: {len(tr_files)}')

sample = tr_files[0]
with open(sample, 'r', encoding='utf-8') as f:
    data = json.load(f)
print(f'sample file: {os.path.basename(sample)}')
print(f'sample schema keys: {list(data.keys())}')
if data.get('points'):
    print(f'first point keys: {list(data["points"][0].keys())}')
    print(f'first point: {data["points"][0]}')
    print(f'last point: {data["points"][-1]}')

min_date = '9999-99-99'
max_date = '0000-00-00'
max_len = 0
min_len = 99999
len_less_20 = 0
len_less_60 = 0
file_sizes = []

for tf in tr_files:
    sz = os.path.getsize(tf)
    file_sizes.append(sz)
    with open(tf, 'r', encoding='utf-8') as f:
        d = json.load(f)
        pts = d.get('points', [])
        if pts:
            if pts[0]['date'] < min_date:
                min_date = pts[0]['date']
            if pts[-1]['date'] > max_date:
                max_date = pts[-1]['date']
            l = len(pts)
            if l > max_len: max_len = l
            if l < min_len: min_len = l
            if l < 20: len_less_20 += 1
            if l < 60: len_less_60 += 1

file_sizes.sort()
median_sz = file_sizes[len(file_sizes)//2] / 1024
max_sz = max(file_sizes) / 1024
total_sz_mb = sum(file_sizes) / (1024 * 1024)

print(f'earliest date: {min_date}, latest date: {max_date}')
print(f'min points: {min_len}, max points: {max_len}')
print(f'<20 trading days: {len_less_20}, <60 trading days: {len_less_60}')
print(f'median size: {median_sz:.1f}KB, max size: {max_sz:.1f}KB, total size: {total_sz_mb:.1f}MB')

dist_csv = 'data/distributions/etf_distribution_events.csv'
tickers_with_dist = set()
if os.path.exists(dist_csv):
    with open(dist_csv, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            t = row.get('ticker') or row.get('code') or row.get('itemcode')
            if t:
                tickers_with_dist.add(t.strip())
print(f'tickers with distribution events in CSV: {len(tickers_with_dist)}')
total_tickers = {os.path.basename(tf).replace('.json', '').strip() for tf in tr_files}
zero_dist_count = len(total_tickers - tickers_with_dist)
print(f'tickers with 0 distribution events: {zero_dist_count}')

zero_dist_tickers = total_tickers - tickers_with_dist
mismatch_count = 0
for t in zero_dist_tickers:
    fpath = os.path.join('public/data/returns/tr_index', f'{t}.json')
    if os.path.exists(fpath):
        with open(fpath, 'r', encoding='utf-8') as f:
            d = json.load(f)
            for p in d.get('points', []):
                if abs(p['close'] - p['tr_index']) > 0.01:
                    mismatch_count += 1
                    break
print(f'zero distribution tickers with close != tr_index mismatch: {mismatch_count}')
