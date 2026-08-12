"""Collect reproducible free sources for lead-magnet page 2."""
from __future__ import annotations

import json
import argparse
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

try:
    from scripts.lead_magnet_dates import compact, parse_as_of
except ModuleNotFoundError:
    from lead_magnet_dates import compact, parse_as_of

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "lead_magnet" / "official_validation" / "raw"
HEADERS = {"User-Agent": "Mozilla/5.0 ETF-Campus-Lead-Magnet/1.0"}


def fetch(url: str, data: dict[str, str] | None = None) -> bytes:
    body = urllib.parse.urlencode(data).encode() if data else None
    request = urllib.request.Request(url, data=body, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=90) as response:
        return response.read()


def save(filename: str, value: bytes) -> dict[str, object]:
    path = RAW / filename
    path.write_bytes(value)
    return {"file": str(path.relative_to(ROOT)), "bytes": len(value)}


def main(as_of_text: str) -> None:
    AS_OF = compact(parse_as_of(as_of_text))
    RAW.mkdir(parents=True, exist_ok=True)
    sources: list[dict[str, object]] = []
    tickers = ["161510", "466940", "315960", "458730", "446720", "402970"]
    for ticker in tickers:
        url = f"https://fchart.stock.naver.com/sise.nhn?symbol={ticker}&timeframe=day&count=400&requestType=0"
        sources.append({"ticker": ticker, "kind": "consistent_daily_market_price", "url": url,
                        **save(f"NAVER_{ticker}_daily_{AS_OF}.xml", fetch(url))})

    tiger_endpoint = "https://investments.miraeasset.com/tigeretf/ko/product/search/detail/refDivAjax.ajax"
    tiger_products = {
        "458730": ("KR7458730009", "TIGER 미국배당다우존스", "20260805110958001428"),
        "466940": ("KR7466940004", "TIGER 은행고배당플러스TOP10", "20260805110958006317"),
    }
    for ticker, (fund, name, report_id) in tiger_products.items():
        form = {"ksdFund": fund, "jongName": name, "pageIndex": "1", "firstIndex": "0", "listCnt": "100"}
        sources.append({"ticker": ticker, "kind": "official_distribution_history", "url": tiger_endpoint, "method": "POST",
                        **save(f"TIGER_{ticker}_distributions_{AS_OF}.html", fetch(tiger_endpoint, form))})
        report_url = f"https://investments.miraeasset.com/tigeretf/upload/etf/{report_id}.pdf"
        sources.append({"ticker": ticker, "kind": "official_monthly_report_holdings", "url": report_url,
                        **save(f"TIGER_{ticker}_factsheet_20260731.pdf", fetch(report_url))})

    pages = {
        "161510": "https://www.plusetf.co.kr/product/detail?n=006273",
        "315960": "https://www.riseetf.co.kr/prod/finderDetail/4494",
    }
    for ticker, url in pages.items():
        sources.append({"ticker": ticker, "kind": "official_product_distributions_holdings", "url": url,
                        **save(f"PRODUCT_{ticker}_{AS_OF}.html", fetch(url))})

    sol_endpoints = {
        "distribution": "https://www.soletf.com/api/etf/pds/dividend/210942",
        "holdings": "https://www.soletf.com/api/etf/pds/pdf/210942",
    }
    for kind, url in sol_endpoints.items():
        sources.append({"ticker": "446720", "kind": f"official_{kind}", "url": url,
                        **save(f"SOL_446720_{kind}_{AS_OF}.json", fetch(url))})

    ace_base = "https://papi.aceetf.co.kr/api/funds/K55101DN4471"
    for kind, suffix in {"distribution": "dividend?page=1&size=100", "holdings": "pdf?page=1&size=100"}.items():
        url = f"{ace_base}/{suffix}"
        sources.append({"ticker": "402970", "kind": f"official_{kind}", "url": url,
                        **save(f"ACE_402970_{kind}_{AS_OF}.json", fetch(url))})

    manifest = {"as_of": AS_OF, "collected_at_utc": datetime.now(timezone.utc).isoformat(), "sources": sources}
    (RAW / f"page2_source_manifest_{AS_OF}.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Collect page-2 price and issuer distribution sources.")
    parser.add_argument("--as-of", required=True, help="Reference date: YYYYMMDD or YYYY-MM-DD")
    main(parser.parse_args().as_of)
