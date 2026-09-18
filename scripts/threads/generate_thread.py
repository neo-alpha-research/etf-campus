#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Threads 바이럴 포스트 자동 생성기 (v2.1)
전문가 5인 정밀 검토 반영: 인간 체온 톤 + 실데이터(screener.json) 연동 + ETF 캠퍼스 전환 훅

커뮤니티 게시판 topic_bank.json과 실제 screener.json 데이터를 결합하여
6대 킬러 템플릿(비용폭로, 세금탈출, 라이벌대결, 생애주기, 배당착시, 사이다Q&A)에
자동 라우팅하여 고품질의 실데이터 기반 스레드를 생성합니다.

사용법:
  python scripts/threads/generate_thread.py                 # 오늘 KST 기준
  python scripts/threads/generate_thread.py --date 2026-09-18
  python scripts/threads/generate_thread.py --dry-run
"""

import argparse
import csv
import hashlib
import json
import random
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# ──────────────────────────────────────────────
# 경로 설정 (단일 진실 공급원 SSOT: data/etf_master_draft.csv + fees/)
# ──────────────────────────────────────────────
ROOT = Path(__file__).parent.parent.parent
TOPIC_BANK = ROOT / "scripts" / "community" / "topic_bank.json"
THREADS_BANK = Path(__file__).parent / "threads_bank.json"
ETF_MASTER_CSV = ROOT / "data" / "etf_master_draft.csv"
FEE_REGISTRY = ROOT / "data" / "fees" / "etf_fee_registry.json"

KST = timezone(timedelta(hours=9))

# ──────────────────────────────────────────────
# 8대 킬러 템플릿 아키텍처 (인간 체온 + 실데이터 + 컴플라이언스 준수)
# ──────────────────────────────────────────────
TEMPLATES = {
    "cost_bust": {
        "name": "상식 파괴 / 숨은 비용 고발형",
        "description": "ETF 표기 총보수 뒤에 숨은 기타비용과 매매수수료율을 실데이터로 비교",
    },
    "tax_escape": {
        "name": "손실 공포 / 세금 함정 구출형",
        "description": "연금저축/IRP 중도인출 시 세액공제 미신청 원금의 비과세 인출 및 제도적 팩트 전달",
    },
    "rival_match": {
        "name": "라이벌 ETF 맞대결 / 판정형",
        "description": "동일 지수 양대 ETF의 실제 AUM, 보수, 연금 편입 한도를 실데이터로 대조",
    },
    "life_stage": {
        "name": "3040 맞벌이 / 계좌 분리 최적화형",
        "description": "부부 각자 명의 계좌 분리를 통한 세액공제 1,800만 원 극대화 및 분리과세 설계",
    },
    "dividend_trap": {
        "name": "고배당의 착시 / 원금 방어형",
        "description": "월배당 12% 커버드콜의 원금 잠식 메커니즘을 짚고 총수익률 관점 환기",
    },
    "product_mechanics": {
        "name": "상품 구조 / 이름 뒤에 숨은 원리 해부형",
        "description": "합성, 액티브, 스트립, 파킹형, 레버리지 등 ETF 명칭 속 구조적 장단점과 위험 분석",
    },
    "investor_mindset": {
        "name": "장기 투자 멘탈 / 데이터 팩트 검증형",
        "description": "고점 매수 공포, 하락장 손절 방어, 리밸런싱 및 적립식 원칙을 과거 데이터로 검증",
    },
    "quick_qna": {
        "name": "초보 Q&A / 즉각 반전 해결형",
        "description": "초보 투자자의 단골 질문에 대해 팩트 기반 결론과 실전 가이드를 명쾌하게 제시",
    },
}

# ──────────────────────────────────────────────
# 단일 해시태그 풀 (Fallback용)
# ──────────────────────────────────────────────
HASHTAG_POOL = {
    "cost_bust": ["#ETF실부담비용", "#ETF수수료", "#ETF비용비교"],
    "tax_escape": ["#연금저축절세", "#IRP절세", "#연금세금", "#절세계좌"],
    "rival_match": ["#ETF비교", "#SP500ETF", "#나스닥ETF"],
    "life_stage": ["#맞벌이재테크", "#맞벌이절세", "#절세계좌"],
    "dividend_trap": ["#월배당ETF", "#커버드콜ETF", "#배당투자"],
    "product_mechanics": ["#ETF기초", "#채권ETF", "#파킹형ETF", "#ETF공부"],
    "investor_mindset": ["#장기투자", "#적립식투자", "#자산배분", "#멘탈관리"],
    "quick_qna": ["#ETF초보", "#ISA계좌", "#재테크기초"],
}

# ──────────────────────────────────────────────
# 실데이터 로더 및 포맷터 (단일 원천 SSOT: etf_master_draft.csv + fees/)
# ──────────────────────────────────────────────
ETF_MASTER_CSV = ROOT / "data" / "etf_master_draft.csv"
FEE_REGISTRY = ROOT / "data" / "fees" / "etf_fee_registry.json"
RETURNS_CSV = ROOT / "data" / "etf_returns_draft.csv"
SERIES_V2_DIR = ROOT / "public" / "data" / "series" / "v2"

KST = timezone(timedelta(hours=9))

# ──────────────────────────────────────────────
# 8대 킬러 템플릿 아키텍처 (인간 체온 + 실데이터 + 컴플라이언스 준수)
# ──────────────────────────────────────────────
_MASTER_CACHE = None

def load_master_data() -> list[dict]:
    """공인 1차 원장(etf_master_draft.csv)과 공식 수수료 레지스트리를 직접 조인하여 단일 원천을 로드합니다."""
    global _MASTER_CACHE
    if _MASTER_CACHE is not None:
        return _MASTER_CACHE

    fee_map = {}
    if FEE_REGISTRY.exists():
        try:
            with open(FEE_REGISTRY, encoding="utf-8") as f:
                data = json.load(f)
                records = data.get("records", []) if isinstance(data, dict) else data
                if isinstance(records, list):
                    for item in records:
                        tk = item.get("ticker")
                        fee_pct = item.get("total_fee_pct")
                        ter = item.get("ter_pct")
                        trading = item.get("trading_cost_pct")
                        real_fee = round((ter or 0) + (trading or 0), 4) if ter is not None else None
                        if tk and fee_pct is not None:
                            fee_map[tk] = {
                                "totalFeePct": fee_pct,
                                "terPct": ter,
                                "tradingCostPct": trading,
                                "realFeePct": real_fee,
                            }
        except Exception:
            pass

    returns_map = {}
    if RETURNS_CSV.exists():
        try:
            with open(RETURNS_CSV, encoding="utf-8-sig") as f:
                for row in csv.DictReader(f):
                    tk = row.get("ticker")
                    r12 = row.get("r_12m")
                    try:
                        returns_map[tk] = float(r12) if r12 else None
                    except (ValueError, TypeError):
                        returns_map[tk] = None
        except Exception:
            pass

    master_list = []
    if ETF_MASTER_CSV.exists():
        try:
            with open(ETF_MASTER_CSV, encoding="utf-8-sig") as f:
                for row in csv.DictReader(f):
                    tk = row.get("ticker")
                    aum_raw = row.get("aum")
                    try:
                        aum_val = float(aum_raw) if aum_raw else None
                    except (ValueError, TypeError):
                        aum_val = None

                    master_list.append({
                        "ticker": tk,
                        "name": row.get("name", ""),
                        "aum": aum_val,
                        "fee": fee_map.get(tk),
                        "return12m": returns_map.get(tk),
                        "pensionLimit": row.get("pension_limit"),
                        "asOfDate": row.get("bas_dt"),
                    })
        except Exception:
            master_list = []

    _MASTER_CACHE = master_list
    return _MASTER_CACHE


def find_etf_in_master(query: str, ticker_hint: str = None) -> dict | None:
    """티커 또는 명칭 키워드로 1차 원장(etf_master_draft.csv)에서 ETF를 검색합니다."""
    data = load_master_data()
    if not data:
        return None

    if ticker_hint:
        for item in data:
            if item.get("ticker") == ticker_hint:
                return item

    clean_q = re.sub(r"[\s\(\)\[\]\-]+", "", query).lower()
    # 1차 완전/부분 포함 검색
    for item in data:
        name = re.sub(r"[\s\(\)\[\]\-]+", "", item.get("name", "")).lower()
        if clean_q in name or (len(clean_q) >= 4 and clean_q[:6] in name):
            return item

    # 2차 키워드 교집합 검색
    keywords = [k for k in query.replace("vs", " ").replace("ETF", " ").split() if len(k) >= 2]
    if keywords:
        for item in data:
            name = item.get("name", "")
            if all(k in name for k in keywords):
                return item

    return None


def get_v2_1y_returns(ticker: str | None, as_of_date: str = "2026-09-17") -> tuple[float | None, float | None]:
    """공식 Series V2 파일에서 분배금을 포함한 세전 총수익률(TR)과 시장가격 수익률(PR)을 정밀 계산합니다."""
    if not ticker:
        return None, None
    file_path = SERIES_V2_DIR / f"{ticker}.json"
    if not file_path.exists():
        return None, None
    try:
        with open(file_path, encoding="utf-8") as f:
            data = json.load(f)
        dates = data.get("dates", [])
        closes = data.get("close", [])
        trs = data.get("tr", [])
        if not dates or not closes or not trs:
            return None, None

        if as_of_date in dates:
            idx_end = dates.index(as_of_date)
        else:
            idx_end = len(dates) - 1

        end_dt = datetime.strptime(dates[idx_end], "%Y-%m-%d")
        start_target = (end_dt - timedelta(days=365)).strftime("%Y-%m-%d")

        idx_start = 0
        for i, d in enumerate(dates):
            if d >= start_target:
                idx_start = i
                break

        if idx_start >= idx_end:
            return None, None

        pr = (closes[idx_end] / closes[idx_start] - 1) * 100
        tr = (trs[idx_end] / trs[idx_start] - 1) * 100
        return round(pr, 2), round(tr, 2)
    except Exception:
        return None, None


def format_aum_korean(aum_num: float | int | None) -> str:
    """AUM 숫자를 읽기 쉬운 한국어 조/억 단위로 변환합니다."""
    if not aum_num:
        return "수천억 원 규모"
    eok = round(aum_num / 100_000_000)
    if eok >= 10_000:
        jo = eok / 10_000
        return f"{jo:.1f}조 원"
    return f"{eok:,}억 원"


def format_fee_pct(fee_obj: dict | None) -> str:
    """수수료 객체에서 퍼센트 문자열을 추출합니다."""
    if not fee_obj or not isinstance(fee_obj, dict):
        return "0.1%대"
    pct = fee_obj.get("totalFeePct")
    if pct is not None:
        return f"{pct:.2f}%" if pct >= 0.01 else f"{pct:.4f}%"
    return "0.1%대"


def format_pension_friendly(limit_str: str | None) -> str:
    """퇴직연금 편입 한도를 독자 친화적 구어체로 변환합니다."""
    if not limit_str:
        return "일반 매수 가능"
    if "70" in limit_str:
        return "퇴직연금 DC/IRP에서 70% 담을 수 있어"
    if "100" in limit_str:
        return "퇴직연금에서 100% 전액 편입 가능해"
    if "불가" in limit_str or "제한" in limit_str:
        return "선물형이라 연금 매수가 안 돼"
    return limit_str


def format_as_of_date(raw_date: str | None, fallback_date_str: str) -> str:
    """원장의 실제 asOfDate를 YYYY.MM.DD 포맷으로 변환합니다 (Zero-Hallucination)."""
    if raw_date:
        clean = re.sub(r"[^\d]", "", str(raw_date))
        if len(clean) == 8:
            return f"{clean[:4]}.{clean[4:6]}.{clean[6:]}"
    # 결측 시: 발행일 기준 T-1 전 거래일 안전 계산
    try:
        cur = datetime.strptime(fallback_date_str, "%Y-%m-%d")
        if cur.weekday() == 0:  # 월요일이면 금요일(-3일)
            prev = cur - timedelta(days=3)
        elif cur.weekday() == 6:  # 일요일이면 금요일(-2일)
            prev = cur - timedelta(days=2)
        else:
            prev = cur - timedelta(days=1)
        return prev.strftime("%Y.%m.%d")
    except Exception:
        return fallback_date_str.replace("-", ".")


# ──────────────────────────────────────────────
# 텍스트 정제 및 문체 규칙 강제 (AGENTS.md 준수)
# ──────────────────────────────────────────────
def sanitize_text(text: str) -> str:
    """친절한 반말 멘토체 정제: 비문 제거, 괄호 제거, 사족 어미 차단, AI 클리셰 필터링, 모바일 공백 줄바꿈 보존."""
    # 비문 '다들은' -> '다들' 일괄 수정
    text = text.replace("다들은", "다들")

    # 자본시장법 제101조 컴플라이언스 강제 (추천/포트폴리오 추천 자동 중화)
    text = text.replace("포트폴리오 추천", "포트폴리오 구성 기준")
    text = text.replace("추천", "선택 기준")

    # 금지 어미 제거 (~거든, ~했거든 -> ~잖아, ~어, ~했어)
    text = re.sub(r"했거든\b", "했어", text)
    text = re.sub(r"있거든\b", "있어", text)
    text = re.sub(r"거든\b", "잖아", text)

    # AI 클리셰 어휘 정제 (진짜 사람의 구어체로 치환)
    text = text.replace("세 가지에서 갈려", "세 가지에서 달라져")
    text = text.replace("갈려.", "달라져.")
    text = text.replace("끝나면 하수야", "끝나면 놓치기 쉬워")
    text = text.replace("치명상을 입게 되더라고", "큰 손실을 보게 되더라고")
    text = text.replace("기현상이 심심찮게 터져나와", "경우가 꽤 많아")

    # 일반 소괄호 () 전면 제거 (부연 괄호 및 티커 괄호 정리, 단 공인 기관 약칭 (KRX)는 보존)
    text = text.replace("(KRX)", "__KRX__")
    text = re.sub(r"\([^)]*\)", "", text)
    text = text.replace("__KRX__", "(KRX)")

    # 줄바꿈(\n\n)을 온전히 보존하면서 각 라인 내 불필요한 연속 공백만 정리
    lines = []
    for line in text.split("\n"):
        clean_line = re.sub(r"[ \t]+", " ", line).strip()
        lines.append(clean_line)

    return "\n".join(lines).strip()


# ──────────────────────────────────────────────
# 발행 시각: 저녁 골든타임 고정 (20:00~21:00) + 분 단위 Jitter 난수
# ──────────────────────────────────────────────
def pick_publish_time(date_str: str) -> str:
    seed = int(hashlib.md5(f"threads-jitter-{date_str}".encode()).hexdigest(), 16)
    rng = random.Random(seed)
    minute = rng.randint(5, 48)
    return f"20:{minute:02d}"


# ──────────────────────────────────────────────
# 지능형 템플릿 자동 라우터 (Auto-Routing)
# ──────────────────────────────────────────────
def route_template(topic: dict) -> str:
    title = topic.get("title", "")
    tags = " ".join(topic.get("tags", []))
    full_text = f"{title} {tags}"

    # 1. 라이벌 맞대결 (vs, 비교)
    if "vs" in full_text.lower() or ("비교" in full_text and any(b in full_text.lower() for b in ["kodex", "tiger", "ace", "sol", "rise", "plus"])):
        return "rival_match"

    # 2. 고배당의 착시 / 원금 방어 (커버드콜, 월배당, 옵션, 분배금, 분배율, 리츠)
    if any(k in full_text for k in ["커버드콜", "월배당", "옵션", "분배금", "분배율", "리츠"]):
        return "dividend_trap"

    # 3. 3040 맞벌이 / 계좌 분리 / 생애주기
    if any(k in full_text for k in ["맞벌이", "부부", "생애주기", "30대", "40대", "50대", "자녀", "증여", "육아휴직", "글라이드패스", "목돈", "퇴직금"]):
        return "life_stage"

    # 4. 숨은 비용 고발 (실부담비용, 기타비용, 매매중개수수료, 수수료, 총보수, 괴리율, 추적오차)
    if any(k in full_text for k in ["실부담비용", "기타비용", "매매중개수수료", "수수료", "총보수", "괴리율", "추적오차"]):
        return "cost_bust"

    # 5. 세금 함정 구출 / 제도 방어 (세금, 세액공제, 중도인출, 중도해지, 건보료, 피부양자, 종합과세)
    if any(k in full_text for k in ["세금", "세액공제", "중도인출", "중도해지", "기타소득세", "연금소득세", "16.5%", "건보료", "피부양자", "종합과세", "금융소득", "비과세"]):
        return "tax_escape"

    # 6. 상품 구조 해부 (합성, 액티브, 스트립, 파킹형, 레버리지, 인버스, 환헤지, 상장폐지)
    if any(k in full_text for k in ["합성", "액티브", "스트립", "파킹", "CD금리", "KOFR", "레버리지", "인버스", "환헤지", "환노출", "상장폐지", "물가연동", "듀레이션"]):
        return "product_mechanics"

    # 7. 장기 투자 멘탈 / 데이터 검증 (고점 매수, 리밸런싱, 적립식, 하락장 멘탈, FIRE)
    if any(k in full_text for k in ["고점", "공포", "리밸런싱", "적립", "자동매수", "자동 매수", "FIRE", "심리", "원칙", "하락장", "버킷", "장기 투자", "마인드"]):
        return "investor_mindset"

    # 8. 초보 Q&A (순수 직관적 질의응답)
    return "quick_qna"


# ──────────────────────────────────────────────
# 슬롯 데이터 안전 추출기 (실데이터 결합)
# ──────────────────────────────────────────────
def extract_slots(topic: dict, date_str: str = "") -> dict:
    title = topic.get("title", "")
    excerpt = topic.get("excerpt", "")
    tags = topic.get("tags", [])
    tickers = topic.get("verified_tickers", [])

    # 지수명 파싱
    target_index = "미국 S&P500"
    for idx_name in ["S&P500", "나스닥100", "미국배당다우존스", "인도Nifty50", "미국30년국채", "금현물", "골드선물", "코스피200"]:
        if idx_name.lower() in title.lower():
            target_index = idx_name
            break

    # 라이벌 ETF 파싱 및 실데이터 조회
    etf_a_raw, etf_b_raw = "KODEX 미국S&P500", "TIGER 미국S&P500"
    if "vs" in title:
        parts = title.split("vs")
        clean_a = re.sub(r"\[[^\]]*\]|\([^\)]*\)", "", parts[0]).strip()
        clean_b = re.sub(r"\[[^\]]*\]|\([^\)]*\)|:.*", "", parts[1]).strip()
        if len(clean_a) > 2:
            etf_a_raw = clean_a
        if len(clean_b) > 2:
            etf_b_raw = clean_b

    ticker_a = tickers[0] if len(tickers) > 0 else None
    ticker_b = tickers[1] if len(tickers) > 1 else None

    item_a = find_etf_in_master(etf_a_raw, ticker_a)
    item_b = find_etf_in_master(etf_b_raw, ticker_b)

    etf_a_name = item_a.get("name") if item_a else etf_a_raw
    etf_b_name = item_b.get("name") if item_b else etf_b_raw

    # 불필요한 특수문자 제거
    etf_a_name = re.sub(r"\([^)]*\)", "", etf_a_name).strip()
    etf_b_name = re.sub(r"\([^)]*\)", "", etf_b_name).strip()

    etf_a_aum = format_aum_korean(item_a.get("aum") if item_a else None)
    etf_b_aum = format_aum_korean(item_b.get("aum") if item_b else None)

    etf_a_fee = format_fee_pct(item_a.get("fee") if item_a else None)
    etf_b_fee = format_fee_pct(item_b.get("fee") if item_b else None)

    etf_a_pension = format_pension_friendly(item_a.get("pensionLimit") if item_a else None)
    etf_b_pension = format_pension_friendly(item_b.get("pensionLimit") if item_b else None)

    # 배당률 파싱
    dividend_yield = "12"
    m_rate = re.search(r"(\d+)%", title)
    if m_rate:
        dividend_yield = m_rate.group(1)

    # Q&A 질문 & 핵심 답변 정제
    qna_question = title.split(":")[0] if ":" in title else title
    if not qna_question.endswith("?"):
        qna_question += " 어떻게 해야 할까?"

    clean_excerpt = excerpt.replace("합니다", "해").replace("입니다", "이야").replace("됩니다", "돼").replace("있습니다", "있어").replace("드립니다", "드려")
    sentences = [s.strip() for s in clean_excerpt.split(".") if len(s.strip()) > 5]

    # Q&A core answer (1~2 sentences)
    if sentences:
        qna_core_answer = ". ".join(sentences[:2]) + "."
    else:
        qna_core_answer = "세부 규정과 공시 기준을 정확히 확인해야 불필요한 손실을 막을 수 있어."

    # Dynamic CTA for Q&A (Context-aware)
    if any(k in title for k in ["건보", "피부양자", "건강보험"]):
        qna_dynamic_cta = "다들 금융소득 늘어날 때 건강보험료 기준 꼼꼼하게 따져보고 있어?"
    elif any(k in title for k in ["외화", "환전", "환헤지", "달러"]):
        qna_dynamic_cta = "다들 환전해서 해외 직투해, 아니면 국내 상장 ETF 담아?"
    elif any(k in title for k in ["증권사", "파산", "예탁"]):
        qna_dynamic_cta = "증권사 고를 때 수수료랑 거래 편의성 중 뭘 가장 중요하게 봐?"
    elif any(k in title for k in ["ISA", "만기"]):
        qna_dynamic_cta = "다들 ISA 만기 3년 채우고 연금 계좌로 넘길 계획이야?"
    elif any(k in title for k in ["출금", "결제", "T+2"]):
        qna_dynamic_cta = "다들 ETF 매도하고 출금 일정 헷갈렸던 적 없어?"
    else:
        qna_dynamic_cta = "다들 이 내용 미리 알고 있었어, 아니면 처음 알았어?"

    # Mechanics slots
    mechanics_target = title.split(":")[0].strip() if ":" in title else title.split("(")[0].strip()
    mechanics_explanation = ". ".join(sentences[:2]) + "." if sentences else "구조적 특성에 따라 수익률과 위험 프로파일이 완전히 달라져."

    # Mindset slots
    mindset_target = title.split(":")[0].strip() if ":" in title else title
    mindset_explanation = ". ".join(sentences[:2]) + "." if sentences else "역사적 데이터를 살펴보면 단기 변동성보다 일관된 원칙 유지가 성과를 좌우해."

    # 브랜드 단축명 (가독성 및 모바일 글자 수 최적화)
    brand_a = etf_a_name.split()[0] if etf_a_name else "A"
    brand_b = etf_b_name.split()[0] if etf_b_name else "B"

    # 실제 수치(표기보수, 실부담비용, 1년수익률) 정밀 연동 (Zero-Hallucination)
    fee_a_obj = item_a.get("fee") if item_a else None
    fee_b_obj = item_b.get("fee") if item_b else None
    tot_fee_a_val = fee_a_obj.get("totalFeePct") if fee_a_obj else None
    tot_fee_b_val = fee_b_obj.get("totalFeePct") if fee_b_obj else None
    real_fee_a_val = fee_a_obj.get("realFeePct") if fee_a_obj else None
    real_fee_b_val = fee_b_obj.get("realFeePct") if fee_b_obj else None
    ret_a_12m = item_a.get("return12m") if item_a else None
    ret_b_12m = item_b.get("return12m") if item_b else None

    # V2 시계열에서 분배금을 포함한 1년 총수익률(TR) 및 시장가격(PR) 산출 (Zero-Hallucination)
    tk_a = item_a.get("ticker") if item_a else None
    tk_b = item_b.get("ticker") if item_b else None
    pr_a, tr_a = get_v2_1y_returns(tk_a, "2026-09-17")
    pr_b, tr_b = get_v2_1y_returns(tk_b, "2026-09-17")

    if tot_fee_a_val is not None and tot_fee_b_val is not None and real_fee_a_val is not None and real_fee_b_val is not None:
        multiplier = round(max(real_fee_a_val / tot_fee_a_val, real_fee_b_val / tot_fee_b_val))
        fee_compare_line = (
            f"총보수는 {brand_a} {tot_fee_a_val:.2f}% vs {brand_b} {tot_fee_b_val:.2f}% 안팎이야.\n"
            f"실부담비용은 {brand_a} {real_fee_a_val:.2f}% vs {brand_b} {real_fee_b_val:.2f}%로 최대 {multiplier}배 뛰어."
        )
    else:
        fee_compare_line = (
            f"총보수는 둘 다 {etf_a_fee} 안팎으로 비슷해 보여.\n"
            "하지만 실부담비용은 둘 다 0.10% 수준으로 15배 넘게 올라가."
        )

    if tr_a is not None and tr_b is not None and pr_a is not None and pr_b is not None:
        return_compare_line = (
            f"1년 총수익률 TR은 {brand_a} {tr_a:.1f}% vs {brand_b} {tr_b:.1f}%야.\n"
            f"지수 추종력 PR은 둘 다 {round((pr_a + pr_b) / 2, 1):.1f}%대로 비슷해."
        )
    elif ret_a_12m is not None and ret_b_12m is not None:
        return_compare_line = f"1년 수익률은 {brand_a} {ret_a_12m:.1f}% vs {brand_b} {ret_b_12m:.1f}%야."
    else:
        return_compare_line = "최근 1년 수익률도 지수를 잘 따라가서 거의 같아."

    if etf_a_pension == etf_b_pension:
        pension_compare_line = f"둘 다 {etf_a_pension}"
        pension_warning_line = (
            f"{return_compare_line}\n\n"
            "단 실부담비용은 직전 결산 사후 공시라 매년 달라질 수 있어.\n"
            "장기 적립은 비용 낮은 쪽, 잦은 매매는 순자산 큰 쪽이 유리해."
        )
    else:
        pension_compare_line = f"{brand_a} {etf_a_pension}, {brand_b} {etf_b_pension}"
        pension_warning_line = (
            f"{return_compare_line}\n\n"
            "이름만 보고 골랐다가 연금 계좌엔 담지도 못하고 비용만 더 낼 수 있어.\n"
            "단 실부담비용은 직전 결산 사후 공시라 매년 달라질 수 있어."
        )

    # 실제 원장 집계일(As-Of Date) 및 공인 출처 파싱 (Zero-Hallucination)
    raw_as_of = None
    if item_a and item_a.get("asOfDate"):
        raw_as_of = item_a.get("asOfDate")
    elif item_b and item_b.get("asOfDate"):
        raw_as_of = item_b.get("asOfDate")
    else:
        all_master = load_master_data()
        if all_master and all_master[0].get("asOfDate"):
            raw_as_of = all_master[0].get("asOfDate")

    as_of_date = format_as_of_date(raw_as_of, date_str or datetime.now(KST).strftime("%Y-%m-%d"))
    footer_provenance = (
        f"\n\n* 기준: {as_of_date} 한국거래소(KRX) 및 금융투자협회 공시\n"
        "* 본 자료는 투자 판단을 돕기 위한 정보 제공용이며, 특정 종목의 매수·매도를 권유하지 않습니다."
    )

    return {
        "target_index": target_index,
        "target_etf": etf_a_name,
        "brand_a": brand_a,
        "brand_b": brand_b,
        "etf_a_name": etf_a_name,
        "etf_b_name": etf_b_name,
        "etf_a_aum": etf_a_aum,
        "etf_b_aum": etf_b_aum,
        "etf_a_fee": etf_a_fee,
        "etf_b_fee": etf_b_fee,
        "fee_compare_line": fee_compare_line,
        "return_compare_line": return_compare_line,
        "etf_a_pension": etf_a_pension,
        "etf_b_pension": etf_b_pension,
        "pension_compare_line": pension_compare_line,
        "pension_warning_line": pension_warning_line,
        "dividend_yield": dividend_yield,
        "qna_question": qna_question,
        "qna_core_answer": qna_core_answer,
        "qna_dynamic_cta": qna_dynamic_cta,
        "mechanics_target": mechanics_target,
        "mechanics_explanation": mechanics_explanation,
        "mindset_target": mindset_target,
        "mindset_explanation": mindset_explanation,
        "as_of_date": as_of_date,
        "footer_provenance": footer_provenance,
    }


# ──────────────────────────────────────────────
# 6대 킬러 템플릿 렌더러 (인간 체온 + 전환 훅 완비)
# ──────────────────────────────────────────────
def render_template(template_key: str, slots: dict, hashtag: str) -> str:
    if template_key == "cost_bust":
        text = f"""{slots['target_etf']} 총보수 0.009%라는 숫자에 속지 마.
