import json
import logging
import sys
import os
from pathlib import Path
import urllib.request
import urllib.parse
import urllib.error

import requests
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import csv
from io import StringIO

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

KRX_INDEX_URLS = {
    "KOSPI": "https://data-dbg.krx.co.kr/svc/apis/idx/kospi_dd_trd",
    "KOSDAQ": "https://data-dbg.krx.co.kr/svc/apis/idx/kosdaq_dd_trd",
}

# Yahoo Finance mapping
TICKERS = {
    "S&P 500": "^GSPC",
    "나스닥": "^IXIC",
    "니케이 225": "^N225",
    "원/달러": "KRW=X",
    "WTI 원유": "CL=F",
    "금 선물": "GC=F",
    "은 선물": "SI=F",
    "미 국채 10년물": "^TNX",
    "VIX": "^VIX",
}


def get_target_date() -> str:
    try:
        with open("data/etf_master_draft.csv", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            return next(reader)["bas_dt"]
    except Exception as e:
        logging.warning(f"Could not read bas_dt, defaulting to today: {e}")
        return datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y%m%d")

def compact_number(value) -> float:
    try:
        return float(str(value).replace(",", ""))
    except (ValueError, TypeError):
        return 0.0

def iso_date(date_str: str) -> str:
    if not date_str:
        return ""
    date_str = date_str.replace("-", "")
    if len(date_str) == 8:
        return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
    return date_str

def fetch_krx_index(auth_key: str, code: str, as_of_date: str) -> dict | None:
    query = urllib.parse.urlencode({"basDd": as_of_date.replace("-", "")})
    request = urllib.request.Request(
        f"{KRX_INDEX_URLS[code]}?{query}",
        headers={"AUTH_KEY": auth_key, "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception as error:
        logging.error(f"KRX {code} API failed: {error}")
        return None

    rows = payload.get("OutBlock_1") or payload.get("outBlock1") or payload.get("data") or []
    if isinstance(rows, dict):
        rows = [rows]
    expected = {"KOSPI": {"KOSPI", "코스피"}, "KOSDAQ": {"KOSDAQ", "코스닥"}}[code]
    for row in rows:
        name = str(row.get("IDX_NM") or row.get("idxNm") or row.get("indexName") or "").strip()
        if name.upper() not in expected and name not in expected:
            continue
        basis = str(row.get("BAS_DD") or row.get("basDt") or "").strip()
        normalized_date = iso_date(basis)
        close_val = compact_number(row.get("CLSPRC_IDX") or row.get("TDD_CLSPRC") or row.get("clpr"))
        change_pct = compact_number(row.get("FLUC_RT") or row.get("fltRt"))
        return {
            "value": close_val,
            "change": change_pct,
            "as_of_date": normalized_date,
            "changePoints": compact_number(row.get("CMPPREVDD_IDX") or row.get("CMPPREVDD") or row.get("vs") or 0),
            "volumeValue": compact_number(row.get("ACC_TRDVAL") or row.get("ACC_TRDVOL") or row.get("trqu") or 0),
        }
    logging.error(f"KRX {code} response has no composite index row for {as_of_date}")
    return None

def fetch_fred_data(series_id: str, target_date_str: str) -> dict | None:
    target_date = datetime.strptime(target_date_str, "%Y%m%d")
    start_date = (target_date - timedelta(days=30)).strftime("%Y-%m-%d")
    end_date = (target_date + timedelta(days=2)).strftime("%Y-%m-%d")
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}&cosd={start_date}&coed={end_date}"
    try:
        response = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
        response.raise_for_status()
        data = response.text
    except Exception as e:
        logging.error(f"Failed to fetch {series_id} from FRED: {e}")
        return None
    
    reader = csv.reader(StringIO(data))
    header = next(reader, None)
    target_date_formatted = target_date.strftime("%Y-%m-%d")
    
    valid_rows = []
    for row in reader:
        if len(row) < 2: continue
        if row[1] == '.' or not row[1].strip(): continue
        valid_rows.append(row)
        
    target_idx = -1
    for i, row in enumerate(valid_rows):
        if row[0] <= target_date_formatted:
            target_idx = i
            
    if target_idx <= 0:
        logging.error(f"Could not find sufficient historical data for {series_id}")
        return None
        
    price = float(valid_rows[target_idx][1])
    prev_close = float(valid_rows[target_idx - 1][1])
    change_pct = ((price - prev_close) / prev_close) * 100 if prev_close else 0
    
    return {
        "value": round(price, 2),
        "change": round(change_pct, 2),
        "as_of_date": valid_rows[target_idx][0]
    }

def fetch_index_data(ticker_symbol: str, target_date_str: str) -> dict | None:
    target_date = datetime.strptime(target_date_str, "%Y%m%d")
    end_date = target_date + timedelta(days=2)
    start_date = target_date - timedelta(days=10)
    
    period1 = int(start_date.timestamp())
    period2 = int(end_date.timestamp())
    
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker_symbol}?period1={period1}&period2={period2}&interval=1d"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        result = data.get("chart", {}).get("result")
        if not result:
            logging.error(f"No result found for {ticker_symbol}")
            return None
            
        timestamps = result[0].get("timestamp", [])
        indicators = result[0].get("indicators", {}).get("quote", [{}])[0]
        closes = indicators.get("close", [])
        
        if not timestamps or not closes:
            logging.error(f"Missing chart data for {ticker_symbol}")
            return None
            
        target_idx = -1
        target_date_actual = ""
        for i, ts in enumerate(timestamps):
            ts_date_obj = datetime.fromtimestamp(ts, tz=ZoneInfo("UTC"))
            ts_date = ts_date_obj.strftime("%Y%m%d")
            if ts_date <= target_date_str and closes[i] is not None:
                target_idx = i
                target_date_actual = ts_date_obj.strftime("%Y-%m-%d")
                
        if target_idx <= 0:
            logging.error(f"Could not find sufficient historical data for {ticker_symbol} around {target_date_str}")
            return None
            
        price = closes[target_idx]
        prev_close = closes[target_idx - 1]
        
        if price is None or prev_close is None:
            logging.error(f"Missing price data in historical array for {ticker_symbol}")
            return None
            
        change_pct = ((price - prev_close) / prev_close) * 100
        
        return {
            "value": round(price, 2),
            "change": round(change_pct, 2),
            "as_of_date": target_date_actual
        }
        
    except Exception as e:
        logging.error(f"Failed to fetch {ticker_symbol}: {e}")
        return None

def check_for_duplicates(new_indices, old_indices):
    old_map = {item['label']: item for item in old_indices}
    for new_item in new_indices:
        label = new_item['label']
        if label in old_map:
            old_item = old_map[label]
            # If both close and change exactly match, and change is not 0.00
            if (new_item['value'] == old_item['value'] and 
                new_item['change'] == old_item['change'] and 
                new_item['change'] != 0.0):
                logging.error(f"Duplicate values detected for {label}! New: {new_item}, Old: {old_item}")
                return True
    return False

def main():
    results = []
    
    target_date_str = get_target_date()
    logging.info(f"Using ETF base date: {target_date_str}")
    iso_target = iso_date(target_date_str)
    
    krx_auth_key = os.environ.get("KRX_OPEN_API_KEY")

    # Read previous JSON for duplicate checking
    out_path = Path("data/market_indices.json")
    old_indices = []
    old_base_date = ""
    if out_path.exists():
        try:
            with open(out_path, "r", encoding="utf-8") as f:
                old_data = json.load(f)
                old_indices = old_data.get("indices", [])
                old_base_date = old_data.get("base_date", "")
        except Exception as e:
            logging.warning(f"Could not read previous market_indices.json: {e}")
            
    success_count = 0
    fail_labels = []

    # 1. Fetch KRX
    if krx_auth_key:
        for label, code in [("코스피", "KOSPI"), ("코스닥", "KOSDAQ")]:
            logging.info(f"Fetching {label} from KRX...")
            data = fetch_krx_index(krx_auth_key, code, iso_target)
            if data:
                data["label"] = label
                data["code"] = code
                results.append(data)
                success_count += 1
            else:
                fail_labels.append(label)
    else:
        logging.error("KRX_OPEN_API_KEY not found. Cannot fetch KOSPI/KOSDAQ from KRX.")
        fail_labels.extend(["코스피", "코스닥"])

    # 2. Fetch Yahoo
    for label, symbol in TICKERS.items():
        logging.info(f"Fetching data for {label} ({symbol}) from Yahoo...")
        data = fetch_index_data(symbol, target_date_str)
        if data:
            data["label"] = label
            data["code"] = symbol # we map the raw symbol just in case
            results.append(data)
            success_count += 1
        else:
            fail_labels.append(label)


            
    # Check duplicates
    if old_base_date and old_base_date != target_date_str and check_for_duplicates(results, old_indices):
        logging.error("Exact duplicate values found from previous trading day! Aborting to prevent stale data publishing.")
        sys.exit(1)
            
    # Write to JSON
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        output_data = {'base_date': target_date_str, 'indices': results}
        json.dump(output_data, f, ensure_ascii=False, indent=2)
        
    logging.info(f"Successfully wrote {success_count} records to {out_path}. Failed: {len(fail_labels)} ({', '.join(fail_labels)})")
    
    total_targets = len(TICKERS)
    if success_count / total_targets < 0.7:
        logging.error("Success rate is below 70%. Failing the workflow.")
        sys.exit(1)

if __name__ == "__main__":
    main()
