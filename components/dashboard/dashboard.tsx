"use client";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

import { Tickery } from "@/components/brand/tickery";
import { AsOfDate, PensionBadge, ReturnCell } from "@/components/etf";
import { getClassificationFields } from "@/lib/domain/etf-classification";
import { formatAsOfDate, formatAumNumber, formatTradeValueNumber, formatWonNumber } from "@/lib/domain/etf-format";
import {
  DEFAULT_EXPLORER_STATE,
  applyExplorerFilters,
  filterEtfsByMode,
  getDefaultPeriod,
  getEtfSearchSuggestions,
  getEtfsByAumScope,
  getReturnPeriods,
  parseExplorerQuery,
  searchEtfs,
  serializeExplorerQuery,
  sortExplorerEtfs,
  type AumScope,
  type ExplorerState,
  type InvestorMode,
} from "@/lib/domain/etf-explorer";
import {
  ASSET_CLASSES,
  RETURN_PERIOD_LABELS,
  RISK_TYPES,
  type AssetClass,
  type Etf,
  type RiskType,
  type ReturnPeriod,
} from "@/lib/domain/etf-types";

const modeCopy: Record<InvestorMode, { eyebrow: string; title: string; description: string }> = {
  general: {
    eyebrow: "General Account",
    title: "일반 계좌 ETF",
    description: "레버리지·인버스를 분리한 일반 구조 ETF를 규모와 기간수익률 기준으로 살펴봅니다.",
  },
  pension: {
    eyebrow: "DC · IRP",
    title: "퇴직연금 DC·IRP 편입 가능 ETF",
    description: "공식 확인과 구조 기준 검수를 거쳐 DC·IRP 편입 가능으로 분류된 일반형 ETF입니다.",
  },
  derivatives: {
    eyebrow: "Leveraged · Inverse",
    title: "레버리지·인버스 ETF",
    description: "일간 배수 구조의 상품을 일반 계좌 ETF와 분리해 위험유형과 단기 움직임 중심으로 살펴봅니다.",
  },
  new: {
    eyebrow: "New Listings",
    title: "상장 후 90일 이내 신규 ETF",
    description: "데이터 기준일과 상장일의 차이가 0~90일인 ETF를 순자산 규모와 관계없이 모두 표시합니다.",
  },
  mixed_bonds: {
    eyebrow: "Mixed Bonds",
    title: "혼합 채권 ETF",
    description: "혼합·자산배분으로 분류된 ETF 중 채권이 포함된 종목만 모아서 살펴봅니다.",
  },
  tdf: {
    eyebrow: "Target Date Fund",
    title: "TDF ETF",
    description: "은퇴 시점을 목표로 자산 비중을 자동으로 조절하는 TDF(Target Date Fund) ETF입니다.",
  },
};

const scopeOptions: { value: AumScope; label: string; summary: string }[] = [
  { value: "1000plus", label: "1,000억 이상", summary: "1,000억 이상" },
  { value: "500plus", label: "500억 이상", summary: "500억 이상" },
  { value: "all", label: "전체", summary: "전체" },
];

const riskLabels: Record<RiskType, string> = { normal: "일반", leverage: "레버리지", inverse: "인버스" };

function toggleValue<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function updateUrl(state: ExplorerState): void {
  const query = serializeExplorerQuery(state);
  if (!window.location.pathname.includes('/quick')) return;
  window.history.replaceState(window.history.state, "", `${window.location.pathname}?${query}`);
}

function getAllowedRiskTypes(mode: InvestorMode): readonly RiskType[] {
  if (mode === "derivatives") return ["leverage", "inverse"];
  if (mode === "new") return RISK_TYPES;
  return [];
}

function SearchSuggestionMeta({ etf }: { etf: Pick<Etf, "assetClass" | "ticker"> }) {
  const assetClass = etf.assetClass.replace("주식-", "");
  return <span className="hidden shrink-0 text-xs text-muted sm:inline">{assetClass}</span>;
}

