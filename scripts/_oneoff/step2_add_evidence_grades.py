#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Step 2: Add evidence_grade and evidence_quote to regulatory ledgers.

Evidence Grades (Section 6 of PENSION_ISA_CLASSIFICATION_GUIDE_20260905.md):
- E0: Statutory text only (e.g. leverage/inverse exclusion)
- E1: Prospectus / Trust Agreement body verbatim quotation
- E2: Amendment filing before/after comparison table
- E3: KOFIA disclosure fund type (pure stock/bond only)
- E4: Broker universe (cross-check only)
- E5: Portfolio holdings measured composition (anomaly detection only, NEVER promotion)
"""

from __future__ import annotations

import csv
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def update_verification_ledger():
    ledger_path = REPO_ROOT / "data/regulatory/pension_verification_ledger.csv"
    with open(ledger_path, "r", encoding="utf-8-sig") as f:
        reader = list(csv.DictReader(f))

    fieldnames = list(reader[0].keys())
    if "evidence_grade" not in fieldnames:
        fieldnames.append("evidence_grade")
    if "evidence_quote" not in fieldnames:
        fieldnames.append("evidence_quote")

    for r in reader:
        tk = r["ticker"].strip()
        src_type = r.get("source_type", "")

        if tk == "284430":
            r["evidence_grade"] = "E2"
            r["evidence_quote"] = "가. 투자대상주식: 40% 이하 → 50% 미만"
        elif src_type == "협회공시대조":
            r["evidence_grade"] = "E3"
            r["evidence_quote"] = ""
        else:
            r["evidence_grade"] = "E1"
            r["evidence_quote"] = ""

    with open(ledger_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(reader)

    print(f"[OK] pension_verification_ledger.csv updated with evidence_grade and evidence_quote ({len(reader)} rows).")


if __name__ == "__main__":
    update_verification_ledger()
