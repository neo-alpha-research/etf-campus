#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Step 7: Populate ISA 4-Field Architecture across all 1,167 ETFs.

Section 8 of PENSION_ISA_CLASSIFICATION_GUIDE_20260905.md:
- isa_eligible: "가능" / "불가" (전건 "가능")
- isa_tax_type: "국내주식형" / "기타"
  (kofia_fund_type == "주식형" and asset_class == "주식-국내" -> "국내주식형", else "기타")
- isa_tax_benefit: "낮음" / "높음"
  (isa_tax_type == "기타" -> "높음", else "낮음")
- isa_education_required: "Y" / "N" (레버리지·인버스: "Y", else "N")
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.rules.pension_regulatory_engine import classify_pension_and_isa


def populate_isa_fields():
    master_path = REPO_ROOT / "data/etf_master_draft.csv"
    with open(master_path, "r", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    updated_rows = []
    for r in rows:
        computed = classify_pension_and_isa(r)
        r["isa_tax_type"] = computed["isa_tax_type"]
        r["isa_tax_benefit"] = computed["isa_tax_benefit"]
        r["isa_eligible"] = computed["isa_eligible"]
        r["isa_education_required"] = computed["isa_education_required"]
        updated_rows.append(r)

    # Insert isa_tax_type and isa_tax_benefit right after isa_education_required
    old_fields = list(rows[0].keys())
    fieldnames = []
    for fld in old_fields:
        fieldnames.append(fld)
        if fld == "isa_education_required":
            if "isa_tax_type" not in fieldnames:
                fieldnames.append("isa_tax_type")
            if "isa_tax_benefit" not in fieldnames:
                fieldnames.append("isa_tax_benefit")

    # Ensure all fieldnames exist in fieldnames list
    for k in ("isa_tax_type", "isa_tax_benefit"):
        if k not in fieldnames:
            fieldnames.append(k)

    with open(master_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(updated_rows)

    print(f"[OK] data/etf_master_draft.csv updated with ISA 4 fields ({len(updated_rows)} rows).")


if __name__ == "__main__":
    populate_isa_fields()
