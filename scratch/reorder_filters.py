import re

with open('components/screener/screener.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_block = """  const activeFilters: { label: string; remove: () => void }[] = [];
  if (filters.keyword) {
    activeFilters.push({ label: `키워드: ${filters.keyword}`, remove: () => updateFilters({ ...filters, keyword: "" }) });
  }
  if (filters.pensionOnly) {
    activeFilters.push({ label: "DC·IRP 가능", remove: () => updateFilters({ ...filters, pensionOnly: false }) });
  }
  filters.marketScopes.forEach(v => {
    activeFilters.push({ label: v, remove: () => updateFilters({ ...filters, marketScopes: filters.marketScopes.filter(i => i !== v) }) });
  });
  filters.assetClasses.forEach(v => {
    activeFilters.push({ label: v, remove: () => updateFilters({ ...filters, assetClasses: filters.assetClasses.filter(i => i !== v) }) });
  });
  filters.riskTypes.forEach(v => {
    activeFilters.push({ label: riskLabels[v], remove: () => updateFilters({ ...filters, riskTypes: filters.riskTypes.filter(i => i !== v) }) });
  });
  filters.strategies.forEach(v => {
    activeFilters.push({ label: v, remove: () => updateFilters({ ...filters, strategies: filters.strategies.filter(i => i !== v) }) });
  });
  filters.fxHedges.forEach(v => {
    activeFilters.push({ label: v, remove: () => updateFilters({ ...filters, fxHedges: filters.fxHedges.filter(i => i !== v) }) });
  });
  if (filters.aumScope !== "all") {
    activeFilters.push({ label: `순자산 ${aumLabels[filters.aumScope]}`, remove: () => updateFilters({ ...filters, aumScope: "all" }) });
  }
  filters.terRanges.forEach(v => {
    activeFilters.push({ label: `총보수 ${terLabels[v]}`, remove: () => updateFilters({ ...filters, terRanges: filters.terRanges.filter(i => i !== v) }) });
  });
  filters.dividendFrequencies.forEach(v => {
    activeFilters.push({ label: v, remove: () => updateFilters({ ...filters, dividendFrequencies: filters.dividendFrequencies.filter(i => i !== v) }) });
  });
  filters.amcs.forEach(v => {
    activeFilters.push({ label: v, remove: () => updateFilters({ ...filters, amcs: filters.amcs.filter(i => i !== v) }) });
  });"""

new_block = """  const activeFilters: { label: string; remove: () => void }[] = [];
  
  // 1순위: 아이덴티티
  if (filters.keyword) {
    activeFilters.push({ label: `키워드: ${filters.keyword}`, remove: () => updateFilters({ ...filters, keyword: "" }) });
  }
  filters.marketScopes.forEach(v => {
    activeFilters.push({ label: v, remove: () => updateFilters({ ...filters, marketScopes: filters.marketScopes.filter(i => i !== v) }) });
  });
  filters.assetClasses.forEach(v => {
    activeFilters.push({ label: v, remove: () => updateFilters({ ...filters, assetClasses: filters.assetClasses.filter(i => i !== v) }) });
  });

  // 2순위: 성격 및 전략
  filters.riskTypes.forEach(v => {
    activeFilters.push({ label: riskLabels[v], remove: () => updateFilters({ ...filters, riskTypes: filters.riskTypes.filter(i => i !== v) }) });
  });
  filters.strategies.forEach(v => {
    activeFilters.push({ label: v, remove: () => updateFilters({ ...filters, strategies: filters.strategies.filter(i => i !== v) }) });
  });
  if (filters.pensionOnly) {
    activeFilters.push({ label: "DC·IRP 가능", remove: () => updateFilters({ ...filters, pensionOnly: false }) });
  }

  // 3순위: 기타 스펙
  if (filters.aumScope !== "all") {
    activeFilters.push({ label: `순자산 ${aumLabels[filters.aumScope]}`, remove: () => updateFilters({ ...filters, aumScope: "all" }) });
  }
  filters.terRanges.forEach(v => {
    activeFilters.push({ label: `총보수 ${terLabels[v]}`, remove: () => updateFilters({ ...filters, terRanges: filters.terRanges.filter(i => i !== v) }) });
  });
  filters.fxHedges.forEach(v => {
    activeFilters.push({ label: v, remove: () => updateFilters({ ...filters, fxHedges: filters.fxHedges.filter(i => i !== v) }) });
  });
  filters.dividendFrequencies.forEach(v => {
    activeFilters.push({ label: v, remove: () => updateFilters({ ...filters, dividendFrequencies: filters.dividendFrequencies.filter(i => i !== v) }) });
  });
  filters.amcs.forEach(v => {
    activeFilters.push({ label: v, remove: () => updateFilters({ ...filters, amcs: filters.amcs.filter(i => i !== v) }) });
  });"""

if old_block in content:
    content = content.replace(old_block, new_block)
    with open('components/screener/screener.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Successfully reordered activeFilters')
else:
    print('Failed to find old block')
