#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Threads 바이럴 포스트 자동 생성기

커뮤니티 게시판 topic_bank.json을 기반으로 매일 1개의 Threads 텍스트 포스트를
Hook→Value→CTA 구조로 생성합니다.

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
SCREENER = ROOT / "public" / "data" / "screener.json"

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

# ──────────────────────────────────────────────
# 발행 시각 난수 생성 (골든타임 3구간)
# ──────────────────────────────────────────────
def pick_publish_time(date_str: str) -> str:
    """날짜 기반 시드로 결정론적 난수 시간 생성 (KST)."""
    seed = int(hashlib.md5(f"threads-time-{date_str}".encode()).hexdigest(), 16)
    rng = random.Random(seed)

    slot = rng.choices(
        ["morning", "lunch", "evening"],
        weights=[40, 30, 30],
    )[0]

    ranges = {
        "morning": (7 * 60 + 30, 8 * 60 + 30),   # 07:30 ~ 08:30
        "lunch":   (12 * 60,     13 * 60),          # 12:00 ~ 13:00
        "evening": (20 * 60,     21 * 60),          # 20:00 ~ 21:00
    }
    t_start, t_end = ranges[slot]
    minutes = rng.randint(t_start, t_end)

    return f"{minutes // 60:02d}:{minutes % 60:02d}"


# ──────────────────────────────────────────────
# 포맷 결정 (날짜 기반 순환)
# ──────────────────────────────────────────────
def pick_format(date_str: str) -> str:
    """날짜 기반으로 5개 포맷 유형을 순환 선택."""
    # 기준일(2026-09-18)부터 순환
    base = datetime(2026, 9, 18)
    target = datetime.strptime(date_str, "%Y-%m-%d")
    day_offset = (target - base).days
    return FORMAT_TYPES[day_offset % len(FORMAT_TYPES)]


# ──────────────────────────────────────────────
# 해시태그 선택 (1개만)
# ──────────────────────────────────────────────
def pick_hashtag(board: str, date_str: str) -> str:
    """게시판과 날짜 기반으로 해시태그 1개 선택."""
    pool = HASHTAG_POOL.get(board, ["#ETF투자"])
    seed = int(hashlib.md5(f"hashtag-{date_str}".encode()).hexdigest(), 16)
    return pool[seed % len(pool)]


# ──────────────────────────────────────────────
# 주제 선택 (미발행 중 순서대로)
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
    """threads_bank에서 발행되지 않은 주제 1개를 선택."""
    with open(TOPIC_BANK, encoding="utf-8") as f:
        topics = json.load(f)["topics"]

    threads_bank = load_threads_bank()
    published_ids = set(threads_bank.get("published_topic_ids", []))

    # 게시판 로테이션: 날짜에 따라 순환
    board_order = ["stock-cost-analysis", "strategy-portfolio", "free-qna"]
    base = datetime(2026, 9, 18)
    target = datetime.strptime(date_str, "%Y-%m-%d")
    day_offset = (target - base).days
    target_board = board_order[day_offset % len(board_order)]

    # 대상 게시판에서 미발행 주제 중 첫 번째 선택
    candidates = [
        t for t in topics
        if t["board"] == target_board and t["id"] not in published_ids
    ]

    if not candidates:
        # 대상 게시판 소진 시 다른 게시판에서 선택
        candidates = [
            t for t in topics if t["id"] not in published_ids
        ]

    return candidates[0] if candidates else None


# ──────────────────────────────────────────────
# 포맷별 텍스트 생성
# ──────────────────────────────────────────────
def sanitize_text(text: str) -> str:
    """AGENTS.md 규칙 적용: ~거든 어미 제거, 괄호 정제."""
    # ~거든, ~거든요 → 다른 표현으로 대체
    text = re.sub(r"거든요?\.?", "어요.", text)
    # 괄호 내 부연설명 제거 (테마명)
    text = re.sub(r"\s*\([^)]*\)", "", text)
    return text


DISCLAIMER = "\n\n* 투자 판단의 최종 책임은 투자자 본인에게 있어요."


def format_number_fact(topic: dict, hashtag: str) -> str:
    """포맷 A: 숫자 팩트."""
    title = topic["title"]
    excerpt = topic["excerpt"]
    tags = topic.get("tags", [])

    # Hook: 제목에서 핵심 추출
    hook_raw = title.split(":")[0] if ":" in title else title[:50]
    hook = hook_raw.replace("합니다", "해요") + "."

    # Value: excerpt 변환
    value = (
        f"\n\n{excerpt.replace('합니다', '해요').replace('입니다', '이에요')}"
        "\n\n투자 전 운용사 공시 자료를 통해 최신 수치를 반드시 확인해 보세요."
    )

    # CTA
    cta = f"\n\n다들 {tags[0] if tags else 'ETF'} 관련해서 어떤 기준으로 선택했어?"

    return sanitize_text(f"{hook}{value}{cta}\n\n{hashtag}{DISCLAIMER}")


def format_common_mistake(topic: dict, hashtag: str) -> str:
    """포맷 B: 흔한 실수."""
    title = topic["title"]
    excerpt = topic["excerpt"]
    tags = topic.get("tags", [])

    # Hook: 제목에서 핵심 추출
    hook_raw = title.split(":")[0] if ":" in title else title[:50]
    hook = hook_raw.replace("합니다", "해요") + "."

    # Value: excerpt 변환 (중복 방지)
    body = excerpt.replace("합니다", "해요").replace("입니다", "이에요")
    body += "\n\n투자 전 공시 자료로 반드시 확인해 보세요."

    cta = f"\n\n혹시 {tags[0] if tags else '이런 부분'}에서 실수한 경험이 있어?"

    return sanitize_text(f"{hook}\n\n{body}{cta}\n\n{hashtag}{DISCLAIMER}")


