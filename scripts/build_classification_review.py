"""현재 ETF 마스터를 기반으로 분류 검수용 자동 초안 CSV를 만든다.

명시적인 규칙 근거가 서로 일치하는 경우만 자동확정하고 나머지는 검수 대기열로 보낸다.
"""

from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path


MARKET_RULES: list[tuple[str, re.Pattern[str]]] = [
    ("글로벌", re.compile(r"글로벌|전세계|월드|WORLD|GLOBAL|ACWI|ALL.?COUNTRY", re.I)),
    ("선진국", re.compile(r"선진국|DEVELOPED", re.I)),
    ("신흥국", re.compile(r"신흥국|EMERGING|MSCI\s*EM\b", re.I)),
    ("아시아", re.compile(r"아시아.*EX.?CHINA|ASIA.*EX.?CHINA|한국대만", re.I)),
    ("중남미", re.compile(r"라틴|LATIN\s*AMERICA", re.I)),
    ("대만", re.compile(r"대만|TAIWAN|TSMC", re.I)),
    ("필리핀", re.compile(r"필리핀|PHILIPPINES", re.I)),
    ("멕시코", re.compile(r"멕시코|MEXICO", re.I)),
    ("러시아", re.compile(r"러시아|RUSSIA", re.I)),
    ("중국", re.compile(r"중국|차이나|CHINA|CSI\s*\d|항셍|HANG\s*SENG|홍콩|과창판|심천|CHINEXT", re.I)),
    ("일본", re.compile(r"일본|JAPAN|NIKKEI|TOPIX|도쿄", re.I)),
    ("인도", re.compile(r"인도|INDIA|NIFTY|SENSEX", re.I)),
    ("베트남", re.compile(r"베트남|VIETNAM|VN30", re.I)),
    ("유럽", re.compile(r"유럽|EUROPE|EUROSTOXX|EURO\s*STOXX|STOXX\s*EUROPE|DAX|독일|프랑스", re.I)),
    ("아시아", re.compile(r"아시아|ASIA|ASEAN|아세안|대만|TAIWAN", re.I)),
    ("미국", re.compile(r"미국|\bU\.?S\.?\b|\bUSA\b|S&P\s*\d|NASDAQ|나스닥|DOW\s*JONES|다우존스|NYSE|RUSSELL|미국채|\bUS\s+TREASURY|테슬라|TESLA|TSLA|엔비디아|NVIDIA|팔란티어|PALANTIR|브로드컴|BROADCOM|구글|GOOGLE|일라이릴리|ELI\s*LILLY", re.I)),
    ("국내", re.compile(r"코스피|KOSPI|코스닥|KOSDAQ|\bKRX\b|S&P\s*KOREA|코리아|한국", re.I)),
]

DIRECT_COMMODITY = re.compile(
    r"금현물|은현물|금은선물|골드선물|실버선물|원유선물|WTI선물|천연가스선물|구리선물|"
    r"농산물선물|콩선물|옥수수선물|커피선물|원자재선물|금커버드콜|골드커버드콜|"
    r"\bGOLD\b|\bSILVER\b|\bWTI\b",
    re.I,
)
COMMODITY_EQUITY = re.compile(r"기업|밸류체인|생산|채굴|광산|에너지기업|원자력|우라늄기업", re.I)
CURRENCY_DIRECT = re.compile(r"미국달러선물|달러선물|엔선물|유로선물|위안화|통화선물", re.I)
PARKING = re.compile(r"머니마켓|MMF|KOFR|CD금리|SOFR|파킹|초단기|통안채|금리액티브", re.I)
MIXED = re.compile(r"혼합|자산배분|TDF|TRF|밸런스|멀티에셋|EMP", re.I)
REIT_INFRA = re.compile(r"리츠|REIT|인프라|맥쿼리", re.I)
BOND = re.compile(
    r"채권|국고채|회사채|국채|금융채|은행채|여전채|단기채|중기채|장기채|"
    r"크레딧|하이일드|TIPS|물가채|미국채|전단채|만기매칭|듀레이션",
    re.I,
)

CURRENT_ASSET_MAP = {
    "주식-국내": "주식",
    "주식-해외": "주식",
    "채권": "채권",
    "금리·파킹": "금리·파킹",
    "원자재": "원자재",
    "리츠·인프라": "리츠/인프라",
    "혼합·자산배분": "혼합자산",
}


def text_of(row: dict[str, str]) -> str:
    return f"{row.get('name', '')} {row.get('base_index', '')}".strip()


def suggest_asset(row: dict[str, str]) -> tuple[str, str]:
    text = text_of(row)
    if PARKING.search(text):
        return "금리·파킹", "금리·파킹 키워드"
    if MIXED.search(text):
        return "혼합자산", "혼합·자산배분 키워드"
    if CURRENCY_DIRECT.search(text):
        return "통화", "통화 선물·지수 키워드"
    if REIT_INFRA.search(text):
        return "리츠/인프라", "리츠·인프라 키워드"
    if DIRECT_COMMODITY.search(text) and not COMMODITY_EQUITY.search(text):
        return "원자재", "원자재 현물·선물 직접 노출 키워드"
    if BOND.search(text):
        return "채권", "채권 키워드"
    return "주식", "주식 기본값·기존 분류 참고"


