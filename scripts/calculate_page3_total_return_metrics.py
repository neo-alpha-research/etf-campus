"""Calculate page-3 market-price total returns and one-year MDD.

The total-return index reinvests each official cash distribution on the
ex-distribution date, defined as the trading day immediately before the
issuer's distribution record date. All results use KRW market prices.
"""

from __future__ import annotations

import csv
import argparse
import json
import re
import zipfile
from datetime import date, datetime
from pathlib import Path
from xml.etree import ElementTree as ET

import xlrd

try:
    from scripts.lead_magnet_dates import compact, months_before, parse_as_of, years_before
except ModuleNotFoundError:
    from lead_magnet_dates import compact, months_before, parse_as_of, years_before


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "lead_magnet" / "official_validation" / "raw"
OUT_DIR = ROOT / "data" / "lead_magnet" / "generated" / "20260810"
AS_OF = date(2026, 8, 10)
SIX_MONTH_ANCHOR = date(2026, 2, 10)
YTD_ANCHOR = date(2025, 12, 30)
ONE_YEAR_ANCHOR = date(2025, 8, 10)

PRODUCTS = {
    "139260": ("TIGER 200 IT", "ai_it_bigtech", "한국"),
    "396500": ("TIGER 반도체TOP10", "ai_semiconductor", "한국"),
    "445290": ("KODEX 로봇액티브", "ai_robotics_automation", "한국"),
    "456600": ("TIME 글로벌AI인공지능액티브", "broad_ai_value_chain", "글로벌"),
    "487240": ("KODEX AI전력핵심설비", "ai_infrastructure_power", "한국"),
}


def parse_date(value: str) -> date:
    normalized = value.strip().replace(".", "-").replace("/", "-")
    if re.fullmatch(r"\d{8}", normalized):
        return datetime.strptime(normalized, "%Y%m%d").date()
    return date.fromisoformat(normalized)


def read_staging_closes() -> dict[str, float]:
    as_of = compact(AS_OF)
    path = ROOT / "data" / "lead_magnet" / "staging" / as_of / "etf_returns_snapshot.csv"
    with path.open(encoding="utf-8-sig", newline="") as stream:
        return {
            row["ticker"]: float(row[f"close_{as_of}"])
            for row in csv.DictReader(stream)
            if row["ticker"] in PRODUCTS
        }


def parse_tiger_prices(ticker: str, end_close: float) -> list[tuple[date, float]]:
    path = RAW_DIR / f"TIGER_{ticker}_chart_{compact(AS_OF)}.json"
    rows = json.loads(path.read_text(encoding="utf-8"))["rtnData"]
    rows.sort(key=lambda row: row["wkdate"])
    end_ratio = 1 + float(rows[-1]["prc"]) / 100
    return [
        (parse_date(row["wkdate"]), end_close * (1 + float(row["prc"]) / 100) / end_ratio)
        for row in rows
    ]


def parse_tiger_distributions(ticker: str) -> list[tuple[date, float]]:
    text = (RAW_DIR / f"TIGER_{ticker}_distributions_{compact(AS_OF)}.html").read_text(
        encoding="utf-8", errors="replace"
    )
    plain = re.sub(r"<[^>]+>", " ", text)
    tokens = re.sub(r"\s+", " ", plain).strip().split(" ")
    rows: list[tuple[date, float]] = []
    for index in range(len(tokens) - 3):
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", tokens[index]) and re.fullmatch(
            r"\d{4}-\d{2}-\d{2}", tokens[index + 1]
        ):
            amount = tokens[index + 2].replace(",", "")
            if re.fullmatch(r"\d+(?:\.\d+)?", amount):
                rows.append((parse_date(tokens[index]), float(amount)))
    return rows


def parse_kodex_prices(ticker: str) -> list[tuple[date, float]]:
    sheet = xlrd.open_workbook(RAW_DIR / f"KODEX_{ticker}_NAV_{compact(AS_OF)}.xls").sheet_by_index(0)
    rows = []
    for index in range(4, sheet.nrows):
        values = sheet.row_values(index)
        if values[0] in ("", None) or not isinstance(values[1], (int, float)):
            continue
        rows.append((parse_date(str(values[0]).split(".")[0]), float(values[1])))
    return sorted(rows)


def parse_kodex_distributions(ticker: str) -> list[tuple[date, float]]:
    data = json.loads(
        (RAW_DIR / f"KODEX_{ticker}_distributions_{compact(AS_OF)}.json").read_text(encoding="utf-8")
    )
    return [(parse_date(row["basicD"]), float(row["dividA"])) for row in data["dividList"]]


