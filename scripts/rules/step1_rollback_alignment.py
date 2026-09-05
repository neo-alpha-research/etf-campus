#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Step 1: Pre-requisite Rollback & Statutory Alignment.

1. Rollback 9 invalid DART rows from pension_verification_ledger.csv (748 -> 739 rows).
2. Keep only 284430 with real quote in note.
3. Purge 제12조 citations in pension_verification_ledger.csv, pension_unverified_queue.csv, README.md, etc.
4. Align threshold to 50% 미만 and exclude TRF5050 from safe assets.
5. Fill 165 empty statutory_basis rows in pension_audit_ledger.csv.
"""

from __future__ import annotations

import csv
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

def step1_rollback_verification_ledger():
    ledger_path = REPO_ROOT / "data/regulatory/pension_verification_ledger.csv"
    with open(ledger_path, "r", encoding="utf-8-sig") as f:
        reader = list(csv.DictReader(f))

    invalid_dart_tickers = {
        "0177N0", "475630", "357870", "449170", "448330",
        "0162Z0", "477080", "423160", "459580"
    }

    cleaned_rows = []
    for r in reader:
        tk = r["ticker"].strip()
        if tk in invalid_dart_tickers:
            continue

        if tk == "284430":
            r["note"] = 'DART 정정신고서(rcpNo 20260630000020) 제2부 8. 투자대상 "가. 투자대상주식: 40% 이하 → 50% 미만" 대조'
        else:
            note = r.get("note", "")
            if "주식형" in note and "제12조" in note:
                r["note"] = "KOFIA 펀드유형: 주식형 (근로자퇴직급여 보장법 시행규칙 제10조 제1항 제2호: 주식형 집합투자증권 위험자산 70% 한도)"
            elif "채권형" in note and "제12조" in note:
                r["note"] = "KOFIA 펀드유형: 채권형 (퇴직연금감독규정 제11조 제1항 제4호: 원리금보장 및 채권형 안전자산 100% 한도)"
            elif "혼합주식형" in note and "제12조" in note:
                r["note"] = "KOFIA 펀드유형: 혼합주식형 (근로자퇴직급여 보장법 시행규칙 제10조 제1항 제2호: 혼합주식형 집합투자증권 위험자산 70% 한도)"
            else:
                note = note.replace("제12조 제1항 제2호", "제11조 제1항 제4호")
                note = note.replace("제12조 제1항 제1호 및 제4항", "근로자퇴직급여 보장법 시행규칙 제10조 제1항 제2호")
                note = note.replace("퇴직연금감독규정 제12조", "퇴직연금감독규정 제11조")
                r["note"] = note

        cleaned_rows.append(r)

    assert len(cleaned_rows) == 739, f"Expected 739 rows, got {len(cleaned_rows)}"

    fieldnames = reader[0].keys()
    with open(ledger_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(cleaned_rows)

    print(f"[OK] pension_verification_ledger.csv updated to {len(cleaned_rows)} rows (739 verified).")


def step1_update_master_draft():
    master_path = REPO_ROOT / "data/etf_master_draft.csv"
    with open(master_path, "r", encoding="utf-8") as f:
        reader = list(csv.DictReader(f))

    invalid_dart_tickers = {
        "0177N0", "475630", "357870", "449170", "448330",
        "0162Z0", "477080", "423160", "459580"
    }

    for r in reader:
        tk = r["ticker"].strip()
        if tk in invalid_dart_tickers:
            r["pension_verified"] = "N"
            r["pension_confidence"] = "낮음"
            # Return source to previous rule estimate / direct statutory
            if "금리" in r["name"] or "KOFR" in r["name"] or "CD" in r["name"]:
                r["pension_source"] = "법령조건직접판정"
            else:
                r["pension_source"] = "규칙기반추정"

        # Also fix TRF5050 (329660) - cannot be safe asset under < 50%
        if tk == "329660":
            r["pension_limit"] = "70% (위험자산)"
            r["pension_verified"] = "N"
            r["pension_confidence"] = "낮음"
            r["pension_source"] = "규칙기반추정"

    with open(master_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=reader[0].keys())
        writer.writeheader()
        writer.writerows(reader)

    print("[OK] etf_master_draft.csv rolled back 9 DART tickers and adjusted TRF5050.")


def step1_clean_readme():
    readme_path = REPO_ROOT / "data/regulatory/README.md"
    content = readme_path.read_text(encoding="utf-8")
    content = content.replace(
        "퇴직연금감독규정 제12조 준수 여부",
        "퇴직연금감독규정 제9조·제11조 및 근로자퇴직급여 보장법령 준수 여부"
    )
    readme_path.write_text(content, encoding="utf-8")
    print("[OK] data/regulatory/README.md updated.")


if __name__ == "__main__":
    step1_rollback_verification_ledger()
    step1_update_master_draft()
    step1_clean_readme()
