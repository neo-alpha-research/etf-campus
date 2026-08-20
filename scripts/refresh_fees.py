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
        print(f"Failed to fetch fee for {ticker}: {e}")
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
    success_count = 0
    
    def process_ticker(ticker):
        fee = get_fee_from_naver(ticker)
        return ticker, fee

    with ThreadPoolExecutor(max_workers=20) as executor:
        results = executor.map(process_ticker, tickers)
        for ticker, fee in results:
            if fee is not None:
                success_count += 1
                if ticker in registry_dict:
                    if registry_dict[ticker].get("total_fee_pct") != fee:
                        registry_dict[ticker]["total_fee_pct"] = fee
                        updates += 1
                else:
                    # New entry fallback
                    pass

    total = len(tickers)
    success_rate = success_count / max(total, 1)
    print(f"Successfully fetched {success_count}/{total} ({success_rate*100:.1f}%)")

    if success_rate < 0.9:
        raise RuntimeError(f"Fee collection severely degraded: {success_count}/{total} successful. Pipeline failed.")

    with open(REGISTRY_PATH, "w", encoding="utf-8") as f:
        json.dump(list(registry_dict.values()), f, indent=2, ensure_ascii=False)
        f.write("\n")
        
    print(f"Done. Updated {updates} fees.")

if __name__ == '__main__':
    main()
