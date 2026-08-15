from pathlib import Path

path = Path(r"D:/ETFCampus/components/etf-detail/etf-detail.tsx")
source = path.read_text(encoding="utf-8")
source = source.replace('peerComparison: PeerComparison', 'peerComparison?: PeerComparison', 1)
source = source.replace(
    'export function EtfDetail({ etf, peerComparison }: { etf: Etf; peerComparison?: PeerComparison }) {',
    '''export function EtfDetail({ etf, peerComparison }: { etf: Etf; peerComparison?: PeerComparison }) {
  const resolvedPeerComparison: PeerComparison = peerComparison ?? {
    profile: null,
    state: "unverified",
    groups: [],
  };''',
    1,
)
source = source.replace('peerComparison={peerComparison}', 'peerComparison={resolvedPeerComparison}', 1)
path.write_text(source, encoding="utf-8")
print("Patched", path)
