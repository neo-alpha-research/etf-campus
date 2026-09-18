#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gemini 기반 Threads 바이럴 포스트 생성 엔진

AGENTS.md Gemini API 표준 아키텍처 준수:
- 7대 마스터 토큰 풀 로드밸런싱
- 5계층 모델 워터폴 (gemini-3.8-flash → gemini-2.5-flash)
- Graceful Fallback: 모든 토큰/모델 실패 시 규칙 기반 폴백
"""

import json
import os
import re
import sys
import urllib.request
import urllib.error
from typing import Optional

# ──────────────────────────────────────────────
# 모델 워터폴 & 토큰 풀 (AGENTS.md SSOT)
# ──────────────────────────────────────────────
MODEL_WATERFALL = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-flash-latest",
    "gemini-2.5-flash",
]

def get_gemini_tokens() -> list[str]:
    """환경변수에서 Gemini API 토큰 풀을 수집."""
    tokens = []
    for key in ["GEMINI_API_KEY", "GEMINI_TOKENS"]:
        raw = os.environ.get(key, "")
        for part in raw.split(","):
            part = part.strip()
            if part and part not in tokens:
                tokens.append(part)
    return tokens


# ──────────────────────────────────────────────
# 포맷별 프롬프트 시스템
# ──────────────────────────────────────────────
SYSTEM_INSTRUCTION = """당신은 팔로워 30만 명을 보유한 한국 ETF 투자 교육 Threads 크리에이터입니다.
국내 상장 ETF, 연금저축, IRP, ISA, DC 퇴직연금 등에 대한 깊은 전문 지식을 바탕으로
투자자들이 "아, 이거 몰랐네!"라고 반응할 만한 실용적인 정보를 친근하게 전달합니다.

당신의 글은 항상 아래 구조를 따릅니다:
1. Hook (첫 1~2줄): 의외성 있는 숫자나 반전 팩트로 시작. 10단어 이내. 스크롤을 멈추게 한다.
2. Value (3~5줄): "아, 이거 몰랐네" 반응을 유발하는 인사이트. 문제→원인→해결 서사.
3. CTA (마지막 1~2줄): 양자택일 또는 경험 공유형 질문 1개.

절대 지켜야 할 규칙:
- 문체: 서두는 반말, 본문은 해요체 혼용 (친근하면서 전문적)
- "~거든", "~했거든" 어미 절대 사용 금지
- 괄호() 남발 금지. 꼭 필요한 종목코드만 허용
- 번호 선택지(1번/2번), 투표 유도 문구 절대 금지
- "어제", "오늘" 등 상대적 시간 표현 금지
- 종목 매수·매도 권유, 수익률 보장, 목표가 제시 절대 금지
- 글자 수: 300~500자
- 1~2줄 단위로 줄 바꿈 (모바일 가독성 최적화)
"""

FORMAT_PROMPTS = {
    "number_fact": """[포맷: 숫자 팩트]
Hook: 충격적이거나 의외인 숫자로 시작해. "~라고 적혀 있어도, 실제로는 ~야" 패턴 추천.
Value: 왜 그런 차이가 발생하는지 원인을 설명하고, 투자자가 몰랐던 메커니즘을 알려줘.
CTA: "~했어, ~했어?" 양자택일 질문.""",

    "common_mistake": """[포맷: 흔한 실수]
Hook: 많은 사람이 하는 실수를 지적하며 시작해. "~하면 ~만큼 손해야" 패턴 추천.
Value: 왜 그게 실수인지 이유를 설명하고, 올바른 대안을 제시해줘.
CTA: "혹시 ~한 적 있어?" 경험 공유형 질문.""",

    "comparison": """[포맷: 비교 정리]
Hook: 두 상품을 대비시키며 시작해. "같은 ~인데 왜 ~가 다를까" 패턴 추천.
Value: 핵심 차이점 2~3가지를 간결하게 정리해줘. 불렛 포인트 사용 가능.
CTA: 비교 기준에 대한 의견을 묻는 질문.""",

    "checklist": """[포맷: 체크리스트]
Hook: "N분이면 끝나는 ~" 또는 "이것만 확인하면 ~" 패턴으로 시작해.
Value: ✅ 이모지로 체크리스트 3가지를 나열해줘. 각 항목은 1줄 이내.
CTA: "마지막으로 ~확인한 게 언제야?" 질문.""",

    "qa_curation": """[포맷: Q&A 큐레이션]
Hook: 실제 투자자 질문을 큰따옴표로 인용하며 시작해. 뒤에 "← 맞아." 또는 "← 이거 진짜 많이 물어봐." 덧붙여.
Value: 질문에 대한 명쾌한 답변을 2~3줄로 제공해줘.
CTA: 관련 경험이나 추가 궁금증을 묻는 질문.""",
}


def build_prompt(topic: dict, format_type: str, hashtag: str) -> str:
    """포맷별 Gemini 프롬프트를 구성."""
    format_guide = FORMAT_PROMPTS.get(format_type, FORMAT_PROMPTS["number_fact"])

    tickers_info = ""
    if topic.get("verified_tickers"):
        tickers_info = f"\n[검증된 종목코드] {', '.join(topic['verified_tickers'])}"

    return f"""{format_guide}

[주제] {topic['title']}
[핵심 정보] {topic['excerpt']}
[태그] {', '.join(topic.get('tags', []))}
{tickers_info}