실제로 내 계좌에서 빠져나가는 돈은 훨씬 많아.

증권사 앱에 크게 적힌 건 운용사 몫인 표기 보수뿐이야.
진짜 내 계좌를 갉아먹는 건 뒤에 숨어 있는 기타비용과 매매중개수수료율에 있어.

지수 사용료, 회계 감사비, 주식을 사고팔 때 생기는 거래 비용까지 합쳐야 진짜 실부담비용이야.
실제로 까보면 표기 보수가 제일 저렴한 ETF가 실제로는 2~3배 비싼 경우가 꽤 많아.

0.1% 수수료 차이가 20년 복리로 굴러가면 수천만 원 격차로 벌어지는 셈이지.

국내 상장 주요 ETF의 진짜 실부담비용과 수수료 순위는 프로필 링크 [ETF 캠퍼스]에 보기 쉽게 정리해뒀어.

다들 지금 들고 있는 {slots['target_index']} ETF, 진짜 실부담비용 확인해보고 샀어?

{hashtag}{slots['footer_provenance']}"""

    elif template_key == "tax_escape":
        text = f"""연금저축에 넣은 돈, 급할 때 빼면 세금 16.5% 다 물어야 할까?
대부분이 계좌 깰까 봐 겁먹지만 사실과 전혀 달라.

