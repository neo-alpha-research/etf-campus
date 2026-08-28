#!/usr/bin/env python3
"""Build ETF comparison classification, peer registry, review queue, and validation report.

The registry treats investment exposure and payoff structure as mandatory peer-group
keys.  Name/base-index rules are only used for high-confidence structural extraction;
ambiguous products are isolated and sent to the review queue.
"""
from __future__ import annotations

import csv
import hashlib
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = DATA / "comparison"
MASTER = DATA / "etf_master_draft.csv"
REVIEW = DATA / "classification" / "etf_classification_review_draft.csv"
PENSION = DATA / "pension_verify_sheet.csv"
OFFICIAL = DATA / "classification" / "official_source_registry.csv"

CLASSIFICATION_COLUMNS = [
    "isin_cd", "ticker", "name", "base_index", "asset_family", "region_primary",
    "comparison_category", "comparison_topic", "comparison_subtopic", "index_family",
    "strategy_style", "payoff_structure", "direction", "leverage_multiple", "fx_hedge",
    "replication_method", "concentration_bucket", "primary_peer_group_id",
    "alternate_peer_group_ids", "classification_status", "evidence_basis",
    "official_source_url", "review_reason",
]

STATUS_AUTO = {"verified_official", "auto_high_confidence"}


def load_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def clean(value: str | None) -> str:
    return (value or "").strip()


def norm(*parts: str | None) -> str:
    return " ".join(clean(p) for p in parts if clean(p)).upper()


def contains(text: str, *keywords: str) -> bool:
    return any(key.upper() in text for key in keywords)


def slug(value: str) -> str:
    value = re.sub(r"[^A-Z0-9가-힣]+", "-", value.upper()).strip("-")
    if not value:
        return "UNKNOWN"
    digest = hashlib.sha1(value.encode("utf-8")).hexdigest()[:10]
    return f"{value[:36]}-{digest}"


def first_match(text: str, rules: list[tuple[str, tuple[str, ...]]], default: str) -> str:
    for label, terms in rules:
        if contains(text, *terms):
            return label
    return default


def infer_asset(text: str, review: dict[str, str]) -> str:
    stated = norm(review.get("final_asset_class"), review.get("suggested_asset_class"), review.get("current_asset_class"))
    if contains(text, "KOF R", "KOFR", "CD금리", "CD 금리", "머니마켓", "MMF", "파킹"):
        return "금리·파킹"
    if contains(text, "국채", "회사채", "금융채", "통안채", "채권", "BOND", "TREASURY", "UST"):
        return "채권"
    if contains(text, "골드", "GOLD", "은선물", "은현물", "실버", "SILVER", "원유", "WTI", "OIL", "천연가스", "COPPER", "구리", "농산물", "COMMODITY"):
        if contains(text, "생산", "광산", "MINERS", "EQUITY", "기업"):
            return "주식"
        return "원자재"
    if contains(text, "리츠", "REIT", "인프라", "인프라스트럭처"):
        return "리츠·인프라"
    if contains(text, "혼합", "TDF", "TARGET DATE", "밸런스", "자산배분", "채권혼합", "주식채권"):
        return "혼합자산"
    if contains(stated, "원자재"):
        return "원자재"
    if contains(stated, "채권"):
        return "채권"
    if contains(stated, "금리", "파킹", "통화"):
        return "금리·파킹"
    if contains(stated, "리츠", "인프라"):
        return "리츠·인프라"
    if contains(stated, "혼합"):
        return "혼합자산"
    if contains(stated, "주식") or contains(text, "ETF", "TOP", "INDEX", "지수"):
        return "주식"
    return "미확인"


