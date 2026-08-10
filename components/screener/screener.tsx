"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AsOfDate, PensionBadge, ReturnCell, RiskBadge } from "@/components/etf";
import { ReturnRankingChart } from "./return-ranking-chart";
import { formatMoney } from "@/lib/domain/etf-format";
import { TER_RANGES, DEFAULT_SCREENER_FILTERS, filterEtfs, parseScreenerQuery, serializeScreenerQuery, type TerRange, type ScreenerFilters } from "@/lib/domain/etf-screener";
import { AUM_SCOPES, GENERAL_RETURN_PERIODS, type AumScope } from "@/lib/domain/etf-explorer";
import { ASSET_CLASSES, RISK_TYPES, DIVIDEND_FREQUENCIES, AMC_TYPES, MARKET_SCOPES, STRATEGIES, FX_HEDGES, RETURN_PERIOD_LABELS, type AssetClass, type Etf, type RiskType, type DividendFrequency, type AmcType, type ReturnPeriod, type MarketScope, type Strategy, type FxHedge } from "@/lib/domain/etf-types";

const riskLabels: Record<RiskType, string> = { normal: "일반형", leverage: "레버리지", inverse: "인버스" };
const aumLabels: Record<AumScope, string> = { all: "전체", "500plus": "500억원 이상", "1000plus": "1,000억원 이상" };
const terLabels: Record<TerRange, string> = { "under0.1": "0.1% 미만", "0.1to0.5": "0.1~0.5%", "over0.5": "0.5% 이상" };

type ScreenerSortKey = "return" | "aum" | "tradeValue" | "ter";
const sortLabels: Record<ScreenerSortKey, string> = {
  return: "선택 기간 수익률 높은순",
  aum: "순자산 높은순",
  tradeValue: "거래대금 높은순",
  ter: "총보수 낮은순",
};

