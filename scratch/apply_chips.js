const fs = require('fs');
let code = fs.readFileSync('components/screener/screener.tsx', 'utf-8');

const filterChipsComp = `function FilterChips<T extends string>({
  options,
  selected,
  onChange,
  labels,
}: {
  options: readonly T[];
  selected: readonly T[];
  onChange: (values: T[]) => void;
  labels?: Record<string, string>;
}) {
  const isAll = selected.length === 0;
  return (
    <div className="pt-2 flex flex-wrap gap-1.5">
      <label className={\`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors \${isAll ? "border-brand-700 bg-brand-50 text-brand-700" : "border-line text-muted hover:bg-neutral-50"}\`}>
        <input type="checkbox" checked={isAll} className="sr-only" onChange={() => onChange([])} />
        전체
      </label>
      {options.map((value) => {
        const isChecked = selected.includes(value);
        return (
          <label key={value} className={\`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors \${isChecked ? "border-brand-700 bg-brand-50 text-brand-700" : "border-line text-muted hover:bg-neutral-50"}\`}>
            <input type="checkbox" checked={isChecked} className="sr-only" onChange={() => {
              if (isChecked) {
                onChange(selected.filter((v) => v !== value));
              } else {
                onChange([...selected, value]);
              }
            }} />
            {labels ? labels[value as string] || value : value}
          </label>
        );
      })}
    </div>
  );
}`;

code = code.replace(
  'function toggleValue<T>(values: readonly T[], value: T): T[] {',
  filterChipsComp + '\n\nfunction toggleValue<T>(values: readonly T[], value: T): T[] {'
);