def infer_region(text: str, asset: str, review: dict[str, str]) -> str:
    if asset in {"원자재", "금리·파킹"}:
        return "해당없음"
    stated = norm(review.get("final_market_scope"), review.get("suggested_market_scope"))
    if contains(text, "국내", "KOSPI", "코스피", "KODEX 200", "TIGER 200", "KRX", "코스닥", "K-", "한국") or contains(stated, "국내"):
        return "국내"
    if contains(text, "미국", "USA", "US ", "S&P", "NASDAQ", "NYSE", "DOW", "RUSSELL", "UST", "NYSE") or contains(stated, "미국"):
        return "미국"
    if contains(text, "중국", "CHINA", "CSI", "항셍", "HANG SENG") or contains(stated, "중국"):
        return "중국"
    if contains(text, "일본", "JAPAN", "NIKKEI", "TOPIX") or contains(stated, "일본"):
        return "일본"
    if contains(text, "인도", "INDIA", "NIFTY", "SENSEX") or contains(stated, "인도"):
        return "인도"
    if contains(text, "유럽", "EUROPE", "EURO", "STOXX", "DAX", "프랑스", "독일") or contains(stated, "유럽"):
        return "유럽"
    if contains(text, "글로벌", "GLOBAL", "WORLD", "ACWI", "MSCI WORLD", "전세계", "선진국", "신흥국") or contains(stated, "글로벌", "선진", "신흥"):
        return "글로벌"
    if asset == "혼합자산":
        return "국내" if contains(stated, "국내") else "글로벌"
    return "기타국가"


def infer_structure(text: str) -> tuple[str, str, str, str]:
    if contains(text, "인버스", "INVERSE", "SHORT"):
        multiple = extract_multiple(text) or "1X"
        return "inverse", "inverse", "short", multiple
    if contains(text, "레버리지", "LEVERAGE", "2X", "3X", "2배", "3배"):
        multiple = extract_multiple(text) or "2X"
        return "leveraged", "leveraged", "long", multiple
    if contains(text, "커버드콜", "COVERED CALL"):
        return "covered_call", "covered_call", "neutral", "1X"
    if contains(text, "버퍼", "BUFFER", "TARGET PREMIUM"):
        return "buffer", "buffer", "neutral", "1X"
    return "plain", "plain", "neutral", "1X"


def extract_multiple(text: str) -> str:
    match = re.search(r"(?:^|[^0-9])([2-5])\s*(?:X|배|곱)", text)
    return f"{match.group(1)}X" if match else ""


def infer_fx(text: str, review: dict[str, str]) -> str:
    stated = norm(review.get("final_fx_hedge"), review.get("suggested_fx_hedge"))
    if contains(text, "환헤지", "HEDGE", "(H)") or contains(stated, "헤지"):
        return "hedged"
    if contains(text, "환노출", "UNHEDGED", "(UH)") or contains(stated, "노출"):
        return "unhedged"
    if contains(stated, "부분"):
        return "partial"
    return "unknown"


def infer_replication(text: str) -> str:
    if contains(text, "합성", "SYNTHETIC"):
        return "synthetic"
    if contains(text, "액티브", "ACTIVE"):
        return "active"
    return "physical_or_unspecified"


def infer_concentration(text: str, category: str) -> str:
    if category == "단일·소수종목" and not contains(text, "TOP2", "TOP3", "TOP4", "TOP5", "바스켓", "BASKET"):
        return "single"
    if re.search(r"TOP\s*[2-5]|TOP[2-5]|[2-5]종목", text):
        return "ultra_concentrated"
    if re.search(r"TOP\s*(?:10|15|20)|TOP(?:10|15|20)|(?:10|15|20)종목", text):
        return "concentrated"
    if contains(text, "200", "500", "100", "ALL COUNTRY", "BROAD"):
        return "broad"
    return "unknown"


def index_family(text: str, topic: str, subtopic: str, asset: str) -> str:
    if contains(text, "S&P 500", "S&P500"):
        return "S&P500"
    if contains(text, "NASDAQ100", "NASDAQ 100", "나스닥100"):
        return "NASDAQ100"
    if contains(text, "DOW JONES", "다우존스") and contains(text, "배당", "DIVIDEND"):
        return "DOW_JONES_DIVIDEND"
    if contains(text, "KOSPI 200", "코스피200"):
        return "KOSPI200"
    if contains(text, "KRX 300", "KRX300"):
        return "KRX300"
    if asset == "채권":
        return "BOND_" + slug(subtopic)
    if asset == "금리·파킹":
        return "RATE_" + slug(subtopic)
    if asset == "원자재":
        return "COMMODITY_" + slug(subtopic)
    return slug(f"{topic}_{subtopic}")


