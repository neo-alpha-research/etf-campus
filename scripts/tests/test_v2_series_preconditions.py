import os
import sys
import glob
import json
import csv
import pytest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

TR_INDEX_DIR = ROOT_DIR / "public" / "data" / "returns" / "tr_index"
DIST_CSV = ROOT_DIR / "data" / "distributions" / "etf_distribution_events.csv"


def test_tr_index_files_exist_and_valid():
    """Verify that tr_index directory contains valid JSON files for all ETFs."""
    tr_files = glob.glob(str(TR_INDEX_DIR / "*.json"))
    assert len(tr_files) > 1000, f"Expected >1000 tr_index files, found {len(tr_files)}"

    # Check a sample file for schema validity
    sample_file = tr_files[0]
    with open(sample_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert "points" in data
    assert len(data["points"]) > 0
    pt = data["points"][0]
    for k in ["date", "close", "tr_index", "net_tr_index"]:
        assert k in pt, f"Missing key {k} in sample point"


def test_tr_index_date_integrity_and_sample_fidelity():
    """Verify that trading points have chronological dates and valid numeric prices."""
    sample_tickers = ["069500", "122630", "252670", "360750"]
    for t in sample_tickers:
        fpath = TR_INDEX_DIR / f"{t}.json"
        if not fpath.exists():
            continue
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)
        points = data.get("points", [])
        assert len(points) >= 20, f"Ticker {t} should have at least 20 points"

        # Check chronology
        dates = [p["date"] for p in points]
        assert dates == sorted(dates), f"Dates not chronological for {t}"

        for p in points:
            assert isinstance(p["close"], (int, float))
            assert isinstance(p["tr_index"], (int, float))
            assert isinstance(p["net_tr_index"], (int, float))
            assert p["close"] > 0


def test_zero_distribution_fidelity():
    """Verify that ETFs with zero distribution events maintain close == tr_index."""
    tickers_with_dist = set()
    if DIST_CSV.exists():
        with open(DIST_CSV, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                t = row.get("ticker") or row.get("code") or row.get("itemcode")
                if t:
                    tickers_with_dist.add(t.strip())

    tr_files = glob.glob(str(TR_INDEX_DIR / "*.json"))
    total_tickers = {Path(tf).stem.strip() for tf in tr_files}
    zero_dist_tickers = list(total_tickers - tickers_with_dist)[:20]

    for t in zero_dist_tickers:
        fpath = TR_INDEX_DIR / f"{t}.json"
        if not fpath.exists():
            continue
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)
            for p in data.get("points", []):
                assert abs(p["close"] - p["tr_index"]) < 0.01, (
                    f"Zero dist ETF {t} has close != tr_index mismatch on {p['date']}"
                )