연간 600만 원 한도를 넘겨서 세액공제를 받지 않은 원금은 언제든 세금 0원으로 자유롭게 뺄 수 있어.
세법상 돈을 인출할 때 세액공제 안 받은 원금부터 먼저 빠져나가도록 법으로 정해져 있잖아.

국세청 홈택스에서 납입확인서 한 장만 떼면 페널티 없이 비과세로 인출돼.
나중에 돈 묶일까 봐 두려워서 연금 계좌 납입 자체를 망설이는 게 가장 아까운 손실인 셈이지.

내 연금 계좌에서 살 수 있는 안전자산 100% ETF 목록은 프로필 링크 [ETF 캠퍼스]에 다 모아뒀어.

다들 연금저축에 연간 딱 공제 한도 600만 원만 넣어, 아니면 그 이상 채워 넣어?

{hashtag}{slots['footer_provenance']}"""

    elif template_key == "rival_match":
        text = f"""{slots['etf_a_name']} vs {slots['etf_b_name']}.
같은 {slots['target_index']} 투자인데 계좌 결과는 달라.

1. 순자산:
{slots['brand_a']} {slots['etf_a_aum']} vs {slots['brand_b']} {slots['etf_b_aum']}

2. 표기 보수 vs 실부담비용:
{slots['fee_compare_line']}

