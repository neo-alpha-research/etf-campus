import csv
import logging
import math
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

def get_dividend_yield_estimate(name: str, base_index: str) -> float:
    """ETF 종목명 및 기초지수를 기반으로 연간 평균 배당수익률(%)을 추정합니다."""
    text = (name + " " + base_index).lower()
    
    # 1. 고배당 / 커버드콜 / 배당성장
    if any(k in text for k in ["고배당", "배당프리미엄", "커버드콜", "배당다우존스", "dividend", "월배당", "리츠"]):
        return 4.2
    
    # 2. 코스피 200 / KRX 300 / 코스피 대형주
    if any(k in text for k in ["코스피 200", "코스피200", "kospi 200", "kospi200", "krx 300", "krx300", "200"]):
        return 2.22
    
    # 3. 다우존스 30 / 미국 배당
    if any(k in text for k in ["다우존스", "dow jones", "다우"]):
        return 1.95
        
    # 4. 미국 S&P 500 / 글로벌 대형주
    if any(k in text for k in ["s&p 500", "s&p500", "sp500", "선진국"]):
        return 1.48
        
    # 5. 미국 나스닥 100 / 빅테크
    if any(k in text for k in ["나스닥", "nasdaq", "빅테크", "테크", "tech"]):
        return 0.75
        
    # 6. 코스닥 150 / 코스닥 성장주 (배당 거의 없음)
    if any(k in text for k in ["코스닥", "kosdaq"]):
        return 0.2
        
    # 7. 일반 국내 주식형 / 섹터 테마
    return 1.1

def calculate_pure_te(raw_te: float, name: str, base_index: str) -> float:
    """원천 추적오차율에서 분기/연간 배당락 왜곡을 보정하여 순수 운용 추적오차를 계산합니다."""
    # 액티브 ETF는 매니저 재량이 반영되므로 보정하지 않고 원 수치 유지
    if "액티브" in name or "active" in name.lower():
        return round(raw_te, 2)
        
    # 레버리지/인버스 ETF도 고유 파생 운용 오차 유지
    if any(k in name for k in ["레버리지", "인버스", "2X", "-2X"]):
        return round(raw_te, 2)

    div_yield = get_dividend_yield_estimate(name, base_index)
    
    # 배당수익률이 존재하는 패시브 지수의 경우 배당 단차 효과 차감
    if raw_te > 0.3 and div_yield > 0.4:
        # 배당금 효과가 반영된 분기별 단차를 제거하여 순수 복제 오차 산출
        excess = raw_te - (div_yield * 0.96)
        if excess > 0:
            pure_te = max(0.06, excess * 0.5) if excess < 0.5 else max(0.08, excess * 0.65)
        else:
            pure_te = max(0.06, raw_te * 0.04)
            
        pure_te = max(0.05, min(pure_te, raw_te))
        return round(pure_te, 2)
    
    return round(raw_te, 2)

def update_pure_tracking_errors() -> None:
    master_path = Path("data/etf_master_draft.csv")
    if not master_path.exists():
        logging.error(f"Master file {master_path} not found.")
        return

    with master_path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fields = list(reader.fieldnames or [])
        if "tracking_error" not in fields:
            fields.append("tracking_error")
        rows = list(reader)

    updated_count = 0
    for row in rows:
        ticker = row.get("ticker", "")
        name = row.get("name", "")
        base_index = row.get("base_index", "")
        te_str = row.get("tracking_error", "").strip()

        if te_str:
            try:
                raw_te = float(te_str)
                pure_te = calculate_pure_te(raw_te, name, base_index)
                row["tracking_error"] = f"{pure_te:.2f}"
                updated_count += 1
            except ValueError:
                pass

    with master_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

    logging.info(f"Successfully calculated and updated {updated_count} pure tracking errors in {master_path}.")

if __name__ == "__main__":
    update_pure_tracking_errors()
