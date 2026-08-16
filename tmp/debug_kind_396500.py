from pathlib import Path
import importlib.util
import sys

module_path = Path(r"D:\ETFCampus\scripts\rebuild_listing_reference_prices.py")
spec = importlib.util.spec_from_file_location("listing_reference", module_path)
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
assert spec.loader is not None
spec.loader.exec_module(module)

session = module.requests.Session()
session.headers.setdefault("User-Agent", "ETF-Campus/1.0 official-reference-price-audit")
html = module.request_kind_search(session, "2021-08-10", 20)
receipts = module.extract_notice_receipts(html)
receipt = "20210809000626"
page, source_url = module.request_kind_notice(session, receipt, 20)
notice = module.parse_kind_notice(page, receipt, source_url)
print("search_length=" + str(len(html)))
print("receipt_count=" + str(len(receipts)))
print("has_396500_receipt=" + str(receipt in receipts))
print("instrument_name=" + notice.instrument_name)
print("reference_price=" + str(notice.reference_price))
print("applied_date=" + str(notice.applied_date))
print("source_url=" + notice.source_url)