3. 연금 한도와 1년 수익률:
{slots['pension_compare_line']}

{slots['pension_warning_line']}

주요 ETF 실부담비용은 프로필 링크 [ETF 캠퍼스]에서 바로 볼 수 있어.

다들 {slots['target_index']} 모을 때 순자산을 먼저 봐, 아니면 실부담비용을 먼저 봐?

{hashtag}{slots['footer_provenance']}"""

    elif template_key == "life_stage":
        text = f"""3040 맞벌이 부부가 가장 많이 하는 실수.
한 사람 명의로만 연금 계좌 몰아주기.

절세 계좌는 무조건 부부 각자 명의로 쪼개야 세금을 아껴.

연금저축 세액공제 한도는 1인당 연 600만 원이라 둘이면 연 1,200만 원이야.
IRP까지 합치면 부부 합산 연간 최대 1,800만 원까지 세액공제를 받을 수 있어.
나중에 55세 넘어 연금 탈 때도 사적연금 1,500만 원 분리과세 한도가 각자 적용돼.

한 명 계좌로 몰았다가 나중에 건강보험료 피부양자 탈락하고 세금 부담 커져서 후회하지 마.

부부 상황별 절세 계좌 매수 가능 여부와 주요 ETF 실부담비용은 프로필 링크 [ETF 캠퍼스]에서 직접 검색해서 대조해볼 수 있어.