def classify_equity(text: str, region: str) -> tuple[str, str, str]:
    if contains(text, "S&P 500", "S&P500"):
        return "대표지수", "S&P500", "미국 S&P500"
    if contains(text, "NASDAQ100", "NASDAQ 100", "나스닥100"):
        return "대표지수", "나스닥100", "미국 나스닥100"
    if contains(text, "KOSPI 200", "코스피200"):
        return "대표지수", "코스피200", "국내 코스피200"
    if contains(text, "다우존스", "DOW JONES") and contains(text, "배당", "DIVIDEND"):
        return "배당·주주환원", "배당다우존스", "미국 배당다우존스"
    if contains(text, "AI 데이터센터", "AI DATA CENTER", "데이터센터"):
        return "테마", "인공지능", "AI 데이터센터"
    if contains(text, "AI 전력", "AI POWER", "전력 인프라"):
        return "테마", "인공지능", "AI 전력 인프라"
    if contains(text, "AI 반도체"):
        return "테마", "인공지능", "AI 반도체"
    if contains(text, "인공지능", "ARTIFICIAL INTELLIGENCE", " AI "):
        return "테마", "인공지능", "인공지능 일반"
    industry_rules = [
        ("반도체 장비·소부장", ("반도체 장비", "소부장", "소재부품장비")),
        ("반도체", ("반도체", "SEMICONDUCTOR", "CHIP")),
        ("자동차·모빌리티", ("자동차", "모빌리티", "MOBILITY", "EV")),
        ("조선", ("조선", "SHIPBUILD")),
        ("방산", ("방산", "DEFENSE", "AEROSPACE")),
        ("원자력", ("원자력", "NUCLEAR")),
        ("금융·은행·증권·보험", ("금융", "은행", "증권", "보험", "FINANCIAL")),
        ("바이오·제약·헬스케어", ("바이오", "제약", "헬스케어", "HEALTH CARE", "PHARMA")),
        ("화장품", ("화장품", "K-BEAUTY", "BEAUTY")),
        ("미디어·게임·엔터테인먼트", ("미디어", "게임", "엔터", "ENTERTAINMENT")),
        ("건설·인프라", ("건설", "INFRASTRUCTURE", "인프라")),
        ("철강·화학", ("철강", "화학", "STEEL", "CHEMICAL")),
        ("2차전지·배터리 소재", ("2차전지", "배터리", "BATTERY")),
        ("에너지·신재생에너지", ("신재생", "태양광", "풍력", "에너지", "SOLAR", "CLEAN ENERGY")),
    ]
    for industry, terms in industry_rules:
        if contains(text, *terms):
            return "산업·섹터", industry, f"{region} {industry}"
    theme_rules = [
        ("로봇", ("로봇", "ROBOT")),
        ("양자컴퓨팅", ("양자", "QUANTUM")),
        ("우주항공", ("우주", "SPACE")),
        ("기후테크", ("기후", "CLIMATE")),
        ("블록체인", ("블록체인", "BLOCKCHAIN")),
        ("고령화", ("고령화", "SILVER AGE")),
        ("K컬처", ("K컬처", "K-컬처", "K-POP", "KCON")),
    ]
    for theme, terms in theme_rules:
        if contains(text, *terms):
            return "테마", theme, f"{region} {theme}"
    if contains(text, "고배당", "DIVIDEND", "배당성장", "월배당", "주주환원"):
        return "배당·주주환원", "고배당", f"{region} 고배당"
    if contains(text, "대형주", "MIDCAP", "미드캡", "SMALL CAP", "소형주", "시가총액"):
        return "규모", "시가총액", f"{region} 시가총액"
    if contains(text, "가치", "VALUE", "성장", "GROWTH", "모멘텀", "QUALITY", "퀄리티", "저변동"):
        return "스타일·팩터", "스타일·팩터", f"{region} 스타일·팩터"
    if contains(text, "테슬라", "TSLA", "엔비디아", "NVIDIA", "애플", "APPLE", "마이크로소프트", "MICROSOFT", "팔란티어", "PLTR", "브로드컴", "BROADCOM", "알파벳", "GOOGLE", "메타", "META", "아마존", "AMAZON", "코인베이스", "COINBASE"):
        return "단일·소수종목", "단일종목", f"{region} 단일종목"
    if contains(text, "그룹", "SAMSUNG", "현대", "LG", "SK", "HANWHA"):
        return "기업집단", "기업집단", f"{region} 기업집단"
    return "기타특수구조", "미확인 주식전략", f"{region} 미확인 주식전략"


