"""Collect reproducible, free official sources for lead-magnet page 1."""
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
RAW = ROOT / "data" / "lead_magnet" / "official_validation" / "raw"
HEADERS = {"User-Agent": "ETF-Campus-Lead-Magnet/1.0 (+official-source-validation)"}


def fetch(url: str, data: dict[str, str] | None = None) -> bytes:
    request = urllib.request.Request(
        url, data=urllib.parse.urlencode(data).encode() if data else None, headers=HEADERS
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def save(filename: str, value: bytes) -> dict[str, object]:
    path = RAW / filename
    path.write_bytes(value)
    return {"file": str(path.relative_to(ROOT)), "bytes": len(value)}


def source_window(as_of_text: str) -> tuple[str, str]:
    as_of = parse_as_of(as_of_text)
    # Ten calendar days of margin lets the calculator find the nearest prior
    # KRX trading date for the three-year anchor without interpolation.
    return compact(as_of - timedelta(days=0)), compact(years_before(as_of, 3) - timedelta(days=10))


def main(as_of_text: str) -> None:
    AS_OF, START = source_window(as_of_text)
    RAW.mkdir(parents=True, exist_ok=True)
    sources: list[dict[str, object]] = []
    chart_endpoint = "https://investments.miraeasset.com/tigeretf/ko/product/chart/prdct-profit-list.ajax"
    distribution_endpoint = "https://investments.miraeasset.com/tigeretf/ko/product/search/detail/refDivAjax.ajax"
    for ticker, fund, name in [
        ("133690", "KR7133690008", "TIGER 미국나스닥100"),
        ("360750", "KR7360750004", "TIGER 미국S&P500"),
    ]:
        query = urllib.parse.urlencode({"ksdFund": fund, "strtDt": START, "endDt": AS_OF, "period": ""})
        url = f"{chart_endpoint}?{query}"
        sources.append({"ticker": ticker, "kind": "daily_return_chart", "url": url,
                        **save(f"TIGER_{ticker}_chart_{AS_OF}.json", fetch(url))})
        form = {"ksdFund": fund, "jongName": name, "pageIndex": "1", "firstIndex": "0", "listCnt": "100"}
        sources.append({"ticker": ticker, "kind": "distribution_history", "url": distribution_endpoint,
                        "method": "POST", **save(f"TIGER_{ticker}_distributions_{AS_OF}.html", fetch(distribution_endpoint, form))})

    fund_id = "2ETF01"
    price_url = "https://m.samsungfund.com/excel_standar.do?" + urllib.parse.urlencode({"fId": fund_id, "gijunYMD": AS_OF})
    sources.append({"ticker": "069500", "kind": "daily_market_price_nav", "url": price_url,
                    **save(f"KODEX_069500_NAV_{AS_OF}.xls", fetch(price_url))})
    distribution_url = "https://m.samsungfund.com/api/v1/kodex/divid-info.do?" + urllib.parse.urlencode({"id": fund_id})
    sources.append({"ticker": "069500", "kind": "distribution_history", "url": distribution_url,
                    **save(f"KODEX_069500_distributions_{AS_OF}.json", fetch(distribution_url))})
    manifest = {"as_of": AS_OF, "start": START, "collected_at_utc": datetime.now(timezone.utc).isoformat(), "sources": sources}
    (RAW / f"page1_performance_source_manifest_{AS_OF}.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Collect page-1 official performance sources.")
    parser.add_argument("--as-of", required=True, help="Reference date: YYYYMMDD or YYYY-MM-DD")
    main(parser.parse_args().as_of)