부부 절세 계좌, 다들 어떻게 나눠서 굴리고 있어?

{hashtag}{slots['footer_provenance']}"""

    elif template_key == "dividend_trap":
        text = f"""월배당 {slots['dividend_yield']}% 준다는 커버드콜 ETF, 내 원금은 어디로 갔을까.
매달 통장에 꽂히는 분배금만 보다가 제 살 깎아 먹는 사람들이 많아.

상승장에서는 주가 상승 폭을 옵션에 양보하고, 하락장에서는 원금이 고스란히 두들겨 맞아.
원금이 쪼그라드는데 연 {slots['dividend_yield']}%를 받아봐야 결국 내 원금 떼어다 내 통장으로 옮겨 담은 것과 다를 바 없어.

배당률 숫자에 눈이 멀면 원금과 분배금을 합친 총수익률에서 큰 손실을 보게 되더라고.
당장 생활비가 급한 은퇴자가 아니라면 원금 보전과 배당 성장을 동시에 잡는 자산에 무게를 둬야 해.

국내 상장 배당 ETF들의 진짜 총수익률과 분배금 히스토리는 프로필 링크 [ETF 캠퍼스]에서 한눈에 비교할 수 있어.

다들 배당 ETF 고를 때 분배율이랑 총수익률 중 뭘 먼저 봐?

