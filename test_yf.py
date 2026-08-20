import sys
sys.stdout.reconfigure(encoding='utf-8')
import csv
import yfinance as yf

tickers = []
with open('data/etf_master_draft.csv', 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        if row.get('ticker'):
            tickers.append(row['ticker'] + '.KS')

df = yf.download(tickers[:100], start='2026-08-10', end='2026-08-15', auto_adjust=False, threads=True)
failed = [col for col in df['Close'].columns if df['Close'][col].isna().all()]
print(f"Failed: {len(failed)}")
if failed:
    print(failed[:10])
