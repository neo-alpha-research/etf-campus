from pathlib import Path

path = Path(r"D:/ETFCampus/components/etf-detail/etf-detail.tsx")
source = path.read_text(encoding="utf-8")

source = source.replace(
    'import { EtfDetailClient, CompareActionButton } from "./etf-detail-client";',
    'import { EtfDetailClient } from "./etf-detail-client";\nimport type { PeerComparison } from "@/lib/data/etf-peer-groups";',
    1,
)
start = source.find("export function EtfDetail({ etf, similarTopEtfs")
end = source.find("}) {", start)
if start < 0 or end < 0:
    raise RuntimeError("EtfDetail props declaration not found")
source = source[:start] + '''export function EtfDetail({ etf, peerComparison }: { etf: Etf; peerComparison: PeerComparison }) {''' + source[end + 4:]
source = source.replace(
    '<EtfDetailClient etf={etf} similarTopEtfs={similarTopEtfs}>',
    '<EtfDetailClient etf={etf} peerComparison={peerComparison}>',
    1,
)
source = source.replace('            <CompareActionButton etf={etf} />\n', '', 1)
if "similarTopEtfs" in source or "CompareActionButton" in source:
    raise RuntimeError("Legacy detail comparison references remain")
path.write_text(source, encoding="utf-8")
print("Patched", path)