def suggest_market(row: dict[str, str], asset: str) -> tuple[str, str]:
    text = text_of(row)
    if asset in {"원자재", "통화"}:
        return "해당없음", "직접 원자재·통화는 국가 귀속 생략"
    for label, pattern in MARKET_RULES:
        if pattern.search(text):
            return label, f"{label} 시장 키워드"
    if row.get("asset_class") == "주식-국내":
        return "국내", "기존 국내주식 분류"
    if row.get("asset_class") in {"채권", "금리·파킹"}:
        return "국내", "해외 단서 없는 국내 채권·금리 상품"
    return "검수 필요", "시장 단서 부족"


def asset_detail(text: str, asset: str) -> str:
    rules = {
        "원자재": [
            ("금", r"금현물|골드|\bGOLD\b"),
            ("은", r"은현물|실버|\bSILVER\b"),
            ("원유", r"원유|\bWTI\b"),
            ("천연가스", r"천연가스"),
            ("구리", r"구리"),
            ("농산물", r"농산물|콩|옥수수|커피"),
        ],
        "통화": [("달러", r"달러"), ("엔", r"엔선물|엔화"), ("유로", r"유로"), ("위안", r"위안")],
        "채권": [
            ("국채", r"국고채|국채|미국채|TREASURY"),
            ("회사채", r"회사채|크레딧|하이일드|여전채"),
        ],
    }
    for label, pattern in rules.get(asset, []):
        if re.search(pattern, text, re.I):
            return label
    return ""


def suggest_strategy(text: str) -> str:
    values: list[str] = []
    rules = [
        ("액티브", r"액티브"),
        ("커버드콜", r"커버드콜|COVERED\s*CALL"),
        ("배당", r"배당|DIVIDEND"),
        ("버퍼", r"버퍼|BUFFER"),
        ("만기매칭", r"\d{2}-\d{2}|만기매칭"),
        ("합성", r"합성"),
    ]
    for label, pattern in rules:
        if re.search(pattern, text, re.I):
            values.append(label)
    return "·".join(values) if values else "일반"


def suggest_fx(row: dict[str, str], market: str) -> tuple[str, str]:
    text = text_of(row)
    if market == "국내":
        return "해당없음", "국내 기초자산"
    if re.search(r"부분\s*헤지|부분환헤지", text, re.I):
        return "부분헤지", "종목명·기초지수명 명시"
    if re.search(r"탄력\s*헤지|탄력적\s*환헤지", text, re.I):
        return "탄력헤지", "종목명·기초지수명 명시"
    if re.search(r"\(\s*(?:합성\s*)?H\s*\)|환헤지|HEDGED", text, re.I):
        return "환헤지", "종목명 (H) 또는 헤지 명시"
    if re.search(r"환노출|UNHEDGED|\(\s*UH\s*\)", text, re.I):
        return "환노출", "종목명·기초지수명 명시"
    return "미확인", "공식 문서 확인 필요"


def normalized_risk(value: str) -> str:
    return {"normal": "일반", "leverage": "레버리지", "inverse": "인버스"}.get(value, "검수 필요")


def review_status(
    row: dict[str, str],
    market: str,
    asset: str,
    fx: str,
    strategy: str,
) -> tuple[str, str]:
    existing = CURRENT_ASSET_MAP.get(row.get("asset_class", ""), "검수 필요")
    notes: list[str] = []
    if existing != asset:
        notes.append(f"기존 {existing} ↔ 제안 {asset}")
    if market == "검수 필요":
        notes.append("시장 단서 부족")
    if asset in {"혼합자산", "리츠/인프라", "원자재", "통화"}:
        notes.append("복합·대체자산 확인")
    if strategy != "일반":
        notes.append(f"전략 {strategy}")
    if fx == "미확인" and market not in {"국내", "해당없음"}:
        notes.append("환헤지 공식문서 필요")

    if existing != asset:
        status = "자산군 우선 검수"
    elif market == "검수 필요":
        status = "시장 우선 검수"
    elif fx == "미확인" and market not in {"국내", "해당없음"}:
        status = "환헤지 검수"
    elif asset in {"혼합자산", "리츠/인프라", "원자재", "통화"} or strategy != "일반":
        status = "구조 검수"
    else:
        status = "자동 초안"
    return status, " | ".join(notes)

