import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone
from pathlib import Path

from trading_days import load_holidays, latest_trading_day

KST = timezone(timedelta(hours=9))
BASE_URL = "https://apis.data.go.kr/1160100/service/GetSecuritiesProductInfoService/getETFPriceInfo"
KRX_ETF_DAILY_URL = "https://data-dbg.krx.co.kr/svc/apis/etp/etf_bydd_trd"
REQUEST_TIMEOUT_SECONDS = 20

def check_krx_api(auth_key: str, day_text: str) -> bool:
    query = urllib.parse.urlencode({"basDd": day_text})
    request = urllib.request.Request(
        f"{KRX_ETF_DAILY_URL}?{query}",
        headers={"AUTH_KEY": auth_key},
    )
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
        payload = json.loads(response.read().decode("utf-8"))
        rows = payload.get("OutBlock_1") or []
        if isinstance(rows, dict):
            rows = [rows]
        return len(rows) > 0

def check_public_api(service_key: str, day_text: str) -> bool:
    query = urllib.parse.urlencode({
        "serviceKey": service_key,
        "resultType": "json",
        "basDt": day_text,
        "numOfRows": 1,
        "pageNo": 1,
    })
    with urllib.request.urlopen(f"{BASE_URL}?{query}", timeout=REQUEST_TIMEOUT_SECONDS) as response:
        payload = json.loads(response.read().decode("utf-8"))
        body = payload.get("response", {}).get("body", {})
        total_count = body.get("totalCount")
        if total_count is not None:
            return int(total_count) > 0
            
        items = (body.get("items") or {}).get("item") or []
        return len(items) > 0

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--holidays", type=Path, default=Path("data/market_holidays.txt"))
    parser.add_argument("--today", help="YYYYMMDD, 테스트용 기준일 고정")
    args = parser.parse_args()

    today = (
        datetime.strptime(args.today, "%Y%m%d").date()
        if args.today
        else datetime.now(KST).date()
    )
    holidays = load_holidays(args.holidays)

    # 1. Weekend Guard (Saturday / Sunday in KST: Korean markets closed)
    if today.weekday() >= 5:
        print(f"Today ({today:%Y-%m-%d}) is a weekend. Korean markets are closed. Skipping pipeline.", file=sys.stderr)
        return 3

    # 2. Market Holiday Guard (Korean statutory holidays: Korean markets closed)
    if today.strftime("%Y%m%d") in holidays:
        print(f"Today ({today:%Y-%m-%d}) is a designated Korean market holiday. Markets are closed. Skipping pipeline.", file=sys.stderr)
        return 4

    service_key = (os.environ.get("DATA_GO_KR_SERVICE_KEY") or "").strip()
    krx_auth_key = (os.environ.get("KRX_OPEN_API_KEY") or "").strip()
    if not service_key and not krx_auth_key:
        print("DATA_GO_KR_SERVICE_KEY 또는 KRX_OPEN_API_KEY 환경변수가 필요합니다.", file=sys.stderr)
        return 1

    expected = latest_trading_day(today, holidays)
    expected_text = expected.strftime("%Y%m%d")

    print(f"Checking data availability for trading day: {expected_text} (today {today:%Y%m%d} KST)")

    try:
        if krx_auth_key:
            print("Using KRX API...")
            has_data = check_krx_api(krx_auth_key, expected_text)
        else:
            print("Using Public Data API...")
            has_data = check_public_api(service_key, expected_text)
    except Exception as e:
        print(f"Error calling API: {type(e).__name__} - {e}", file=sys.stderr)
        return 1

    if has_data:
        print(f"Data is AVAILABLE for {expected_text}.")
        return 0
    else:
        print(f"Data is NOT YET AVAILABLE for {expected_text}.")
        return 2

if __name__ == "__main__":
    sys.exit(main())
