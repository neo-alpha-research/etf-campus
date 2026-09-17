"""
Generate static timeseries data contract v2 for compare charts.

Path: public/data/series/v2/{ticker}.json
      public/data/series/v2/{ticker}.recent.json
      public/data/series/v2/manifest.json
"""

import os
import sys
import glob
import json
import csv
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

def format_num(val):
    if val is None:
        return None
    r = round(float(val), 2)
    return int(r) if r.is_integer() else r

def generate_series_v2(root_dir=None, fail_on_quarantine: bool = False):
    if root_dir is None:
        root_dir = Path(__file__).resolve().parent.parent
    else:
        root_dir = Path(root_dir)

    out_dir = root_dir / "public" / "data" / "series" / "v2"
    out_dir.mkdir(parents=True, exist_ok=True)

    dist_csv = root_dir / "data" / "distributions" / "etf_distribution_events.csv"
    ca_csv = root_dir / "data" / "corporate_actions" / "etf_corporate_actions.csv"
    master_csv = root_dir / "data" / "etf_master_draft.csv"

    tickers_with_dist = set()
    if dist_csv.exists():
        with open(dist_csv, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for r in reader:
                t = r.get("ticker") or r.get("code") or r.get("itemcode")
                if t:
                    tickers_with_dist.add(t.strip())

    # Pre-generation Audit: verify input series against corporate actions ledger
    quarantined_tickers = {}
    try:
        from scripts.verify_split_adjustment import verify_splits
        cat1, cat2, cat3, cat4 = verify_splits(
            series_dir=str(root_dir / "public" / "data" / "returns" / "tr_index"),
            ca_file=str(ca_csv),
            master_file=str(master_csv),
        )
        for r in cat2:
            quarantined_tickers[r["ticker"]] = {
                "status": "quarantined",
                "reason": r.get("reason", "unadjusted_corporate_action"),
                "as_of": r.get("date", ""),
            }
        for r in cat3:
            quarantined_tickers[r["ticker"]] = {
                "status": "quarantined",
                "reason": "unregistered_price_limit_anomaly",
                "as_of": r.get("date", ""),
            }
    except Exception as e:
        print(f"[WARN] verify_splits check skipped during generation: {e}")

    tr_files = sorted(glob.glob(str(root_dir / "public" / "data" / "returns" / "tr_index" / "*.json")))
    manifest_tickers = {}
    latest_global_date = "2023-01-02"

    # Step 1: Ingest all points and compute master KRX trading calendar
    all_raw_data = {}
    master_dates_set = set()
    for tf in tr_files:
        ticker = Path(tf).stem.strip()
        with open(tf, "r", encoding="utf-8") as f:
            raw = json.load(f)

        points = raw.get("points", [])
        if not points:
            continue

        all_raw_data[ticker] = points
        for p in points:
            master_dates_set.add(p["date"])

    master_calendar = sorted(list(master_dates_set))
    total_filled_points = 0

    # Step 2: Generate aligned v2 series with LOCF for internal calendar gaps
    for ticker, points in all_raw_data.items():
        first_date = points[0]["date"]
        last_date = points[-1]["date"]

        active_calendar = [d for d in master_calendar if first_date <= d <= last_date]
        point_by_date = {p["date"]: p for p in points}

        dates = []
        close = []
        tr = []
        net_tr = []
        filled = []

        last_close = None
        last_tr = None
        last_net_tr = None

        for idx, d in enumerate(active_calendar):
            if d in point_by_date:
                p = point_by_date[d]
                c_val = format_num(p.get("close"))
                tr_val = format_num(p.get("tr_index"))
                ntr_val = format_num(p.get("net_tr_index"))

                if c_val is not None:
                    last_close = c_val
                if tr_val is not None:
                    last_tr = tr_val
                if ntr_val is not None:
                    last_net_tr = ntr_val

                dates.append(d)
                close.append(c_val)
                tr.append(tr_val)
                net_tr.append(ntr_val)
            else:
                # Trading halt / gap -> LOCF
                dates.append(d)
                close.append(last_close)
                tr.append(last_tr)
                net_tr.append(last_net_tr)
                filled.append(idx)
                total_filled_points += 1

        has_dist = ticker in tickers_with_dist
        as_of = dates[-1] if dates else ""
        as_of_tag = as_of.replace("-", "") if as_of else ""

        if as_of > latest_global_date:
            latest_global_date = as_of

        if ticker in quarantined_tickers:
            # Preserve quarantined entry in manifest, do not generate corrupt price series
            manifest_tickers[ticker] = quarantined_tickers[ticker]
            continue

        # Full series object
        full_obj = {
            "ticker": ticker,
            "startDate": dates[0] if dates else "",
            "dates": dates,
            "close": close,
            "tr": tr,
            "netTr": net_tr,
            "hasDistribution": has_dist,
            "filled": filled,
            "asOf": as_of
        }

        # Recent series object (last 250 points)
        recent_count = min(len(dates), 250)
        cutoff = len(dates) - recent_count
        recent_filled = [idx - cutoff for idx in filled if idx >= cutoff]

        recent_obj = {
            "ticker": ticker,
            "startDate": dates[-recent_count] if dates else "",
            "dates": dates[-recent_count:],
            "close": close[-recent_count:],
            "tr": tr[-recent_count:],
            "netTr": net_tr[-recent_count:],
            "hasDistribution": has_dist,
            "filled": recent_filled,
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

    print(f"Generated v2 series for {len(manifest_tickers)} tickers in {out_dir} (total LOCF filled points: {total_filled_points})")

    if quarantined_tickers:
        print(f"\n[ALERT: QUARANTINED TICKERS] {len(quarantined_tickers)} tickers quarantined due to price integrity violations:")
        for t, q in quarantined_tickers.items():
            print(f"  - {t}: {q['reason']} (as of {q['as_of']})")
        if fail_on_quarantine:
            raise RuntimeError(f"Gate Fail-Closed: {len(quarantined_tickers)} tickers quarantined: {list(quarantined_tickers.keys())}")

    return len(manifest_tickers)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Generate v2 timeseries contracts")
    parser.add_argument("--fail-on-quarantine", action="store_true", help="Exit with error if any tickers are quarantined")
    args = parser.parse_args()
    generate_series_v2(fail_on_quarantine=args.fail_on_quarantine)
