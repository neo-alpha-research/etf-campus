from pathlib import Path

page = Path(r"D:/ETFCampus/components/etf-detail/etf-detail.tsx")
s = page.read_text(encoding="utf-8")
old = '''function formatStrategyLabel(strategy: string | null | undefined, baseIndex: string): string {
  if (!strategy) return "";
  if (strategy === "일반") return baseIndex ? "지수 추종" : "일반 전략";
  return strategy;
}
'''
new = '''const INDEX_CATEGORY_LABELS: Record<string, string> = {
  "대표지수": "시장대표 지수",
  "산업·섹터": "섹터 지수",
  "테마": "테마 지수",
  "채권": "채권 지수",
  "스타일·팩터": "스타일·팩터 지수",
  "규모": "규모 지수",
  "기업집단": "기업집단 지수",
  "배당·주주환원": "배당·주주환원 지수",
};

function formatStrategyLabel(
  strategy: string | null | undefined,
  baseIndex: string,
  comparisonCategory: string | null | undefined,
): string {
  if (!strategy) return "";
  if (strategy === "일반" || strategy === "passive") {
    return INDEX_CATEGORY_LABELS[comparisonCategory ?? ""] ?? (baseIndex ? "지수 추종" : "일반 전략");
  }
  return strategy;
}
'''
if old not in s:
    raise RuntimeError("strategy helper anchor not found")
s = s.replace(old, new, 1)
old_tag = '{formatStrategyLabel(etf.classification.strategy, etf.baseIndex)}'
new_tag = '{formatStrategyLabel(etf.classification.strategy, etf.baseIndex, peerComparison?.profile?.comparisonCategory)}'
if old_tag not in s:
    raise RuntimeError("strategy label call anchor not found")
s = s.replace(old_tag, new_tag, 1)
page.write_text(s, encoding="utf-8")
print("Patched index category-aware labels")
