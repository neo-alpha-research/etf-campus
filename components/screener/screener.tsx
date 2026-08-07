"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AsOfDate, AssetClassTag, PensionBadge, ReturnCell, RiskBadge } from "@/components/etf";
import { ReturnRankingChart } from "./return-ranking-chart";
import { formatMoney } from "@/lib/domain/etf-format";
import { AUM_RANGES, DEFAULT_SCREENER_FILTERS, filterEtfs, parseScreenerQuery, serializeScreenerQuery, type AumRange, type ScreenerFilters } from "@/lib/domain/etf-screener";
import { ASSET_CLASSES, RISK_TYPES, type AssetClass, type Etf, type RiskType } from "@/lib/domain/etf-types";

const riskLabels: Record<RiskType, string> = { normal: "일반", leverage: "레버리지", inverse: "인버스" };
const aumLabels: Record<AumRange, string> = { under100: "100억원 미만", "100to500": "100억~500억원", "500plus": "500억원 이상" };

function toggleValue<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function Screener({ etfs }: { etfs: Etf[] }) {
  const [filters, setFilters] = useState<ScreenerFilters>(DEFAULT_SCREENER_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const syncFromUrl = () => setFilters(parseScreenerQuery(new URLSearchParams(window.location.search)));
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  const updateFilters = (next: ScreenerFilters) => {
    setFilters(next);
    const query = serializeScreenerQuery(next);
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  };

  const results = useMemo(() => filterEtfs(etfs, filters).sort((a, b) => b.tradeValue - a.tradeValue), [etfs, filters]);
  const activeCount = Number(filters.pensionOnly) + filters.assetClasses.length + filters.riskTypes.length + filters.aumRanges.length;

  return (
    <main className="page-shell flex-1 py-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">ETF Screener</p><h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-strong sm:text-4xl">내 기준으로 ETF 찾기</h1><p className="mt-3 text-sm leading-6 text-muted">선택한 조건은 URL에 저장되어 같은 결과를 다시 열거나 공유할 수 있습니다.</p></div>
        <button className="rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white md:hidden" onClick={() => setFiltersOpen(true)} type="button">필터 {activeCount ? `${activeCount}개` : ""}</button>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
        {filtersOpen ? <button aria-label="필터 닫기" className="fixed inset-0 z-30 bg-neutral-900/30 md:hidden" onClick={() => setFiltersOpen(false)} type="button" /> : null}
        <aside aria-label="ETF 필터" className={`${filtersOpen ? "fixed inset-x-0 bottom-0 z-40 max-h-[82vh] overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl" : "hidden"} md:static md:block md:max-h-none md:rounded-2xl md:border md:border-line md:bg-neutral-50 md:p-5 md:shadow-none`}>
          <div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">필터</h2><button className="text-xs font-bold text-brand-700" onClick={() => updateFilters(DEFAULT_SCREENER_FILTERS)} type="button">초기화</button></div>
          <fieldset className="mt-5 border-b border-line pb-5">
            <legend className="text-sm font-extrabold">계좌유형</legend>
            <label className="mt-3 flex cursor-pointer items-center justify-between rounded-xl bg-brand-50 p-3 text-sm font-bold text-brand-800">
              <span>연금 가능만</span>
              <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${filters.pensionOnly ? "bg-brand-600" : "bg-neutral-300"}`}>
                <input checked={filters.pensionOnly} className="peer sr-only" onChange={(event) => updateFilters({ ...filters, pensionOnly: event.target.checked })} type="checkbox" role="switch" />
                <span className={`inline-block size-4 transform rounded-full bg-white transition-transform ${filters.pensionOnly ? "translate-x-6" : "translate-x-1"}`} />
              </div>
            </label>
          </fieldset>
          <fieldset className="border-b border-line py-5"><legend className="text-sm font-extrabold">자산군</legend><div className="mt-3 space-y-2">{ASSET_CLASSES.map((value) => <label className="flex items-center gap-2 text-sm text-muted" key={value}><input checked={filters.assetClasses.includes(value)} className="size-4 accent-brand-700" onChange={() => updateFilters({ ...filters, assetClasses: toggleValue<AssetClass>(filters.assetClasses, value) })} type="checkbox" />{value}</label>)}</div></fieldset>
          <fieldset className="border-b border-line py-5"><legend className="text-sm font-extrabold">위험유형</legend><div className="mt-3 space-y-2">{RISK_TYPES.map((value) => <label className="flex items-center gap-2 text-sm text-muted" key={value}><input checked={filters.riskTypes.includes(value)} className="size-4 accent-brand-700" onChange={() => updateFilters({ ...filters, riskTypes: toggleValue<RiskType>(filters.riskTypes, value) })} type="checkbox" />{riskLabels[value]}</label>)}</div></fieldset>
          <fieldset className="py-5">
            <legend className="text-sm font-extrabold">순자산 구간</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {AUM_RANGES.map((value) => {
                const isChecked = filters.aumRanges.includes(value);
                return (
                  <label key={value} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${isChecked ? "border-brand-700 bg-brand-50 text-brand-700" : "border-line text-muted hover:bg-neutral-50"}`}>
                    <input checked={isChecked} className="sr-only" onChange={() => updateFilters({ ...filters, aumRanges: toggleValue<AumRange>(filters.aumRanges, value) })} type="checkbox" />
                    {aumLabels[value]}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <button className="sticky bottom-0 w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white md:hidden" onClick={() => setFiltersOpen(false)} type="button">{results.length.toLocaleString("ko-KR")}종목 보기</button>
        </aside>

        <section aria-labelledby="results-title" className="min-w-0">
          <ReturnRankingChart etfs={results} />
          <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-extrabold" id="results-title">검색 결과 <span className="tabular-nums text-brand-700">{results.length.toLocaleString("ko-KR")}</span></h2>{etfs[0] ? <AsOfDate value={etfs[0].asOfDate} /> : null}</div>
          <p className="mt-2 text-xs font-semibold text-muted">수익률: 1개월 가격 기준·분배금 미포함 · 거래대금순</p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-line"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-neutral-50 text-xs font-bold text-muted"><tr><th className="min-w-44 px-4 py-3" scope="col">종목명</th><th className="px-3 py-3 text-right" scope="col">등락률</th><th className="px-4 py-3 text-right" scope="col">1개월 수익률</th><th className="hidden px-3 py-3 text-right lg:table-cell" scope="col">순자산</th><th className="hidden px-3 py-3 md:table-cell" scope="col">분류</th><th className="hidden px-4 py-3 md:table-cell" scope="col">연금</th></tr></thead>
          <tbody className="divide-y divide-line">{results.map((etf) => <tr className="hover:bg-brand-50/50" key={etf.ticker}><th className="px-4 py-4 font-normal" scope="row"><Link className="font-bold text-strong hover:text-brand-700" href={`/etf/${etf.ticker}`}>{etf.name}</Link><p className="tabular-nums mt-1 text-xs text-muted">{etf.ticker}</p></th><td className="px-3 py-4 text-right"><ReturnCell value={etf.changePct} /></td><td className="px-4 py-4 text-right"><ReturnCell value={etf.returns["1m"]} /></td><td className="tabular-nums hidden px-3 py-4 text-right lg:table-cell">{formatMoney(etf.aum)}</td><td className="hidden px-3 py-4 md:table-cell"><div className="flex flex-wrap gap-1"><AssetClassTag assetClass={etf.assetClass} /><RiskBadge riskType={etf.riskType} /></div></td><td className="hidden px-4 py-4 md:table-cell"><PensionBadge status={etf.pension} /></td></tr>)}</tbody></table></div></div>
        </section>
      </div>
    </main>
  );
}