def bond_subtopic(text: str, region: str) -> str:
    issuer = first_match(text, [
        ("국채", ("국채", "TREASURY", "UST")),
        ("특수채", ("특수채",)), ("금융채", ("금융채",)), ("회사채", ("회사채", "CORPORATE")),
    ], "채권")
    maturity = first_match(text, [
        ("초단기", ("초단기", "0-1", "1년", "1Y")), ("단기", ("단기", "1-3", "3년", "3Y")),
        ("중기", ("중기", "5년", "7년", "5Y", "7Y")), ("장기", ("장기", "10년", "20년", "30년", "10Y", "20Y", "30Y")),
    ], "만기미확인")
    credit = first_match(text, [("AAA", ("AAA",)), ("AA", ("AA",)), ("A", (" A ", "A등급")), ("HY", ("하이일드", "HIGH YIELD", "HY"))], "등급미확인")
    return f"{region} {issuer} {maturity} {credit}"


def commodity_subtopic(text: str) -> tuple[str, str]:
    commodity = first_match(text, [
        ("금", ("골드", "GOLD", "금 현물")), ("은", ("실버", "SILVER", "은 현물")),
        ("원유", ("원유", "WTI", "OIL")), ("천연가스", ("천연가스", "NATURAL GAS")),
        ("구리", ("구리", "COPPER")), ("농산물", ("농산물", "AGRICULTURE")),
    ], "기타원자재")
    structure = "spot" if contains(text, "현물", "SPOT") else "futures"
    return commodity, f"{commodity} {structure}"


def rate_subtopic(text: str) -> str:
    if contains(text, "KOFR"):
        return "KOFR"
    if contains(text, "CD금리", "CD 금리", "양도성예금증서"):
        return "CD금리"
    if contains(text, "머니마켓", "MMF", "파킹"):
        return "머니마켓"
    return "초단기 금리"


def mix_subtopic(text: str) -> str:
    match = re.search(r"주식\s*(\d{1,3})\s*[/·+ ]\s*채권\s*(\d{1,3})", text)
    if match:
        return f"주식{match.group(1)}/채권{match.group(2)}"
    if contains(text, "50/50", "50:50"):
        return "주식50/채권50"
    return "구성비율 미확인"


def has_complex_theme(text: str) -> bool:
    themes = sum(1 for term in ["AI", "데이터센터", "반도체", "로봇", "양자", "우주", "기후", "블록체인"] if term in text)
    return themes >= 3 and not contains(text, "AI 데이터센터", "AI 반도체", "AI 전력")


