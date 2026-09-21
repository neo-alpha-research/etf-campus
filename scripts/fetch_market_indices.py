import json
import logging
import sys
import os
import time
from pathlib import Path
import urllib.request
import urllib.parse
import urllib.error

import requests
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import csv

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from lib.indices import (
    CANONICAL_MACRO_CODES,
    normalize_index_code,
    validate_canonical_macro_codes,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

KRX_INDEX_URLS = {
    "KOSPI": "https://data-dbg.krx.co.kr/svc/apis/idx/kospi_dd_trd",
    "KOSDAQ": "https://data-dbg.krx.co.kr/svc/apis/idx/kosdaq_dd_trd",
}

# 네이버 증권 공식 일별 시세 SSOT (원자재 및 환율)
NAVER_COMMODITY_FX_CONFIG = {
    "WTI 원유": {"category": "energy", "reutersCode": "CLcv1", "code": "CLF"},
    "금 선물": {"category": "metals", "reutersCode": "GCcv1", "code": "GC"},
    "은 선물": {"category": "metals", "reutersCode": "SIcv1", "code": "SI"},
    "원/달러": {"category": "exchange", "reutersCode": "FX_USDKRW", "code": "USDKRW"},
}

# 네이버 증권 공식 국채 금리 SSOT (10년물)
NAVER_BOND_CONFIG = {
    "국채 10년": {"reutersCode": "KR10YT=RR", "code": "KR10Y"},
    "미 국채 10년물": {"reutersCode": "US10YT=RR", "code": "DGS10"},
}

# 미국 정규 주가지수 및 변동성 (Yahoo Finance 공식 정규장 종가)
US_TICKERS = {
    "S&P 500": "^GSPC",
    "나스닥": "^IXIC",
    "VIX": "^VIX",
}

US_MARKET_HOLIDAYS_2026 = {
    "2026-01-01",  # New Year's Day
    "2026-01-19",  # Martin Luther King Jr. Day
    "2026-02-16",  # Washington's Birthday (Presidents' Day)
    "2026-04-03",  # Good Friday
    "2026-05-25",  # Memorial Day
    "2026-06-19",  # Juneteenth
    "2026-07-03",  # Independence Day (observed)
    "2026-09-07",  # Labor Day
    "2026-11-26",  # Thanksgiving Day
    "2026-12-25",  # Christmas Day
}

ALL_REQUIRED_LABELS = [
    "코스피",
    "코스닥",
    "코스피 변동성지수",
    "국채 10년",
    "원/달러",
    "S&P 500",
    "나스닥",
    "VIX",
    "미 국채 10년물",
    "WTI 원유",
    "금 선물",
    "은 선물",
]


def get_target_date() -> str:
    for arg in sys.argv[1:]:
        if arg.startswith("--target-date="):
            raw = arg.split("=", 1)[1].strip().replace("-", "")
            if len(raw) == 8 and raw.isdigit():
                return raw
        elif len(arg.replace("-", "")) == 8 and arg.replace("-", "").isdigit():
            return arg.replace("-", "")
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

def fetch_krx_index(auth_key: str, code: str, as_of_date: str, retries: int = 3) -> dict | None:
    query = urllib.parse.urlencode({"basDd": as_of_date.replace("-", "")})
    url = f"{KRX_INDEX_URLS[code]}?{query}"
    request = urllib.request.Request(
        url,
        headers={"AUTH_KEY": auth_key, "Accept": "application/json"},
    )
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                payload = json.loads(response.read().decode("utf-8"))
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
                label = "코스피" if code == "KOSPI" else "코스닥"
                return {
                    "label": label,
                    "code": code,
                    "value": close_val,
                    "change": change_pct,
                    "as_of_date": normalized_date,
                    "changePoints": compact_number(row.get("CMPPREVDD_IDX") or row.get("CMPPREVDD") or row.get("vs") or 0),
                    "volumeValue": compact_number(row.get("ACC_TRDVAL") or row.get("ACC_TRDVOL") or row.get("trqu") or 0),
                }
            logging.error(f"KRX {code} response has no composite index row for {as_of_date}")
            return None
        except Exception as error:
            if attempt < retries:
                logging.warning(f"KRX {code} attempt {attempt} failed ({error}). Retrying...")
                time.sleep(attempt * 1.5)
            else:
                logging.error(f"KRX {code} API failed after {retries} attempts: {error}")
                return None

def get_krx_auth_key() -> str | None:
    key = os.environ.get("KRX_OPEN_API_KEY")
    if key and key.strip():
        return key.strip().lstrip("\ufeff")
    dev_vars = Path(".dev.vars")
    if dev_vars.exists():
        for line in dev_vars.read_text(encoding="utf-8").splitlines():
            if line.startswith("KRX_OPEN_API_KEY="):
                val = line.split("=", 1)[1].strip().lstrip("\ufeff")
                if val:
                    return val
    return None

def fetch_krx_vkospi(auth_key: str, as_of_date: str, retries: int = 3) -> dict | None:
    query = urllib.parse.urlencode({"basDd": as_of_date.replace("-", "")})
    url = f"https://data-dbg.krx.co.kr/svc/apis/idx/drvprod_dd_trd?{query}"
    request = urllib.request.Request(
        url,
        headers={"AUTH_KEY": auth_key, "Accept": "application/json"},
    )
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                payload = json.loads(response.read().decode("utf-8"))
            rows = payload.get("OutBlock_1") or payload.get("outBlock1") or []
            for row in rows:
                name = str(row.get("IDX_NM") or row.get("idxNm") or "").strip()
                if "변동성" in name or name in ("코스피 200 변동성지수", "코스피200 변동성지수", "VKOSPI"):
                    basis = str(row.get("BAS_DD") or row.get("basDt") or "").strip()
                    close_val = compact_number(row.get("CLSPRC_IDX") or row.get("clpr"))
                    change_pct = compact_number(row.get("FLUC_RT") or row.get("fltRt"))
                    change_pts = compact_number(row.get("CMPPREVDD_IDX") or row.get("vs") or 0)
                    return {
                        "label": "코스피 변동성지수",
                        "code": "VKOSPI",
                        "value": close_val,
                        "change": change_pct,
                        "changePoints": change_pts,
                        "as_of_date": iso_date(basis),
                    }
            logging.error(f"KRX VKOSPI response has no volatility index row for {as_of_date}")
            return None
        except Exception as error:
            if attempt < retries:
                logging.warning(f"KRX VKOSPI attempt {attempt} failed ({error}). Retrying...")
                time.sleep(attempt * 1.5)
            else:
                logging.error(f"KRX VKOSPI API failed after {retries} attempts: {error}")
                return None


def fetch_naver_market_index(category: str, reuters_code: str, iso_target: str, retries: int = 3) -> dict | None:
    """네이버 증권 공식 일별 시세 API를 통해 정규장 마감 종가를 수집합니다 (전산 틱 및 차근월물 왜곡 원천 차단)."""
    url = f"https://m.stock.naver.com/front-api/marketIndex/prices?category={category}&reutersCode={reuters_code}&page=1&pageSize=30"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
    }
    for attempt in range(1, retries + 1):
        try:
            resp = requests.get(url, headers=headers, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            items = data.get("result", [])
            for item in items:
                actual_date = str(item.get("localTradedAt", ""))[:10]
                if actual_date <= iso_target:
                    close_price = compact_number(item.get("closePrice"))
                    change_pct = compact_number(item.get("fluctuationsRatio"))
                    change_pts = compact_number(item.get("fluctuations"))
                    if close_price <= 0:
                        logging.error(f"[CLOSING_PRICE GATE] Invalid non-positive closing price ({close_price}) for {reuters_code}")
                        return None
                    is_us_holiday = iso_target in US_MARKET_HOLIDAYS_2026 if category in ("energy", "metals") else False
                    is_closed = is_us_holiday or (actual_date < iso_target)
                    return {
                        "value": close_price,
                        "change": change_pct,
                        "changePoints": change_pts,
                        "as_of_date": actual_date,
                        "is_closed": is_closed,
                    }
            logging.warning(f"No Naver market index found on or before {iso_target} for {reuters_code}")
            return None
        except Exception as e:
            if attempt < retries:
                time.sleep(attempt * 1.5)
            else:
                logging.error(f"Failed to fetch Naver index {reuters_code} after {retries} attempts: {e}")
                return None


def fetch_naver_bond(reuters_code: str, iso_target: str, retries: int = 3) -> dict | None:
    """네이버 증권 공식 국채 금리 API를 통해 10년물 정규 마감 수익률을 수집합니다."""
    # 1. 당일 실시간/마감 직후 다이렉트 엔드포인트 조회
    direct_url = f"https://api.stock.naver.com/marketindex/bond/{reuters_code}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
    }
    for attempt in range(1, retries + 1):
        try:
            resp = requests.get(direct_url, headers=headers, timeout=12)
            if resp.status_code == 200:
                data = resp.json()
                actual_date = str(data.get("localTradedAt", ""))[:10]
                if actual_date == iso_target:
                    close_price = compact_number(data.get("closePrice"))
                    fluc = compact_number(data.get("fluctuations"))
                    if close_price > 0:
                        return {
                            "value": close_price,
                            "change": fluc,
                            "changePoints": fluc,
                            "as_of_date": actual_date,
                            "is_closed": False,
                        }
            break
        except Exception as e:
            if attempt == retries:
                logging.warning(f"Direct bond API failed for {reuters_code}: {e}")
            time.sleep(attempt * 1.0)

    # 2. 일별 시세 API (과거일 조회 및 Fallback)
    prices_data = fetch_naver_market_index("bond", reuters_code, iso_target, retries=retries)
    if prices_data:
        prices_data["change"] = prices_data["changePoints"]
        return prices_data
    return None


