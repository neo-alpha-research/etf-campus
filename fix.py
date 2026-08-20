import os
with open('lib/domain/etf-screener.ts', 'r', encoding='utf-8') as f:
    content = f.read()
    
replacement = '''export type ScreenerEtf = Pick<Etf,
  | "ticker"
  | "name"
  | "baseIndex"
  | "close"
  | "tradeValue"
  | "aum"
  | "fee"
  | "issuer"
  | "riskType"
  | "assetClass"
  | "pension"
  | "asOfDate"
  | "returns"
  | "classification"
>;

export function filterEtfs(etfs: readonly ScreenerEtf[], filters: ScreenerFilters): ScreenerEtf[] {'''

content = content.replace('export function filterEtfs(etfs: readonly Etf[], filters: ScreenerFilters): Etf[] {', replacement)

with open('lib/domain/etf-screener.ts', 'w', encoding='utf-8') as f:
    f.write(content)
