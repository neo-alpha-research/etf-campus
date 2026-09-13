#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/community/add_posts.py
--------------------------------
ETF 캠퍼스 커뮤니티 게시판 일일 게시글 자동 생성 CLI.

topic_bank.json에서 미발행 주제 3개(각 게시판 1개)를 선택하여
AI 없이 규칙 기반으로 본문을 채우고 mock-community-posts.json에 추가합니다.

사용법:
  python scripts/community/add_posts.py                    # 오늘 KST 기준
  python scripts/community/add_posts.py --date 2026-09-15 # 날짜 지정
  python scripts/community/add_posts.py --dry-run          # 미리보기 (파일 저장 안 함)
  python scripts/community/add_posts.py --validate         # 생성 후 티커 검증까지 실행

GitHub Actions 자동화 호출:
  python scripts/community/add_posts.py --date $DATE --validate
"""

import json
import sys
import argparse
import hashlib
import subprocess
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).parent.parent.parent
TOPIC_BANK = Path(__file__).parent / "topic_bank.json"
POSTS_FILE = ROOT / "public" / "mock-community-posts.json"
VALIDATE_SCRIPT = Path(__file__).parent / "validate_tickers.py"

KST = timezone(timedelta(hours=9))
BOARDS = ["stock-cost-analysis", "strategy-portfolio", "free-qna"]

# 게시판별 목업 닉네임 풀
AUTHOR_POOL = {
    "stock-cost-analysis": ["데이터분석가", "자산배분연구원", "코어위성전략가", "포트폴리오장인"],
    "strategy-portfolio": ["연금마스터", "포트폴리오장인", "자산배분연구원", "절세꿈나무"],
    "free-qna": ["초보적립러", "사회초년생민지", "은퇴준비생", "워킹맘재테크"],
}
COMMENT_AUTHORS = ["연금마스터", "절세꿈나무", "자산배분연구원", "코어위성전략가", "Neo"]


def load_topic_bank() -> dict:
    with open(TOPIC_BANK, encoding="utf-8") as f:
        return json.load(f)


def save_topic_bank(bank: dict) -> None:
    with open(TOPIC_BANK, "w", encoding="utf-8") as f:
        json.dump(bank, f, ensure_ascii=False, indent=2)


def load_posts() -> dict:
    with open(POSTS_FILE, encoding="utf-8") as f:
        return json.load(f)


def save_posts(data: dict) -> None:
    with open(POSTS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def pick_topics(bank: dict, date_str: str) -> list[dict]:
    """각 게시판에서 미발행 주제 1개씩 선택 (날짜를 시드로 결정론적 선택)"""
    seed = int(hashlib.md5(date_str.encode()).hexdigest(), 16)
    selected = []
    for board in BOARDS:
        candidates = [
            t for t in bank["topics"]
            if t["board"] == board and not t.get("published", False)
        ]
        if not candidates:
            print(f"⚠  {board}: 미발행 주제 소진. topic_bank.json에 주제를 추가하세요.")
            continue
        idx = seed % len(candidates)
        seed = seed // len(candidates) + 1
        selected.append(candidates[idx])
    return selected


def make_slug(title: str, board: str, date_str: str) -> str:
    """제목 기반 slug 생성"""
    import re
    # 영어·숫자·일부 한글 기반 slug
    slug = re.sub(r"[^\w\s-]", "", title.lower())
    slug = re.sub(r"\s+", "-", slug.strip())
    slug = re.sub(r"-+", "-", slug)[:60]
    short_date = date_str.replace("-", "")[-4:]  # MMDD
    return f"{slug}-{short_date}"


def make_comment(author: str, body: str, pub_date: str, offset_minutes: int) -> dict:
    dt = datetime.fromisoformat(pub_date.replace("Z", "+00:00"))
    comment_dt = dt + timedelta(minutes=offset_minutes)
    ts = comment_dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    return {
        "publicId": f"c-{hashlib.md5((author + ts).encode()).hexdigest()[:8]}",
        "authorNickname": author,
        "bodyText": body,
        "createdAt": ts,
        "updatedAt": ts,
        "canEdit": False,
    }


def generate_post(topic: dict, date_str: str, board_hour: int) -> dict:
    """토픽에서 게시글 딕셔너리 생성"""
    board = topic["board"]
    title = topic["title"]
    excerpt = topic["excerpt"]
    tags = topic.get("tags", [])
    verified_tickers = topic.get("verified_tickers", [])

    # 날짜+시간 설정 (게시판별 다른 시간)
    pub_iso = f"{date_str}T{board_hour:02d}:00:00.000Z"

    # 닉네임 결정론적 선택
    seed = int(hashlib.md5((title + date_str).encode()).hexdigest(), 16)
    author_list = AUTHOR_POOL.get(board, ["사용자"])
    author = author_list[seed % len(author_list)]

    # 본문 — topic_bank의 excerpt를 기반으로 마크다운 구조 생성
    ticker_section = ""
    if verified_tickers:
        ticker_section = "\n\n## 주요 분석 종목\n" + "\n".join(
            f"- 종목코드: {t}" for t in verified_tickers
        )

    body = (
        f"## 주제 소개\n{excerpt}"
        f"{ticker_section}\n\n"
        f"## 핵심 분석\n{excerpt.replace('합니다.', '에 대해 ETF 캠퍼스 관점에서 분석합니다.')}\n\n"
        f"## 결론\n"
        f"관련 태그: {', '.join(tags)}\n\n"
        f"> 이 글은 ETF 캠퍼스 커뮤니티 학습 자료입니다. 투자 판단의 최종 책임은 투자자 본인에게 있습니다."
    )

    # 댓글 3개 자동 생성
    comment_authors = [a for a in COMMENT_AUTHORS if a != author][:3]
    comments = [
        make_comment(
            comment_authors[i % len(comment_authors)],
            f"{excerpt.split('.')[0]}에 대한 의견을 공유합니다. {'감사합니다!' if i < 2 else ''}",
            pub_iso,
            20 * (i + 1),
        )
        for i in range(3)
    ]

    slug = make_slug(title, board, date_str)

    return {
        "slug": slug,
        "title": title,
        "excerpt": excerpt,
        "bodyText": body,
        "category": {
            "slug": board,
            "name": {"stock-cost-analysis": "종목·비용 분석",
                      "strategy-portfolio": "전략·포트폴리오",
                      "free-qna": "자유·질문"}[board],
        },
        "authorNickname": author,
        "createdAt": pub_iso,
        "commentCount": len(comments),
        "upvoteCount": seed % 60 + 20,  # 20~79 사이 결정론적 값
        "isPinned": False,
        "isAuthorSeed": False,
        "comments": comments,
    }


def run(date_str: str, dry_run: bool = False, validate: bool = False) -> int:
    bank = load_topic_bank()
    topics = pick_topics(bank, date_str)

    if not topics:
        print("❌ 선택된 주제 없음. topic_bank.json 확인 필요.")
        return 1

    # 게시판별 시간 배정
    board_hours = {
        "stock-cost-analysis": 23,   # UTC 23:00 = KST 08:00
        "strategy-portfolio": 1,     # UTC 01:00 = KST 10:00
        "free-qna": 0,               # UTC 00:00 = KST 09:00
    }

    new_posts = []
    for topic in topics:
        hour = board_hours.get(topic["board"], 0)
        post = generate_post(topic, date_str, hour)
        new_posts.append(post)
        print(f"  📝 [{topic['board']}] {post['title'][:60]}")

    if dry_run:
        print("\n--- DRY RUN: 파일 저장 안 함 ---")
        print(f"생성될 게시글 수: {len(new_posts)}")
        return 0

    # 파일 저장
    data = load_posts()
    all_posts = new_posts + data["posts"]
    all_posts.sort(key=lambda x: x["createdAt"], reverse=True)
    data["posts"] = all_posts
    save_posts(data)
    print(f"\n✅ {len(new_posts)}개 게시글 추가 완료. 총 {len(all_posts)}개.")

    # topic_bank 발행 마킹
    published_ids = {t["id"] for t in topics}
    for t in bank["topics"]:
        if t["id"] in published_ids:
            t["published"] = True
            t["published_date"] = date_str
    save_topic_bank(bank)
    print("✅ topic_bank.json 발행 마킹 완료.")

    # 선택적 검증
    if validate:
        print("\n🔍 티커 검증 실행 중...")
        result = subprocess.run(
            [sys.executable, str(VALIDATE_SCRIPT)],
            capture_output=True, text=True
        )
        print(result.stdout)
        if result.returncode == 2:
            print("❌ 티커 오류 감지. 게시글 추가는 완료됐으나 수동 검토가 필요합니다.")
            return 2

    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ETF 캠퍼스 커뮤니티 일일 게시글 생성기")
    parser.add_argument(
        "--date",
        default=None,
        help="대상 날짜 (YYYY-MM-DD). 기본값: 오늘 KST",
    )
    parser.add_argument("--dry-run", action="store_true", help="파일 저장 없이 미리보기")
    parser.add_argument("--validate", action="store_true", help="생성 후 티커 검증 실행")
    args = parser.parse_args()

    if args.date:
        target_date = args.date
    else:
        target_date = datetime.now(KST).strftime("%Y-%m-%d")

    print(f"🗓  대상 날짜: {target_date}")
    sys.exit(run(target_date, dry_run=args.dry_run, validate=args.validate))
