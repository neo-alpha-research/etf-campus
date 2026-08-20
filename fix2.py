import os
with open('components/screener/screener.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('export function Screener({ etfs }: { etfs: Etf[] })', 'export function Screener({ etfs }: { etfs: ScreenerEtf[] })')
content = content.replace('import { TER_RANGES, DEFAULT_SCREENER_FILTERS, filterEtfs', 'import { TER_RANGES, DEFAULT_SCREENER_FILTERS, filterEtfs, type ScreenerEtf')

with open('components/screener/screener.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
