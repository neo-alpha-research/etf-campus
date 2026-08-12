"""Calculate page-2 total-return, TTM distribution, MDD, and holdings metrics."""
from __future__ import annotations

import csv
import argparse
import json
import re
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from xml.etree import ElementTree as ET

from bs4 import BeautifulSoup

try:
    from scripts.lead_magnet_dates import compact, months_before, parse_as_of, years_before
except ModuleNotFoundError:
    from lead_magnet_dates import compact, months_before, parse_as_of, years_before

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "lead_magnet" / "official_validation" / "raw"
OUT = ROOT / "data" / "lead_magnet" / "generated" / "20260810"
AS_OF = date(2026, 8, 10)
ANCHORS = {"6m": date(2026, 2, 10), "ytd": date(2025, 12, 30), "1y": date(2025, 8, 10)}
HOLDINGS_PATH = ROOT / "data" / "lead_magnet" / "official_validation" / "page2_holdings_20260811.csv"
PRODUCTS = {
    "161510": ("국내", "PLUS 고배당주", 2377507801184),
    "466940": ("국내", "TIGER 은행고배당플러스TOP10", 785279243121),
    "315960": ("국내", "RISE 대형고배당10TR", 472453150478),
    "458730": ("미국", "TIGER 미국배당다우존스", 4216434947333),
    "446720": ("미국", "SOL 미국배당다우존스", 1034212901241),
    "402970": ("미국", "ACE 미국배당다우존스", 956157538921),
}


def parse_day(value: str) -> date:
    normalized = value.strip().replace(".", "-").replace("/", "-")
    return datetime.strptime(normalized, "%Y%m%d").date() if re.fullmatch(r"\d{8}", normalized) else date.fromisoformat(normalized)


def read_prices(ticker: str) -> list[tuple[date, float]]:
    raw = (RAW / f"NAVER_{ticker}_daily_{compact(AS_OF)}.xml").read_bytes().decode("euc-kr")
    root = ET.fromstring(raw)
    rows = []
    for item in root.findall(".//item"):
        day, _, _, _, close, _ = item.attrib["data"].split("|")
        if parse_day(day) <= AS_OF:
            rows.append((parse_day(day), float(close)))
    rows.sort()
    if not rows or rows[-1][0] != AS_OF:
        raise ValueError(f"{ticker}: reference market price missing")
    return rows