def derive_record(master: dict[str, str], review: dict[str, str], pension: dict[str, str], official: dict[str, str]) -> dict[str, Any]:
    text = norm(master.get("name"), master.get("base_index"))
    asset = infer_asset(text, review)
    region = infer_region(text, asset, review)
    strategy, payoff, direction, leverage = infer_structure(text)
    fx = infer_fx(text, review)
    replication = infer_replication(text)

    if asset == "채권":
        category, topic, subtopic = "채권", "채권", bond_subtopic(text, region)
        payoff = "bond_coupon"
    elif asset == "금리·파킹":
        category, topic, subtopic = "금리·파킹", "금리·파킹", rate_subtopic(text)
        payoff = "rate_return"
    elif asset == "원자재":
        topic, subtopic = commodity_subtopic(text)
        category = "원자재"
        payoff = subtopic.split()[-1]
    elif asset == "리츠·인프라":
        category, topic, subtopic = "리츠·인프라", "리츠·인프라", f"{region} 리츠·인프라"
    elif asset == "혼합자산":
        category, topic, subtopic, payoff = "혼합자산", "혼합자산", mix_subtopic(text), "mixed_asset"
    elif asset == "주식":
        category, topic, subtopic = classify_equity(text, region)
    else:
        category, topic, subtopic = "기타특수구조", "미확인", "미확인"

    if has_complex_theme(text):
        category, topic, subtopic = "테마", "복합테마", f"{region} 복합테마"

    family = index_family(text, topic, subtopic, asset)
    concentration = infer_concentration(text, category)
    existing = norm(review.get("final_asset_class"), review.get("suggested_asset_class"), review.get("current_asset_class"))
    asset_conflict = bool(existing and asset != "미확인" and ((asset == "주식" and not contains(existing, "주식")) or (asset == "채권" and not contains(existing, "채권")) or (asset == "원자재" and not contains(existing, "원자재")) or (asset == "혼합자산" and not contains(existing, "혼합"))))
    official_url = clean(official.get("official_source_url")) or clean(review.get("official_source_url")) or clean(pension.get("issuer_official")) or clean(pension.get("official_src"))

    review_reason: list[str] = []
    if asset == "미확인":
        review_reason.append("자산군을 신뢰성 있게 판정할 근거 부족")
    if category == "기타특수구조" and topic == "미확인 주식전략":
        review_reason.append("직접 비교에 필요한 주식 전략·투자대상 미확인")
    if subtopic.endswith("미확인") or "미확인" in subtopic:
        review_reason.append("세부 투자대상 또는 만기·구성비율 미확인")
    if has_complex_theme(text):
        review_reason.append("복수 테마가 혼재되어 단일 테마 직접 비교 불가")
    if asset_conflict:
        review_reason.append("기존 자산분류와 비교분류 추론값 충돌")

    confident_categories = {"대표지수", "배당·주주환원", "산업·섹터", "테마", "기업집단", "단일·소수종목", "채권", "금리·파킹", "원자재", "리츠·인프라", "혼합자산", "규모", "스타일·팩터"}
    strong_signal = bool(clean(master.get("base_index"))) or category in {"금리·파킹", "원자재", "혼합자산"}
    if asset_conflict:
        status = "conflict"
    elif review_reason:
        status = "needs_review"
    elif official_url and clean(review.get("review_status")) not in {"", "미검수", "검수 필요"}:
        status = "verified_official"
    elif category in confident_categories and strong_signal:
        status = "auto_high_confidence"
    else:
        status = "needs_review"
        review_reason.append("자동 확정 요건 미충족")

    if status in STATUS_AUTO:
        base_key = "|".join([
            asset, region, category, topic, subtopic, family, payoff, direction, leverage, concentration if category == "단일·소수종목" else "",
        ])
        group_id = "PG-" + slug(base_key)
    else:
        group_id = "PG-PENDING-" + slug(master.get("ticker", "NO-TICKER"))

    evidence_parts = []
    if clean(master.get("base_index")):
        evidence_parts.append("기초지수 명시")
    if official_url:
        evidence_parts.append("운용사·공식 출처 URL 존재")
    if strategy != "plain":
        evidence_parts.append(f"상품명 구조표시({strategy})")
    if asset != "미확인":
        evidence_parts.append(f"자산군·투자대상 추출({asset}/{subtopic})")

    return {
        "isin_cd": clean(master.get("isin_cd")), "ticker": clean(master.get("ticker")), "name": clean(master.get("name")),
        "base_index": clean(master.get("base_index")), "asset_family": asset, "region_primary": region,
        "comparison_category": category, "comparison_topic": topic, "comparison_subtopic": subtopic,
        "index_family": family, "strategy_style": strategy, "payoff_structure": payoff,
        "direction": direction, "leverage_multiple": leverage, "fx_hedge": fx,
        "replication_method": replication, "concentration_bucket": concentration,
        "primary_peer_group_id": group_id, "alternate_peer_group_ids": "",
        "classification_status": status, "evidence_basis": "; ".join(evidence_parts),
        "official_source_url": official_url, "review_reason": "; ".join(review_reason),
    }


