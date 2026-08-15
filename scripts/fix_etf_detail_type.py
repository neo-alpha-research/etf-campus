from pathlib import Path

path = Path(r"D:/ETFCampus/components/etf-detail/etf-detail.tsx")
source = path.read_text(encoding="utf-8")
if 'peerComparison?: any' not in source:
    raise RuntimeError("Expected peerComparison type anchor not found")
source = source.replace('peerComparison?: any', 'peerComparison: PeerComparison', 1)
path.write_text(source, encoding="utf-8")
print("Patched", path)
