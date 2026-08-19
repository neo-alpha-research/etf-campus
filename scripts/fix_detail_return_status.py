from pathlib import Path

client = Path(r"D:/ETFCampus/components/etf-detail/etf-detail-client.tsx")
s = client.read_text(encoding="utf-8")
s = s.replace('  peerComparison: PeerComparison;\n  children: ReactNode;', '  peerComparison: PeerComparison;\n  returnDisplayStatus?: unknown;\n  children: ReactNode;', 1)
s = s.replace('export function EtfDetailClient({ etf, peerComparison, children }: Props)', 'export function EtfDetailClient({ etf, peerComparison, children }: Props)', 1)
client.write_text(s, encoding="utf-8")

wrapper = Path(r"D:/ETFCampus/components/etf-detail/etf-detail.tsx")
s = wrapper.read_text(encoding="utf-8")
s = s.replace('export function EtfDetail({ etf, peerComparison }: { etf: Etf; peerComparison?: PeerComparison })', 'export function EtfDetail({ etf, peerComparison, returnDisplayStatus }: { etf: Etf; peerComparison?: PeerComparison; returnDisplayStatus?: unknown })', 1)
s = s.replace('<EtfDetailClient etf={etf} peerComparison={resolvedPeerComparison}>', '<EtfDetailClient etf={etf} peerComparison={resolvedPeerComparison} returnDisplayStatus={returnDisplayStatus}>', 1)
wrapper.write_text(s, encoding="utf-8")
print("Patched detail prop threading")
