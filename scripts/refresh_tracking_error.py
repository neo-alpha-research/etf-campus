import csv
import json
import logging
import time
from pathlib import Path

import requests

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

KRX_MDC_URL = "http://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd"

def fetch_krx_tracking_error(trd_dd: str) -> dict[str, float]:
    """
    KRX 정보데이터시스템 (data.krx.co.kr) 에서 전종목 기본정보(MDCSTAT04601) 또는 
    전종목 시세(MDCSTAT04301) 등을 통해 추적오차율 데이터를 수집합니다.
    (현재 WAF 등에 의해 로컬 차단이 발생할 수 있으나, 정상 응답 시 데이터를 파싱합니다.)
    """
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'http://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201010101',
        'Origin': 'http://data.krx.co.kr',
        'X-Requested-With': 'XMLHttpRequest'
    })

    # Get initial cookies
    try:
        session.get('http://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201010101', timeout=10)
    except Exception as e:
        logging.warning(f"Failed to get initial cookies: {e}")

    # OTP Request
    url_otp = 'http://data.krx.co.kr/comm/fileDn/GenerateOTP/generate.cmd'
    data_otp = {
        'mktId': 'ALL',
        'trdDd': trd_dd,
        'share': '1',
        'money': '1',
        'csvxls_isNo': 'false',
        'name': 'fileDown',
        'url': 'dbms/MDC/STAT/standard/MDCSTAT04301'
    }
    
    try:
        otp = session.post(url_otp, data=data_otp, timeout=10).text
        if otp == "LOGOUT" or not otp:
            logging.error("KRX OTP fetch returned LOGOUT or empty. WAF blocking active.")
            return {}
    except Exception as e:
        logging.error(f"OTP request failed: {e}")
        return {}

    # Download Data
    url_dn = 'http://data.krx.co.kr/comm/fileDn/download_csv/download.cmd'
    try:
        res = session.post(url_dn, data={'code': otp}, timeout=15)
        res.encoding = 'euc-kr'
        
        # Parse CSV
        reader = csv.DictReader(res.text.splitlines())
        tracking_errors = {}
        for row in reader:
            # KRX CSV 컬럼명에 따라 수정 필요. 일반적으로 '종목코드', '추적오차율' 등 포함
            ticker = row.get('종목코드', '').strip()
            te_str = row.get('추적오차율', '').strip()
            if ticker and te_str:
                try:
                    tracking_errors[ticker] = float(te_str)
                except ValueError:
                    pass
        return tracking_errors
    except Exception as e:
        logging.error(f"Failed to download or parse KRX data: {e}")
        return {}

def update_master_draft(tracking_errors: dict[str, float]) -> None:
    master_path = Path("data/etf_master_draft.csv")
    if not master_path.exists():
        logging.error(f"{master_path} does not exist.")
        return

    with master_path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fields = list(reader.fieldnames or [])
        if "tracking_error" not in fields:
            fields.append("tracking_error")
        rows = list(reader)

    updated_count = 0
    for row in rows:
        ticker = row["ticker"]
        if ticker in tracking_errors:
            row["tracking_error"] = str(tracking_errors[ticker])
            updated_count += 1

    with master_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

    logging.info(f"Updated {updated_count} rows with tracking error data.")

if __name__ == "__main__":
    import datetime
    # Use yesterday as default trading day (approximation)
    trd_dd = (datetime.datetime.now() - datetime.timedelta(days=1)).strftime("%Y%m%d")
    te_data = fetch_krx_tracking_error(trd_dd)
    if te_data:
        update_master_draft(te_data)
    else:
        logging.warning("No tracking error data fetched.")