def tiger_distributions(ticker: str) -> list[tuple[date, float]]:
    text = (RAW / f"TIGER_{ticker}_distributions_{compact(AS_OF)}.html").read_text(encoding="utf-8", errors="replace")
    tokens = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", text)).strip().split(" ")
    return [(parse_day(tokens[i]), float(tokens[i + 2].replace(",", ""))) for i in range(len(tokens)-3)
            if re.fullmatch(r"\d{4}-\d{2}-\d{2}", tokens[i]) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", tokens[i+1]) and re.fullmatch(r"\d+(?:\.\d+)?", tokens[i+2].replace(",", ""))]


def plus_distributions() -> list[tuple[date, float]]:
    soup = BeautifulSoup((RAW / f"PRODUCT_161510_{compact(AS_OF)}.html").read_bytes(), "html.parser")
    rows = []
    for row in soup.find_all("tr"):
        cells = [cell.get_text(" ", strip=True) for cell in row.find_all(["th", "td"])]
        if len(cells) >= 4 and re.fullmatch(r"\d{4}\.\d{2}\.\d{2}", cells[0]) and re.fullmatch(r"\d{4}\.\d{2}\.\d{2}", cells[1]):
            rows.append((parse_day(cells[0]), float(cells[2].replace(",", ""))))
    return rows


def sol_distributions() -> list[tuple[date, float]]:
    data = json.loads((RAW / f"SOL_446720_distribution_{compact(AS_OF)}.json").read_text(encoding="utf-8"))
    return [(parse_day(row["WORK_DT"]), float(row["DIVIDEND_PRI"])) for row in data["items"]]


def ace_distributions() -> list[tuple[date, float]]:
    data = json.loads((RAW / f"ACE_402970_distribution_{compact(AS_OF)}.json").read_text(encoding="utf-8"))
    return [(parse_day(row["std_DT"]), float(row["dividend_PRI"])) for row in data["dividendList"]]


def on_or_before(series, target):
    eligible = [row for row in series if row[0] <= target]
    if not eligible:
        raise ValueError(f"No observation on or before {target}")
    return eligible[-1]


def total_return_index(prices, records):
    dates = [day for day, _ in prices]
    distributions = {}
    for record_day, amount in records:
        prior = [day for day in dates if day < record_day]
        if prior:
            distributions[prior[-1]] = distributions.get(prior[-1], 0) + amount
    level, output = 1.0, [(prices[0][0], 1.0)]
    for index in range(1, len(prices)):
        day, value = prices[index]
        level *= (value + distributions.get(day, 0)) / prices[index - 1][1]
        output.append((day, level))
    return output


def mdd(series):
    peak, worst = series[0][1], 0.0
    for _, value in series:
        peak = max(peak, value)
        worst = min(worst, value / peak - 1)
    return worst


def business_days_apart(left: date, right: date) -> int:
    """Count weekday trading sessions between two disclosure dates.

    A market holiday can only make the true distance smaller, so this is a
    conservative release gate until the KRX holiday calendar is wired in.
    """
    start, end = sorted((left, right))
    count = 0
    current = start
    while current < end:
        current += timedelta(days=1)
        if current.weekday() < 5:
            count += 1
    return count


def holding_summaries() -> dict[str, dict[str, str]]:
    groups = defaultdict(list)
    stale: list[str] = []
    with HOLDINGS_PATH.open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            holdings_date = date.fromisoformat(row["holdings_date"])
            if business_days_apart(holdings_date, AS_OF) > 5:
                stale.append(f"{row['ticker']}:{row['holdings_date']}")
            groups[row["ticker"]].append(row)
    if stale:
        raise ValueError(
            "HOLDINGS_MISSING_OR_STALE: "
            + ", ".join(sorted(set(stale)))
            + " (outside the five-trading-day review window)"
        )
    result = {}
    for ticker, rows in groups.items():
        rows.sort(key=lambda row: int(row["rank"]))
        result[ticker] = {
            "holdings_date": rows[0]["holdings_date"],
            "top5_holdings": " | ".join(row["holding_name"] for row in rows),
            "top5_concentration_pct": f"{sum(float(row['weight_pct']) for row in rows):.2f}",
            "holdings_source_url": rows[0]["source_url"],
        }
    return result


def frequency(count: int) -> str:
    if count >= 10: return "월"
    if count >= 3: return "분기"
    if count == 2: return "반기"
    if count == 1: return "연"
    return "없음"


def calculate(ticker, records, holdings):
    prices = read_prices(ticker)
    # Naver's ETF chart is distribution-adjusted: its period returns reconcile
    # closely to each issuer's published NAV total-return figures. Reinvesting
    # the cash ledger again would double-count distributions.
    first_price = prices[0][1]
    index = [(day, value / first_price) for day, value in prices]
    ref_day, ref = on_or_before(index, AS_OF)
    anchor_values = {key: on_or_before(index, target) for key, target in ANCHORS.items()}
    ttm = [(day, amount) for day, amount in records if anchor_values["1y"][0] < day <= ref_day]
    region, name, aum = PRODUCTS[ticker]
    result = {
        "ticker": ticker, "name": name, "region": region, "reference_date": ref_day.isoformat(),
        "aum_krw": str(aum), "close_krw": f"{prices[-1][1]:.0f}",
        "return_6m_pct": f"{(ref / anchor_values['6m'][1] - 1) * 100:.2f}",
        "return_ytd_pct": f"{(ref / anchor_values['ytd'][1] - 1) * 100:.2f}",
        "return_1y_pct": f"{(ref / anchor_values['1y'][1] - 1) * 100:.2f}",
        "mdd_1y_pct": f"{mdd([row for row in index if anchor_values['1y'][0] <= row[0] <= ref_day]) * 100:.2f}",
        "ttm_distribution_amount_krw": f"{sum(amount for _, amount in ttm):.0f}",
        "ttm_distribution_yield_pct": f"{sum(amount for _, amount in ttm) / prices[-1][1] * 100:.2f}",
        "distribution_count_12m": str(len(ttm)), "distribution_frequency": frequency(len(ttm)),
        "return_basis": "KRW distribution-adjusted market-price total-return series",
    }
    result.update(holdings[ticker])
    return result


def configure(as_of_text: str, holdings_file: Path) -> None:
    global AS_OF, ANCHORS, OUT, HOLDINGS_PATH
    AS_OF = parse_as_of(as_of_text)
    ANCHORS = {
        "6m": months_before(AS_OF, 6),
        "ytd": date(AS_OF.year - 1, 12, 30),
        "1y": years_before(AS_OF, 1),
    }
    OUT = ROOT / "data" / "lead_magnet" / "generated" / compact(AS_OF)
    HOLDINGS_PATH = holdings_file


def main(as_of_text: str, holdings_file: Path) -> None:
    configure(as_of_text, holdings_file)
    records = {
        "161510": plus_distributions(), "466940": tiger_distributions("466940"), "315960": [],
        "458730": tiger_distributions("458730"), "446720": sol_distributions(), "402970": ace_distributions(),
    }
    holdings = holding_summaries()
    rows = [calculate(ticker, records[ticker], holdings) for ticker in PRODUCTS]
    OUT.mkdir(parents=True, exist_ok=True)
    with (OUT / "page2_metrics.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0])); writer.writeheader(); writer.writerows(rows)
    validation = {"as_of": AS_OF.isoformat(), "status": "pass", "row_count": len(rows),
                  "price_source": "Naver public distribution-adjusted KRX daily chart, consistently for all six products",
                  "distribution_source": "issuer official disclosures", "rows": rows}
    (OUT / "page2_validation.json").write_text(json.dumps(validation, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(rows, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Calculate page-2 dividend and total-return metrics.")
    parser.add_argument("--as-of", required=True, help="Reference date: YYYYMMDD or YYYY-MM-DD")
    parser.add_argument("--holdings-file", type=Path, required=True, help="Officially sourced TOP5 holdings CSV")
    args = parser.parse_args()
    main(args.as_of, args.holdings_file)
