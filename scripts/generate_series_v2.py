"""
Generate static timeseries data contract v2 for compare charts.

Path: public/data/series/v2/{ticker}.json
      public/data/series/v2/{ticker}.recent.json
      public/data/series/v2/manifest.json
"""

import os
import glob
import json
import csv
from pathlib import Path

def format_num(val):
    if val is None:
        return None
    r = round(float(val), 2)
    return int(r) if r.is_integer() else r

def generate_series_v2(root_dir=None):
    if root_dir is None:
        root_dir = Path(__file__).resolve().parent.parent
    else:
        root_dir = Path(root_dir)

    out_dir = root_dir / "public" / "data" / "series" / "v2"
    out_dir.mkdir(parents=True, exist_ok=True)

    dist_csv = root_dir / "data" / "distributions" / "etf_distribution_events.csv"
    tickers_with_dist = set()
    if dist_csv.exists():
        with open(dist_csv, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for r in reader:
                t = r.get("ticker") or r.get("code") or r.get("itemcode")
                if t:
                    tickers_with_dist.add(t.strip())

    tr_files = glob.glob(str(root_dir / "public" / "data" / "returns" / "tr_index" / "*.json"))
    manifest_tickers = {}
    latest_global_date = "2023-01-02"

    for tf in tr_files:
        ticker = Path(tf).stem.strip()
        with open(tf, "r", encoding="utf-8") as f:
            raw = json.load(f)

        points = raw.get("points", [])
        if not points:
            continue

        dates = [p["date"] for p in points]
        close = [format_num(p.get("close")) for p in points]
        tr = [format_num(p.get("tr_index")) for p in points]
        net_tr = [format_num(p.get("net_tr_index")) for p in points]

        has_dist = ticker in tickers_with_dist
        as_of = dates[-1] if dates else ""
        as_of_tag = as_of.replace("-", "") if as_of else ""

        if as_of > latest_global_date:
            latest_global_date = as_of

        # Full series object
        full_obj = {
            "ticker": ticker,
            "startDate": dates[0] if dates else "",
            "dates": dates,
            "close": close,
            "tr": tr,
            "netTr": net_tr,
            "hasDistribution": has_dist,
            "asOf": as_of
        }

        # Recent series object (last 250 points)
        recent_count = min(len(dates), 250)
        recent_obj = {
            "ticker": ticker,
            "startDate": dates[-recent_count] if dates else "",
            "dates": dates[-recent_count:],
            "close": close[-recent_count:],
            "tr": tr[-recent_count:],
            "netTr": net_tr[-recent_count:],
            "hasDistribution": has_dist,
            "asOf": as_of
        }

        # Write full
        with open(out_dir / f"{ticker}.json", "w", encoding="utf-8") as f:
            json.dump(full_obj, f, separators=(',', ':'))

        # Write recent
        with open(out_dir / f"{ticker}.recent.json", "w", encoding="utf-8") as f:
            json.dump(recent_obj, f, separators=(',', ':'))

        manifest_tickers[ticker] = as_of_tag

    manifest = {
        "asOf": latest_global_date.replace("-", ""),
        "tickers": manifest_tickers
    }

    with open(out_dir / "manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, separators=(',', ':'), indent=2)

    print(f"Generated v2 series for {len(manifest_tickers)} tickers in {out_dir}")
    return len(manifest_tickers)

if __name__ == "__main__":
    generate_series_v2()
