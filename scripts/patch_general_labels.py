from pathlib import Path

risk = Path(r"D:/ETFCampus/components/etf/risk-badge.tsx")
s = risk.read_text(encoding="utf-8")
old = 'normal: "일반",'
if old not in s:
    raise RuntimeError("RiskBadge normal label anchor not found")
risk.write_text(s.replace(old, 'normal: "일반형",', 1), encoding="utf-8")

page = Path(r"D:/ETFCampus/components/etf-detail/etf-detail.tsx")
s = page.read_text(encoding="utf-8")
anchor = 'export function EtfDetail({ etf, peerComparison, returnDisplayStatus }: { etf: Etf; peerComparison?: PeerComparison; returnDisplayStatus?: unknown }) {'
helper = '''function formatStrategyLabel(strategy: string | null | undefined, baseIndex: string): string {
  if (!strategy) return "";
  if (strategy === "일반") return baseIndex ? "지수 추종" : "일반 전략";
  return strategy;
}

'''
if 'function formatStrategyLabel(' not in s:
    if anchor not in s:
        raise RuntimeError("EtfDetail export anchor not found")
    s = s.replace(anchor, helper + anchor, 1)
old_tag = '{etf.classification.strategy}</span>'
new_tag = '{formatStrategyLabel(etf.classification.strategy, etf.baseIndex)}</span>'
if old_tag not in s:
    raise RuntimeError("strategy tag anchor not found")
s = s.replace(old_tag, new_tag, 1)
page.write_text(s, encoding="utf-8")
print("Patched user-facing strategy and risk labels")
