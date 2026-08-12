"""Collect free, official performance sources for the five page-3 ETFs.

No paid API or credential is required. The files are kept verbatim so the
calculation step can be reproduced and audited.
"""

from __future__ import annotations

import json
import argparse
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    from scripts.lead_magnet_dates import compact, parse_as_of, years_before
except ModuleNotFoundError:
    from lead_magnet_dates import compact, parse_as_of, years_before


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "lead_magnet" / "official_validation" / "raw"
USER_AGENT = "ETF-Campus-Lead-Magnet/1.0 (+official-source-validation)"


def request(url: str, data: dict[str, str] | None = None) -> bytes:
    payload = urllib.parse.urlencode(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=payload, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as response:
        return response.read()


def save(name: str, content: bytes) -> dict[str, object]:
    path = RAW_DIR / name
    path.write_bytes(content)
    return {"file": str(path.relative_to(ROOT)), "bytes": len(content)}


def main(as_of_text: str) -> None:
    as_of = parse_as_of(as_of_text)
    AS_OF = compact(as_of)
    START = compact(years_before(as_of, 1) - timedelta(days=2))
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    sources: list[dict[str, object]] = []

    tiger_chart_url = (
        "https://investments.miraeasset.com/tigeretf/ko/product/chart/"
        "prdct-profit-list.ajax"
    )
    tiger_distribution_url = (
        "https://investments.miraeasset.com/tigeretf/ko/product/search/detail/"
        "refDivAjax.ajax"
    )
    tiger_products = {
        "139260": ("KR7139260004", "TIGER 200 IT"),
        "396500": ("KR7396500001", "TIGER 반도체TOP10"),
    }
    for ticker, (fund_id, name) in tiger_products.items():
        chart_query = urllib.parse.urlencode(
            {"ksdFund": fund_id, "strtDt": START, "endDt": AS_OF, "period": ""}
        )
        chart_full_url = f"{tiger_chart_url}?{chart_query}"
        item = save(f"TIGER_{ticker}_chart_{AS_OF}.json", request(chart_full_url))
        sources.append({"ticker": ticker, "kind": "daily_return_chart", "url": chart_full_url, **item})

        distribution_form = {
            "ksdFund": fund_id,
            "jongName": name,
            "pageIndex": "1",
            "firstIndex": "0",
            "listCnt": "100",
        }
        item = save(
            f"TIGER_{ticker}_distributions_{AS_OF}.html",
            request(tiger_distribution_url, distribution_form),
        )
        sources.append(
            {
                "ticker": ticker,
                "kind": "distribution_history",
                "url": tiger_distribution_url,
                "method": "POST",
                **item,
            }
        )

    kodex_products = {"445290": "2ETFH5", "487240": "2ETFN7"}
    for ticker, fund_id in kodex_products.items():
        nav_url = (
            "https://m.samsungfund.com/excel_standar.do?"
            + urllib.parse.urlencode({"fId": fund_id, "gijunYMD": AS_OF})
        )
        item = save(f"KODEX_{ticker}_NAV_{AS_OF}.xls", request(nav_url))
        sources.append({"ticker": ticker, "kind": "daily_price_nav", "url": nav_url, **item})

        distribution_url = (
            "https://m.samsungfund.com/api/v1/kodex/divid-info.do?"
            + urllib.parse.urlencode({"id": fund_id})
        )
        item = save(
            f"KODEX_{ticker}_distributions_{AS_OF}.json",
            request(distribution_url),
        )
        sources.append(
            {"ticker": ticker, "kind": "distribution_history", "url": distribution_url, **item}
        )

    time_nav_url = (
        "https://www.timeetf.co.kr/nav_xls.php?"
        + urllib.parse.urlencode(
            {"idx": "6", "navStartDate": (years_before(as_of, 1) - timedelta(days=2)).isoformat(), "navEndDate": as_of.isoformat()}
        )
    )
    item = save(f"TIME_456600_NAV_{AS_OF}.xlsx", request(time_nav_url))
    sources.append({"ticker": "456600", "kind": "daily_price_nav", "url": time_nav_url, **item})

    time_product_url = "https://www.timeetf.co.kr/m11_view.php?idx=6"
    item = save(f"TIME_456600_product_{AS_OF}.html", request(time_product_url))
    sources.append(
        {"ticker": "456600", "kind": "distribution_and_published_returns", "url": time_product_url, **item}
    )

    manifest = {
        "as_of": AS_OF,
        "start": START,
        "collected_at_utc": datetime.now(timezone.utc).isoformat(),
        "sources": sources,
    }
    (RAW_DIR / f"page3_performance_source_manifest_{AS_OF}.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Collect page-3 official AI ETF performance sources.")
    parser.add_argument("--as-of", required=True, help="Reference date: YYYYMMDD or YYYY-MM-DD")
    main(parser.parse_args().as_of)
