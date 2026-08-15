from pathlib import Path

path = Path(r"D:/ETFCampus/app/etf/[ticker]/page.tsx")
source = path.read_text(encoding="utf-8")
source = source.replace(
    'import { getComparableEtfs } from "@/lib/data/etf-peer-groups";',
    'import { getPeerComparison } from "@/lib/data/etf-peer-groups";',
    1,
)
start = source.find("  // Expose only direct peers")
end = source.find("  return <EtfDetail", start)
if start < 0 or end < 0:
    raise RuntimeError("Peer comparison region not found")
replacement = '''  const peerComparison = getPeerComparison(etf, etfs);
'''
source = source[:start] + replacement + source[end:]
source = source.replace(
    'return <EtfDetail etf={etf} similarTopEtfs={similarTopEtfs} />;',
    'return <EtfDetail etf={etf} peerCmparison={peerComparison} />;',
    1,
)
if "getComparableEtfs" in source or "similarTopEtfs" in source:
    raise RuntimeError("Legacy similar ETF logic remains")
path.write_text(source, encoding="utf-8")
print("Patched", path)
