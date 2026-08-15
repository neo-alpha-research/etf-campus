from pathlib import Path

path = Path(r"D:/ETFCampus/lib/data/__tests__/etf-peer-groups.test.ts")
source = path.read_text(encoding="utf-8")
old = 'replicationMethod: "" }))).toBe(5);'
new = 'replicationMethod: "" }))).toBe(0);'
if old not in source:
    raise RuntimeError("Test expectation anchor not found")
path.write_text(source.replace(old, new, 1), encoding="utf-8")
print("Patched", path)
