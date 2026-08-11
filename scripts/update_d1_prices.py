import argparse
import datetime
import json
import os
import sys
import time
import urllib.request
import urllib.parse
from pathlib import Path

# Import existing logic
from update_daily_data import fetch_krx_snapshot

def generate_sql_statements(snapshot: dict, date_str: str) -> list[str]:
    """date_str is YYYY-MM-DD"""
    values = []
    for ticker, data in snapshot.items():
        close_price = data.get("TDD_CLSPRC") or data.get("close")
        if close_price is not None:
            if isinstance(close_price, str):
                close_price = close_price.replace(",", "")
            values.append(f"('{ticker}', '{date_str}', {close_price})")
            
    sql_statements = []
    if values:
        chunk_size = 500
        for i in range(0, len(values), chunk_size):
            val_chunk = values[i:i+chunk_size]
            sql = f"INSERT INTO etf_prices (ticker, date, close) VALUES {','.join(val_chunk)} ON CONFLICT(ticker, date) DO UPDATE SET close=excluded.close;"
            sql_statements.append(sql)
    return sql_statements

def execute_d1_query(account_id: str, db_id: str, token: str, sql: str) -> dict:
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{db_id}/query"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    data = json.dumps({"sql": sql}).encode("utf-8")
    
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"D1 API Error ({e.code}): {body}")
        raise

def main():
    parser = argparse.ArgumentParser(description="Update D1 database with today's ETF prices")
    parser.add_argument("--date", type=str, help="Target date in YYYYMMDD (default: today)")
    args = parser.parse_args()

    krx_key = os.environ.get("KRX_OPEN_API_KEY")
    cf_account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    cf_db_id = os.environ.get("CLOUDFLARE_D1_ID")
    cf_token = os.environ.get("CLOUDFLARE_D1_TOKEN")
    
    if not all([krx_key, cf_account_id, cf_db_id, cf_token]):
        print("Error: Missing required environment variables.")
        print("Required: KRX_OPEN_API_KEY, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_ID, CLOUDFLARE_D1_TOKEN")
        sys.exit(1)

    target_date_str = args.date
    if not target_date_str:
        target_date_str = datetime.date.today().strftime("%Y%m%d")
        
    sql_date = f"{target_date_str[:4]}-{target_date_str[4:6]}-{target_date_str[6:8]}"
    
    print(f"Fetching KRX data for {target_date_str}...")
    try:
        snapshot = fetch_krx_snapshot(krx_key, target_date_str)
    except Exception as e:
        print(f"Failed to fetch KRX data: {e}")
        sys.exit(1)
        
    if not snapshot:
        print("No data received from KRX. Possibly a holiday or before market close.")
        return

    print("Generating SQL...")
    sql_statements = generate_sql_statements(snapshot, sql_date)
    
    if not sql_statements:
        print("No valid price data to insert.")
        return
        
    print(f"Executing {len(sql_statements)} statements against D1...")
    
    for i, sql in enumerate(sql_statements):
        print(f"Executing batch {i+1}/{len(sql_statements)}...")
        execute_d1_query(cf_account_id, cf_db_id, cf_token, sql)
        time.sleep(1) # Rate limit protection
        
    print(f"Successfully updated D1 for {sql_date}.")

if __name__ == "__main__":
    main()
