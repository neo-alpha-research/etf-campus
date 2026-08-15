from pathlib import Path

path = Path(r"D:/ETFCampus/components/etf-detail/etf-detail.tsx")
source = path.read_text(encoding="utf-8")
source = source.replace('import { getReturnPeriods, isNewListing } from "@/lib/domain/etf-explorer";', 'import { isNewListing } from "@/lib/domain/etf-explorer";', 1)
source = source.replace('  const returnPeriods = getReturnPeriods(etf.returns);\n', '', 1)
path.write_text(source, encoding="utf-8")
print("Patched", path)
