import csv
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "rebuild_listing_reference_prices.py"
spec = importlib.util.spec_from_file_location("rebuild_listing_reference_prices", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
assert spec.loader is not None
spec.loader.exec_module(module)


NOTICE_HTML = """
<html><head><title>[TIGER Fn반도체TOP10] ETF 신규상장 기준가격 안내</title></head>
<body><table>
<tr><th>1. 종목명</th><td>TIGER Fn반도체TOP10</td></tr>
<tr><th>2. 기준가격(원)</th><td>9,870</td></tr>
<tr><th>5. 적용일</th><td>2021-08-10</td></tr>
</table></body></html>
"""

SEARCH_HTML = """
<html><body><table><tr>
<td><a href="/common/disclsviewer.do?method=search&acptno=20210809000626">ETF 신규상장 기준가격 안내</a></td>
</tr></table></body></html>
"""

VIEWER_HTML = """
<html><body><select id="mainDoc"><option value="20210809001410|Y" selected="selected">본문</option></select></body></html>
"""

PATH_HTML = """
<script>parent.setPath('', 'https://kind.krx.co.kr/external/2021/08/09/000626/20210809001410/99401.htm', '/external/path', '03', '12')</script>
"""


class FakeResponse:
    def __init__(self, text):
        self.text = text

    def raise_for_status(self):
        return None


class FakeSession:
    headers = {}

    def post(self, url, data=None, timeout=None):
        if url == module.KIND_ETF_SEARCH_URL:
            self.last_search_data = data
            return FakeResponse(SEARCH_HTML)
        if url == module.KIND_DISCLOSURE_URL and data and data.get("method") == "searchContents":
            return FakeResponse(PATH_HTML)
        raise AssertionError(f"Unexpected POST URL: {url}")

    def get(self, url, params=None, timeout=None):
        if url == module.KIND_DISCLOSURE_URL:
            return FakeResponse(VIEWER_HTML)
        if url.startswith("https://kind.krx.co.kr/external/"):
            return FakeResponse(NOTICE_HTML)
        raise AssertionError(f"Unexpected GET URL: {url}")


class ListingReferencePriceTests(unittest.TestCase):
    def test_parse_kind_notice_extracts_official_reference_price_and_applied_date(self):
        notice = module.parse_kind_notice(
            NOTICE_HTML,
            "20210809000626",
            "https://kind.krx.co.kr/common/disclsviewer.do?method=search&acptno=20210809000626",
        )
        self.assertEqual(notice.reference_price, 9870.0)
        self.assertEqual(notice.applied_date, "2021-08-10")
        self.assertEqual(notice.receipt_no, "20210809000626")
        self.assertEqual(notice.instrument_name, "TIGER Fn반도체TOP10")

    def test_extract_notice_receipts_reads_kind_disclosure_receipt(self):
        self.assertEqual(module.extract_notice_receipts(SEARCH_HTML), ["20210809000626"])

    def test_current_name_matches_historical_fn_notice_name(self):
        self.assertTrue(module.names_equivalent("TIGER 반도체TOP10", "TIGER Fn반도체TOP10"))
        self.assertFalse(module.names_equivalent("TIGER 반도체TOP10", "TIGER 차이나반도체FACTSET"))

    def test_apply_verified_anchors_uses_listing_reference_price_not_first_close(self):
        rows = [
            {
                "ticker": "396500",
                "close_20260814": "36240",
                "r_itd": "",
                "itd_anchor_close": "40360",
                "itd_anchor_date": "2021-08-10",
                "itd_return_type": "",
                "itd_source": "",
                "itd_verified_at": "",
                "itd_quality_status": "",
            }
        ]
        resolution = module.Resolution(
            ticker="396500",
            isin="KR7396500001",
            name="TIGER Fn반도체TOP10",
            listing_date="2021-08-10",
            existing_anchor_close=40360.0,
            reference_price=9870.0,
            status="official_verified",
            reason="verified",
            receipt_no="20210809000626",
            source_url="https://kind.krx.co.kr/common/disclsviewer.do?method=search&acptno=20210809000626",
            notice_applied_date="2021-08-10",
            notice_title=module.KIND_NOTICE_TITLE,
        )
        updated, count = module.apply_verified_anchors(rows, {"396500": resolution}, "2026-08-15T12:00:00+09:00")
        self.assertEqual(count, 1)
        self.assertEqual(updated[0]["itd_anchor_close"], "9870")
        self.assertEqual(updated[0]["itd_anchor_date"], "2021-08-10")
        self.assertEqual(updated[0]["r_itd"], "267.17")
        self.assertEqual(updated[0]["itd_source"], "KRX_KIND_LISTING_REFERENCE_PRICE")

    def test_process_dry_run_is_non_destructive_and_apply_creates_backups(self):
        with tempfile.TemporaryDirectory() as temporary:
            data_dir = Path(temporary) / "data"
            data_dir.mkdir()
            (data_dir / "etf_master_draft.csv").write_text(
                "ticker,isin,name,listing_date\n396500,KR7396500001,TIGER 반도체TOP10,2021-08-10\n",
                encoding="utf-8",
            )
            returns_fields = [
                "ticker", "name", "close_20260814", "r_itd", "itd_anchor_close", "itd_anchor_date",
                "itd_return_type", "itd_source", "itd_verified_at", "itd_quality_status",
            ]
            with (data_dir / "etf_returns_draft.csv").open("w", encoding="utf-8", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=returns_fields)
                writer.writeheader()
                writer.writerow({
                    "ticker": "396500", "name": "TIGER Fn반도체TOP10", "close_20260814": "36240",
                    "r_itd": "-10.21", "itd_anchor_close": "40360", "itd_anchor_date": "2021-08-10",
                })
            (data_dir / "listing_prices.json").write_text('{"396500": 40360.0}\n', encoding="utf-8")

            args = module.parser().parse_args([
                "--data-dir", str(data_dir), "--ticker", "396500", "--throttle-seconds", "0",
            ])
            stats = module.process(args, session=FakeSession())
            self.assertEqual(stats["official_verified"], 1)
            self.assertFalse((data_dir / "listing-ledger" / "etf_listing_reference_prices.csv").exists())
            self.assertEqual(json.loads((data_dir / "listing_prices.json").read_text(encoding="utf-8"))["396500"], 40360.0)

            apply_args = module.parser().parse_args([
                "--data-dir", str(data_dir), "--ticker", "396500", "--throttle-seconds", "0",
                "--apply", "--apply-returns", "--apply-listing-cache",
            ])
            applied = module.process(apply_args, session=FakeSession())
            self.assertEqual(applied["returns_updated"], 1)
            self.assertEqual(applied["cache_updated"], 1)
            with (data_dir / "etf_returns_draft.csv").open(encoding="utf-8-sig", newline="") as handle:
                rebuilt = next(csv.DictReader(handle))
            self.assertEqual(rebuilt["itd_anchor_close"], "9870")
            self.assertEqual(rebuilt["r_itd"], "267.17")
            self.assertEqual(json.loads((data_dir / "listing_prices.json").read_text(encoding="utf-8"))["396500"], 9870.0)
            self.assertEqual(len(list((data_dir / "backups").glob("etf_returns_draft.*.csv"))), 1)
            self.assertEqual(len(list((data_dir / "backups").glob("listing_prices.*.json"))), 1)

    def test_purge_nonrecent_keeps_only_recent_official_prices_and_clears_old_itd(self):
        with tempfile.TemporaryDirectory() as temporary:
            data_dir = Path(temporary) / "data"
            data_dir.mkdir()
            (data_dir / "etf_master_draft.csv").write_text(
                "ticker,isin,name,listing_date\n"
                "396500,KR7396500001,TIGER 반도체TOP10,2021-08-10\n"
                "000001,KR7000000001,오래된ETF,2021-04-01\n",
                encoding="utf-8",
            )
            fields = [
                "ticker", "name", "close_20260814", "r_itd", "itd_anchor_close", "itd_anchor_date",
                "itd_return_type", "itd_source", "itd_verified_at", "itd_quality_status",
            ]
            with (data_dir / "etf_returns_draft.csv").open("w", encoding="utf-8", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=fields)
                writer.writeheader()
                writer.writerows([
                    {
                        "ticker": "396500", "name": "TIGER 반도체TOP10", "close_20260814": "36240",
                        "r_itd": "-10.21", "itd_anchor_close": "40360", "itd_anchor_date": "2021-08-10",
                    },
                    {
                        "ticker": "000001", "name": "오래된ETF", "close_20260814": "10000",
                        "r_itd": "15.00", "itd_anchor_close": "8695", "itd_anchor_date": "2021-04-01",
                        "itd_return_type": "pr", "itd_source": "legacy", "itd_verified_at": "2021-04-01",
                        "itd_quality_status": "legacy",
                    },
                ])
            (data_dir / "listing_prices.json").write_text(
                '{"396500": 40360.0, "000001": 8695.0}\n', encoding="utf-8"
            )

            args = module.parser().parse_args([
                "--data-dir", str(data_dir), "--recent-listings-only", "--recent-days", "90",
                "--as-of-date", "2021-08-15", "--throttle-seconds", "0", "--apply",
                "--apply-returns", "--apply-listing-cache", "--purge-nonrecent",
            ])
            stats = module.process(args, session=FakeSession())
            self.assertEqual(stats["official_verified"], 1)
            self.assertEqual(stats["returns_updated"], 1)
            self.assertEqual(stats["itd_rows_cleared"], 1)
            self.assertEqual(stats["cache_entries_removed"], 1)
            self.assertEqual(stats["cache_updated"], 1)
            self.assertEqual(
                json.loads((data_dir / "listing_prices.json").read_text(encoding="utf-8")),
                {"396500": 9870.0},
            )
            with (data_dir / "etf_returns_draft.csv").open(encoding="utf-8-sig", newline="") as handle:
                rebuilt = {row["ticker"]: row for row in csv.DictReader(handle)}
            self.assertEqual(rebuilt["396500"]["itd_anchor_close"], "9870")
            self.assertEqual(rebuilt["000001"]["itd_anchor_close"], "")
            self.assertEqual(rebuilt["000001"]["r_itd"], "")
            self.assertEqual(rebuilt["000001"]["itd_quality_status"], "not_applicable_not_recent_listing")
            with (data_dir / "listing-ledger" / "etf_listing_reference_prices.csv").open(encoding="utf-8-sig", newline="") as handle:
                ledger = list(csv.DictReader(handle))
            self.assertEqual([row["ticker"] for row in ledger], ["396500"])
            self.assertEqual(len(list((data_dir / "backups").glob("etf_returns_draft.*.csv"))), 1)
            self.assertEqual(len(list((data_dir / "backups").glob("listing_prices.*.json"))), 1)


if __name__ == "__main__":
    unittest.main()
