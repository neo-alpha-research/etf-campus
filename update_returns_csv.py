import csv
import re
from datetime import datetime
from dateutil.relativedelta import relativedelta

# Load prices from SQL
with open('d1_unadjusted_prices.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

prices = {}
for match in re.finditer(r"\('(\d{6})',\s*'(\d{4}-\d{2}-\d{2})',\s*(\d+)\)", sql):
    t, d, p = match.groups()
    if t not in prices:
        prices[t] = {}
    prices[t][d] = int(p)

def get_price_on_or_before(ticker, target_date):
    if ticker not in prices: return None
    history = prices[ticker]
    available_dates = sorted(history.keys())
    target_str = target_date.strftime('%Y-%m-%d')
    for d in reversed(available_dates):
        if d <= target_str:
            return history[d]
    return None

today = datetime.strptime('2026-08-19', '%Y-%m-%d').date()

csv_path = 'data/etf_returns_draft.csv'
rows = []
fields = []
with open(csv_path, 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    fields = reader.fieldnames
    for row in reader:
        ticker = row['ticker']
        current_close_str = row.get('close_20260819', '')
        if not current_close_str:
            rows.append(row)
            continue
            
        current_close = float(current_close_str)
        
        # Calculate 24m and 36m
        d24 = today - relativedelta(months=24)
        p24 = get_price_on_or_before(ticker, d24)
        if p24:
            row['r_24m'] = f"{(current_close - p24) / p24 * 100:.2f}"
            
        d36 = today - relativedelta(months=36)
        p36 = get_price_on_or_before(ticker, d36)
        if p36:
            row['r_36m'] = f"{(current_close - p36) / p36 * 100:.2f}"
            
        rows.append(row)

with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fields)
    writer.writeheader()
    writer.writerows(rows)

print("Updated etf_returns_draft.csv successfully!")