def fetch_index_data(ticker_symbol: str, target_date_str: str, retries: int = 3) -> dict | None:
    target_date = datetime.strptime(target_date_str, "%Y%m%d")
    end_date = target_date + timedelta(days=2)
    start_date = target_date - timedelta(days=10)

    period1 = int(start_date.timestamp())
    period2 = int(end_date.timestamp())

    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker_symbol}?period1={period1}&period2={period2}&interval=1d"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }

    tz = ZoneInfo("America/New_York")

    for attempt in range(1, retries + 1):
        try:
            response = requests.get(url, headers=headers, timeout=12)
            response.raise_for_status()
            data = response.json()

            result = data.get("chart", {}).get("result")
            if not result:
                return None

            timestamps = result[0].get("timestamp", [])
            indicators = result[0].get("indicators", {}).get("quote", [{}])[0]
            closes = indicators.get("close", [])

            if not timestamps or not closes:
                return None

            target_idx = -1
            target_date_actual = ""
            for i, ts in enumerate(timestamps):
                ts_date_obj = datetime.fromtimestamp(ts, tz=tz)
                ts_date = ts_date_obj.strftime("%Y%m%d")
                if ts_date <= target_date_str and closes[i] is not None:
                    target_idx = i
                    target_date_actual = ts_date_obj.strftime("%Y-%m-%d")

            if target_idx < 0:
                return None

            price = closes[target_idx]
            prev_close = None
            for j in range(target_idx - 1, -1, -1):
                if closes[j] is not None:
                    prev_close = closes[j]
                    break

            if price is None or prev_close is None:
                return None

            change_val = round(((price - prev_close) / prev_close) * 100, 2)
            change_points = round(price - prev_close, 2)

            iso_target = f"{target_date_str[:4]}-{target_date_str[4:6]}-{target_date_str[6:8]}"
            is_closed = (
                iso_target in US_MARKET_HOLIDAYS_2026
                or (bool(target_date_actual) and target_date_actual < iso_target)
            )

            return {
                "value": round(price, 2),
                "change": change_val,
                "changePoints": change_points,
                "as_of_date": target_date_actual,
                "is_closed": is_closed,
            }
        except Exception as e:
            if attempt < retries:
                time.sleep(attempt * 1.5)
            else:
                logging.error(f"Failed to fetch {ticker_symbol} from Yahoo after {retries} attempts: {e}")
                return None