function FilterChips<T extends string>({
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
      <label className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${isAll ? "border-brand-700 bg-brand-700 text-white shadow-sm" : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"}`}>
        <input type="checkbox" checked={isAll} className="sr-only" onChange={() => onChange([])} />
        전체
      </label>
      {options.map((value) => {
        const isChecked = selected.includes(value);
        return (
          <label key={value} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${isChecked ? "border-brand-700 bg-brand-700 text-white shadow-sm" : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"}`}>
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
}

function toggleValue<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function Screener({ etfs }: { etfs: Etf[] }) {
  const [filters, setFilters] = useState<ScreenerFilters>(DEFAULT_SCREENER_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<ReturnPeriod>("1d");
  const [sort, setSort] = useState<ScreenerSortKey>("return");

  const syncFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    setFilters(parseScreenerQuery(params));
    const p = params.get("period") as ReturnPeriod;
    setSelectedPeriod((GENERAL_RETURN_PERIODS as readonly string[]).includes(p) ? p : "1d");
    const s = params.get("sort") as ScreenerSortKey;
    setSort(Object.keys(sortLabels).includes(s) ? s : "return");
  };

  useEffect(() => {
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  const updateStateAndUrl = (nextFilters: ScreenerFilters, nextPeriod: ReturnPeriod, nextSort: ScreenerSortKey) => {
    setFilters(nextFilters);
    setSelectedPeriod(nextPeriod);
    setSort(nextSort);
    const query = new URLSearchParams(serializeScreenerQuery(nextFilters));
    if (nextPeriod !== "1d") query.set("period", nextPeriod);
    if (nextSort !== "return") query.set("sort", nextSort);
    const queryString = query.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${queryString ? `?${queryString}` : ""}`);
  };

  const updateFilters = (next: ScreenerFilters) => updateStateAndUrl(next, selectedPeriod, sort);
  const handlePeriodChange = (nextPeriod: ReturnPeriod) => updateStateAndUrl(filters, nextPeriod, sort);
  const handleSortChange = (nextSort: ScreenerSortKey) => updateStateAndUrl(filters, selectedPeriod, nextSort);

  const results = useMemo(() => {
    return filterEtfs(etfs, filters).sort((a, b) => {
      if (sort === "return") {
        const ra = a.returns[selectedPeriod] ?? -Infinity;
        const rb = b.returns[selectedPeriod] ?? -Infinity;
        if (ra !== rb) return rb - ra;
        if (a.tradeValue !== b.tradeValue) return b.tradeValue - a.tradeValue;
        if (a.aum !== b.aum) return b.aum - a.aum;
      } else if (sort === "aum") {
        if (a.aum !== b.aum) return b.aum - a.aum;
        if (a.tradeValue !== b.tradeValue) return b.tradeValue - a.tradeValue;
      } else if (sort === "tradeValue") {
        if (a.tradeValue !== b.tradeValue) return b.tradeValue - a.tradeValue;
        if (a.aum !== b.aum) return b.aum - a.aum;
      } else if (sort === "ter") {
        if (a.ter !== b.ter) return a.ter - b.ter; // asc
        if (a.aum !== b.aum) return b.aum - a.aum;
      }
      return a.ticker.localeCompare(b.ticker);
    });
  }, [etfs, filters, selectedPeriod, sort]);
  
  const activeCount = Number(filters.pensionOnly) + filters.marketScopes.length + filters.assetClasses.length + filters.riskTypes.length + filters.strategies.length + filters.fxHedges.length + (filters.aumScope !== "all" ? 1 : 0) + filters.terRanges.length + filters.dividendFrequencies.length + filters.amcs.length;

  const quickQuery = useMemo(() => {
    let quickMode = "general";
    if (filters.pensionOnly) {
      quickMode = "pension";
    } else if (filters.riskTypes.length > 0 && !filters.riskTypes.includes("normal")) {
      quickMode = "derivatives";
    }
    
    const q = new URLSearchParams();
    q.set("mode", quickMode);
    if (filters.aumScope !== "all") {
      q.set("scope", filters.aumScope);
    }
    if (selectedPeriod !== "1d") {
      q.set("period", selectedPeriod);
    }
    filters.assetClasses.forEach(v => q.append("asset", v));
    
    if (quickMode === "derivatives") {
      filters.riskTypes.forEach(v => q.append("risk", v));
    }
    return q;
  }, [filters, selectedPeriod]);

  const hasUnsupportedFilters = filters.marketScopes.length > 0 || filters.strategies.length > 0 || filters.fxHedges.length > 0 || filters.terRanges.length > 0 || filters.dividendFrequencies.length > 0 || filters.amcs.length > 0;

  const isPensionQuickActive = filters.pensionOnly;
  const togglePensionQuick = () => updateFilters({ ...filters, pensionOnly: !filters.pensionOnly });

  const isUsStockQuickActive = filters.assetClasses.includes("주식-해외") && filters.marketScopes.includes("미국");
  const toggleUsStockQuick = () => {
    if (isUsStockQuickActive) {
      updateFilters({
        ...filters,
        assetClasses: filters.assetClasses.filter(v => v !== "주식-해외"),
        marketScopes: filters.marketScopes.filter(v => v !== "미국"),
      });
    } else {
      updateFilters({
        ...filters,
        assetClasses: Array.from(new Set([...filters.assetClasses, "주식-해외"])),
        marketScopes: Array.from(new Set([...filters.marketScopes, "미국"])),
      });
    }
  };

  const isMonthlyDivQuickActive = filters.dividendFrequencies.includes("월배당");
  const toggleMonthlyDivQuick = () => {
    updateFilters({
      ...filters,
      dividendFrequencies: isMonthlyDivQuickActive ? filters.dividendFrequencies.filter(v => v !== "월배당") : [...filters.dividendFrequencies, "월배당"]
    });
  };

  const isBondParkingQuickActive = filters.assetClasses.includes("채권") && filters.assetClasses.includes("금리·파킹");
  const toggleBondParkingQuick = () => {
    if (isBondParkingQuickActive) {
      updateFilters({
        ...filters,
        assetClasses: filters.assetClasses.filter(v => v !== "채권" && v !== "금리·파킹")
      });
    } else {
      updateFilters({
        ...filters,
        assetClasses: Array.from(new Set([...filters.assetClasses, "채권", "금리·파킹"]))
      });
    }
  };

  const isAum1000QuickActive = filters.aumScope === "1000plus";
  const toggleAum1000Quick = () => updateFilters({ ...filters, aumScope: isAum1000QuickActive ? "all" : "1000plus" });

  const isSemiconductorQuickActive = filters.keyword === "반도체";
  const toggleSemiconductorQuick = () => updateFilters({ ...filters, keyword: isSemiconductorQuickActive ? "" : "반도체" });

  const isAiQuickActive = filters.keyword === "ai";
  const toggleAiQuick = () => updateFilters({ ...filters, keyword: isAiQuickActive ? "" : "ai" });

  const isDivGrowthQuickActive = filters.keyword === "배당성장";
  const toggleDivGrowthQuick = () => updateFilters({ ...filters, keyword: isDivGrowthQuickActive ? "" : "배당성장" });

  const activeFilters: { label: string; remove: () => void }[] = [];
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
  });

  return (
    <main className="page-shell flex-1 pt-2 pb-6 sm:pt-4 sm:pb-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-xs">ETF Screener</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.04em] text-strong sm:text-3xl">내 기준으로 ETF 찾기</h1>
          <p className="mt-1 text-[13px] leading-tight text-muted">선택한 조건은 URL에 저장되어 같은 결과를 다시 열거나 공유할 수 있습니다.</p>
        </div>
        <button className="rounded-xl bg-brand-700 px-3 py-2.5 text-xs font-bold text-white md:hidden" onClick={() => setFiltersOpen(true)} type="button">필터 {activeCount ? `${activeCount}개` : ""}</button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="빠른 시작 조건">
        <button
          type="button"
          aria-pressed={isPensionQuickActive}
          onClick={togglePensionQuick}
          className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-bold transition-colors ${
            isPensionQuickActive ? "border-brand-700 bg-brand-700 text-white shadow-sm" : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
          }`}
        >
          연금 가능 ETF
        </button>
        <button
          type="button"
          aria-pressed={isUsStockQuickActive}
          onClick={toggleUsStockQuick}
          className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-bold transition-colors ${
            isUsStockQuickActive ? "border-brand-700 bg-brand-700 text-white shadow-sm" : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
          }`}
        >
          미국 주식
        </button>
        <button
          type="button"
          aria-pressed={isMonthlyDivQuickActive}
          onClick={toggleMonthlyDivQuick}
          className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-bold transition-colors ${
            isMonthlyDivQuickActive ? "border-brand-700 bg-brand-700 text-white shadow-sm" : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
          }`}
        >
          월분배
        </button>
        <button
          type="button"
          aria-pressed={isBondParkingQuickActive}
          onClick={toggleBondParkingQuick}
          className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-bold transition-colors ${
            isBondParkingQuickActive ? "border-brand-700 bg-brand-700 text-white shadow-sm" : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
          }`}
        >
          채권·파킹
        </button>
        <button
          type="button"
          aria-pressed={isSemiconductorQuickActive}
          onClick={toggleSemiconductorQuick}
          className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-bold transition-colors ${
            isSemiconductorQuickActive ? "border-brand-700 bg-brand-700 text-white shadow-sm" : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
          }`}
        >
          반도체
        </button>
        <button
          type="button"
          aria-pressed={isAiQuickActive}
          onClick={toggleAiQuick}
          className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-bold transition-colors ${
            isAiQuickActive ? "border-brand-700 bg-brand-700 text-white shadow-sm" : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
          }`}
        >
          AI
        </button>
        <button
          type="button"
          aria-pressed={isDivGrowthQuickActive}
          onClick={toggleDivGrowthQuick}
          className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-bold transition-colors ${
            isDivGrowthQuickActive ? "border-brand-700 bg-brand-700 text-white shadow-sm" : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
          }`}
        >
          배당성장
        </button>
        <button
          type="button"
          aria-pressed={isAum1000QuickActive}
          onClick={toggleAum1000Quick}
          className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-bold transition-colors ${
            isAum1000QuickActive ? "border-brand-700 bg-brand-700 text-white shadow-sm" : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
          }`}
        >
          순자산 1,000억 이상
        </button>
      </div>

      <div className="mt-4 grid gap-5 md:grid-cols-[260px_minmax(0,1fr)]">
        {filtersOpen ? <button aria-label="필터 닫기" className="fixed inset-0 z-30 bg-neutral-900/30 md:hidden" onClick={() => setFiltersOpen(false)} type="button" /> : null}
        <aside aria-label="ETF 필터" className={`${filtersOpen ? "fixed inset-x-0 bottom-0 z-40 max-h-[82vh] overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl" : "hidden"} md:static md:block md:max-h-none md:rounded-2xl md:border md:border-line md:bg-neutral-50 md:p-5 md:shadow-none`}>
          <div className="flex items-center justify-between"><h2 className="text-base font-extrabold">필터</h2><button className="text-xs font-bold text-brand-700" onClick={() => updateFilters(DEFAULT_SCREENER_FILTERS)} type="button">초기화</button></div>
          <fieldset className="mt-4 border-b border-line pb-4">
            <legend className="text-[15px] font-extrabold text-strong">계좌 편입</legend>
            <label className="pt-1 flex cursor-pointer items-center justify-between rounded-xl bg-brand-50 p-3 text-sm font-bold text-brand-800">
              <span>DC·IRP 가능만</span>
              <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${filters.pensionOnly ? "bg-brand-600" : "bg-neutral-300"}`}>
                <input aria-label="DC·IRP 가능만" checked={filters.pensionOnly} className="peer sr-only" onChange={(event) => updateFilters({ ...filters, pensionOnly: event.target.checked })} type="checkbox" role="switch" />
                <span className={`inline-block size-4 transform rounded-full bg-white transition-transform ${filters.pensionOnly ? "translate-x-6" : "translate-x-1"}`} />
              </div>
            </label>
          </fieldset>
          <fieldset className="border-b border-line py-4"><legend className="text-[15px] font-extrabold text-strong">자산군</legend><FilterChips options={ASSET_CLASSES} selected={filters.assetClasses} onChange={(v) => updateFilters({ ...filters, assetClasses: v })} /></fieldset>
          <fieldset className="border-b border-line py-4"><legend className="text-[15px] font-extrabold text-strong">지역</legend><FilterChips options={MARKET_SCOPES} selected={filters.marketScopes} onChange={(v) => updateFilters({ ...filters, marketScopes: v })} /></fieldset>
          <fieldset className="border-b border-line py-4">
            <legend className="text-[15px] font-extrabold text-strong">순자산 구간</legend>
            <div className="pt-1 flex flex-wrap gap-1.5">
              {AUM_SCOPES.map((value) => {
                const isChecked = filters.aumScope === value;
                return (
                  <label key={value} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${isChecked ? "border-brand-700 bg-brand-700 text-white shadow-sm" : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"}`}>
                    <input checked={isChecked} className="sr-only" onChange={() => updateFilters({ ...filters, aumScope: value })} type="radio" name="aumScope" />
                    {aumLabels[value]}
                  </label>
                );
              })}
            </div>
          </fieldset>
          
          <div className="py-4">
            <button 
              type="button" 
              onClick={() => setAdvancedOpen(!advancedOpen)} 
              aria-expanded={advancedOpen}
              aria-controls="advanced-filters"
              className="flex w-full items-center justify-between text-[15px] font-extrabold text-strong"
            >
              세부 조건
              <svg className={`size-5 transform transition-transform ${advancedOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          <div id="advanced-filters" className={advancedOpen ? "block" : "hidden"}>
            <fieldset className="border-t border-line py-4">
              <legend className="text-[15px] font-extrabold text-strong">상품 구조</legend>
              <div className="pt-2">
                <div className="mb-2 text-xs font-bold text-muted">배율 구조</div>
                <div className="mb-4"><FilterChips options={RISK_TYPES} selected={filters.riskTypes} labels={riskLabels} onChange={(v) => updateFilters({ ...filters, riskTypes: v })} /></div>
                <div className="mb-2 text-xs font-bold text-muted">운용 전략</div>
                <FilterChips options={STRATEGIES} selected={filters.strategies} onChange={(v) => updateFilters({ ...filters, strategies: v })} />
              </div>
            </fieldset>
            <fieldset className="border-t border-line py-4"><legend className="text-[15px] font-extrabold text-strong">환헤지</legend><FilterChips options={FX_HEDGES} selected={filters.fxHedges} onChange={(v) => updateFilters({ ...filters, fxHedges: v })} /></fieldset>
            <fieldset className="border-t border-line py-4"><legend className="text-[15px] font-extrabold text-strong">총보수</legend><FilterChips options={TER_RANGES} selected={filters.terRanges} labels={terLabels} onChange={(v) => updateFilters({ ...filters, terRanges: v })} /></fieldset>
            <fieldset className="border-t border-line py-4"><legend className="text-[15px] font-extrabold text-strong">분배 방식</legend><FilterChips options={DIVIDEND_FREQUENCIES} selected={filters.dividendFrequencies} onChange={(v) => updateFilters({ ...filters, dividendFrequencies: v })} /></fieldset>
            <fieldset className="border-t border-line pt-4"><legend className="text-[15px] font-extrabold text-strong">운용사</legend><FilterChips options={AMC_TYPES} selected={filters.amcs} onChange={(v) => updateFilters({ ...filters, amcs: v })} /></fieldset>
          </div>

          <button className="sticky bottom-0 w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white md:hidden" onClick={() => setFiltersOpen(false)} type="button">{results.length.toLocaleString("ko-KR")}종목 보기</button>
        </aside>

        <section aria-labelledby="results-title" className="min-w-0">
          <ReturnRankingChart etfs={results} selectedPeriod={selectedPeriod} onPeriodChange={handlePeriodChange} />
          
          <div className="mt-8 mb-4 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2" aria-label="선택된 ETF 조건">
              {activeFilters.map(f => (
                <button key={f.label} onClick={f.remove} aria-label={`${f.label} 조건 제거`} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-strong hover:bg-neutral-50">
                  {f.label}
                  <svg className="size-3 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              ))}
            </div>
            
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-extrabold" id="results-title">검색 결과 <span className="tabular-nums text-brand-700">{results.length.toLocaleString("ko-KR")}</span></h2>
                  {activeFilters.length > 0 && (
                    <button onClick={() => updateFilters(DEFAULT_SCREENER_FILTERS)} className="text-sm font-bold text-muted hover:text-brand-700">조건 초기화</button>
                  )}
                </div>
                
                {results.length > 0 && (
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                    <Link href={`/quick?${quickQuery.toString()}`} className="inline-flex w-fit items-center gap-1 rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-bold text-strong hover:border-brand-700 hover:text-brand-700">
                      이 조건으로 상세 표 보기
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </Link>
                    {hasUnsupportedFilters && (
                      <p className="text-[11px] text-muted sm:text-xs">계좌·자산·순자산·기간 조건을 이어서 봅니다.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <label htmlFor="results-sort" className="sr-only">정렬 기준</label>
                <select
                  id="results-sort"
                  value={sort}
                  onChange={(e) => handleSortChange(e.target.value as ScreenerSortKey)}
                  className="rounded-lg border border-line bg-white py-2 pl-3 pr-8 text-sm font-bold text-strong focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  {(Object.keys(sortLabels) as ScreenerSortKey[]).map((key) => (
                    <option key={key} value={key}>{sortLabels[key]}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-2 mb-4">
            <p className="text-xs font-semibold text-muted">수익률: {RETURN_PERIOD_LABELS[selectedPeriod]} 기준 · 분배금 미포함</p>
            {etfs[0] ? <AsOfDate value={etfs[0].asOfDate} /> : null}
          </div>
          
          <div className="overflow-hidden rounded-2xl border border-line">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-50 text-xs font-bold text-muted">
                  <tr>
                    <th className="w-[150px] min-w-[150px] max-w-[150px] px-3 py-3" scope="col">종목명</th>
                    <th className="px-3 py-3 text-right" scope="col">{RETURN_PERIOD_LABELS[selectedPeriod]} 수익률</th>
                    <th className="px-3 py-3 text-right" scope="col" title="선택 기간과 별도로 보는 장기 참고 수익률">1년 수익률</th>
                    <th className="px-3 py-3 text-right" scope="col">총보수</th>
                    <th className="hidden px-3 py-3 text-right lg:table-cell" scope="col">순자산</th>
                    <th className="hidden px-3 py-3 text-right lg:table-cell" scope="col">거래대금</th>
                    <th className="hidden px-3 py-3 md:table-cell" scope="col">태그</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {results.map((etf) => (
                    <tr className="hover:bg-brand-50/50" key={etf.ticker}>
                      <th className="w-[150px] min-w-[150px] max-w-[150px] px-3 py-4 font-normal" scope="row">
                        <Link className="break-all whitespace-normal font-bold text-strong hover:text-brand-700" href={`/etf/${etf.ticker}`}>{etf.name}</Link>
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
                          <span className="tabular-nums">{etf.ticker}</span>
                          <span className="text-neutral-300">|</span>
                          <span className="truncate">{etf.classification?.marketScope || etf.assetClass}</span>
                        </div>
                      </th>
                      <td className="px-3 py-4 text-right"><ReturnCell value={etf.returns[selectedPeriod]} /></td>
                      <td className="px-3 py-4 text-right"><ReturnCell value={etf.returns["12m"]} /></td>
                      <td className="tabular-nums px-3 py-4 text-right">{(etf.ter * 100).toFixed(2)}%</td>
                      <td className="tabular-nums hidden px-3 py-4 text-right lg:table-cell">{formatMoney(etf.aum)}</td>
                      <td className="tabular-nums hidden px-3 py-4 text-right lg:table-cell">{formatMoney(etf.tradeValue)}</td>
                      <td className="hidden px-3 py-4 md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          <RiskBadge riskType={etf.riskType} />
                          <PensionBadge status={etf.pension} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
