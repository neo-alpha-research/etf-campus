#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unit tests for Threads Viral Engine (generate_thread.py v2.3)
Ensures:
1. All 8 killer templates are functional and routable from topic_bank.json
2. Zero '추천' or '포트폴리오 추천' (Compliance with Capital Markets Act §101)
3. Zero-Hallucination: Required KRX/KOFIA provenance and disclaimer footer
4. Mobile 4-Beat length constraints (300 ~ 650 chars)
5. 0-Turn Constitution Enforcement (Eliminating forbidden words, typos, and ensuring White Space)
6. Financial Anomaly Detection (Detecting distribution reserve divergence)
7. 4-Step Golden Bundle First Comment generation for all templates
"""

import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "threads"))

from generate_thread import (
    TEMPLATES,
    route_template,
    extract_slots,
    render_template,
    render_first_comment,
    enforce_thread_constitution,
    generate_thread,
)


class TestThreadsViralEngine(unittest.TestCase):

    def setUp(self):
        topic_bank_path = ROOT / "scripts" / "community" / "topic_bank.json"
        with open(topic_bank_path, encoding="utf-8") as f:
            self.topics = json.load(f)["topics"]

    def test_eight_templates_defined(self):
        """8대 킬러 템플릿이 정의되어 있는지 검증."""
        self.assertEqual(len(TEMPLATES), 8)
        expected_keys = {
            "cost_bust", "tax_escape", "rival_match", "life_stage",
            "dividend_trap", "product_mechanics", "investor_mindset", "quick_qna"
        }
        self.assertEqual(set(TEMPLATES.keys()), expected_keys)

    def test_routing_coverage(self):
        """180개 주제가 8개 템플릿 전부에 골고루 분산되는지 검증."""
        routed = set(route_template(t) for t in self.topics)
        self.assertEqual(routed, set(TEMPLATES.keys()), "모든 8대 템플릿에 최소 1개 이상의 주제가 매핑되어야 합니다.")

    def test_constitution_enforcement(self):
        """0턴 자율 교정기가 금기어, 비문, 소괄호, 공백 리듬을 완벽히 교정하는지 검증."""
        raw_sample = """다들은 압력이 쏟아졌거든. (원유·천연가스)
