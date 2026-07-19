# Phase 0 — ETF 전 종목 수집·태그 분류 시험 스크립트
# 사용: python phase0_collect_and_tag.py <서비스키> [기준일 YYYYMMDD]
# 산출: etf_master_draft.csv (전 종목 + 태그), 콘솔에 분류 통계
# 사양: Phase0_ETF_Master_Table_Spec_20260716.md

import csv
import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import date, timedelta

BASE = "https://apis.data.go.kr/1160100/service/GetSecuritiesProductInfoService/getETFPriceInfo"
AUM_FLOOR = 10_000_000_000  # 순자산 100억 원 (유동성 기준)


def fetch_page(key: str, bas_dt: str, page: int, rows: int = 1000):
    params = urllib.parse.urlencode({
        "serviceKey": key, "resultType": "json",
        "basDt": bas_dt, "numOfRows": rows, "pageNo": page,
    })
    with urllib.request.urlopen(f"{BASE}?{params}", timeout=30) as r:
        body = r.read().decode("utf-8")
    data = json.loads(body)
    b = data["response"]["body"]
    items = b.get("items") or {}
    rows_ = items.get("item") or []
    if isinstance(rows_, dict):
        rows_ = [rows_]
    return rows_, int(b.get("totalCount", 0))


def latest_trading_date(key: str) -> str:
    d = date.today()
    for _ in range(10):
        bas = d.strftime("%Y%m%d")
        try:
            rows, total = fetch_page(key, bas, 1, 1)
            if total > 0:
                return bas
        except Exception:
            pass
        d -= timedelta(days=1)
    raise SystemExit("최근 10일 내 데이터 없음 — 키 상태 또는 API 점검 확인 필요")


LEV_PAT = re.compile(r"레버리지|2X|3X", re.I)
INV_PAT = re.compile(r"인버스|-1X|-2X", re.I)

ASSET_RULES = [
    ("금리·파킹", r"머니마켓|MMF|KOFR|CD금리|초단기|금리액티브|파킹|SOFR|단기통안채|통안채"),
    ("채권", r"채권|국고채|회사채|국채|금융채|은행채|특수은행채|여전채|카드채|캐피탈|단기채|중기채|장기채|듀레이션|만기매칭|크레딧|하이일드|TIPS|물가채|미국채|국공채|전단채|\d{2}-\d{2}"),
    ("원자재", r"금현물|은현물|골드|실버|원유|WTI|천연가스|구리|팔라듐|백금|우라늄현물|농산물|콩|옥수수|커피|원자재|금액티브|은액티브|귀금속|Silver|Gold"),
    ("리츠·인프라", r"리츠|REIT|인프라|맥쿼리"),
    ("혼합·자산배분", r"채권혼합|주식혼합|자산배분|TDF|TRF|밸런스|멀티에셋|EMP|커버드콜.*채권|미국채커버드콜|혼합"),
    ("주식-해외", r"미국|나스닥|S&P|다우|글로벌|차이나|중국|일본|니케이|인도|베트남|유럽|선진국|신흥국|항셍|테슬라|엔비디아|팔란티어|애플|필라델피아|해외|월드|샤오미|BYD|브로드컴|TSMC|알리바바|텐센트|아세안|멕시코|브라질|빅테크|매그니피센트|양자컴퓨팅|일런|스페이스|유로스탁스|이머징|라틴|심천|차이넥스트|필리핀|러시아|DAX|일라이릴리|MSCI EM"),
    ("주식-국내", r"코스피|코스닥|KRX|200|국내|코리아|K-|K\d|삼성|SK|현대|LG|배당|그룹주|TOP\d+|방산|원자력|SMR|조선|반도체|2차전지|배터리|전고체|음극재|소부장|바이오|셀트리온|카카오|네이버|포스코|한화|밸류업|동학개미|금융지주|IB|은행|증권|K방산|K제조|소버린|한국|KEDI|우주항공"),
]