function CompactAssetClassLabel({ value }: { value: string }) {
  if (value === "금리/파킹" || value === "금리·파킹") {
    return <span aria-label="금리" className="whitespace-nowrap text-[11px] font-bold text-strong" title="금리">금리</span>;
  }
  if (value === "리츠/인프라" || value === "리츠·인프라") {
    return <span aria-label="리츠/인프라" className="inline-flex flex-col whitespace-nowrap text-[11px] font-bold leading-4 text-strong" title="리츠/인프라"><span aria-hidden="true">리츠/</span><span aria-hidden="true">인프라</span></span>;
  }
  return <span className="whitespace-nowrap text-[11px] font-bold text-strong">{value}</span>;
}

function UnitHeaderLabel({ label, unit }: { label: string; unit: string }) {
  return (
    <span className="inline-flex flex-col items-center leading-tight">
      <span>{label}</span>
      <span className="block pt-0.5 text-[10px] font-bold text-neutral-500">({unit})</span>
    </span>
  );
}

function FxHedgeMarker({ value }: { value: string | null }) {
  if (!value || value === "노출" || value === "비헤지") return null;

  const label = value === "헤지" ? "(H)" : `(${value} H)`;
  return (
    <span aria-label="환헤지 적용" className="whitespace-nowrap text-[12px] font-extrabold text-brand-700" title="환헤지 적용">
      {label}
    </span>
  );
}



function SearchParamsSync({ onSync }: { onSync: (searchParams: URLSearchParams) => void }) {
  const searchParams = useSearchParams();
  const onSyncRef = useRef(onSync);
  useLayoutEffect(() => {
    onSyncRef.current = onSync;
  }, [onSync]);

  useEffect(() => {
    if (searchParams) {
      onSyncRef.current(searchParams);
    }
  }, [searchParams]);
  
  return null;
}

function RiskBadge({ label, compact = false }: { label?: string | null, compact?: boolean }) {
  if (!label) return null;
  const isInverse = label.includes("인버스");
  const colorClass = isInverse ? "bg-purple-50 text-purple-700" : "bg-emerald-50 text-emerald-700";
  const sizeClass = compact 
    ? "px-0.5 py-0.5 text-[9px] tracking-tighter" 
    : "px-1.5 py-0.5 text-[10px]";
  return (
    <span aria-label={label} className={`select-none rounded font-extrabold ${colorClass} ${sizeClass}`} title={label}>
      {label}
    </span>
  );
}