def _xlsx_rows(path: Path) -> list[list[str]]:
    namespace = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with zipfile.ZipFile(path) as archive:
        shared_root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
        shared = [
            "".join(node.text or "" for node in item.findall(".//m:t", namespace))
            for item in shared_root.findall("m:si", namespace)
        ]
        sheet_root = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))

    output: list[list[str]] = []
    for row in sheet_root.findall(".//m:sheetData/m:row", namespace):
        values: dict[int, str] = {}
        for cell in row.findall("m:c", namespace):
            reference = cell.attrib["r"]
            column_letters = re.match(r"[A-Z]+", reference).group(0)
            column = 0
            for letter in column_letters:
                column = column * 26 + ord(letter) - ord("A") + 1
            raw = cell.findtext("m:v", default="", namespaces=namespace)
            value = shared[int(raw)] if cell.attrib.get("t") == "s" and raw else raw
            values[column - 1] = value
        if values:
            output.append([values.get(i, "") for i in range(max(values) + 1)])
    return output


def parse_time_prices() -> list[tuple[date, float]]:
    rows = []
    for values in _xlsx_rows(RAW_DIR / f"TIME_456600_NAV_{compact(AS_OF)}.xlsx")[2:]:
        if len(values) < 4 or not re.fullmatch(r"\d{4}\.\d{2}\.\d{2}", values[0]):
            continue
        rows.append((parse_date(values[0]), float(values[3].replace(",", ""))))
    return sorted(rows)


def parse_time_distributions() -> list[tuple[date, float]]:
    text = (RAW_DIR / f"TIME_456600_product_{compact(AS_OF)}.html").read_text(
        encoding="utf-8", errors="replace"
    )
    table = re.search(r'class="moreList3".*?<tbody>(.*?)</tbody>', text, re.DOTALL)
    if not table:
        raise ValueError("TIME distribution table was not found")
    plain = re.sub(r"<[^>]+>", " ", table.group(1))
    tokens = re.sub(r"\s+", " ", plain).strip().split(" ")
    rows = []
    for index in range(len(tokens) - 3):
        if re.fullmatch(r"\d{4}\.\d{2}\.\d{2}", tokens[index]) and re.fullmatch(
            r"\d{4}\.\d{2}\.\d{2}", tokens[index + 1]
        ):
            rows.append((parse_date(tokens[index]), float(tokens[index + 2].replace(",", ""))))
    return rows


def ex_date_distributions(
    prices: list[tuple[date, float]], records: list[tuple[date, float]]
) -> dict[date, float]:
    dates = [day for day, _ in prices]
    events: dict[date, float] = {}
    for record_day, amount in records:
        prior = [day for day in dates if day < record_day]
        if not prior:
            continue
        ex_day = prior[-1]
        events[ex_day] = events.get(ex_day, 0.0) + amount
    return events


def total_return_index(
    prices: list[tuple[date, float]], distributions: dict[date, float]
) -> list[tuple[date, float]]:
    if not prices:
        raise ValueError("Price history is empty")
    output = [(prices[0][0], 1.0)]
    level = 1.0
    for index in range(1, len(prices)):
        day, price = prices[index]
        previous_price = prices[index - 1][1]
        level *= (price + distributions.get(day, 0.0)) / previous_price
        output.append((day, level))
    return output


def on_or_before(series: list[tuple[date, float]], target: date) -> tuple[date, float]:
    eligible = [row for row in series if row[0] <= target]
    if not eligible:
        raise ValueError(f"No observation on or before {target}")
    return eligible[-1]


def mdd(series: list[tuple[date, float]]) -> float:
    peak = series[0][1]
    worst = 0.0
    for _, value in series:
        peak = max(peak, value)
        worst = min(worst, value / peak - 1)
    return worst


def calculate_row(
    ticker: str,
    prices: list[tuple[date, float]],
    records: list[tuple[date, float]],
) -> dict[str, str]:
    prices = [(day, value) for day, value in sorted(prices) if day <= AS_OF]
    events = ex_date_distributions(prices, records)
    index = total_return_index(prices, events)
    reference_day, reference_value = on_or_before(index, AS_OF)
    six_day, six_value = on_or_before(index, SIX_MONTH_ANCHOR)
    ytd_day, ytd_value = on_or_before(index, YTD_ANCHOR)
    year_day, year_value = on_or_before(index, ONE_YEAR_ANCHOR)
    one_year_series = [row for row in index if year_day <= row[0] <= reference_day]
    name, theme, region = PRODUCTS[ticker]
    included_records = [(day, amount) for day, amount in records if year_day < day <= reference_day]
    return {
        "ticker": ticker,
        "name": name,
        "theme": theme,
        "region": region,
        "reference_date": reference_day.isoformat(),
        "return_6m_pct": f"{(reference_value / six_value - 1) * 100:.2f}",
        "return_ytd_pct": f"{(reference_value / ytd_value - 1) * 100:.2f}",
        "return_1y_pct": f"{(reference_value / year_value - 1) * 100:.2f}",
        "mdd_1y_pct": f"{mdd(one_year_series) * 100:.2f}",
        "six_month_anchor_date": six_day.isoformat(),
        "ytd_anchor_date": ytd_day.isoformat(),
        "one_year_anchor_date": year_day.isoformat(),
        "observation_count_1y": str(len(one_year_series)),
        "distribution_count_1y": str(len(included_records)),
        "distribution_amount_1y": f"{sum(amount for _, amount in included_records):.0f}",
        "return_basis": "KRW market-price total return; official cash distributions reinvested",
    }