def check_for_duplicates(new_indices: list, old_indices: list, iso_target: str = "") -> bool:
    old_map = {item["label"]: item for item in old_indices if "label" in item}
    duplicate_count = 0
    for new_item in new_indices:
        label = new_item.get("label")
        if label in old_map:
            old_item = old_map[label]
            if new_item.get("is_closed") or new_item.get("is_stale"):
                continue

            new_date = new_item.get("as_of_date")
            if new_date and iso_target and new_date < iso_target:
                continue

            if (
                new_item.get("value") == old_item.get("value")
                and new_item.get("change") == old_item.get("change")
                and new_item.get("change") != 0.0
            ):
                logging.warning(f"Duplicate values detected for {label}! New: {new_item}, Old: {old_item}")
                duplicate_count += 1

    if duplicate_count >= 4:
        logging.error(f"Too many duplicate indices ({duplicate_count}). Likely fetching stale data.")
        return True
    return False


def main():
    target_date_str = get_target_date()
    logging.info(f"Using ETF base date: {target_date_str}")
    iso_target = iso_date(target_date_str)

    krx_auth_key = get_krx_auth_key()

    # Load existing indices snapshot for fallback and duplicate checking
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

    old_map = {item.get("label"): item for item in old_indices if item.get("label")}

    results = []
    failed_labels = []

    # 1. KRX (코스피, 코스닥, 코스피 변동성지수)
    if krx_auth_key:
        for label, code in [("코스피", "KOSPI"), ("코스닥", "KOSDAQ")]:
            logging.info(f"Fetching {label} from KRX...")
            data = fetch_krx_index(krx_auth_key, code, iso_target)
            if data:
                results.append(data)
            elif label in old_map:
                fb = dict(old_map[label])
                fb["is_stale"] = True
                results.append(fb)
                logging.warning(f"Recovered {label} from previous snapshot fallback.")
            else:
                failed_labels.append(label)

        logging.info("Fetching 코스피 변동성지수 (VKOSPI) from KRX...")
        vkospi_data = fetch_krx_vkospi(krx_auth_key, iso_target)
        if vkospi_data:
            results.append(vkospi_data)
        elif "코스피 변동성지수" in old_map:
            fb = dict(old_map["코스피 변동성지수"])
            fb["is_stale"] = True
            results.append(fb)
            logging.warning("Recovered 코스피 변동성지수 from previous snapshot fallback.")
        else:
            failed_labels.append("코스피 변동성지수")
    else:
        logging.error("KRX_OPEN_API_KEY not found.")
        for label in ["코스피", "코스닥", "코스피 변동성지수"]:
            if label in old_map:
                fb = dict(old_map[label])
                fb["is_stale"] = True
                results.append(fb)
                logging.warning(f"Recovered {label} from previous snapshot fallback.")
            else:
                failed_labels.append(label)

    # 2. 국내 국채 10년물 (네이버 증권 공식 마감 종가 SSOT)
    logging.info("Fetching 국채 10년 (KR10YT=RR) from Naver...")
    kr10y_data = fetch_naver_bond("KR10YT=RR", iso_target)
    if kr10y_data:
        kr10y_data["label"] = "국채 10년"
        kr10y_data["code"] = "KR10Y"
        results.append(kr10y_data)
    elif "국채 10년" in old_map:
        fb = dict(old_map["국채 10년"])
        fb["is_stale"] = True
        results.append(fb)
        logging.warning("Recovered 국채 10년 from previous snapshot fallback.")
    else:
        failed_labels.append("국채 10년")

    # 3. 원/달러 (네이버 증권 공식 일별 마감 SSOT)
    logging.info("Fetching 원/달러 (USD/KRW) official rate from Naver...")
    usdkrw_data = fetch_naver_market_index("exchange", "FX_USDKRW", iso_target)
    if usdkrw_data:
        usdkrw_data["label"] = "원/달러"
        usdkrw_data["code"] = "USDKRW"
        results.append(usdkrw_data)
    elif "원/달러" in old_map:
        fb = dict(old_map["원/달러"])
        fb["code"] = "USDKRW"
        fb["is_stale"] = True
        results.append(fb)
        logging.warning("Recovered 원/달러 from previous snapshot fallback.")
    else:
        failed_labels.append("원/달러")

    # 4. 원자재 공식 일별 시세 (WTI 원유, 금 선물, 은 선물 - 네이버 증권 SSOT)
    for label, cfg in NAVER_COMMODITY_FX_CONFIG.items():
        if label == "원/달러":
            continue  # 이미 처리됨
        logging.info(f"Fetching {label} ({cfg['reutersCode']}) from Naver...")
        data = fetch_naver_market_index(cfg["category"], cfg["reutersCode"], iso_target)
        if data:
            data["label"] = label
            data["code"] = cfg["code"]
            data["source_symbol"] = cfg["reutersCode"]
            results.append(data)
        elif label in old_map:
            fb = dict(old_map[label])
            fb["code"] = cfg["code"]
            fb["is_stale"] = True
            results.append(fb)
            logging.warning(f"Recovered {label} from previous snapshot fallback.")
        else:
            failed_labels.append(label)

    # 5. 미국 국채 10년물 (네이버 증권 공식 마감 종가 SSOT)
    logging.info("Fetching 미 국채 10년물 (US10YT=RR) from Naver...")
    us10y_data = fetch_naver_bond("US10YT=RR", iso_target)
    if us10y_data:
        us10y_data["label"] = "미 국채 10년물"
        us10y_data["code"] = "DGS10"
        us10y_data["source_symbol"] = "US10YT=RR"
        results.append(us10y_data)
    elif "미 국채 10년물" in old_map:
        fb = dict(old_map["미 국채 10년물"])
        fb["code"] = "DGS10"
        fb["is_stale"] = True
        results.append(fb)
        logging.warning("Recovered 미 국채 10년물 from previous snapshot fallback.")
    else:
        failed_labels.append("미 국채 10년물")

    # 6. 미국 정규 주가지수 및 변동성 (S&P 500, 나스닥, VIX - Yahoo Finance 정규장 종가)
    for label, symbol in US_TICKERS.items():
        logging.info(f"Fetching data for {label} ({symbol}) from Yahoo...")
        data = fetch_index_data(symbol, target_date_str)
        if data:
            data["label"] = label
            data["code"] = normalize_index_code(symbol)
            data["source_symbol"] = symbol
            results.append(data)
        elif label in old_map:
            fb = dict(old_map[label])
            fb["code"] = normalize_index_code(fb.get("code") or symbol)
            fb["is_stale"] = True
            results.append(fb)
            logging.warning(f"Recovered {label} ({symbol}) from previous snapshot fallback.")
        else:
            failed_labels.append(label)

    # 5. 무결성 검증 (12개 필수 지표 및 12대 정규 지표 코드 전수 확인)
    for r in results:
        r["code"] = normalize_index_code(r.get("code") or r.get("label"))

    is_valid_canonical, missing_codes = validate_canonical_macro_codes(results)
    if not is_valid_canonical:
        logging.error(f"Missing required canonical macro indices: {sorted(missing_codes)}")
        sys.exit(1)

    collected_labels = {r.get("label") for r in results}
    missing_labels = [l for l in ALL_REQUIRED_LABELS if l not in collected_labels]
    if missing_labels:
        logging.error(f"Missing required indices after fetch and fallback: {missing_labels}")
        sys.exit(1)

    # 6. 이전 거래일 대비 중복 검사
    if old_base_date and old_base_date != target_date_str and check_for_duplicates(results, old_indices, iso_target):
        logging.error("Exact duplicate values found from previous trading day! Aborting to prevent stale data publishing.")
        sys.exit(1)

    # 7. JSON 저장
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        output_data = {"base_date": target_date_str, "indices": results}
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    stale_count = sum(1 for r in results if r.get("is_stale"))
    logging.info(
        f"Successfully wrote {len(results)}/{len(ALL_REQUIRED_LABELS)} indices to {out_path} "
        f"(Fresh: {len(results) - stale_count}, Fallback Stale: {stale_count}, Failed: {len(failed_labels)})."
    )


if __name__ == "__main__":
    main()
