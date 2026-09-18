#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Threads 바이럴 포스트 자동 생성기 v2.0

Gemini API 기반 고품질 본문 생성 + 규칙 기반 폴백.
Hook→Value→CTA 3단 구조, 5포맷 로테이션, 요일별 골든타임 난수 발행.

사용법:
  python scripts/threads/generate_thread.py                 # 오늘 KST 기준
  python scripts/threads/generate_thread.py --date 2026-09-18
  python scripts/threads/generate_thread.py --dry-run
"""

import argparse
import hashlib
import json
import random
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# ──────────────────────────────────────────────
# 경로 설정
# ──────────────────────────────────────────────
ROOT = Path(__file__).parent.parent.parent
TOPIC_BANK = ROOT / "scripts" / "community" / "topic_bank.json"
THREADS_BANK = Path(__file__).parent / "threads_bank.json"

KST = timezone(timedelta(hours=9))

# ──────────────────────────────────────────────
# 포맷 유형 (5종 로테이션)
# ──────────────────────────────────────────────
FORMAT_TYPES = ["number_fact", "common_mistake", "comparison", "checklist", "qa_curation"]

# 게시판 → Threads 해시태그 매핑 (1개만 사용)
HASHTAG_POOL = {
    "stock-cost-analysis": [
        "#ETF비용분석", "#ETF실부담비용", "#S&P500ETF", "#ETF비교",
        "#ETF투자", "#ETF수수료", "#ETF선택기준",
    ],
    "strategy-portfolio": [
        "#ETF연금", "#연금저축ETF", "#IRP투자", "#자산배분",
        "#포트폴리오", "#절세투자", "#ETF전략",
    ],
    "free-qna": [
        "#ISA절세", "#연금저축", "#IRP", "#ETF초보",
        "#절세계좌", "#퇴직연금ETF", "#ETF세금",
    ],
}

# CTA 풀 (포맷별 다양화)
CTA_POOL = {
    "number_fact": [
        "이 차이를 알고 있었어, 처음 알았어?",
        "총보수만 봤어, 실부담비용까지 확인했어?",
        "이 숫자 보고 어떤 생각이 들어?",
        "혹시 이거 직접 계산해 본 적 있어?",
        "내 연금 계좌에서도 확인해 봤어?",
    ],
    "common_mistake": [
        "혹시 나도 이런 실수 한 적 있어?",
        "이거 주변에서도 많이 보이지 않아?",
        "이 사실을 알고 나서 뭘 바꿨어?",
        "실수를 알았을 때 어떻게 대처했어?",
        "이런 경험담 있으면 공유해 줘.",
    ],
    "comparison": [
        "비교할 때 어떤 기준을 가장 먼저 봐?",
        "둘 중에 하나 고르라면 뭘 선택해?",
        "실부담비용이 더 중요해, AUM이 더 중요해?",
        "직접 비교해 보고 선택한 경험 있어?",
        "같은 지수인데 뭐가 다른지 알고 있었어?",
    ],
    "checklist": [
        "마지막으로 연금 계좌 확인한 게 언제야?",
        "이 중에 못 지키고 있는 게 있어?",
        "체크리스트 중에 가장 중요한 게 뭐라고 생각해?",
        "이거 분기에 한 번은 하고 있어?",
        "확인해 보니 놓치고 있던 게 있었어?",
    ],
    "qa_curation": [
        "이 질문, 나도 궁금했던 적 있어?",
        "혹시 다른 궁금한 점도 있어?",
        "이 답변으로 해결이 됐어, 더 궁금한 게 있어?",
        "비슷한 상황에서 어떻게 했어?",
        "주변에 이거 모르는 사람 많지 않아?",
    ],
}


# ──────────────────────────────────────────────
# 발행 시각 난수 생성 (요일별 가중치 적용)
# ──────────────────────────────────────────────
def pick_publish_time(date_str: str) -> str:
    """요일별 차등 가중치 적용한 골든타임 난수 생성 (KST)."""
    seed = int(hashlib.md5(f"threads-v2-{date_str}".encode()).hexdigest(), 16)
    rng = random.Random(seed)

    weekday = datetime.strptime(date_str, "%Y-%m-%d").weekday()

    # 요일별 가중치 (월=0 ~ 일=6)
    if weekday in (1, 2, 3):  # 화·수·목 (인게이지먼트 최고)
        weights = [50, 30, 20]  # 오전 집중
    elif weekday == 0:  # 월 (주간 시작)
        weights = [40, 35, 25]
    elif weekday == 4:  # 금
        weights = [30, 40, 30]  # 점심 집중
    else:  # 토·일
        weights = [20, 20, 60]  # 저녁 집중

    slot = rng.choices(["morning", "lunch", "evening"], weights=weights)[0]

    ranges = {
        "morning": (7 * 60 + 30, 8 * 60 + 30),
        "lunch":   (12 * 60,     13 * 60),
        "evening": (20 * 60,     21 * 60),
    }
    t_start, t_end = ranges[slot]
    minutes = rng.randint(t_start, t_end)

    return f"{minutes // 60:02d}:{minutes % 60:02d}"


# ──────────────────────────────────────────────
# 포맷 & 해시태그 & CTA 결정
# ──────────────────────────────────────────────
def pick_format(date_str: str) -> str:
    base = datetime(2026, 9, 18)
    target = datetime.strptime(date_str, "%Y-%m-%d")
    return FORMAT_TYPES[(target - base).days % len(FORMAT_TYPES)]


def pick_hashtag(board: str, date_str: str) -> str:
    pool = HASHTAG_POOL.get(board, ["#ETF투자"])
    seed = int(hashlib.md5(f"hashtag-{date_str}".encode()).hexdigest(), 16)
    return pool[seed % len(pool)]


def pick_cta(format_type: str, date_str: str) -> str:
    pool = CTA_POOL.get(format_type, CTA_POOL["number_fact"])
    seed = int(hashlib.md5(f"cta-{date_str}".encode()).hexdigest(), 16)
    return pool[seed % len(pool)]


# ──────────────────────────────────────────────
# 주제 선택
# ──────────────────────────────────────────────
def load_threads_bank() -> dict:
    if THREADS_BANK.exists():
        with open(THREADS_BANK, encoding="utf-8") as f:
            return json.load(f)
    return {"posts": [], "published_topic_ids": []}


def save_threads_bank(bank: dict) -> None:
    with open(THREADS_BANK, "w", encoding="utf-8") as f:
        json.dump(bank, f, ensure_ascii=False, indent=2)


def pick_topic(date_str: str) -> dict | None:
    with open(TOPIC_BANK, encoding="utf-8") as f:
        topics = json.load(f)["topics"]

    threads_bank = load_threads_bank()
    published_ids = set(threads_bank.get("published_topic_ids", []))

    board_order = ["stock-cost-analysis", "strategy-portfolio", "free-qna"]
    base = datetime(2026, 9, 18)
    target = datetime.strptime(date_str, "%Y-%m-%d")
    target_board = board_order[(target - base).days % len(board_order)]

    candidates = [
        t for t in topics
        if t["board"] == target_board and t["id"] not in published_ids
    ]
    if not candidates:
        candidates = [t for t in topics if t["id"] not in published_ids]

    return candidates[0] if candidates else None


# ──────────────────────────────────────────────
# 규칙 기반 폴백 (Gemini 실패 시)
# ──────────────────────────────────────────────
DISCLAIMER = "\n\n* 투자 판단의 최종 책임은 투자자 본인에게 있어요."


def fallback_generate(topic: dict, format_type: str, hashtag: str, cta: str) -> str:
    """Gemini 실패 시 규칙 기반 폴백 생성."""
    title = topic["title"]
    excerpt = topic["excerpt"]

    # 제목에서 hook 추출
    if ":" in title:
        hook_raw = title.split(":")[0]
    elif "vs" in title:
        parts = title.split("vs")
        hook_raw = f"{parts[0].strip()} vs {parts[1].strip().split()[0]}"
    else:
        hook_raw = title[:40]

    # 문체 변환
    body = excerpt.replace("합니다", "해요").replace("입니다", "이에요")

    # 괄호 정제
    hook_raw = re.sub(r"\s*\([^)]*\)", "", hook_raw)
    body = re.sub(r"\s*\([^)]*\)", "", body)

    # ~거든 교정
    body = re.sub(r"거든요?\.", "어요.", body)

    if format_type == "checklist":
        text = (
            f"{hook_raw}, 꼭 확인해야 할 포인트.\n\n"
            f"✅ {body}\n"
            f"✅ 운용사 공시 자료에서 최신 수치를 확인해 보세요\n"
            f"✅ 계좌 유형별로 적용 방식이 다를 수 있어요\n\n"
            f"{cta}"
        )
    elif format_type == "qa_curation":
        text = (
            f'"{title}"\n← 이거 진짜 많이 물어봐.\n\n'
            f"{body}\n\n"
            f"{cta}"
        )
    elif format_type == "comparison":
        text = (
            f"{hook_raw}.\n같은 지수인데 뭐가 다를까.\n\n"
            f"{body}\n\n"
            f"실부담비용·추적오차·AUM을 함께 비교해 보면 답이 보여요.\n\n"
            f"{cta}"
        )
    else:
        text = f"{hook_raw}.\n\n{body}\n\n{cta}"

    text = text.rstrip() + f"\n\n{hashtag}{DISCLAIMER}"
    return text


# ──────────────────────────────────────────────
# 메인 생성 함수
# ──────────────────────────────────────────────
def generate_thread(date_str: str, dry_run: bool = False) -> int:
    topic = pick_topic(date_str)
    if not topic:
        print("[ERROR] 발행할 주제가 없습니다. topic_bank 보충 필요.")
        return 1

    fmt = pick_format(date_str)
    publish_time = pick_publish_time(date_str)
    hashtag = pick_hashtag(topic["board"], date_str)
    cta = pick_cta(fmt, date_str)

    # Gemini 기반 생성 시도
    text = None
    generation_method = "gemini"
    try:
        from gemini_thread_writer import generate_with_gemini
        text = generate_with_gemini(topic, fmt, hashtag)
    except ImportError:
        print("[WARN] gemini_thread_writer 모듈 로드 실패.")
    except Exception as e:
        print(f"[WARN] Gemini 생성 실패: {e}")

    # 폴백
    if not text:
        generation_method = "fallback"
        print("[INFO] 규칙 기반 폴백으로 생성합니다.")
        text = fallback_generate(topic, fmt, hashtag, cta)

    char_count = len(text)

    post = {
        "id": f"threads-{date_str}",
        "date": date_str,
        "publish_time_kst": publish_time,
        "format_type": fmt,
        "source_topic_id": topic["id"],
        "source_board": topic["board"],
        "hashtag": hashtag,
        "char_count": char_count,
        "generation_method": generation_method,
        "text": text,
        "status": "draft",
    }

    weekday_names = ["월", "화", "수", "목", "금", "토", "일"]
    wd = datetime.strptime(date_str, "%Y-%m-%d").weekday()

    print(f"[INFO] 대상 날짜 : {date_str} ({weekday_names[wd]})")
    print(f"  포맷       : {fmt}")
    print(f"  발행 시각   : KST {publish_time}")
    print(f"  주제 ID    : {topic['id']} [{topic['board']}]")
    print(f"  해시태그    : {hashtag}")
    print(f"  글자 수     : {char_count}자")
    print(f"  생성 방식   : {generation_method}")
    print(f"\n{'='*50}")
    print(text)
    print(f"{'='*50}\n")

    if dry_run:
        print("[DRY-RUN] 저장하지 않습니다.")
        return 0

    bank = load_threads_bank()
    if date_str in {p["date"] for p in bank["posts"]}:
        print(f"[WARN] {date_str}에 이미 포스트가 존재합니다. 건너뜁니다.")
        return 0

    bank["posts"].append(post)
    bank["published_topic_ids"].append(topic["id"])
    save_threads_bank(bank)

    print(f"[OK] threads_bank.json에 저장 완료. 총 {len(bank['posts'])}개 포스트.")
    return 0


# ──────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Threads 바이럴 포스트 생성기 v2.0")
    parser.add_argument("--date", help="대상 날짜 (YYYY-MM-DD). 기본: 오늘 KST")
    parser.add_argument("--dry-run", action="store_true", help="저장 없이 미리보기")
    args = parser.parse_args()

    date_str = args.date or datetime.now(KST).strftime("%Y-%m-%d")
    sys.exit(generate_thread(date_str, dry_run=args.dry_run))


if __name__ == "__main__":
    main()
