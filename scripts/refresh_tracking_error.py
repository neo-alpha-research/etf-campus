import csv
import json
import logging
import time
from pathlib import Path
import datetime
import urllib.parse
from playwright.sync_api import sync_playwright

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

def fetch_krx_tracking_error(trd_dd: str) -> dict[str, float]:
    """
    Playwright(Headless Browser)를 사용하여 KRX 정보데이터시스템의 WAF를 우회하고 
    추적오차율 데이터를 안정적으로 수집합니다.
    """
    tracking_errors = {}
    
    with sync_playwright() as p:
        # headless=True 로 백그라운드 실행 (CI 환경 최적화)
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()
        
        try:
            # 1. 메인 페이지 접속을 통해 세션 및 쿠키(WAF 토큰 등) 발급
            logging.info("Visiting KRX main page to bypass WAF...")
            page.goto("http://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201010101", wait_until="domcontentloaded")
            
            # 2. OTP 발급 (AJAX Request 에뮬레이션)
            logging.info("Fetching OTP...")
            otp_response = page.evaluate('''async (trdDd) => {
                const formData = new URLSearchParams();
                formData.append('mktId', 'ALL');
                formData.append('trdDd', trdDd);
                formData.append('share', '1');
                formData.append('money', '1');
                formData.append('csvxls_isNo', 'false');
                formData.append('name', 'fileDown');
                formData.append('url', 'dbms/MDC/STAT/standard/MDCSTAT04301');
                
                const res = await fetch('/comm/fileDn/GenerateOTP/generate.cmd', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: formData.toString()
                });
                return await res.text();
            }''', trd_dd)
            
            if not otp_response or "LOGOUT" in otp_response:
                logging.error(f"OTP fetch failed or returned LOGOUT. Response: {otp_response}")
                return tracking_errors

            # 3. CSV 데이터 다운로드
            logging.info("Downloading CSV data via OTP...")
            csv_response = page.evaluate('''async (otp) => {
                const formData = new URLSearchParams();
                formData.append('code', otp);
                
                const res = await fetch('/comm/fileDn/download_csv/download.cmd', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: formData.toString()
                });
                
                // EUC-KR 디코딩
                const buffer = await res.arrayBuffer();
                const decoder = new TextDecoder('euc-kr');
                return decoder.decode(buffer);
            }''', otp_response)
            
            # 파싱
            reader = csv.DictReader(csv_response.splitlines())
            for row in reader:
                ticker = row.get('종목코드', '').strip()
                te_str = row.get('추적오차율', '').strip()
                if ticker and te_str:
                    try:
                        tracking_errors[ticker] = float(te_str)
                    except ValueError:
                        pass
                        
            logging.info(f"Successfully parsed {len(tracking_errors)} tracking errors.")
        except Exception as e:
            logging.error(f"Playwright crawling failed: {e}")
        finally:
            browser.close()

    return tracking_errors

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
    master_path = Path("data/etf_master_draft.csv")
    trd_dd = ""
    if master_path.exists():
        with master_path.open(encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            first_row = next(reader, None)
            if first_row and "bas_dt" in first_row:
                trd_dd = first_row["bas_dt"].strip()
                
    if not trd_dd:
        trd_dd = (datetime.datetime.now() - datetime.timedelta(days=1)).strftime("%Y%m%d")

    logging.info(f"Fetching Tracking Error for date: {trd_dd}")
    te_data = fetch_krx_tracking_error(trd_dd)
    if te_data:
        update_master_draft(te_data)
        from calculate_pure_tracking_error import update_pure_tracking_errors
        update_pure_tracking_errors()
    else:
        logging.warning("No tracking error data fetched.")