def format_comparison(topic: dict, hashtag: str) -> str:
    """포맷 C: 비교 정리."""
    title = topic["title"]
    excerpt = topic["excerpt"]
    tags = topic.get("tags", [])

    # Hook: 제목 활용
    hook_title = title.split(":")[0] if ":" in title else title[:40]
    hook = f"{hook_title}.\n어떤 차이가 있을까."

    value = (
        f"\n\n{excerpt.replace('합니다', '해요').replace('입니다', '이에요')}"
        "\n\n실부담비용·추적오차·AUM을 함께 비교해 보면 답이 보여요."
    )

    cta = f"\n\n다들 비교할 때 어떤 기준을 가장 중요하게 봐?"

    return sanitize_text(f"{hook}{value}{cta}\n\n{hashtag}{DISCLAIMER}")


def format_checklist(topic: dict, hashtag: str) -> str:
    """포맷 D: 체크리스트."""
    excerpt = topic["excerpt"]
    tags = topic.get("tags", [])

    hook = f"{tags[0] if tags else 'ETF'} 관련 꼭 확인해야 할 포인트."

    value = (
        f"\n\n✅ {excerpt.replace('합니다', '해요').replace('입니다', '이에요')}"
        "\n✅ 운용사 공시 자료에서 최신 수치를 확인해 보세요"
        "\n✅ 계좌 유형별로 적용 방식이 다를 수 있어요"
    )

    cta = f"\n\n마지막으로 {tags[0] if tags else '이 부분'} 확인해 본 게 언제야?"

    return sanitize_text(f"{hook}{value}{cta}\n\n{hashtag}{DISCLAIMER}")


def format_qa_curation(topic: dict, hashtag: str) -> str:
    """포맷 E: Q&A 큐레이션."""
    title = topic["title"]
    excerpt = topic["excerpt"]
    tags = topic.get("tags", [])

    # Hook: 질문 형태
    if "?" in title:
        hook = f'"{title}"'
    else:
        hook = f'"{title}에 대해 궁금해하는 분들이 많아요."'

    value = (
        f"\n\n{excerpt.replace('합니다', '해요').replace('입니다', '이에요')}"
    )

    cta = f"\n\n이 부분에 대해 다들 어떻게 생각해?"

    return sanitize_text(f"{hook}{value}{cta}\n\n{hashtag}{DISCLAIMER}")


# ──────────────────────────────────────────────
# 메인 생성 함수
# ──────────────────────────────────────────────
FORMAT_GENERATORS = {
    "number_fact": format_number_fact,
    "common_mistake": format_common_mistake,
    "comparison": format_comparison,
    "checklist": format_checklist,
    "qa_curation": format_qa_curation,
}


def generate_thread(date_str: str, dry_run: bool = False) -> int:
    """Threads 포스트 1개를 생성합니다."""
    topic = pick_topic(date_str)
    if not topic:
        print("[ERROR] 발행할 주제가 없습니다. topic_bank 보충 필요.")
        return 1

    fmt = pick_format(date_str)
    publish_time = pick_publish_time(date_str)
    hashtag = pick_hashtag(topic["board"], date_str)

    generator = FORMAT_GENERATORS[fmt]
    text = generator(topic, hashtag)

    # 글자 수 검증 (300~500자 권장)
    char_count = len(text)
    if char_count > 500:
        print(f"[WARN] 글자 수 {char_count}자 (권장 500자 이내). 자동 트리밍 적용.")
        # 면책 문구 앞까지 자르고 면책 재삽입
        parts = text.rsplit("* 투자 판단", 1)
        if len(parts) == 2:
            text = parts[0][:480].rstrip() + DISCLAIMER

    post = {
        "id": f"threads-{date_str}",
        "date": date_str,
        "publish_time_kst": publish_time,
        "format_type": fmt,
        "source_topic_id": topic["id"],
        "source_board": topic["board"],
        "hashtag": hashtag,
        "char_count": len(text),
        "text": text,
        "status": "draft",
    }

    print(f"[INFO] 대상 날짜: {date_str}")
    print(f"  포맷      : {fmt}")
    print(f"  발행 시각  : KST {publish_time}")
    print(f"  주제 ID   : {topic['id']} [{topic['board']}]")
    print(f"  해시태그   : {hashtag}")
    print(f"  글자 수    : {len(text)}자")
    print(f"\n{'='*50}")
    print(text)
    print(f"{'='*50}\n")

    if dry_run:
        print("[DRY-RUN] 저장하지 않습니다.")
        return 0

    # threads_bank에 저장
    bank = load_threads_bank()

    # 중복 체크
    existing_dates = {p["date"] for p in bank["posts"]}
    if date_str in existing_dates:
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
    parser = argparse.ArgumentParser(description="Threads 바이럴 포스트 생성기")
    parser.add_argument("--date", help="대상 날짜 (YYYY-MM-DD). 기본: 오늘 KST")
    parser.add_argument("--dry-run", action="store_true", help="저장 없이 미리보기")
    args = parser.parse_args()

    if args.date:
        date_str = args.date
    else:
        date_str = datetime.now(KST).strftime("%Y-%m-%d")

    sys.exit(generate_thread(date_str, dry_run=args.dry_run))


if __name__ == "__main__":
    main()