반드시 포함:
- 해시태그: {hashtag} (본문 마지막에 1개만)
- 면책: * 투자 판단의 최종 책임은 투자자 본인에게 있어요.

위 내용을 바탕으로 Threads 포스트 본문만 작성해줘. 다른 설명 없이 포스트 텍스트만 출력해."""


# ──────────────────────────────────────────────
# Gemini API 호출 (워터폴)
# ──────────────────────────────────────────────
def call_gemini(prompt: str) -> Optional[str]:
    """7대 토큰 풀 × 5계층 모델 워터폴로 Gemini API를 호출."""
    tokens = get_gemini_tokens()
    if not tokens:
        print("[WARN] Gemini API 토큰 없음. 폴백으로 전환.")
        return None

    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "systemInstruction": {"parts": [{"text": SYSTEM_INSTRUCTION}]},
        "generationConfig": {
            "temperature": 0.8,
            "maxOutputTokens": 1024,
        },
    }).encode("utf-8")

    for token in tokens:
        for model in MODEL_WATERFALL:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={token}"
            req = urllib.request.Request(
                url,
                data=body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    result = json.loads(resp.read().decode("utf-8"))
                    text = result["candidates"][0]["content"]["parts"][0]["text"]
                    print(f"[OK] Gemini 응답 (model={model}, token=#{tokens.index(token)+1})")
                    return text.strip()
            except urllib.error.HTTPError as e:
                status = e.code
                if status == 429:
                    print(f"[WARN] Token #{tokens.index(token)+1} rate limited. 다음 토큰 시도.")
                    break  # 다음 토큰으로
                elif status in (503, 500, 504):
                    print(f"[WARN] {model} 일시 장애 ({status}). 다음 모델 시도.")
                    continue  # 다음 모델로
                elif status == 403:
                    print(f"[WARN] Token #{tokens.index(token)+1} 인증 오류. 다음 토큰 시도.")
                    break
                else:
                    print(f"[WARN] Gemini HTTP {status}. 다음 모델 시도.")
                    continue
            except Exception as e:
                print(f"[WARN] Gemini 호출 실패: {e}. 다음 시도.")
                continue

    print("[WARN] 모든 Gemini 토큰/모델 소진. 폴백으로 전환.")
    return None


# ──────────────────────────────────────────────
# 품질 가드
# ──────────────────────────────────────────────
BANNED_PATTERNS = [
    r"거든[요.]",           # ~거든 어미
    r"1번|2번|3번",          # 번호 선택지
    r"댓글에.*남겨",         # 투표 유도
    r"매수.*권유|매도.*권유", # 종목 추천
    r"수익률.*보장",         # 수익률 보장
    r"목표가",              # 목표가
    r"오늘|어제",            # 상대적 시간
]

DISCLAIMER = "\n\n* 투자 판단의 최종 책임은 투자자 본인에게 있어요."


def quality_guard(text: str, hashtag: str) -> tuple[bool, str, list[str]]:
    """품질 검증. (통과여부, 정제된 텍스트, 위반 목록) 반환."""
    violations = []

    for pattern in BANNED_PATTERNS:
        if re.search(pattern, text):
            violations.append(f"금지 패턴 발견: {pattern}")

    # 괄호 정제 (종목코드 괄호는 허용)
    text = re.sub(r"\s*\((?!\d{6}\))[^)]*\)", "", text)

    # 면책 문구 보장
    if "투자 판단의 최종 책임" not in text:
        text = text.rstrip() + DISCLAIMER

    # 해시태그 보장 (1개만)
    existing_tags = re.findall(r"#\S+", text)
    if len(existing_tags) > 1:
        # 첫 번째만 남기고 제거
        for tag in existing_tags[1:]:
            text = text.replace(tag, "")
        violations.append(f"해시태그 {len(existing_tags)}개 → 1개로 정제")
    if not existing_tags:
        # 면책 앞에 삽입
        text = text.replace(DISCLAIMER, f"\n\n{hashtag}{DISCLAIMER}")

    # 글자 수 검증
    char_count = len(text)
    if char_count > 500:
        parts = text.rsplit("* 투자 판단", 1)
        if len(parts) == 2:
            text = parts[0][:480].rstrip() + DISCLAIMER
        violations.append(f"글자수 {char_count} → 500자 이내로 트리밍")

    # ~거든 자동 교정
    text = re.sub(r"거든요?\.", "어요.", text)
    text = re.sub(r"거든요? ", "어요 ", text)

    passed = len([v for v in violations if "금지 패턴" in v]) == 0
    return passed, text.strip(), violations


def generate_with_gemini(topic: dict, format_type: str, hashtag: str) -> Optional[str]:
    """Gemini로 포스트를 생성하고 품질 검증."""
    prompt = build_prompt(topic, format_type, hashtag)
    raw_text = call_gemini(prompt)

    if not raw_text:
        return None

    passed, cleaned, violations = quality_guard(raw_text, hashtag)

    if violations:
        print(f"[INFO] 품질 가드 결과: {violations}")

    if not passed:
        print("[WARN] 품질 가드 미통과. 1회 재생성 시도.")
        raw_text_retry = call_gemini(prompt + "\n\n이전 생성에서 금지 패턴이 발견되었습니다. 규칙을 더 엄격히 지켜주세요.")
        if raw_text_retry:
            passed2, cleaned2, violations2 = quality_guard(raw_text_retry, hashtag)
            if passed2 or len(violations2) <= len(violations):
                return cleaned2

    return cleaned
