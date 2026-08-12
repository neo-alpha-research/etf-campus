import re

with open('components/dashboard/dashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update the col elements for periods
content = re.sub(
    r'<col key=\{period\} style=\{\{ width: period === "ytd" \|\| period === "itd" \? 56 : 54 \}\} />',
    r'<col key={period} style={{ width: 48 }} />',
    content
)

# 2. Update the group header
content = content.replace(
    'colSpan={returnsColSpan} scope="colgroup">수익률</th>',
    'colSpan={returnsColSpan} scope="colgroup">수익률(%)</th>'
)

# 3. Update the period th rendering
old_th = """                  const isYtd = period === "ytd" || period === "itd";
                  const width = isYtd ? 56 : 54;
                  const borderL = isYtd ? 'border-l-2 border-neutral-200' : index === 0 ? 'border-l border-neutral-200' : '';
                  const bg = normalizedPeriod === period && !isYtd ? "bg-brand-100 text-brand-900" : isYtd ? "bg-neutral-100/60" : "bg-neutral-50";
                  return (
                    <th aria-label={`${RETURN_PERIOD_LABELS[period]} 수익률, 단위 퍼센트`} className={`sticky top-[32px] z-20 h-[48px] px-0.5 py-0 text-center ${borderL} ${bg}`} key={period} scope="col" style={{ width: `${width}px` }}>
                      <UnitHeaderLabel label={RETURN_PERIOD_LABELS[period]} unit="%" />
                    </th>"""

new_th = """                  const isYtd = period === "ytd" || period === "itd";
                  const width = 48;
                  const borderL = isYtd ? 'border-l-2 border-neutral-200' : index === 0 ? 'border-l border-neutral-200' : '';
                  const bg = normalizedPeriod === period && !isYtd ? "bg-brand-100 text-brand-900" : isYtd ? "bg-neutral-100/60" : "bg-neutral-50";
                  return (
                    <th aria-label={`${RETURN_PERIOD_LABELS[period]} 수익률`} className={`sticky top-[32px] z-20 h-[48px] px-0.5 py-0 text-center ${borderL} ${bg}`} key={period} scope="col" style={{ width: `${width}px` }}>
                      <span className="whitespace-nowrap text-[11px] tracking-tighter font-bold text-strong">{RETURN_PERIOD_LABELS[period]}</span>
                    </th>"""

content = content.replace(old_th, new_th)

old_td = """                      <td className={`px-1 py-2 text-center align-middle whitespace-nowrap ${borderL} ${bg}`} key={period}>
                        <ReturnCell value={etf.returns[period]} />
                      </td>"""

new_td = """                      <td className={`px-0.5 py-2 text-center align-middle whitespace-nowrap text-[11px] tracking-tighter ${borderL} ${bg}`} key={period}>
                        <ReturnCell value={etf.returns[period]} showUnit={false} />
                      </td>"""

content = content.replace(old_td, new_td)

with open('components/dashboard/dashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