export function Dashboard({ etfs }: { etfs: Etf[] }) {
  const [state, setState] = useState<ExplorerState>(DEFAULT_EXPLORER_STATE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [urlReady, setUrlReady] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);

  // We handle initial load and popstate in a separate effect just to be safe,
  // but SearchParamsSync handles Next.js router soft-navigations.
  useEffect(() => {
    const syncFromUrl = () => {
      setState(parseExplorerQuery(new URLSearchParams(window.location.search)));
      setUrlReady(true);
    };

    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  useEffect(() => {
    if (!urlReady) return;
    updateUrl(state);
  }, [state, urlReady]);

  const setExplorerState = (patch: Partial<ExplorerState>, resetPage = true) => {
    setState((current) => {
      const next = { ...current, ...patch, page: resetPage ? 1 : patch.page ?? current.page };
      return next;
    });
  };

  const modeEtfs = filterEtfsByMode(etfs, state.mode);
  const searchSuggestions = getEtfSearchSuggestions(modeEtfs, state.query);
  const showSearchSuggestions = searchFocused && searchSuggestions.length > 0;
  const allowedRiskTypes = getAllowedRiskTypes(state.mode);
  const activeRiskTypes = state.riskTypes.filter((value) => allowedRiskTypes.includes(value));
  const periods = getReturnPeriods(state.mode);
  const normalizedPeriod = periods.includes(state.period) ? state.period : getDefaultPeriod(state.mode);
  const selectedScope = scopeOptions.find((option) => option.value === state.scope) ?? scopeOptions[0];

  const scopedEtfs = state.mode === "new" ? modeEtfs : getEtfsByAumScope(modeEtfs, state.scope);
  const searchedEtfs = searchEtfs(scopedEtfs, state.query);
  const filteredEtfs = applyExplorerFilters(searchedEtfs, { assetClasses: state.assetClasses, riskTypes: activeRiskTypes });
  const results = sortExplorerEtfs(filteredEtfs, state.sort, state.direction, normalizedPeriod);

  const visibleEtfs = results;
  const activeFilterCount = state.assetClasses.length + activeRiskTypes.length;
  const asOfDate = etfs[0]?.asOfDate;
  const copy = modeCopy[state.mode];
  const pendingListingDates = state.mode === "new" ? modeEtfs.filter((etf) => !etf.listingDate).length : 0;

  
  const isGeneral = state.mode === "general";
  const isPension = state.mode === "pension";
  const isDeriv = state.mode === "derivatives";
  const isNew = state.mode === "new";

  const productInfoColSpan = isGeneral ? 6 : isPension ? 5 : isDeriv ? 6 : isNew ? 7 : 6;
  const returnsColSpan = periods.length;
  const costSizePriceColSpan = 4;
  const desktopColumnCount = productInfoColSpan + returnsColSpan + costSizePriceColSpan;

  const tableWrapperRef = useRef<HTMLDivElement>(null);

  const [tableScrollMargin, setTableScrollMargin] = useState(0);
  useLayoutEffect(() => {
    setTableScrollMargin(tableWrapperRef.current?.offsetTop ?? 0);
  }, [state.mode, filtersOpen, activeFilterCount, pendingListingDates, results.length]);

  const rowVirtualizer = useWindowVirtualizer({
    count: visibleEtfs.length,
    estimateSize: () => 44,
    overscan: 12,
    scrollMargin: tableScrollMargin,
    getItemKey: (index) => visibleEtfs[index]?.ticker ?? index,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualPaddingTop = virtualRows.length > 0 ? virtualRows[0].start - tableScrollMargin : 0;
  const virtualPaddingBottom = virtualRows.length > 0 ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end : 0;
  // const tableColumnCount = 5 + 3 + (state.mode === "new" ? 1 : 0) + periods.length + 3 + 1;

  const clearFilters = () => setExplorerState({ assetClasses: [], riskTypes: [] });

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!showSearchSuggestions && event.key !== "ArrowDown") return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSearchFocused(true);
      setActiveSuggestion((current) => Math.min(current + 1, searchSuggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion((current) => Math.max(current - 1, 0));
    } else if (event.key === "Escape") {
      setSearchFocused(false);
      setActiveSuggestion(-1);
    } else if (event.key === "Enter" && activeSuggestion >= 0) {
      event.preventDefault();
      document.getElementById(`etf-suggestion-${activeSuggestion}`)?.click();
    }
  };

  return (
    <main aria-labelledby="dashboard-title" className="page-shell flex-1 py-4 sm:py-6">
      <Suspense fallback={null}>
        <SearchParamsSync onSync={(params) => {
          setState(parseExplorerQuery(params));
          setUrlReady(true);
        }} />
      </Suspense>
      <header className="flex items-center justify-between gap-3 rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/80 to-surface px-4 py-3 sm:px-5">
        <div className="min-w-0 max-w-5xl">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.04em] text-strong sm:text-3xl" id="dashboard-title">{copy.title}</h1>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted sm:text-sm">{copy.description}</p>
        </div>
        <Tickery className="h-16 w-16 shrink-0 sm:h-20 sm:w-20" pose={state.mode === "pension" ? "pension" : "search"} priority sizes="(max-width: 640px) 64px, 80px" />
      </header>

      {state.mode === "pension" ? <p className="mt-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-semibold leading-6 text-brand-900">DC·IRP 편입 가능 여부는 금융회사별 매매 가능 목록과 위험자산 한도에 따라 달라질 수 있습니다.</p> : null}
      {state.mode === "derivatives" ? <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold leading-6 text-amber-900">레버리지·인버스 ETF는 일간 수익률의 배수를 목표로 하므로 보유 기간이 길어질수록 기초지수 누적수익률과 차이가 커질 수 있습니다.</p> : null}
      {pendingListingDates ? <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold leading-6 text-amber-900">정확한 상장일 백필 전인 {pendingListingDates.toLocaleString("ko-KR")}종목은 기존 3개월 플래그로 표시하며 상장일은 확인 중입니다.</p> : null}

      <section aria-label="ETF 검색과 정렬" className="mt-3 rounded-2xl border border-brand-200 bg-brand-50/40 p-3 shadow-sm sm:p-4">
        <div
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setSearchFocused(false);
              setActiveSuggestion(-1);
            }
          }}
        >
          <div className="relative min-w-0 w-full flex-1 sm:w-[760px] sm:max-w-full sm:flex-none">
            <label className="block">
              <span className="sr-only">종목명 또는 티커 검색</span>
              <svg aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-brand-700" fill="none" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="m16.5 16.5 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg>
              <input
                aria-activedescendant={activeSuggestion >= 0 ? `etf-suggestion-${activeSuggestion}` : undefined}
                aria-autocomplete="list"
                aria-controls="etf-search-suggestions"
                aria-expanded={showSearchSuggestions}
                className="min-h-12 w-full appearance-none rounded-xl border border-line bg-surface pl-12 pr-12 text-base font-semibold text-strong shadow-sm outline-none placeholder:font-normal placeholder:text-neutral-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 [&::-webkit-search-cancel-button]:hidden"
                onChange={(event) => {
                  setExplorerState({ query: event.target.value });
                  setActiveSuggestion(-1);
                }}
                onFocus={() => setSearchFocused(true)}
                onKeyDown={handleSearchKeyDown}
                placeholder="ETF 종목명·티커·기초지수 검색"
                role="combobox"
                type="search"
                value={state.query}
              />
            </label>
            {state.query ? <button aria-label="검색어 지우기" className="absolute right-2 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-lg text-muted hover:bg-neutral-100" onClick={() => { setExplorerState({ query: "" }); setActiveSuggestion(-1); }} type="button">×</button> : null}
            {showSearchSuggestions ? (
              <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
                <ul aria-label="ETF 검색 자동완성" id="etf-search-suggestions" role="listbox">
                  {searchSuggestions.map((etf, index) => (
                    <li key={etf.ticker}>
                      <Link
                        aria-selected={activeSuggestion === index}
                        className={`flex min-h-14 items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0 hover:bg-brand-50 ${activeSuggestion === index ? "bg-brand-50" : ""}`}
                        href={`/etf/${etf.ticker}/`}
                        id={`etf-suggestion-${index}`}
                        onMouseEnter={() => setActiveSuggestion(index)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSearchFocused(false);
                          setActiveSuggestion(-1);
                        }}
                        role="option"
                      >
                        <span className="tabular-nums w-14 shrink-0 text-xs font-semibold text-muted">{etf.ticker}</span>
                        <span className="line-clamp-2 min-w-0 flex-1 text-sm font-bold leading-5 text-strong [overflow-wrap:anywhere]">{etf.name}</span>
                        <SearchSuggestionMeta etf={etf} />
                        <PensionBadge compact status={etf.pension} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 px-1 sm:ml-auto sm:justify-end sm:px-2"><span className="tabular-nums text-sm font-extrabold text-strong">{state.mode !== "new" ? `순자산 ${selectedScope.summary} · ` : ""}{results.length.toLocaleString("ko-KR")}종목</span>{asOfDate ? <AsOfDate value={asOfDate} /> : null}</div>
        </div>

        <div className="mt-3 grid gap-2 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
            {state.mode !== "new" ? (
              <label className="flex items-center gap-2 text-xs font-bold text-strong">
                순자산 기준
                <select className="min-h-10 rounded-lg border border-line bg-surface px-2 py-1 text-sm font-semibold text-strong" onChange={(e) => setExplorerState({ scope: e.target.value as AumScope })} value={state.scope}>
                  {scopeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            ) : <span className="w-fit shrink-0 rounded-full bg-brand-100 px-3 py-2 text-xs font-extrabold text-brand-800">0~90일 · 규모 제한 없음</span>}
            <span aria-hidden="true" className="hidden h-7 w-px shrink-0 bg-line sm:block" />
            <label className="flex items-center gap-2 text-xs font-bold text-muted">
              기간
              <select className="min-h-10 rounded-lg border border-line bg-surface px-2 py-1 text-sm font-semibold text-strong" onChange={(e) => setExplorerState({ period: e.target.value as ReturnPeriod })} value={normalizedPeriod}>
                {periods.map((period) => (
                  <option key={period} value={period}>{RETURN_PERIOD_LABELS[period]}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2 xl:self-start">
            <label className="flex items-center gap-2 text-xs font-semibold text-muted">정렬
              <select className="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-strong" onChange={(event) => setExplorerState({ sort: event.target.value as ExplorerState["sort"] })} value={state.sort}>
                <option value="return">기간 수익률</option>
                <option value="aum">순자산</option>
                <option value="tradeValue">거래대금</option>
                {state.mode === "new" ? <option value="listingDate">상장일</option> : null}
              </select>
            </label>
            <div aria-label="정렬 방향" className="flex rounded-lg border border-line bg-surface p-1" role="group">
              <button aria-pressed={state.direction === "desc"} className={`min-h-9 rounded-md px-3 text-xs font-bold ${state.direction === "desc" ? "bg-neutral-800 text-white" : "text-muted"}`} onClick={() => setExplorerState({ direction: "desc" })} type="button">높은순</button>
              <button aria-pressed={state.direction === "asc"} className={`min-h-9 rounded-md px-3 text-xs font-bold ${state.direction === "asc" ? "bg-neutral-800 text-white" : "text-muted"}`} onClick={() => setExplorerState({ direction: "asc" })} type="button">낮은순</button>
            </div>
            <button
              aria-controls="etf-filter-panel"
              aria-expanded={filtersOpen}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border-2 border-brand-700 bg-brand-700 px-3.5 text-sm font-extrabold text-white shadow-sm transition-colors hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
              onClick={() => setFiltersOpen(!filtersOpen)}
              type="button"
            >
              <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg>
              필터{activeFilterCount ? ` ${activeFilterCount}` : ""}
            </button>
          </div>
          <p className="mt-0 text-[11px] font-semibold leading-5 text-muted xl:col-start-2 xl:max-w-[520px] xl:text-right">기간 수익률: 기준일 대비 선택 기간 / 순자산·거래대금: 기준일</p>
        </div>

        {activeFilterCount ? <div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-muted">적용 중</span>{state.assetClasses.map((value) => <button className="chip" key={value} onClick={() => setExplorerState({ assetClasses: toggleValue<AssetClass>(state.assetClasses, value) })} type="button">{value} ×</button>)}{activeRiskTypes.map((value) => <button className="chip" key={value} onClick={() => setExplorerState({ riskTypes: toggleValue<RiskType>(state.riskTypes, value) })} type="button">{riskLabels[value]} ×</button>)}<button className="text-xs font-bold text-brand-700" onClick={clearFilters} type="button">모두 해제</button></div> : null}
      </section>

      {filtersOpen ? <>
        <button aria-label="필터 닫기" className="fixed inset-0 z-30 bg-neutral-900/30 md:hidden" onClick={() => setFiltersOpen(false)} type="button" />
        <aside aria-label="ETF 필터" className="fixed inset-x-0 bottom-0 z-40 max-h-[82vh] overflow-y-auto rounded-t-3xl bg-surface p-4 shadow-2xl md:static md:mt-2 md:rounded-2xl md:border md:border-line md:bg-neutral-50 md:p-3.5 md:shadow-none" id="etf-filter-panel">
          <div className="flex items-center justify-between gap-4"><h2 className="text-base font-extrabold">목록 필터</h2><div className="flex gap-3"><button className="text-xs font-bold text-brand-700" onClick={clearFilters} type="button">초기화</button><button aria-label="필터 닫기" className="rounded-lg px-2 text-xl text-muted" onClick={() => setFiltersOpen(false)} type="button">×</button></div></div>
          <div className={`mt-2 grid gap-6 md:gap-8 ${allowedRiskTypes.length ? "md:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]" : "md:grid-cols-1"}`}>
            <fieldset><legend className="text-[13px] font-extrabold text-strong">자산군</legend><div className="pt-1 grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-7">{ASSET_CLASSES.map((value) => <label className="flex min-h-9 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-xs font-semibold text-muted transition-colors hover:border-brand-300 hover:bg-brand-50" key={value}><input checked={state.assetClasses.includes(value)} className="size-3.5 accent-brand-700" onChange={() => setExplorerState({ assetClasses: toggleValue<AssetClass>(state.assetClasses, value) })} type="checkbox" />{value}</label>)}</div></fieldset>
            {allowedRiskTypes.length ? <fieldset><legend className="text-[13px] font-extrabold text-strong">위험유형</legend><div className="pt-1 grid grid-cols-2 gap-1.5">{allowedRiskTypes.map((value) => <label className="flex min-h-9 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-xs font-semibold text-muted transition-colors hover:border-brand-300 hover:bg-brand-50" key={value}><input checked={activeRiskTypes.includes(value)} className="size-3.5 accent-brand-700" onChange={() => setExplorerState({ riskTypes: toggleValue<RiskType>(state.riskTypes, value) })} type="checkbox" />{riskLabels[value]}</label>)}</div></fieldset> : null}
          </div>
          <button className="sticky bottom-0 mt-5 w-full rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-bold text-white md:hidden" onClick={() => setFiltersOpen(false)} type="button">{results.length.toLocaleString("ko-KR")}종목 보기</button>
        </aside>
      </> : null}

      <div className="mt-5 rounded-2xl border border-line bg-surface" ref={tableWrapperRef}>
        <div className="overflow-x-auto min-[1244px]:overflow-x-visible">
          
          
          <table className="w-full border-collapse text-left text-sm md:min-w-[1140px] md:table-fixed"><caption className="sr-only">{copy.title} 목록과 기간별 가격 수익률</caption>
            {/* 명시적 열 너비 제어 */}
            <colgroup className="hidden md:table-column-group">
              <col style={{ width: 56 }} />
              <col style={{ width: 192 }} />
              {isDeriv ? <col style={{ width: 44 }} /> : null}
              {isNew ? <col style={{ width: 80 }} /> : null}
              <col style={{ width: 36 }} />
              <col style={{ width: 56 }} />
              <col style={{ width: 40 }} />
              {!isPension && !isDeriv ? <col style={{ width: 36 }} /> : null}
              {periods.map((period) => (
                <col key={period} style={{ width: 54 }} />
              ))}
              <col style={{ width: 40 }} />
              <col style={{ width: 48 }} />
              <col style={{ width: 52 }} />
              <col style={{ width: 48 }} />
            </colgroup>

            {/* 모바일 헤더 */}
            <thead className="border-b-2 border-neutral-300 bg-neutral-100 text-[13px] font-extrabold text-neutral-700 md:hidden">
              <tr>
                <th className="sticky top-0 z-10 w-24 px-2 py-3 text-center bg-neutral-100" scope="col">등락률</th>
                <th className="sticky top-0 z-10 w-28 px-4 py-3 text-right bg-neutral-100" scope="col">{RETURN_PERIOD_LABELS[normalizedPeriod]} 수익률</th>
                <th aria-label="총보수, 단위 퍼센트" className="sticky top-0 z-10 w-16 px-2 py-3 text-right bg-neutral-100" scope="col"><UnitHeaderLabel label="총보수" unit="%" /></th>
              </tr>
            </thead>
            
            {/* 데스크톱 2단 헤더 */}
            <thead className="hidden border-b-2 border-neutral-300 bg-neutral-100 text-[13px] font-bold text-neutral-700 md:table-header-group">
              {/* 1단 그룹 헤더 */}
              <tr className="border-b border-neutral-200">
                <th className="sticky top-0 z-30 h-[32px] bg-neutral-100 px-2 py-0 text-center" colSpan={productInfoColSpan} scope="colgroup">상품 정보</th>
                <th className="sticky top-0 z-20 h-[32px] bg-neutral-50 px-2 py-0 text-center border-l border-neutral-200" colSpan={returnsColSpan} scope="colgroup">수익률(%)</th>
                <th className="sticky top-0 z-20 h-[32px] bg-neutral-100 px-2 py-0 text-center border-l border-neutral-200" colSpan={costSizePriceColSpan} scope="colgroup">비용·규모·가격</th>
              </tr>
              {/* 2단 세부 헤더 */}
              <tr className="text-[12px]">
                <th className="sticky top-[32px] z-30 w-[56px] h-[48px] bg-neutral-100 px-0 py-0 text-center" scope="col" style={{ left: 0 }}>종목코드</th>
                <th className="sticky top-[32px] z-30 w-[192px] h-[48px] bg-neutral-100 px-2 py-0 text-center shadow-[1px_0_0_0_#e5e5e5]" scope="col" style={{ left: 56 }}>종목명</th>
                {isDeriv ? <th className="sticky top-[32px] z-20 w-[44px] h-[48px] bg-neutral-100 px-0.5 py-0 text-center" scope="col">유형</th> : null}
                {isNew ? <th className="sticky top-[32px] z-20 h-[48px] w-[80px] min-w-[80px] bg-neutral-100 px-1 py-0 text-center" scope="col">상장일</th> : null}
                <th className="sticky top-[32px] z-20 w-[36px] h-[48px] bg-neutral-100 px-0.5 py-0 text-center" scope="col">지역</th>
                <th className="sticky top-[32px] z-20 w-[40px] h-[48px] bg-neutral-100 px-0.5 py-0 text-center" scope="col">자산</th>
                <th className="sticky top-[32px] z-20 w-[40px] h-[48px] bg-neutral-100 px-0.5 py-0 text-center text-[10px] tracking-tighter" scope="col">환헤지</th>
                {!isPension && !isDeriv ? <th className="sticky top-[32px] z-20 w-[36px] h-[48px] bg-neutral-100 px-0.5 py-0 text-center" scope="col">연금</th> : null}
                
                {periods.map((period, index) => {
                  const isYtd = period === "ytd" || period === "itd";
                  const width = 54;
                  const borderL = isYtd ? 'border-l-2 border-neutral-200' : index === 0 ? 'border-l border-neutral-200' : '';
                  const bg = normalizedPeriod === period && !isYtd ? "bg-brand-100 text-brand-900" : "bg-neutral-50";
                  return (
                    <th aria-label={`${RETURN_PERIOD_LABELS[period]} 수익률`} className={`sticky top-[32px] z-20 h-[48px] px-0.5 py-0 text-center ${borderL} ${bg}`} key={period} scope="col" style={{ width: `${width}px` }}>
                      <span className="whitespace-nowrap text-[11px] tracking-tighter font-bold text-strong">{RETURN_PERIOD_LABELS[period]}</span>
                    </th>
                  );
                })}
                
                <th aria-label="총보수, 단위 퍼센트" className="sticky top-[32px] z-20 w-[40px] h-[48px] bg-neutral-100 px-0.5 py-0 text-center border-l border-neutral-200" scope="col"><UnitHeaderLabel label="총보수" unit="%" /></th>
                <th aria-label="순자산, 단위 억원" className="sticky top-[32px] z-20 w-[48px] h-[48px] bg-neutral-100 px-0.5 py-0 text-center" scope="col"><UnitHeaderLabel label="순자산" unit="억원" /></th>
                <th aria-label="거래대금, 단위 억원" className="sticky top-[32px] z-20 w-[52px] h-[48px] bg-neutral-100 px-0.5 py-0 text-center" scope="col"><UnitHeaderLabel label="거래대금" unit="억원" /></th>
                
                <th aria-label="종가, 단위 원" className="sticky top-[32px] z-20 w-[48px] h-[48px] bg-neutral-100 px-0.5 py-0 text-center" scope="col"><UnitHeaderLabel label="종가" unit="원" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-[12px]">
              {virtualPaddingTop > 0 ? <tr aria-hidden="true" style={{ height: virtualPaddingTop }}><td colSpan={desktopColumnCount} /></tr> : null}
              {virtualRows.map((virtualRow) => {
                const etf = visibleEtfs[virtualRow.index];
                if (!etf) return null;
                const fields = getClassificationFields(etf);
                return (
                  <tr className="bg-surface transition-colors hover:bg-neutral-100 even:bg-neutral-100/40 h-[44px]" data-index={virtualRow.index} key={etf.ticker} ref={rowVirtualizer.measureElement}>
                    {/* 모바일 종목명 (이제 아래 공용 th를 사용하므로 삭제) */}
                    <td className="px-2 py-4 text-right md:hidden"><ReturnCell value={etf.changePct} /></td>
                    <td className="px-4 py-4 text-right font-semibold tabular-nums md:hidden"><ReturnCell value={etf.returns[normalizedPeriod]} /></td>
                    <td className="tabular-nums px-2 py-4 text-right text-xs text-muted font-semibold md:hidden">{(etf.fee?.verificationStatus === "verified_official" || etf.fee?.verificationStatus === "official_single_source") && etf.fee.totalFeePct !== null ? etf.fee.totalFeePct.toFixed(2) : "-"}</td>
                    
                    {/* 데스크톱용 셀들 */}
                    <td className="tabular-nums hidden w-[56px] px-0 py-1.5 text-center text-[12px] font-normal text-muted bg-inherit md:sticky md:table-cell md:z-10" style={{ left: 0 }}>{etf.ticker}</td>
                    <th className="w-[192px] bg-inherit px-2 py-1.5 text-left shadow-[1px_0_0_0_#e5e5e5] md:sticky md:z-10" scope="row" style={{ left: 56 }}>
                      <Link className="line-clamp-2 break-all whitespace-normal text-left text-[12px] font-bold leading-[16px] text-strong hover:text-brand-700" href={`/etf/${etf.ticker}/`} title={etf.name}>{etf.name}</Link>
                    </th>
                    
                    {isDeriv ? <td className="hidden px-0.5 py-2 text-center md:table-cell"><RiskBadge compact label={fields.riskLabel} /></td> : null}
                    {isNew ? <td className="tabular-nums hidden w-[80px] min-w-[80px] whitespace-nowrap px-1 py-2 text-center text-muted md:table-cell">{etf.listingDate ? formatAsOfDate(etf.listingDate) : "확인 중"}</td> : null}
                    
                    <td className="hidden px-0.5 py-2 text-center text-[11px] font-semibold text-muted md:table-cell">{fields.marketScope ?? ""}</td>
                    <td className="hidden px-0.5 py-2 text-center md:table-cell">
                      <div className="flex flex-wrap items-center justify-center gap-1">
                        <CompactAssetClassLabel value={fields.assetClass} />
                        {!isDeriv ? <RiskBadge label={fields.riskLabel} /> : null}
                      </div>
                    </td>
                    <td className="hidden px-0.5 py-2 text-center text-[11px] font-bold text-muted md:table-cell"><FxHedgeMarker value={fields.fxHedge} /></td>
                    {!isPension && !isDeriv ? <td className="hidden px-0.5 py-2 text-center md:table-cell"><PensionBadge compact status={etf.pension} /></td> : null}
                    
                    {periods.map((period, index) => {
                      const isYtd = period === "ytd" || period === "itd";
                      const borderL = isYtd ? 'border-l-2 border-neutral-100' : index === 0 ? 'border-l border-neutral-100' : '';
                      const bg = normalizedPeriod === period ? "bg-brand-50" : "";
                      return (
                        <td className={`hidden px-1 py-2 text-right font-semibold tabular-nums md:table-cell ${borderL} ${bg}`} key={period}>
                          <ReturnCell showUnit={false} value={etf.returns[period]} />
                        </td>
                      );
                    })}
                    
                    <td className="hidden px-1 py-2 text-right font-semibold tabular-nums text-muted md:table-cell border-l border-neutral-100">{(etf.fee?.verificationStatus === "verified_official" || etf.fee?.verificationStatus === "official_single_source") && etf.fee.totalFeePct !== null ? etf.fee.totalFeePct.toFixed(2) : "-"}</td>
                    <td className="hidden px-1 py-2 text-right font-semibold tabular-nums md:table-cell">{formatAumNumber(etf.aum)}</td>
                    <td className="hidden px-1 py-2 text-right font-semibold tabular-nums md:table-cell">{formatTradeValueNumber(etf.tradeValue)}</td>
                    
                    <td className="hidden px-1 py-2 text-right font-semibold tabular-nums md:table-cell">{formatWonNumber(etf.close)}</td>
                  </tr>
                );
              })}
              {virtualPaddingBottom > 0 ? <tr aria-hidden="true" style={{ height: virtualPaddingBottom }}><td colSpan={desktopColumnCount} /></tr> : null}
            </tbody>
          </table>


          {!visibleEtfs.length ? <div className="px-5 py-16 text-center"><p className="font-extrabold text-strong">조건에 맞는 ETF가 없습니다</p><p className="mt-2 text-sm text-muted">검색어나 필터, 순자산 범위를 조정해 보세요.</p></div> : null}
        </div>
      </div>


    </main>
  );
}