def confidence_assessment(
    row: dict[str, str],
    market: str,
    market_basis: str,
    asset: str,
    asset_basis: str,
    fx: str,
    fx_basis: str,
    strategy: str,
) -> tuple[int, str, str, str]:
    """판정 신뢰도와 자동 처리 여부를 반환한다.

    점수는 검수 순서를 정하기 위한 보조 지표다. 자동확정은 아래의 필수
    조건을 모두 충족할 때만 허용한다.
    """

    existing = CURRENT_ASSET_MAP.get(row.get("asset_class", ""), "검수 필요")
    score = 20  # 기존 risk_type을 그대로 사용하는 구조 판정
    basis: list[str] = ["기존 위험유형"]
    blockers: list[str] = []

    if market == "검수 필요":
        blockers.append("MARKET_UNKNOWN")
    elif "키워드" in market_basis or market == "해당없음":
        score += 25
        basis.append("시장 명시")
    else:
        score += 15
        basis.append("기존 시장 보조")

    if existing == asset:
        score += 25
        basis.append("기존 자산군 일치")
    else:
        score += 5
        blockers.append("ASSET_CONFLICT")

    if "키워드" in asset_basis or asset in {"원자재", "통화"}:
        score += 10
        basis.append("자산 명시")

    if market in {"국내", "해당없음"}:
        score += 20
        basis.append("환헤지 비적용")
    elif fx != "미확인":
        score += 20
        basis.append("환헤지 명시")
    else:
        blockers.append("FX_UNKNOWN")

    if strategy != "일반":
        score += 5
        basis.append("전략 명시")
        if asset in {"혼합자산", "리츠/인프라", "원자재", "통화"}:
            blockers.append("STRUCTURE_COMPLEX")

    score = min(score, 100)
    if blockers:
        decision = "검수필요"
        reason_code = "|".join(dict.fromkeys(blockers))
    elif score >= 85:
        decision = "자동확정"
        reason_code = "RULES_AGREE"
    else:
        decision = "표본검수"
        reason_code = "CONFIDENCE_BELOW_85"

    return score, decision, reason_code, " · ".join(basis)


def build_rows(
    source: Path,
    existing_reviews: dict[str, dict[str, str]] | None = None,
) -> list[dict[str, str]]:
    with source.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))

    output: list[dict[str, str]] = []
    for row in rows:
        text = text_of(row)
        asset, asset_basis = suggest_asset(row)
        market, market_basis = suggest_market(row, asset)
        detail = asset_detail(text, asset)
        strategy = suggest_strategy(text)
        fx, fx_basis = suggest_fx(row, market)
        status, note = review_status(row, market, asset, fx, strategy)
        score, decision, reason_code, confidence_basis = confidence_assessment(
            row, market, market_basis, asset, asset_basis, fx, fx_basis, strategy
        )
        previous = (existing_reviews or {}).get(row.get("ticker", ""), {})
        has_manual_review = previous.get("review_status") == "수기확정"
        final_values = {
            "final_market_scope": previous.get("final_market_scope", ""),
            "final_asset_class": previous.get("final_asset_class", ""),
            "final_asset_detail": previous.get("final_asset_detail", ""),
            "final_risk_type": previous.get("final_risk_type", ""),
            "final_fx_hedge": previous.get("final_fx_hedge", ""),
        }
        if decision == "자동확정" and not has_manual_review:
            final_values = {
                "final_market_scope": market,
                "final_asset_class": asset,
                "final_asset_detail": detail,
                "final_risk_type": normalized_risk(row.get("risk_type", "")),
                "final_fx_hedge": fx,
            }

        output.append({
            "ticker": row.get("ticker", ""),
            "name": row.get("name", ""),
            "base_index": row.get("base_index", ""),
            "bas_dt": row.get("bas_dt", ""),
            "current_asset_class": row.get("asset_class", ""),
            "suggested_market_scope": market,
            "suggested_asset_class": asset,
            "suggested_asset_detail": detail,
            "suggested_risk_type": normalized_risk(row.get("risk_type", "")),
            "suggested_strategy": strategy,
            "suggested_fx_hedge": fx,
            "market_basis": market_basis,
            "asset_basis": asset_basis,
            "fx_basis": fx_basis,
            "review_priority": status,
            "auto_review_note": note,
            "confidence_score": str(score),
            "auto_decision": decision,
            "reason_code": reason_code,
            "confidence_basis": confidence_basis,
            **final_values,
            "review_status": previous.get("review_status", "") if has_manual_review else ("자동확정" if decision == "자동확정" else "미검수"),
            "official_source_url": previous.get("official_source_url", ""),
            "evidence_summary": previous.get("evidence_summary", ""),
            "reviewer": previous.get("reviewer", ""),
            "reviewed_at": previous.get("reviewed_at", ""),
        })
    return output


def read_existing_reviews(path: Path) -> dict[str, dict[str, str]]:
    if not path.exists():
        return {}
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return {row["ticker"]: row for row in csv.DictReader(handle)}


def write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="data/etf_master_draft.csv")
    parser.add_argument("--output", default="data/classification/etf_classification_review_draft.csv")
    parser.add_argument("--queue-output", default="data/classification/etf_classification_review_queue.csv")
    args = parser.parse_args()

    output = Path(args.output)
    rows = build_rows(Path(args.source), read_existing_reviews(output))
    queue = [row for row in rows if row["auto_decision"] != "자동확정"]
    write_csv(output, rows)
    write_csv(Path(args.queue_output), queue)
    confirmed = len(rows) - len(queue)
    print(f"{len(rows)} rows: 자동확정 {confirmed}, 검수대기 {len(queue)} -> {output}")


if __name__ == "__main__":
    main()
