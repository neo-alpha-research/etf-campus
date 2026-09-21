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

# 게시판별 게시 시각 (UTC) — 각각 KST 09:00, 10:00, 11:00에 해당 (당일 KST/UTC 일치)
BOARD_HOURS_UTC: dict[str, int] = {
    "free-qna": 0,              # UTC 00:00 = KST 09:00
    "strategy-portfolio": 1,    # UTC 01:00 = KST 10:00
    "stock-cost-analysis": 2,   # UTC 02:00 = KST 11:00
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
        ticker_section = "\n\n**분석 종목:** " + " · ".join(
            f"`{t}`" for t in verified_tickers
        )

    disclaimer = (
        "\n\n---\n"
        "> ⚠️ 본 자료는 투자 판단을 돕기 위한 정보 제공용이며, "
        "특정 종목의 매수·매도를 권유하지 않습니다."
    )

    if board == "free-qna":
        # Q&A 형식: 질문 → 핵심 답변 → 상세 설명 → 관련 팁
        body = (
            f"## 질문\n"
            f"{excerpt.split('.')[0]}에 대해 궁금한 점이 있어서 질문드립니다."
            f"{ticker_section}\n\n"
            f"## 핵심 답변\n"
            f"{excerpt}\n\n"
            f"## 상세 설명\n"
            f"ETF 캠퍼스에서는 이 주제를 다음과 같이 이해하고 있습니다:\n\n"
            f"1. **기본 개념**: {excerpt.split('。')[0].split('.')[0]}.\n"
            f"2. **계좌별 차이**: 일반 계좌, ISA, 연금저축, IRP에 따라 적용 방식이 다릅니다.\n"
            f"3. **실전 주의사항**: 투자 전 증권사 공시 자료 및 최신 세법을 반드시 확인하세요.\n\n"
            f"## 관련 태그\n"
            f"{' '.join(f'`#{tag}`' for tag in tags)}"
            f"{disclaimer}"
        )
    elif board == "strategy-portfolio":
        # 전략 형식: 상황 설명 → 전략 제안 → 실행 방법 → 주의사항
        body = (
            f"## 상황 설명\n"
            f"{excerpt}"
            f"{ticker_section}\n\n"
            f"## 전략 제안\n"
            f"ETF 캠퍼스 관점에서 이 전략을 분석합니다:\n\n"
            f"**핵심 원칙**\n"
            f"- 장기 투자와 절세 계좌(IRP·연금저축·ISA) 활용을 우선합니다.\n"
            f"- 리밸런싱 주기는 연 1회 또는 ±5% 임계값 방식을 권장합니다.\n"
            f"- 비용(총보수+기타비용)이 낮은 ETF를 핵심으로 구성합니다.\n\n"
            f"**실행 단계**\n"
            f"1. 목표 자산배분 비율 설정\n"
            f"2. 계좌별(절세/일반) 최적 ETF 배치\n"
            f"3. 정기 적립 자동화 설정\n"
            f"4. 연 1회 비중 점검 및 리밸런싱\n\n"
            f"## 관련 태그\n"
            f"{' '.join(f'`#{tag}`' for tag in tags)}"
            f"{disclaimer}"
        )
    else:
        # stock-cost-analysis: 비용·데이터 분석 형식
        body = (
            f"## 분석 개요\n"
            f"{excerpt}"
            f"{ticker_section}\n\n"
            f"## 핵심 비교 포인트\n\n"
            f"| 항목 | 확인 기준 | 비고 |\n"
            f"|------|-----------|------|\n"
            f"| 총보수(TER) | 운용사 공시 기준 | 낮을수록 유리 |\n"
            f"| 실부담비용 | 총보수+기타비용+매매중개수수료 | 실제 비용 기준 |\n"
            f"| 추적오차(TE) | 벤치마크 대비 수익률 차이 | 낮을수록 우수 |\n"
            f"| AUM | 순자산 총액 | 클수록 유동성 유리 |\n\n"
            f"## ETF 캠퍼스 분석\n"
            f"{excerpt} "
            f"투자 전 운용사 공시 자료(금융투자협회 전자공시시스템)를 통해 최신 데이터를 반드시 확인하시기 바랍니다.\n\n"
            f"## 관련 태그\n"
            f"{' '.join(f'`#{tag}`' for tag in tags)}"
            f"{disclaimer}"
        )

    # 게시판·주제에 맞는 댓글 생성
    comment_templates = {
        "free-qna": [
            f"저도 같은 궁금증이 있었는데 잘 정리된 것 같아요. 감사합니다!",
            f"추가로 {tags[0] if tags else '관련'} 부분도 궁금한데 혹시 아시나요?",
            f"좋은 정보 감사합니다. 저도 비슷한 고민을 하고 있었어요.",
        ],
        "strategy-portfolio": [
            f"실용적인 전략이네요. 저도 비슷하게 운용 중인데 참고가 됩니다.",
            f"{tags[0] if tags else '이 전략'} 관련해서 좋은 글이에요. 리밸런싱 주기도 공유해 주시면 좋겠어요.",
            f"포트폴리오 구성 방법이 구체적이어서 도움이 많이 됐습니다.",
        ],
        "stock-cost-analysis": [
            f"비용 비교 잘 정리해 주셨어요. 실부담비용 기준으로 봐야 한다는 점 공감합니다.",
            f"추적오차까지 고려해야 한다는 걸 몰랐는데 배웠습니다.",
            (
                "제도적 차이점과 거래 시 유의사항을 명확히 짚어주셔서 많은 도움이 되었습니다."
                if any(k in (tags + [title]) for k in ["레버리지", "인버스", "편입 불가", "금지"])
                else f"{tags[0] if tags else 'ETF'} 분석 감사합니다. 핵심 데이터와 비용 구조 비교가 유익하네요."
            ),
        ],
    }
    templates = comment_templates.get(board, comment_templates["free-qna"])
    comment_authors = [a for a in COMMENT_AUTHORS if a != author][:3]
    comments = [
        make_comment(
            comment_authors[i % len(comment_authors)],
            templates[i % len(templates)],
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

    # ── 중복 게시 방지: 해당 날짜 게시글이 이미 있으면 스킵 ──
    data = load_posts()
    already_posted_boards = {
        p["category"]["slug"]
        for p in data["posts"]
        if p["createdAt"].startswith(date_str)
    }
    topics = [t for t in topics if t["board"] not in already_posted_boards]

    if already_posted_boards:
        print(f"[WARN] {date_str} 이미 게시된 게시판: {', '.join(sorted(already_posted_boards))}")
    if not topics:
        print(f"[INFO] {date_str}의 모든 게시판에 이미 게시글이 있습니다. 중복 생성 건너뜁니다.")
        return 0

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
