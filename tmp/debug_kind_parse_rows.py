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
html, source_url = module.request_kind_notice(session, "20210809000626", 20)
soup = module.BeautifulSoup(html, "html.parser")
print("contains_9870=" + str("9,870" in html))
for row in soup.select("tr"):
    cells = [cell.get_text(" ", strip=True) for cell in row.select("th, td")]
    if len(cells) >= 2:
        print("ROW=" + repr(cells))
print("NOTICE=" + repr(module.parse_kind_notice(html, "20210809000626", source_url)))