def configure(as_of_text: str) -> None:
    global AS_OF, SIX_MONTH_ANCHOR, YTD_ANCHOR, ONE_YEAR_ANCHOR, OUT_DIR
    AS_OF = parse_as_of(as_of_text)
    SIX_MONTH_ANCHOR = months_before(AS_OF, 6)
    YTD_ANCHOR = date(AS_OF.year - 1, 12, 30)
    ONE_YEAR_ANCHOR = years_before(AS_OF, 1)
    OUT_DIR = ROOT / "data" / "lead_magnet" / "generated" / compact(AS_OF)


def main(as_of_text: str) -> None:
    configure(as_of_text)
    closes = read_staging_closes()
    inputs = {
        "139260": (parse_tiger_prices("139260", closes["139260"]), parse_tiger_distributions("139260")),
        "396500": (parse_tiger_prices("396500", closes["396500"]), parse_tiger_distributions("396500")),
        "445290": (parse_kodex_prices("445290"), parse_kodex_distributions("445290")),
        "456600": (parse_time_prices(), parse_time_distributions()),
        "487240": (parse_kodex_prices("487240"), parse_kodex_distributions("487240")),
    }
    rows = [calculate_row(ticker, *inputs[ticker]) for ticker in PRODUCTS]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    csv_path = OUT_DIR / "page3_performance_metrics.csv"
    with csv_path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    summary = {
        "as_of": AS_OF.isoformat(),
        "status": "pass" if len(rows) == 5 else "fail",
        "basis": rows[0]["return_basis"],
        "ex_distribution_rule": "previous available trading day before issuer record date",
        "rows": rows,
    }
    json_path = OUT_DIR / "page3_performance_validation.json"
    json_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    report_path = (
        ROOT
        / "data"
        / "lead_magnet"
        / "official_validation"
        / f"PAGE3_PERFORMANCE_VALIDATION_{compact(AS_OF)}.md"
    )
    report_lines = [
        "# 페이지 3 총수익률·MDD 검증 결과",
        "",
        "- 기준일: 2026-08-10",
        "- 기준: 원화 시장가격 + 공식 현금분배금 재투자 총수익률",
        "- 분배락일: 운용사 지급기준일 직전 거래일",
        "- 결과: 선정 5종 모두 6개월·YTD·1년·최근 1년 MDD 산출 가능",
        "",
        "| ETF | 6개월 | YTD | 1년 | 1년 MDD | 1년 분배금 |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for row in rows:
        report_lines.append(
            f'| {row["name"]} | {row["return_6m_pct"]}% | '
            f'{row["return_ytd_pct"]}% | {row["return_1y_pct"]}% | '
            f'{row["mdd_1y_pct"]}% | {row["distribution_amount_1y"]}원 |'
        )
    report_lines.extend(
        [
            "",
            "## 원자료",
            "",
            "- TIGER: 공식 기간수익률 JSON과 공식 분배금 지급현황",
            "- KODEX: 공식 기준가 엑셀과 공식 분배금 API",
            "- TIME: 공식 기준가격 엑셀과 상품 페이지 내 최근 3년 분배금 표",
            "",
            "## 해석 주의",
            "",
            "- MDD는 2025-08-08부터 2026-08-10까지의 일별 총수익지수에서 계산했다.",
            "- 높은 1년 수익률과 큰 MDD가 동시에 나타날 수 있다. 중간 급락 후 반등한 경우이므로 서로 모순되지 않는다.",
            "- TIGER 시장가격은 공식 차트의 누적 시장가격 수익률을 2026-08-10 종가에 맞춰 역산했다. 누적수익률이 소수 둘째 자리로 제공되어 MDD에는 미세한 반올림 오차가 있을 수 있다.",
            "- 유료 API와 가격수익률 대체값은 사용하지 않았다.",
        ]
    )
    report_path.write_text("\n".join(report_lines) + "\n", encoding="utf-8")
    print(csv_path)
    print(report_path)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Calculate page-3 AI ETF total-return metrics.")
    parser.add_argument("--as-of", required=True, help="Reference date: YYYYMMDD or YYYY-MM-DD")
    main(parser.parse_args().as_of)