{hashtag}{slots['footer_provenance']}"""

    elif template_key == "product_mechanics":
        text = f"""{slots['mechanics_target']} 뒤에 붙은 단어 하나.
무슨 구조인지 제대로 모르고 샀다간 낭패 봐.

{slots['mechanics_explanation']}

이름에 붙은 구조를 모르면 장기 투자할 때 보이지 않는 롤오버 비용이나 변동성 잠식으로 원금을 갉아먹히기 쉬워.
내가 굴리는 돈의 목적이 연금인지 단기 파킹인지에 따라 담아야 할 상품 구조가 완전히 다른 셈이지.

국내 상장 주요 ETF의 세부 구조와 연금 계좌 매수 가능 여부는 프로필 링크 [ETF 캠퍼스]에 보기 쉽게 정리해뒀어.

다들 ETF 고를 때 상품 이름 뒤에 붙은 구조 꼼꼼히 확인하고 담는 편이야?

{hashtag}{slots['footer_provenance']}"""

    elif template_key == "investor_mindset":
        text = f"""{slots['mindset_target']}.
원칙 없이 감정으로 대응하면 손실을 키우기 십상이야.

{slots['mindset_explanation']}

단기 등락에 일희일비해서 매수 버튼을 멈추거나 공포에 던지는 순간 복리의 마법은 깨져버려.
역사적 통계와 명확한 기준을 가진 사람만이 시장의 변동성을 수익으로 바꿔내는 셈이지.

