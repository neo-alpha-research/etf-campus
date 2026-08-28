import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from build_comparison_registry import infer_asset


def test_infer_asset_cd_rate_plus():
    assert infer_asset("KODEX CD1년금리플러스액티브(합성) KAP 1년은행 CD+추가금리 지수(총수익지수)", {}) == "금리·파킹"


def test_infer_asset_bank():
    assert infer_asset("KODEX 은행 KRX 은행", {}) == "주식"


def test_infer_asset_commodity_futures():
    assert infer_asset("TIGER 금은선물(H) S&P GSCI Precious Metals Index(TR)", {}) == "원자재"
