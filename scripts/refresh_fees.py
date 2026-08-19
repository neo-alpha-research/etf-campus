import json
import re
import urllib.request
import csv
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor

REGISTRY_PATH = "data/fees/etf_fee_registry.json"
MASTER_CSV_PATH = "data/etf_master_draft.csv"

def get_fee_from_naver(ticker: str):
    url = f"https://finance.naver.com/item/coinfo.naver?code={ticker}"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            html = response.read().decode('euc-kr', errors='replace')
            soup = BeautifulSoup(html, 'html.parser')
            for th in soup.find_all('th'):
                if '펀드보수' in th.text:
                    td = th.find_next_sibling('td')
                    if td:
                        text = td.text.strip()
                        match = re.search(r'([0-9]+\.[0-9]+|[0-9]+)', text)
                        if match:
                            return float(match.group(1))
    except Exception as e:
        pass
    return None

def main():
    print("Loading master ETFs...")
    tickers = set()
    try:
        with open(MASTER_CSV_PATH, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get("srtnCd"):
                    tickers.add(row["srtnCd"].strip())
    except FileNotFoundError:
        print("Master CSV not found. Using existing registry keys.")

    with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
        registry_list = json.load(f)
        
    registry_dict = {item["ticker"]: item for item in registry_list}
        
    for k in registry_dict.keys():
        tickers.add(k)

    print(f"Total ETFs to check: {len(tickers)}")
    
    updates = 0
    news = 0
    
    def process_ticker(ticker):
        fee = get_fee_from_naver(ticker)
        return ticker, fee

    with ThreadPoolExecutor(max_workers=20) as executor:
        results = executor.map(process_ticker, tickers)
        for ticker, fee in results:
            if fee is None:
                continue
            if ticker not in registry_dict:
                registry_dict[ticker] = {
                    "ticker": ticker,
                    "isin": "",
                    "name": "",
                    "issuer": "",
                    "total_fee_pct": fee,
                    "other_cost_pct": None,
                    "trading_cost_pct": None,
                    "verification_status": "seed_unverified"
                }
                news += 1
                print(f"[NEW] {ticker} -> {fee}%")
            else:
                old_fee = registry_dict[ticker].get("total_fee_pct")
                if old_fee != fee:
                    registry_dict[ticker]["total_fee_pct"] = fee
                    print(f"[UPDATE] {ticker}: {old_fee}% -> {fee}%")
                    updates += 1

    print(f"Finished. New: {news}, Updated: {updates}")
    if news > 0 or updates > 0:
        sorted_keys = sorted(registry_dict.keys())
        final_list = [registry_dict[k] for k in sorted_keys]
        with open(REGISTRY_PATH, "w", encoding="utf-8") as f:
            json.dump(final_list, f, ensure_ascii=False, indent=2)
            f.write('\n')
        print("Registry saved.")

if __name__ == '__main__':
    main()
