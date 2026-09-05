#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Step 1.3: Clean Article 12 and 40% threshold across UNVERIFIED registries and queue.

Per Section 2, 3, and Step 1 of PENSION_ISA_CLASSIFICATION_GUIDE_20260905.md:
- Article 12 is an investor concentration rule that explicitly exempts collective investment securities.
  Replace with statutory articles:
  - 혼합 50% 미만: 퇴직연금감독규정 제11조 제1항 제5호
  - 채권형 100%: 퇴직연금감독규정 제11조 제1항 제4호
  - 주식형/파생 위험자산 70%: 근로자퇴직급여 보장법 시행규칙 제10조 제1항 제2호 (시행령 제26조제1항제2호가목 위임)
  - 레버리지/인버스/파생위험평가액 초과: 퇴직연금감독규정 제9조 제1항 제2호 마목
  - 적격 TDF: 퇴직연금감독규정 제11조 제1항 제9호
- Threshold: 40% 이하 -> 50% 미만
"""

from __future__ import annotations

import csv
import glob
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def clean_queue_file():
    queue_path = REPO_ROOT / "data/reports/pension_unverified_queue.csv"
    with open(queue_path, "r", encoding="utf-8-sig") as f:
        reader = list(csv.DictReader(f))

    for r in reader:
        for k, v in r.items():
            if not v:
                continue
            new_v = v
            # Replace 40% 이하 with 50% 미만
            new_v = new_v.replace("40% 이하", "50% 미만")
            # Replace Article 12 citations
            new_v = new_v.replace(
                "(감독규정 제12조 제1항 제2호)",
                "(퇴직연금감독규정 제11조 제1항 제5호)"
            )
            new_v = new_v.replace(
                "(감독규정 제12조 제1항 제6호)",
                "(퇴직연금감독규정 제11조 제1항 제9호)"
            )
            new_v = new_v.replace("제12조", "제11조")
            r[k] = new_v

    with open(queue_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=reader[0].keys())
        writer.writeheader()
        writer.writerows(reader)

    print("[OK] pension_unverified_queue.csv cleaned.")


def clean_prospectus_registries():
    registry_files = glob.glob(str(REPO_ROOT / "data/regulatory/sources/prospectus_*_UNVERIFIED.csv"))
    for file_path in registry_files:
        with open(file_path, "r", encoding="utf-8-sig") as f:
            content = f.read()

        # Threshold replacements
        content = content.replace("40% 이하 (30% 타깃)", "50% 미만 (약관 한도)")
        content = content.replace("40% 이하", "50% 미만")
        content = content.replace("50% 이하", "50% 미만")

        # Specific Article 12 replacements
        content = content.replace(
            "감독규정 제12조 제1항 제2호 (금융위 고시 제2023-56호)",
            "퇴직연금감독규정 제11조 제1항 제5호 (금융위고시 제2023-56호)"
        )
        content = content.replace(
            "감독규정 제12조1항2호",
            "퇴직연금감독규정 제11조 제1항 제5호"
        )
        content = content.replace(
            "퇴직연금감독규정 제12조 제1항 제1호 및 제4항",
            "근로자퇴직급여 보장법 시행규칙 제10조 제1항 제2호"
        )
        content = content.replace(
            "퇴직연금감독규정 제12조 제1항 제2호",
            "퇴직연금감독규정 제11조 제1항 제4호"
        )
        content = content.replace(
            "퇴직연금감독규정 제12조 제1항 제6호",
            "퇴직연금감독규정 제11조 제1항 제9호"
        )
        content = content.replace(
            "퇴직연금감독규정 제12조",
            "퇴직연금감독규정 제11조"
        )
        content = content.replace("제12조", "제11조")

        with open(file_path, "w", encoding="utf-8", newline="") as f:
            f.write(content)

        print(f"[OK] {Path(file_path).name} cleaned.")


if __name__ == "__main__":
    clean_queue_file()
    clean_prospectus_registries()