GLOBAL_HINT = re.compile(r"미국|글로벌|차이나|중국|일본|유럽|인도|베트남|항셍|나스닥|S&P|다우|구글|Google|테슬라|애플|엔비디아|아마존|메타|MSCI World|MSCI ACWI|선진국|신흥국|해외", re.I)
KR_VENDOR = re.compile(r"FnGuide|WISE|iSelect|KRX|KAP|MKF|에프앤가이드|MSCI Korea|KIS ", re.I)


def classify(name: str, base_index: str) -> tuple[str, str]:
    text = f"{name} {base_index}"
    if INV_PAT.search(text):
        risk = "inverse"
    elif LEV_PAT.search(text):
        risk = "leverage"
    else:
        risk = "normal"
    asset = "기타"
    for label, pat in ASSET_RULES:
        if re.search(pat, text, re.I):
            asset = label
            break
    # 폴백: 국내 지수 벤더 기반 + 해외 힌트 없음 → 주식-국내 (2026-07-17 검수 규칙)
    if asset == "기타":
        if GLOBAL_HINT.search(text):
            asset = "주식-해외"
        elif KR_VENDOR.search(base_index):
            asset = "주식-국내"
    return risk, asset


def pension_rule(risk: str, name: str, base_index: str) -> str:
    # 1차 규칙: 레버리지·인버스 불가, 파생(선물) 기반 불가. 나머지는 검수 대상(잠정 가능).
    if risk in ("leverage", "inverse"):
        return "불가"
    if re.search(r"선물|Futures", f"{name} {base_index}", re.I):
        return "불가"
    return "가능(검수전)"


def main():
    if len(sys.argv) < 2:
        raise SystemExit("사용법: python phase0_collect_and_tag.py <서비스키> [기준일]")
    key = sys.argv[1]
    bas = sys.argv[2] if len(sys.argv) > 2 else latest_trading_date(key)

    all_rows, page = [], 1
    while True:
        rows, total = fetch_page(key, bas, page)
        all_rows.extend(rows)
        if len(all_rows) >= total or not rows:
            break
        page += 1
    print(f"기준일 {bas} · 수집 {len(all_rows)}종목 (totalCount {total})")
    if all_rows:
        print("응답 필드:", ", ".join(all_rows[0].keys()))

    out, stats = [], {"risk": {}, "asset": {}, "pension": {}, "liq_fail": 0}
    for r in all_rows:
        name = r.get("itmsNm", "")
        base_index = r.get("bssIdxIdxNm", "")
        aum = float(r.get("nPptTotAmt") or 0)
        risk, asset = classify(name, base_index)
        pension = pension_rule(risk, name, base_index)
        liq = "pass" if aum >= AUM_FLOOR else "fail"
        if liq == "fail":
            stats["liq_fail"] += 1
        stats["risk"][risk] = stats["risk"].get(risk, 0) + 1
        stats["asset"][asset] = stats["asset"].get(asset, 0) + 1
        stats["pension"][pension] = stats["pension"].get(pension, 0) + 1
        out.append({
            "isin_cd": r.get("isinCd"), "ticker": r.get("srtnCd"), "name": name,
            "base_index": base_index, "close": r.get("clpr"), "aum": int(aum),
            "risk_type": risk, "asset_class": asset,
            "pension_eligible": pension, "liquidity": liq, "bas_dt": bas,
        })

    path = "etf_master_draft.csv"
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0].keys()))
        w.writeheader()
        w.writerows(out)

    print(f"\n저장: {path}")
    print("위험 유형:", stats["risk"])
    print("자산군:", stats["asset"])
    print("연금 1차:", stats["pension"])
    print(f"유동성 미달(순자산 100억 미만): {stats['liq_fail']}종목")
    others = [o["name"] for o in out if o["asset_class"] == "기타"][:20]
    if others:
        print("\n[검수 필요] 자산군 '기타' 상위 20:", others)


if __name__ == "__main__":
    main()
