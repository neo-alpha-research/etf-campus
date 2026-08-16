from pathlib import Path
p=Path(r'D:/ETFCampus/components/etf/risk-badge.tsx')
s=p.read_text(encoding='utf-8')
old='  if (riskType === "normal") {'
if old not in s: raise RuntimeError('normal risk branch anchor not found')
start=s.index(old)
end=s.index('\n  }', start)+4
s=s[:start]+'  if (riskType === "normal") return null;'+s[end:]
p.write_text(s,encoding='utf-8')
print('Hidden normal risk badge; leverage and inverse remain visible')
