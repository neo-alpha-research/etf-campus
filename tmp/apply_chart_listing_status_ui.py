from pathlib import Path
import re

path = Path(__file__).resolve().parents[1] / "components" / "etf-detail" / "price-history-chart.tsx"
text = path.read_text(encoding="utf-8")
if "상장일 확인 중" in text:
    print("Listing-date status UI is already present.")
else:
    replacement = """\n) : maxListingDateUnavailable ? (\n        <div className=\"p-8 text-center text-muted bg-neutral-50 rounded-2xl text-sm font-medium\">\n          상장일 확인 중\n        </div>\n      ) : error ? (\n"""
    updated, count = re.subn(r"\)\s*:\s*error\s*\?\s*\(", replacement, text, count=1)
    if count != 1:
        raise SystemExit("Could not find chart error-state branch; no file was changed.")
    path.write_text(updated, encoding="utf-8")
    print("Added listing-date-unavailable chart status UI.")