def build_registry(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        grouped[record["primary_peer_group_id"]].append(record)
    registry: list[dict[str, Any]] = []
    for group_id, members in grouped.items():
        first = members[0]
        status_counts = Counter(member["classification_status"] for member in members)
        automatic = all(member["classification_status"] in STATUS_AUTO for member in members)
        structure = f"{first['payoff_structure']}|{first['direction']}|{first['leverage_multiple']}"
        rationale = (
            f"{first['asset_family']}·{first['region_primary']} 노출, {first['comparison_category']} / "
            f"{first['comparison_subtopic']} 투자대상, {structure} 수익·손실 구조를 공통 기준으로 사용"
        )
        registry.append({
            "primary_peer_group_id": group_id,
            "peer_group_name": f"{first['comparison_subtopic']} · {first['payoff_structure']}",
            "member_count": len(members), "asset_family": first["asset_family"], "region_primary": first["region_primary"],
            "comparison_category": first["comparison_category"], "comparison_topic": first["comparison_topic"],
            "comparison_subtopic": first["comparison_subtopic"], "index_family": first["index_family"],
            "strategy_structure": structure, "automatic_comparison_eligible": "Y" if automatic else "N",
            "group_status_summary": "; ".join(f"{key}:{value}" for key, value in sorted(status_counts.items())),
            "classification_rationale": rationale,
        })
    return sorted(registry, key=lambda row: (-int(row["member_count"]), row["primary_peer_group_id"]))


def validate(records: list[dict[str, Any]], registry: list[dict[str, Any]], master_count: int) -> tuple[list[str], list[dict[str, Any]]]:
    errors: list[str] = []
    ticker_counts = Counter(row["ticker"] for row in records if row["ticker"])
    isin_counts = Counter(row["isin_cd"] for row in records if row["isin_cd"])
    if len(records) != master_count:
        errors.append(f"입력 ETF 수 불일치: master={master_count}, output={len(records)}")
    dup_ticker = [value for value, count in ticker_counts.items() if count > 1]
    dup_isin = [value for value, count in isin_counts.items() if count > 1]
    if dup_ticker:
        errors.append(f"ticker 중복 {len(dup_ticker)}건: {', '.join(dup_ticker[:10])}")
    if dup_isin:
        errors.append(f"ISIN 중복 {len(dup_isin)}건: {', '.join(dup_isin[:10])}")
    group_ids = {row["primary_peer_group_id"] for row in registry}
    missing_groups = [row["ticker"] for row in records if row["primary_peer_group_id"] not in group_ids]
    if missing_groups:
        errors.append(f"레지스트리에 없는 primary_peer_group_id {len(missing_groups)}건")

    broad: list[dict[str, Any]] = []
    members_by_group: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in records:
        members_by_group[row["primary_peer_group_id"]].append(row)
    for group_id, members in members_by_group.items():
        asset_values = {row["asset_family"] for row in members}
        region_values = {row["region_primary"] for row in members}
        payoff_values = {row["payoff_structure"] for row in members}
        direction_values = {row["direction"] for row in members}
        concentration_values = {row["concentration_bucket"] for row in members}
        if len(asset_values) > 1:
            errors.append(f"자산군 혼합 오류: {group_id} = {asset_values}")
        if len(region_values) > 1:
            errors.append(f"지역 혼합 오류: {group_id} = {region_values}")
        if len(payoff_values) > 1 or len(direction_values) > 1:
            errors.append(f"수익구조 혼합 오류: {group_id}")
        if "single" in concentration_values and len(concentration_values) > 1:
            errors.append(f"단일종목·바스켓 혼합 오류: {group_id}")
        if len(members) > 20:
            broad.append({"primary_peer_group_id": group_id, "member_count": len(members), "reason": "20종목 초과: 과도한 분류 범위 여부 검수 필요"})
    return errors, sorted(broad, key=lambda row: -int(row["member_count"]))


def sample_rows(records: list[dict[str, Any]], registry: list[dict[str, Any]]) -> list[dict[str, str]]:
    count_map = {row["primary_peer_group_id"]: str(row["member_count"]) for row in registry}
    specifications = [
        ("S&P500", lambda row: row["index_family"] == "S&P500"),
        ("나스닥100", lambda row: row["index_family"] == "NASDAQ100"),
        ("미국배당다우존스", lambda row: row["index_family"] == "DOW_JONES_DIVIDEND"),
        ("국내 반도체", lambda row: row["comparison_subtopic"] == "국내 반도체"),
        ("미국 반도체", lambda row: row["comparison_subtopic"] == "미국 반도체"),
        ("AI 데이터센터", lambda row: row["comparison_subtopic"] == "AI 데이터센터"),
        ("조선", lambda row: "조선" in row["comparison_subtopic"]),
        ("화장품", lambda row: "화장품" in row["comparison_subtopic"]),
        ("2차전지", lambda row: "2차전지" in row["comparison_subtopic"]),
        ("국내 고배당", lambda row: row["comparison_subtopic"] == "국내 고배당"),
        ("미국 장기국채", lambda row: "미국 국채 장기" in row["comparison_subtopic"]),
        ("국내 초단기채", lambda row: "국내" in row["comparison_subtopic"] and "초단기" in row["comparison_subtopic"]),
        ("KOFR/CD금리", lambda row: row["comparison_subtopic"] in {"KOFR", "CD금리"}),
        ("금 현물", lambda row: row["comparison_subtopic"] == "금 spot"),
        ("원유 선물", lambda row: row["comparison_subtopic"] == "원유 futures"),
        ("국내 리츠", lambda row: row["comparison_subtopic"] == "국내 리츠·인프라"),
        ("주식50/채권50 혼합", lambda row: row["comparison_subtopic"] == "주식50/채권50"),
        ("단일종목 ETF", lambda row: row["comparison_category"] == "단일·소수종목"),
        ("커버드콜", lambda row: row["payoff_structure"] == "covered_call"),
        ("레버리지·인버스", lambda row: row["strategy_style"] in {"leveraged", "inverse"}),
    ]
    output: list[dict[str, str]] = []
    for label, predicate in specifications:
        matched = [row for row in records if predicate(row)]
        groups = sorted({row["primary_peer_group_id"] for row in matched})
        candidates = ", ".join(f"{row['ticker']} {row['name']}" for row in matched[:8]) or "해당 없음"
        reason = "투자대상·지역·수익구조가 동일한 그룹만 후보로 유지"
        output.append({"sample_type": label, "peer_group_ids": ", ".join(groups[:8]) or "해당 없음", "candidate_count": str(len(matched)), "example_candidates": candidates, "selection_reason": reason})
    target = next((row for row in records if row["ticker"] == "0142D0"), None)
    if target:
        protected = target["comparison_subtopic"] == "AI 데이터센터" and target["index_family"] not in {"S&P500", "NASDAQ100"} and "반도체" not in target["comparison_subtopic"]
        output.append({"sample_type": "0142D0 격리 확인", "peer_group_ids": target["primary_peer_group_id"], "candidate_count": count_map.get(target["primary_peer_group_id"], "0"), "example_candidates": f"{target['ticker']} {target['name']}", "selection_reason": "PASS" if protected else "ERROR: S&P500·나스닥100·일반 반도체 직접그룹과 분리 실패"})
    else:
        output.append({"sample_type": "0142D0 격리 확인", "peer_group_ids": "미존재", "candidate_count": "0", "example_candidates": "입력 데이터에 0142D0 없음", "selection_reason": "검수 필요"})
    return output


def report(records: list[dict[str, Any]], registry: list[dict[str, Any]], errors: list[str], broad: list[dict[str, Any]], samples: list[dict[str, str]]) -> str:
    status_counts = Counter(row["classification_status"] for row in records)
    singleton = sum(1 for row in registry if int(row["member_count"]) == 1)
    top20 = registry[:20]
    lines = [
        "# ETF 동적 동종 비교분류 검증 보고서",
        "",
        "> 기준일: 입력 파일 `bas_dt`를 그대로 사용했습니다. 비교그룹은 자산군·지역·투자대상·수익·손실 구조를 공통 키로 사용하며, 순자산·거래대금·총보수·수익률·운용사·연금 가능 여부는 분류 키에서 제외했습니다.",
        "",
        "## 1. 처리 요약",
        "",
        "| 지표 | 값 |",
        "|---|---:|",
        f"| 전체 ETF 수 | {len(records)} |",
        f"| 자동확정 수 | {status_counts.get('auto_high_confidence', 0)} |",
        f"| 공식확정 수 | {status_counts.get('verified_official', 0)} |",
        f"| 검수 필요 수 | {status_counts.get('needs_review', 0)} |",
        f"| 분류 충돌 수 | {status_counts.get('conflict', 0)} |",
        f"| 비교그룹 수 | {len(registry)} |",
        f"| 1종목 그룹 수 | {singleton} |",
        f"| 20종목 초과 그룹 | {len(broad)} |",
        "",
        "## 2. 검증 결과",
        "",
    ]
    if errors:
        lines.extend(["다음 검증 오류가 발견되었습니다.", ""])
        lines.extend(f"- {error}" for error in errors)
    else:
        lines.extend(["입력 전 종목 1회 존재, ticker/ISIN 중복 없음, 모든 primary_peer_group_id의 레지스트리 존재, 그룹 내 자산군·지역·수익구조·집중도 혼합 금지 규칙을 통과했습니다.", ""])
    lines.extend(["", "## 3. 가장 큰 비교그룹 20개", "", "| 그룹 ID | 그룹명 | 구성원 | 자동 비교 | 분류 근거 |", "|---|---|---:|---|---|"])
    for row in top20:
        lines.append(f"| {row['primary_peer_group_id']} | {row['peer_group_name']} | {row['member_count']} | {row['automatic_comparison_eligible']} | {row['classification_rationale']} |")
    lines.extend(["", "## 4. 20종목 초과 그룹 검수", ""])
    if broad:
        lines.extend(["| 그룹 ID | 구성원 | 조치 |", "|---|---:|---|"])
        lines.extend(f"| {row['primary_peer_group_id']} | {row['member_count']} | {row['reason']} |" for row in broad)
    else:
        lines.append("없음")
    lines.extend(["", "## 5. 표본 비교 후보", "", "| 유형 | 그룹 | 후보 수 | 후보 예시 | 선정 이유 |", "|---|---|---:|---|---|"])
    for row in samples:
        lines.append(f"| {row['sample_type']} | {row['peer_group_ids']} | {row['candidate_count']} | {row['example_candidates']} | {row['selection_reason']} |")
    lines.extend(["", "## 6. 모든 그룹의 분류 근거", "", "| 그룹 ID | 구성원 | 자동 비교 | 분류 근거 |", "|---|---:|---|---|"])
    for row in registry:
        lines.append(f"| {row['primary_peer_group_id']} | {row['member_count']} | {row['automatic_comparison_eligible']} | {row['classification_rationale']} |")
    lines.extend(["", "## 7. 충돌 및 미확인 처리", "", "`comparison_review_queue.csv`에는 `needs_review`, `conflict`, `unavailable` 상태의 모든 종목과 20종목 초과 그룹 검수 항목을 기록했습니다. 이 상태의 종목은 자동 비교 후보에서 제외해야 합니다.", "", "### 분류 근거·한계", "", "- `verified_official`은 기존 검토 시트 또는 공식 출처 레지스트리에 공식 URL과 검토 상태가 함께 기록된 경우에만 부여했습니다.", "- `auto_high_confidence`는 상품명과 기초지수에서 투자대상 및 구조가 명확한 경우에만 부여했습니다.", "- 환헤지와 액티브·패시브는 필드로 보존하되, 투자대상과 수익구조가 같은 경우에는 직접 비교그룹을 분할하지 않았습니다.", "- 가짜 값이나 출처 없는 확정값을 생성하지 않기 위해 모호한 종목은 단독 대기 그룹과 검수 대기열로 보냈습니다.", ""])
    return "\n".join(lines)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    master = load_csv(MASTER)
    reviews = {clean(row.get("ticker")): row for row in load_csv(REVIEW)}
    pensions = {clean(row.get("ticker")): row for row in load_csv(PENSION)}
    officials = {clean(row.get("ticker")): row for row in load_csv(OFFICIAL)}
    records = [derive_record(row, reviews.get(clean(row.get("ticker")), {}), pensions.get(clean(row.get("ticker")), {}), officials.get(clean(row.get("ticker")), {})) for row in master]
    registry = build_registry(records)
    errors, broad = validate(records, registry, len(master))
    samples = sample_rows(records, registry)
    review_queue = [row for row in records if row["classification_status"] not in STATUS_AUTO]
    review_queue.extend({
        "isin_cd": "", "ticker": "", "name": "", "base_index": "", "asset_family": "", "region_primary": "",
        "comparison_category": "", "comparison_topic": "", "comparison_subtopic": "", "index_family": "", "strategy_style": "", "payoff_structure": "", "direction": "", "leverage_multiple": "", "fx_hedge": "", "replication_method": "", "concentration_bucket": "", "primary_peer_group_id": row["primary_peer_group_id"], "alternate_peer_group_ids": "", "classification_status": "needs_review", "evidence_basis": "그룹 크기 검수", "official_source_url": "", "review_reason": row["reason"],
    } for row in broad)
    write_csv(OUT / "etf_comparison_classification.csv", records, CLASSIFICATION_COLUMNS)
    registry_fields = ["primary_peer_group_id", "peer_group_name", "member_count", "asset_family", "region_primary", "comparison_category", "comparison_topic", "comparison_subtopic", "index_family", "strategy_structure", "automatic_comparison_eligible", "group_status_summary", "classification_rationale"]
    write_csv(OUT / "peer_group_registry.csv", registry, registry_fields)
    write_csv(OUT / "comparison_review_queue.csv", review_queue, CLASSIFICATION_COLUMNS)
    (OUT / "comparison_validation_report.md").write_text(report(records, registry, errors, broad, samples), encoding="utf-8")
    print(f"records={len(records)} groups={len(registry)} errors={len(errors)} review_queue={len(review_queue)}")
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