const replacements = [
  {
    target: '<fieldset className="border-b border-line py-4"><legend className="text-[15px] font-extrabold text-strong">자산군</legend><div className="pt-1 grid grid-cols-2 gap-x-2 gap-y-2">{ASSET_CLASSES.map((value) => <label className="flex items-center gap-2 text-sm text-muted" key={value}><input checked={filters.assetClasses.includes(value)} className="size-4 accent-brand-700" onChange={() => updateFilters({ ...filters, assetClasses: toggleValue<AssetClass>(filters.assetClasses, value) })} type="checkbox" />{value}</label>)}</div></fieldset>',
    replacement: '<fieldset className="border-b border-line py-4"><legend className="text-[15px] font-extrabold text-strong">자산군</legend><FilterChips options={ASSET_CLASSES} selected={filters.assetClasses} onChange={(v) => updateFilters({ ...filters, assetClasses: v })} /></fieldset>'
  },
  {
    target: '<fieldset className="border-b border-line py-4"><legend className="text-[15px] font-extrabold text-strong">지역</legend><div className="pt-1 grid grid-cols-2 gap-x-2 gap-y-2">{MARKET_SCOPES.map((value) => <label className="flex items-center gap-2 text-sm text-muted" key={value}><input checked={filters.marketScopes.includes(value)} className="size-4 accent-brand-700" onChange={() => updateFilters({ ...filters, marketScopes: toggleValue<MarketScope>(filters.marketScopes, value) })} type="checkbox" />{value}</label>)}</div></fieldset>',
    replacement: '<fieldset className="border-b border-line py-4"><legend className="text-[15px] font-extrabold text-strong">지역</legend><FilterChips options={MARKET_SCOPES} selected={filters.marketScopes} onChange={(v) => updateFilters({ ...filters, marketScopes: v })} /></fieldset>'
  },
  {
    target: '<div className="mb-4 grid grid-cols-2 gap-x-2 gap-y-2">\n                  {RISK_TYPES.map((value) => <label className="flex items-center gap-2 text-sm text-muted" key={value}><input checked={filters.riskTypes.includes(value)} className="size-4 accent-brand-700" onChange={() => updateFilters({ ...filters, riskTypes: toggleValue<RiskType>(filters.riskTypes, value) })} type="checkbox" />{riskLabels[value]}</label>)}\n                </div>',
    replacement: '<div className="mb-4"><FilterChips options={RISK_TYPES} selected={filters.riskTypes} labels={riskLabels} onChange={(v) => updateFilters({ ...filters, riskTypes: v })} /></div>'
  },
  {
    target: '<div className="grid grid-cols-2 gap-x-2 gap-y-2">\n                  {STRATEGIES.map((value) => <label className="flex items-center gap-2 text-sm text-muted" key={value}><input checked={filters.strategies.includes(value)} className="size-4 accent-brand-700" onChange={() => updateFilters({ ...filters, strategies: toggleValue<Strategy>(filters.strategies, value) })} type="checkbox" />{value}</label>)}\n                </div>',
    replacement: '<FilterChips options={STRATEGIES} selected={filters.strategies} onChange={(v) => updateFilters({ ...filters, strategies: v })} />'
  },
  {
    target: '<fieldset className="border-t border-line py-4"><legend className="text-[15px] font-extrabold text-strong">환헤지</legend><div className="pt-1 grid grid-cols-2 gap-x-2 gap-y-2">{FX_HEDGES.map((value) => <label className="flex items-center gap-2 text-sm text-muted" key={value}><input checked={filters.fxHedges.includes(value)} className="size-4 accent-brand-700" onChange={() => updateFilters({ ...filters, fxHedges: toggleValue<FxHedge>(filters.fxHedges, value) })} type="checkbox" />{value}</label>)}</div></fieldset>',
    replacement: '<fieldset className="border-t border-line py-4"><legend className="text-[15px] font-extrabold text-strong">환헤지</legend><FilterChips options={FX_HEDGES} selected={filters.fxHedges} onChange={(v) => updateFilters({ ...filters, fxHedges: v })} /></fieldset>'
  },
  {
    target: '<fieldset className="border-t border-line py-4"><legend className="text-[15px] font-extrabold text-strong">총보수</legend><div className="pt-1 grid grid-cols-2 gap-x-2 gap-y-2">{TER_RANGES.map((value) => <label className="flex items-center gap-2 text-sm text-muted" key={value}><input checked={filters.terRanges.includes(value)} className="size-4 accent-brand-700" onChange={() => updateFilters({ ...filters, terRanges: toggleValue<TerRange>(filters.terRanges, value) })} type="checkbox" />{terLabels[value]}</label>)}</div></fieldset>',
    replacement: '<fieldset className="border-t border-line py-4"><legend className="text-[15px] font-extrabold text-strong">총보수</legend><FilterChips options={TER_RANGES} selected={filters.terRanges} labels={terLabels} onChange={(v) => updateFilters({ ...filters, terRanges: v })} /></fieldset>'
  },
  {
    target: '<fieldset className="border-t border-line py-4"><legend className="text-[15px] font-extrabold text-strong">분배 방식</legend><div className="pt-1 grid grid-cols-2 gap-x-2 gap-y-2">{DIVIDEND_FREQUENCIES.map((value) => <label className="flex items-center gap-2 text-sm text-muted" key={value}><input checked={filters.dividendFrequencies.includes(value)} className="size-4 accent-brand-700" onChange={() => updateFilters({ ...filters, dividendFrequencies: toggleValue<DividendFrequency>(filters.dividendFrequencies, value) })} type="checkbox" />{value}</label>)}</div></fieldset>',
    replacement: '<fieldset className="border-t border-line py-4"><legend className="text-[15px] font-extrabold text-strong">분배 방식</legend><FilterChips options={DIVIDEND_FREQUENCIES} selected={filters.dividendFrequencies} onChange={(v) => updateFilters({ ...filters, dividendFrequencies: v })} /></fieldset>'
  },
  {
    target: '<fieldset className="border-t border-line pt-4"><legend className="text-[15px] font-extrabold text-strong">운용사</legend><div className="pt-1 grid grid-cols-2 gap-x-2 gap-y-2">{AMC_TYPES.map((value) => <label className="flex items-center gap-2 text-sm text-muted" key={value}><input checked={filters.amcs.includes(value)} className="size-4 accent-brand-700" onChange={() => updateFilters({ ...filters, amcs: toggleValue<AmcType>(filters.amcs, value) })} type="checkbox" />{value}</label>)}</div></fieldset>',
    replacement: '<fieldset className="border-t border-line pt-4"><legend className="text-[15px] font-extrabold text-strong">운용사</legend><FilterChips options={AMC_TYPES} selected={filters.amcs} onChange={(v) => updateFilters({ ...filters, amcs: v })} /></fieldset>'
  }
];

let successCount = 0;
for (const r of replacements) {
  if (code.includes(r.target)) {
    code = code.replace(r.target, r.replacement);
    successCount++;
  } else {
    console.error("Could not find target:\\n" + r.target);
  }
}

fs.writeFileSync('components/screener/screener.tsx', code);
console.log('Successfully replaced', successCount, 'targets.');