포트폴리오 추천을 해줄게.
국내 상장 ETF 실부담비용은 프로필 링크 [ETF 캠퍼스]에서 확인해봐."""

        cleaned = enforce_thread_constitution(raw_sample)

        # 1. 비문 정제
        self.assertNotIn("다들은", cleaned)
        self.assertIn("다들", cleaned)

        # 2. 금기 어미 치환
        self.assertNotIn("쏟아졌거든", cleaned)
        self.assertIn("쏟아졌지", cleaned)

        # 3. 자본시장법 §101 컴플라이언스
        self.assertNotIn("포트폴리오 추천", cleaned)

        # 4. 소괄호 제거 (단 (KRX)는 보존)
        self.assertNotIn("(원유·천연가스)", cleaned)

        # 5. 프로필 링크 CTA 라인 직전 빈 줄(\\n\\n) 보장
        self.assertTrue(bool(re.search(r"\n\n[^\n]*프로필 링크 \[ETF 캠퍼스\]", cleaned)))

    def test_rival_match_fact_binding(self):
        """라이벌 맞대결에서 1화(sca-001 S&P500) 고유 공시와 타 종목 범용 서사가 데이터 레벨에서 완벽히 격리되는지 검증."""
        # 1. 1화 (sca-001 KODEX vs TIGER S&P500): 유보금 공시 팩트 바인딩
        slots_sp500 = {
            "topic_id": "sca-001",
            "r4_winner": "KODEX",
            "target_index": "S&P500",
            "etf_a_name": "KODEX 미국S&P500",
            "etf_b_name": "TIGER 미국S&P500",
            "r1_line": "", "r1_verdict": "", "r2_line": "", "r2_verdict": "",
            "r3_line": "", "r4_line": "", "r4_verdict": "", "r1_winner": "TIGER",
            "footer_provenance": "",
        }
        text_sp500 = render_template("rival_match", slots_sp500, "#SP500")
        comment_sp500 = render_first_comment("rival_match", slots_sp500)
        self.assertIn("2029년 1월까지 유효한 공시 내막", text_sp500)
        self.assertIn("유보금", comment_sp500)
        self.assertIn("2029년 1월", comment_sp500)

        # 2. 타 라이벌 종목 (나스닥100, 배당다우존스 등): 범용 장기 복리/기타비용 첫 댓글 바인딩 (S&P500 유보금 문구 배제)
        slots_nasdaq = {
            "topic_id": "sca-002",
            "r4_winner": "KODEX",
            "target_index": "나스닥100",
            "etf_a_name": "TIGER 미국나스닥100",
            "etf_b_name": "KODEX 미국나스닥100",
            "r1_line": "", "r1_verdict": "", "r2_line": "", "r2_verdict": "",
            "r3_line": "", "r4_line": "", "r4_verdict": "", "r1_winner": "TIGER",
            "footer_provenance": "",
        }
        text_nasdaq = render_template("rival_match", slots_nasdaq, "#나스닥100")
        comment_nasdaq = render_first_comment("rival_match", slots_nasdaq)
        self.assertNotIn("2029년 1월", text_nasdaq)
        self.assertNotIn("유보금", comment_nasdaq)
        self.assertNotIn("2029년 1월", comment_nasdaq)
        self.assertNotIn("세법 개정", comment_nasdaq)
        self.assertIn("숨은 기타비용", comment_nasdaq)

    def test_first_comment_bundle_all_templates(self):
        """8대 전 템플릿에서 4-Step 첫 댓글이 정상 생성되고 필수 요소를 갖추었는지 검증."""
        sample_slots = {
            "r4_winner": "KODEX",
            "target_index": "S&P500",
            "anomaly": {"type": "KODEX_SP500_RESERVE_DIVIDEND"},
        }

        for tmpl_key in TEMPLATES.keys():
            comment = render_first_comment(tmpl_key, sample_slots)
            self.assertIsNotNone(comment, f"[{tmpl_key}] 첫 댓글이 None입니다.")
            self.assertGreaterEqual(len(comment), 150, f"[{tmpl_key}] 첫 댓글이 너무 짧습니다 ({len(comment)}자)")
            self.assertLessEqual(len(comment), 500, f"[{tmpl_key}] 첫 댓글이 너무 깁니다 ({len(comment)}자)")
            self.assertIn("프로필 링크 [ETF 캠퍼스]", comment, f"[{tmpl_key}] 프로필 링크 CTA가 누락되었습니다.")
            self.assertTrue(bool(re.search(r"\n\n[^\n]*프로필 링크 \[ETF 캠퍼스\]", comment)), f"[{tmpl_key}] 프로필 링크 라인 직전 빈 줄이 누락되었습니다.")
            self.assertNotIn("했거든", comment, f"[{tmpl_key}] 첫 댓글에 금기 어미 '했거든'이 포함되어 있습니다.")

    def test_compliance_and_forbidden_words(self):
        """180개 전 토픽에서 '추천' 및 '포트폴리오 추천'이 100% 제거되고 글자 수가 준수되는지 검증 (자본시장법 §101 & Rule 6)."""
        self.assertEqual(len(self.topics), 180, "topic_bank.json에는 총 180개 주제가 존재해야 합니다.")

        for idx, topic in enumerate(self.topics):
            tmpl = route_template(topic)
            slots = extract_slots(topic, "2026-09-19")
            text = render_template(tmpl, slots, "#ETF투자")
            tid = topic.get("id", f"topic_{idx}")

            # 자본시장법 §101 및 유사투자자문 방지 검증
            self.assertNotIn("추천", text, f"[{tid} / {tmpl}] '추천' 단어가 본문에 포함되어 있습니다!")
            self.assertNotIn("포트폴리오 추천", text, f"[{tid} / {tmpl}] '포트폴리오 추천' 단어가 포함되어 있습니다!")

            # 금융 데이터 정합성 & 가공 개인 썰 배제 검증 (Zero-Hallucination)
            self.assertNotIn("전수", text, f"[{tid} / {tmpl}] '전수' 단어가 포함되어 있습니다! 미공시 종목이 있으므로 과장 표현 금지.")
            self.assertNotIn("나는 ", text, f"[{tid} / {tmpl}] 가공의 개인 계좌 썰('나는 ~')이 포함되어 있습니다!")

            # 금융위원회 퇴직연금감독규정 개정(주식 50% 한도 상향) 및 무결성 검증
            self.assertFalse(bool(re.search(r"(?<![\d\.])82%", text)), f"[{tid} / {tmpl}] 구 규정 잔재(82%)가 본문에 포함되어 있습니다! 현행 기준은 85%입니다.")
            self.assertNotIn("40% 혼합", text, f"[{tid} / {tmpl}] 구 규정 잔재(40% 혼합)가 포함되어 있습니다! 현행 기준은 50% 미만입니다.")

            # 법정 면책 문구 및 공인 출처 표기 검증
            self.assertIn("한국거래소(KRX)", text, f"[{tid} / {tmpl}] 공인 원천 표기가 누락되었습니다!")
            self.assertIn("특정 종목의 매수·매도를 권유하지 않습니다", text, f"[{tid} / {tmpl}] 법정 면책 문구가 누락되었습니다!")

            # 모바일 최적 글자 수 범위 검증 (300 ~ 650자)
            self.assertGreaterEqual(len(text), 300, f"[{tid} / {tmpl}] 텍스트가 너무 짧습니다 ({len(text)}자)")
            self.assertLessEqual(len(text), 650, f"[{tid} / {tmpl}] 텍스트가 너무 깁니다 ({len(text)}자)")

    def test_generate_thread_dry_run(self):
        """실제 CLI 엔트리포인트 드라이런 정상 동작 검증."""
        code, post = generate_thread("2026-09-19", dry_run=True)
        self.assertEqual(code, 0)
        self.assertIsNotNone(post)
        self.assertNotIn("추천", post["text"])
        self.assertIn(post["template_key"], TEMPLATES)
        self.assertIsNotNone(post["first_comment"])


if __name__ == "__main__":
    unittest.main()