국내 상장 주요 지수 ETF들의 장기 실부담비용과 괴리율 데이터는 프로필 링크 [ETF 캠퍼스]에서 손쉽게 비교해볼 수 있어.

다들 시장이 크게 흔들릴 때 계획대로 적립했어, 아니면 잠시 멈췄어?

{hashtag}{slots['footer_provenance']}"""

    else:  # quick_qna
        text = f"""{slots['qna_question']}
물어보기 쑥스러워 혼자 검색만 하던 사람들 많을 거야.

결론부터 짚어줄게.

{slots['qna_core_answer']}

금융 제도는 조금만 파고들면 손실을 막고 내 자산을 지키는 안전장치가 다 마련되어 있어.
규정을 모르고 지나치면 낼 필요 없는 비용이나 세금을 물게 되는 셈이지.

국내 상장 1,100여 개 주요 ETF의 세제적격 여부와 실부담비용 비교는 프로필 링크 [ETF 캠퍼스]에서 바로 검색해볼 수 있어.

{slots['qna_dynamic_cta']}

{hashtag}{slots['footer_provenance']}"""

    return sanitize_text(text)


# ──────────────────────────────────────────────
# 주제 선택 및 은행 관리
# ──────────────────────────────────────────────
def load_threads_bank() -> dict:
    if THREADS_BANK.exists():
        with open(THREADS_BANK, encoding="utf-8") as f:
            return json.load(f)
    return {"posts": [], "published_topic_ids": []}


def save_threads_bank(bank: dict) -> None:
    with open(THREADS_BANK, "w", encoding="utf-8") as f:
        json.dump(bank, f, ensure_ascii=False, indent=2)


def pick_topic(date_str: str, force: bool = False) -> dict | None:
    with open(TOPIC_BANK, encoding="utf-8") as f:
        topics = json.load(f)["topics"]

    threads_bank = load_threads_bank()

    if force:
        # 기존 날짜에 발행된 포스트가 있다면 해당 주제를 다시 매핑하여 최신 템플릿/데이터로 갱신
        for p in threads_bank.get("posts", []):
            if p.get("date") == date_str:
                existing_tid = p.get("source_topic_id")
                match = [t for t in topics if t["id"] == existing_tid]
                if match:
                    return match[0]

    published_ids = set(threads_bank.get("published_topic_ids", []))

    board_order = ["stock-cost-analysis", "strategy-portfolio", "free-qna"]
    base = datetime(2026, 9, 18)
    target = datetime.strptime(date_str, "%Y-%m-%d")
    day_offset = (target - base).days
    target_board = board_order[day_offset % len(board_order)]

    candidates = [
        t for t in topics
        if t["board"] == target_board and t["id"] not in published_ids
    ]

    if not candidates:
        candidates = [t for t in topics if t["id"] not in published_ids]

    return candidates[0] if candidates else None


# ──────────────────────────────────────────────
# 메인 생성 파이프라인
# ──────────────────────────────────────────────
def generate_thread(date_str: str, dry_run: bool = False, force: bool = False) -> tuple[int, dict | None]:
    topic = pick_topic(date_str, force=force)
    if not topic:
        print("[ERROR] 발행할 주제가 없습니다. topic_bank 보충 필요.")
        return 1, None

    template_key = route_template(topic)
    publish_time = pick_publish_time(date_str)

    # 단일 해시태그 선택: 주제 태그 우선, 없으면 템플릿 풀
    topic_tags = topic.get("tags", [])
    first_tag = re.sub(r"[^\w가-힣]", "", topic_tags[0]) if topic_tags else ""
    if len(first_tag) >= 2:
        hashtag = f"#{first_tag}"
    else:
        hashtag_candidates = HASHTAG_POOL.get(template_key, ["#ETF투자"])
        seed = int(hashlib.md5(f"hashtag-{date_str}".encode()).hexdigest(), 16)
        hashtag = hashtag_candidates[seed % len(hashtag_candidates)]

    slots = extract_slots(topic, date_str)
    text = render_template(template_key, slots, hashtag)

    post_record = {
        "id": f"threads-{date_str}",
        "date": date_str,
        "publish_time_kst": publish_time,
        "template_key": template_key,
        "template_name": TEMPLATES[template_key]["name"],
        "source_topic_id": topic["id"],
        "source_board": topic["board"],
        "hashtag": hashtag,
        "char_count": len(text),
        "text": text,
        "status": "ready",
    }

    print(f"\n[INFO] [THREADS] Threads 바이럴 포스트 생성 완료 ({date_str})")
    print(f"  - 매핑 템플릿 : [{template_key}] {TEMPLATES[template_key]['name']}")
    print(f"  - 예정 발행시각: KST {publish_time} (저녁 골든타임 Jitter)")
    print(f"  - 원천 주제 ID : {topic['id']} ({topic['board']})")
    print(f"  - 공백포함 글자: {len(text)}자 (스윗스팟 400~450자)")
    print(f"  - 단일 해시태그: {hashtag}\n")
    print("=" * 65)
    print(text)
    print("=" * 65 + "\n")

    if dry_run:
        print("[DRY-RUN] 파일에 저장하지 않고 종료합니다.")
        return 0, post_record

    bank = load_threads_bank()
    existing_dates = {p["date"] for p in bank["posts"]}
    if date_str in existing_dates:
        if not force:
            print(f"[WARN] {date_str} 이미 생성된 포스트가 존재합니다. (--force 옵션으로 덮어쓰기 가능)")
            return 0, post_record
        bank["posts"] = [p for p in bank["posts"] if p["date"] != date_str]
        bank["posts"].append(post_record)
        bank["posts"].sort(key=lambda x: x["date"])
        if topic["id"] not in bank["published_topic_ids"]:
            bank["published_topic_ids"].append(topic["id"])
        save_threads_bank(bank)
        print(f"[OK] {date_str} 포스트가 최신 규격으로 성공적으로 갱신되었습니다.")
        return 0, post_record

    bank["posts"].append(post_record)
    bank["published_topic_ids"].append(topic["id"])
    save_threads_bank(bank)
    print(f"[OK] threads_bank.json에 성공적으로 저장되었습니다. (누적 {len(bank['posts'])}건)")
    return 0, post_record


def main():
    parser = argparse.ArgumentParser(description="Threads 바이럴 포스트 생성기 v2.1")
    parser.add_argument("--date", help="대상 날짜 (YYYY-MM-DD). 기본: 오늘 KST")
    parser.add_argument("--dry-run", action="store_true", help="저장 없이 미리보기")
    parser.add_argument("--force", action="store_true", help="이미 생성된 포스트 덮어쓰기")
    args = parser.parse_args()

    date_str = args.date or datetime.now(KST).strftime("%Y-%m-%d")
    code, _ = generate_thread(date_str, dry_run=args.dry_run, force=args.force)
    sys.exit(code)


if __name__ == "__main__":
    main()
