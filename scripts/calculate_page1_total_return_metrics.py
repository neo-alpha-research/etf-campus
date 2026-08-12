"""Calculate page-1 KRW market-price total returns and one-year MDD."""
from __future__ import annotations

import csv
import argparse
import json
import re
from datetime import date, datetime
from pathlib import Path

import xlrd

try:
    from scripts.lead_magnet_dates import compact, parse_as_of, years_before
except ModuleNotFoundError:
    from lead_magnet_dates import compact, parse_as_of, years_before

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "lead_magnet" / "official_validation" / "raw"
OUT = ROOT / "data" / "lead_magnet" / "generated" / "20260810"
AS_OF = date(2026, 8, 10)
ANCHORS = {"6m": date(2026, 2, 10), "ytd": date(2025, 12, 30), "1y": date(2025, 8, 10), "2y": date(2024, 8, 10), "3y": date(2023, 8, 10)}
PRODUCTS = {"069500": "KODEX 200", "360750": "TIGER 미국S&P500", "133690": "TIGER 미국나스닥100"}

def parse_day(value: str) -> date:
    value = value.strip().replace(".", "-").replace("/", "-")
    return datetime.strptime(value, "%Y%m%d").date() if re.fullmatch(r"\d{8}", value) else date.fromisoformat(value)

def staging_closes() -> dict[str, float]:
    as_of = compact(AS_OF)
    with (ROOT / "data" / "lead_magnet" / "staging" / as_of / "etf_returns_snapshot.csv").open(encoding="utf-8-sig", newline="") as stream:
        return {r["ticker"]: float(r[f"close_{as_of}"]) for r in csv.DictReader(stream) if r["ticker"] in PRODUCTS}

def tiger_prices(ticker: str, close: float) -> list[tuple[date, float]]:
    rows = json.loads((RAW / f"TIGER_{ticker}_chart_{compact(AS_OF)}.json").read_text(encoding="utf-8"))["rtnData"]
    rows.sort(key=lambda row: row["wkdate"])
    end_ratio = 1 + float(rows[-1]["prc"]) / 100
    return [(parse_day(row["wkdate"]), close * (1 + float(row["prc"]) / 100) / end_ratio) for row in rows]

def tiger_distributions(ticker: str) -> list[tuple[date, float]]:
    text = (RAW / f"TIGER_{ticker}_distributions_{compact(AS_OF)}.html").read_text(encoding="utf-8", errors="replace")
    tokens = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", text)).strip().split(" ")
    return [(parse_day(tokens[i]), float(tokens[i + 2].replace(",", ""))) for i in range(len(tokens)-3)
            if re.fullmatch(r"\d{4}-\d{2}-\d{2}", tokens[i]) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", tokens[i+1]) and re.fullmatch(r"\d+(?:\.\d+)?", tokens[i+2].replace(",", ""))]

def kodex_prices() -> list[tuple[date, float]]:
    sheet = xlrd.open_workbook(RAW / f"KODEX_069500_NAV_{compact(AS_OF)}.xls").sheet_by_index(0)
    return sorted((parse_day(str(v[0]).split(".")[0]), float(v[1])) for v in (sheet.row_values(i) for i in range(4, sheet.nrows)) if v[0] not in ("", None) and isinstance(v[1], (int, float)))

def kodex_distributions() -> list[tuple[date, float]]:
    return [(parse_day(r["basicD"]), float(r["dividA"])) for r in json.loads((RAW / f"KODEX_069500_distributions_{compact(AS_OF)}.json").read_text(encoding="utf-8"))["dividList"]]

def on_or_before(series, target):
    return [row for row in series if row[0] <= target][-1]

def total_return(prices, distributions):
    record_to_ex = {}
    dates = [d for d, _ in prices]
    for record, amount in distributions:
        prior = [d for d in dates if d < record]
        if prior: record_to_ex[prior[-1]] = record_to_ex.get(prior[-1], 0) + amount
    result, level = [(prices[0][0], 1.0)], 1.0
    for i in range(1, len(prices)):
        d, p = prices[i]; level *= (p + record_to_ex.get(d, 0)) / prices[i-1][1]; result.append((d, level))
    return result

def drawdown(series):
    peak, worst = series[0][1], 0.0
    for _, value in series: peak, worst = max(peak, value), min(worst, value / max(peak, value) - 1)
    return worst

def calculate(ticker, prices, distributions):
    index = total_return([(d, p) for d, p in prices if d <= AS_OF], distributions)
    ref_day, ref = on_or_before(index, AS_OF)
    anchors = {key: on_or_before(index, target) for key, target in ANCHORS.items()}
    mdd_series = [x for x in index if anchors["1y"][0] <= x[0] <= ref_day]
    result = {"ticker": ticker, "name": PRODUCTS[ticker], "reference_date": ref_day.isoformat()}
    for key, (_, val) in anchors.items():
        years = int(key[0]) if key in ("2y", "3y") else 1
        value = (ref / val) ** (1 / years) - 1 if key in ("2y", "3y") else ref / val - 1
        result[f"return_{key}_pct"] = f"{value * 100:.2f}"
        result[f"{key}_anchor_date"] = anchors[key][0].isoformat()
    result["mdd_1y_pct"] = f"{drawdown(mdd_series) * 100:.2f}"
    result["return_basis"] = "KRW market-price total return; official cash distributions reinvested"
    return result

def configure(as_of_text: str) -> None:
    global AS_OF, ANCHORS, OUT
    AS_OF = parse_as_of(as_of_text)
    ANCHORS = {
        "6m": AS_OF.replace(month=AS_OF.month - 6) if AS_OF.month > 6 else AS_OF.replace(year=AS_OF.year - 1, month=AS_OF.month + 6),
        "ytd": date(AS_OF.year - 1, 12, 30),
        "1y": years_before(AS_OF, 1),
        "2y": years_before(AS_OF, 2),
        "3y": years_before(AS_OF, 3),
    }
    OUT = ROOT / "data" / "lead_magnet" / "generated" / compact(AS_OF)


def main(as_of_text: str):
    configure(as_of_text)
    closes = staging_closes()
    inputs = {"069500": (kodex_prices(), kodex_distributions()), "360750": (tiger_prices("360750", closes["360750"]), tiger_distributions("360750")), "133690": (tiger_prices("133690", closes["133690"]), tiger_distributions("133690"))}
    rows = [calculate(t, *inputs[t]) for t in PRODUCTS]
    OUT.mkdir(parents=True, exist_ok=True)
    with (OUT / "page1_performance_metrics.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0])); writer.writeheader(); writer.writerows(rows)
    (OUT / "page1_performance_validation.json").write_text(json.dumps({"as_of": AS_OF.isoformat(), "status": "pass", "basis": rows[0]["return_basis"], "rows": rows}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(rows, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Calculate page-1 total-return metrics.")
    parser.add_argument("--as-of", required=True, help="Reference date: YYYYMMDD or YYYY-MM-DD")
    main(parser.parse_args().as_of)
