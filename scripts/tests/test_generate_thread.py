#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unit tests for Threads Viral Engine (generate_thread.py v2.2)
Ensures:
1. All 8 killer templates are functional and routable from topic_bank.json
2. Zero '추천' or '포트폴리오 추천' (Compliance with Capital Markets Act §101)
3. Zero-Hallucination: Required KRX/KOFIA provenance and disclaimer footer
4. Mobile 4-Beat length constraints (300 ~ 650 chars)
"""

import json
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "threads"))

from generate_thread import TEMPLATES, route_template, extract_slots, render_template, generate_thread


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

    def test_compliance_and_forbidden_words(self):
        """모든 템플릿에서 '추천' 및 '포트폴리오 추천'이 100% 제거되었는지 검증 (자본시장법 §101)."""
        templates_sample = {}
        for t in self.topics:
            tmpl = route_template(t)
            if tmpl not in templates_sample:
                templates_sample[tmpl] = t

        for tmpl, topic in templates_sample.items():
            slots = extract_slots(topic, "2026-09-19")
            text = render_template(tmpl, slots, "#ETF투자")

            # 자본시장법 §101 및 유사투자자문 방지 검증
            self.assertNotIn("추천", text, f"[{tmpl}] '추천' 단어가 본문에 포함되어 있습니다!")
            self.assertNotIn("포트폴리오 추천", text, f"[{tmpl}] '포트폴리오 추천' 단어가 포함되어 있습니다!")

            # 금융위원회 퇴직연금감독규정 개정(주식 50% 한도 상향) 및 무결성 검증
            self.assertNotIn("82%", text, f"[{tmpl}] 구 규정 잔재(82%)가 본문에 포함되어 있습니다! 현행 기준은 85%입니다.")
            self.assertNotIn("40% 혼합", text, f"[{tmpl}] 구 규정 잔재(40% 혼합)가 포함되어 있습니다! 현행 기준은 50% 미만입니다.")

            # 법정 면책 문구 및 공인 출처 표기 검증
            self.assertIn("한국거래소(KRX)", text, f"[{tmpl}] 공인 원천 표기가 누락되었습니다!")
            self.assertIn("특정 종목의 매수·매도를 권유하지 않습니다", text, f"[{tmpl}] 법정 면책 문구가 누락되었습니다!")

            # 모바일 최적 글자 수 범위 검증 (300 ~ 650자)
            self.assertGreaterEqual(len(text), 300, f"[{tmpl}] 텍스트가 너무 짧습니다 ({len(text)}자)")
            self.assertLessEqual(len(text), 650, f"[{tmpl}] 텍스트가 너무 깁니다 ({len(text)}자)")

    def test_generate_thread_dry_run(self):
        """실제 CLI 엔트리포인트 드라이런 정상 동작 검증."""
        code, post = generate_thread("2026-09-19", dry_run=True)
        self.assertEqual(code, 0)
        self.assertIsNotNone(post)
        self.assertNotIn("추천", post["text"])
        self.assertIn(post["template_key"], TEMPLATES)


if __name__ == "__main__":
    unittest.main()
