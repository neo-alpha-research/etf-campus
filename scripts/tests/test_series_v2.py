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

    required_fields = ["ticker", "startDate", "dates", "close", "tr", "netTr", "hasDistribution", "filled", "asOf"]

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
        assert isinstance(full_data["filled"], list)
        assert isinstance(recent_data["filled"], list)

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

            # Check that filled indices are within [0, n_dates - 1]
            for idx in data["filled"]:
                assert isinstance(idx, int)
                assert 0 <= idx < n_dates

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

def test_series_v2_locf_gap_filling(tmp_path):
    """Test 4: Verify that internal calendar gaps are filled with LOCF and recorded in filled array."""
    from scripts.generate_series_v2 import generate_series_v2

    # Create synthetic directory structure
    fake_root = tmp_path / "repo"
    fake_tr_dir = fake_root / "public" / "data" / "returns" / "tr_index"
    fake_tr_dir.mkdir(parents=True)

    # ETF A has complete dates: Day 1, Day 2, Day 3
    etf_a = {
        "points": [
            {"date": "2026-01-02", "close": 10000, "tr_index": 10000, "net_tr_index": 10000},
            {"date": "2026-01-05", "close": 10200, "tr_index": 10200, "net_tr_index": 10200},
            {"date": "2026-01-06", "close": 10300, "tr_index": 10300, "net_tr_index": 10300},
        ]
    }
    # ETF B is suspended on Day 2 (2026-01-05 missing): Day 1, Day 3
    etf_b = {
        "points": [
            {"date": "2026-01-02", "close": 20000, "tr_index": 20000, "net_tr_index": 20000},
            {"date": "2026-01-06", "close": 20500, "tr_index": 20500, "net_tr_index": 20500},
        ]
    }

    with open(fake_tr_dir / "AAA.json", "w", encoding="utf-8") as f:
        json.dump(etf_a, f)
    with open(fake_tr_dir / "BBB.json", "w", encoding="utf-8") as f:
        json.dump(etf_b, f)

    generate_series_v2(fake_root)

    out_b = fake_root / "public" / "data" / "series" / "v2" / "BBB.json"
    assert out_b.exists()
    with open(out_b, "r", encoding="utf-8") as f:
        data_b = json.load(f)

    # BBB should now have 3 dates: 2026-01-02, 2026-01-05 (filled), 2026-01-06
    assert data_b["dates"] == ["2026-01-02", "2026-01-05", "2026-01-06"]
    # 2026-01-05 should be LOCF from 2026-01-02 (20000)
    assert data_b["close"] == [20000, 20000, 20500]
    assert data_b["tr"] == [20000, 20000, 20500]
    # filled index should be [1]
    assert data_b["filled"] == [1]

