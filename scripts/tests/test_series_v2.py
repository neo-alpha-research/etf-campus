import os
import glob
import json
import csv
import pytest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
SERIES_V2_DIR = ROOT_DIR / "public" / "data" / "series" / "v2"
DIST_CSV = ROOT_DIR / "data" / "distributions" / "etf_distribution_events.csv"

@pytest.fixture(scope="module")
def sample_tickers():
    return ["069500", "360750", "133690", "488770", "161510"]

def test_series_v2_fields_exist(sample_tickers):
    """Test 1: Verify all required fields exist in v2 series files and manifest."""
    manifest_path = SERIES_V2_DIR / "manifest.json"
    assert manifest_path.exists(), "manifest.json must exist"
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    assert "asOf" in manifest, "manifest must contain asOf"
    assert "tickers" in manifest, "manifest must contain tickers map"

    required_fields = ["ticker", "startDate", "dates", "close", "tr", "netTr", "hasDistribution", "asOf"]

    for ticker in sample_tickers:
        full_path = SERIES_V2_DIR / f"{ticker}.json"
        recent_path = SERIES_V2_DIR / f"{ticker}.recent.json"

        assert full_path.exists(), f"{ticker}.json must exist"
        assert recent_path.exists(), f"{ticker}.recent.json must exist"

        with open(full_path, "r", encoding="utf-8") as f:
            full_data = json.load(f)
        with open(recent_path, "r", encoding="utf-8") as f:
            recent_data = json.load(f)

        for field in required_fields:
            assert field in full_data, f"Field '{field}' missing in {ticker}.json"
            assert field in recent_data, f"Field '{field}' missing in {ticker}.recent.json"

        assert full_data["ticker"] == ticker
        assert recent_data["ticker"] == ticker
        assert len(recent_data["dates"]) <= 250

def test_series_v2_array_lengths_match(sample_tickers):
    """Test 2: Verify array lengths of dates, close, tr, and netTr are strictly equal."""
    for ticker in sample_tickers:
        for suffix in [".json", ".recent.json"]:
            path = SERIES_V2_DIR / f"{ticker}{suffix}"
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)

            n_dates = len(data["dates"])
            assert len(data["close"]) == n_dates, f"close length mismatch in {ticker}{suffix}"
            assert len(data["tr"]) == n_dates, f"tr length mismatch in {ticker}{suffix}"
            assert len(data["netTr"]) == n_dates, f"netTr length mismatch in {ticker}{suffix}"
            assert n_dates > 0, f"dates array should not be empty in {ticker}{suffix}"

def test_series_v2_has_distribution_ledger_fidelity():
    """Test 3: Verify hasDistribution matches data/distributions/etf_distribution_events.csv ledger exactly."""
    tickers_with_dist = set()
    if DIST_CSV.exists():
        with open(DIST_CSV, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for r in reader:
                t = r.get("ticker") or r.get("code") or r.get("itemcode")
                if t:
                    tickers_with_dist.add(t.strip())

    # Sample a mix of tickers known to have distributions and tickers with 0 distributions
    tr_files = glob.glob(str(SERIES_V2_DIR / "*.recent.json"))[:50]
    assert len(tr_files) > 0

    for tf in tr_files:
        ticker = Path(tf).name.replace(".recent.json", "").strip()
        with open(tf, "r", encoding="utf-8") as f:
            data = json.load(f)

        expected = ticker in tickers_with_dist
        assert data["hasDistribution"] == expected, (
            f"Fidelity mismatch for {ticker}: hasDistribution is {data['hasDistribution']} but ledger says {expected}"
        )
