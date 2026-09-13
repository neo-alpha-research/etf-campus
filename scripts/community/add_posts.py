#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/community/add_posts.py
--------------------------------
ETF 캠퍼스 커뮤니티 게시판 일일 게시글 자동 생성 CLI.

topic_bank.json에서 미발행 주제 3개(각 게시판 1개)를 선택하여
규칙 기반으로 본문을 채우고 mock-community-posts.json에 추가합니다.

사용법:
  python scripts/community/add_posts.py                    # 오늘 KST 기준
  python scripts/community/add_posts.py --date 2026-09-15  # 날짜 지정
  python scripts/community/add_posts.py --dry-run           # 미리보기 (파일 저장 안 함)
  python scripts/community/add_posts.py --validate          # 생성 후 티커 검증까지 실행

GitHub Actions 자동화 호출:
  python scripts/community/add_posts.py --date $DATE --validate
"""

import io
import json
import re
import sys
import argparse
import hashlib
import subprocess
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Windows PowerShell UTF-8 출력 설정
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).parent.parent.parent
TOPIC_BANK = Path(__file__).parent / "topic_bank.json"
POSTS_FILE = ROOT / "public" / "mock-community-posts.json"
VALIDATE_SCRIPT = Path(__file__).parent / "validate_tickers.py"

KST = timezone(timedelta(hours=9))
BOARDS = ["stock-cost-analysis", "strategy-portfolio", "free-qna"]

# 게시판별 목업 닉네임 풀
AUTHOR_POOL: dict[str, list[str]] = {
    "stock-cost-analysis": ["데이터분석가", "자산배분연구원", "코어위성전략가", "포트폴리오장인"],
    "strategy-portfolio": ["연금마스터", "포트폴리오장인", "자산배분연구원", "절세꿈나무"],
    "free-qna": ["초보적립러", "사회초년생민지", "은퇴준비생", "워킹맘재테크"],
}
COMMENT_AUTHORS = ["연금마스터", "절세꿈나무", "자산배분연구원", "코어위성전략가", "Neo"]

# 게시판별 게시 시각 (UTC) — 각각 KST 08:00, 09:00, 10:00에 해당
BOARD_HOURS_UTC: dict[str, int] = {
    "stock-cost-analysis": 23,  # UTC 23:00 = KST 08:00
    "free-qna": 0,              # UTC 00:00 = KST 09:00
    "strategy-portfolio": 1,    # UTC 01:00 = KST 10:00
}


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
    """각 게시판에서 미발행 주제 1개씩 결정론적으로 선택합니다."""
    seed = int(hashlib.md5(date_str.encode()).hexdigest(), 16)
    selected: list[dict] = []
    for board in BOARDS:
        candidates = [
            t for t in bank["topics"]
            if t["board"] == board and not t.get("published", False)
        ]
        if not candidates:
            print(f"[WARN] {board}: 미발행 주제 소진. topic_bank.json에 주제를 추가하세요.")
            continue
        idx = seed % len(candidates)
        seed = seed // len(candidates) + 1
        selected.append(candidates[idx])
    return selected


def make_slug(title: str, date_str: str) -> str:
    """제목 + 날짜(MMDD) 기반 URL-safe slug 생성"""
    slug = re.sub(r"[^\w\s-]", "", title.lower())
    slug = re.sub(r"\s+", "-", slug.strip())
    slug = re.sub(r"-+", "-", slug)[:60]
    short_date = date_str.replace("-", "")[-4:]  # MMDD
    return f"{slug}-{short_date}"


def make_comment(author: str, body: str, pub_iso: str, offset_minutes: int) -> dict:
    dt = datetime.fromisoformat(pub_iso.replace("Z", "+00:00"))
    ts = (dt + timedelta(minutes=offset_minutes)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    return {
        "publicId": f"c-{hashlib.md5((author + ts).encode()).hexdigest()[:8]}",
        "authorNickname": author,
        "bodyText": body,
        "createdAt": ts,
        "updatedAt": ts,
        "canEdit": False,
    }


def generate_post(topic: dict, date_str: str) -> dict:
    """토픽 딕셔너리에서 게시글 딕셔너리를 생성합니다."""
    board = topic["board"]
    title = topic["title"]
    excerpt = topic["excerpt"]
    tags = topic.get("tags", [])
    verified_tickers = topic.get("verified_tickers", [])

    hour_utc = BOARD_HOURS_UTC.get(board, 0)
    pub_iso = f"{date_str}T{hour_utc:02d}:00:00.000Z"

    seed = int(hashlib.md5((title + date_str).encode()).hexdigest(), 16)
    author_list = AUTHOR_POOL.get(board, ["사용자"])
    author = author_list[seed % len(author_list)]

    ticker_section = ""
    if verified_tickers:
        ticker_section = "\n\n## 주요 분석 종목\n" + "\n".join(
            f"- 종목코드: {t}" for t in verified_tickers
        )

    body = (
        f"## 주제 소개\n{excerpt}"
        f"{ticker_section}\n\n"
        f"## 핵심 분석\n"
        f"{excerpt.replace('합니다.', '에 대해 ETF 캠퍼스 관점에서 분석합니다.')}\n\n"
        f"## 결론\n"
        f"관련 태그: {', '.join(tags)}\n\n"
        f"> 이 글은 ETF 캠퍼스 커뮤니티 학습 자료입니다. "
        f"투자 판단의 최종 책임은 투자자 본인에게 있습니다."
    )

    comment_authors = [a for a in COMMENT_AUTHORS if a != author][:3]
    comments = [
        make_comment(
            comment_authors[i % len(comment_authors)],
            f"{excerpt.split('.')[0]}에 대한 의견을 공유합니다."
            + (" 감사합니다!" if i < 2 else ""),
            pub_iso,
            20 * (i + 1),
        )
        for i in range(3)
    ]

    board_names = {
        "stock-cost-analysis": "종목·비용 분석",
        "strategy-portfolio": "전략·포트폴리오",
        "free-qna": "자유·질문",
    }

    return {
        "slug": make_slug(title, date_str),
        "title": title,
        "excerpt": excerpt,
        "bodyText": body,
        "category": {"slug": board, "name": board_names[board]},
        "authorNickname": author,
        "createdAt": pub_iso,
        "commentCount": len(comments),
        "upvoteCount": seed % 60 + 20,
        "isPinned": False,
        "isAuthorSeed": False,
        "comments": comments,
    }


def run(date_str: str, dry_run: bool = False, validate: bool = False) -> int:
    bank = load_topic_bank()
    topics = pick_topics(bank, date_str)

    if not topics:
        print("[ERROR] 선택된 주제 없음. topic_bank.json 확인 필요.")
        return 1

    new_posts: list[dict] = []
    for topic in topics:
        post = generate_post(topic, date_str)
        new_posts.append(post)
        print(f"  [+] [{topic['board']}] {post['title'][:60]}")

    if dry_run:
        print("\n[DRY-RUN] 파일 저장 안 함.")
        print(f"생성될 게시글 수: {len(new_posts)}")
        return 0

    data = load_posts()
    all_posts = new_posts + data["posts"]
    all_posts.sort(key=lambda x: x["createdAt"], reverse=True)
    data["posts"] = all_posts
    save_posts(data)
    print(f"\n[OK] {len(new_posts)}개 게시글 추가 완료. 총 {len(all_posts)}개.")

    published_ids = {t["id"] for t in topics}
    for t in bank["topics"]:
        if t["id"] in published_ids:
            t["published"] = True
            t["published_date"] = date_str
    save_topic_bank(bank)
    print("[OK] topic_bank.json 발행 마킹 완료.")

    if validate:
        print("\n[INFO] 티커 검증 실행 중...")
        result = subprocess.run(
            [sys.executable, str(VALIDATE_SCRIPT)],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        print(result.stdout)
        if result.returncode == 2:
            print("[WARN] 티커 오류 감지 — 게시글 추가는 완료됐으나 수동 검토가 필요합니다.")
            return 2

    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ETF 캠퍼스 커뮤니티 일일 게시글 생성기")
    parser.add_argument("--date", default=None, help="대상 날짜 YYYY-MM-DD (기본값: 오늘 KST)")
    parser.add_argument("--dry-run", action="store_true", help="파일 저장 없이 미리보기")
    parser.add_argument("--validate", action="store_true", help="생성 후 티커 검증 실행")
    args = parser.parse_args()

    target_date = args.date or datetime.now(KST).strftime("%Y-%m-%d")
    print(f"[INFO] 대상 날짜: {target_date}")
    sys.exit(run(target_date, dry_run=args.dry_run, validate=args.validate))
