"use client";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { fetcher } from "@/lib/hooks/fetcher";
import { Suspense, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

import { Tickery } from "@/components/brand/tickery";
import { AsOfDate, ReturnCell, FeeDoubleStack } from "@/components/etf";
import { getClassificationFields } from "@/lib/domain/etf-classification";
import { formatAsOfDate, formatAumNumber, formatMoney, formatTradeValueNumber, formatWonNumber } from "@/lib/domain/etf-format";
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

const riskLabels: Record<RiskType, string> = { normal: "일반", leverage: "레버리지", inverse: "인버스", parking: "파킹형" };

const TDF_VINTAGES = ["2030", "2035", "2040", "2045", "2050", "2055", "2060"] as const;
const TDF_AGE_RECOMMENDATIONS = [
  { label: "20대", birth: "~97년생", vintage: "2055" },
  { label: "30대", birth: "87~96년", vintage: "2050" },
  { label: "40대", birth: "77~86년", vintage: "2045" },
  { label: "50대", birth: "67~76년", vintage: "2035" },
  { label: "60대+", birth: "~66년생", vintage: "2030" },
] as const;

function getTdfVintageInfo(name: string): { vintage: string; equityPct: number } | null {
  const match = name.match(/20(30|35|40|45|50|55|60)/);
  if (!match) return null;
  const vintage = "20" + match[1];
  const equityMap: Record<string, number> = {
    "2030": 40,
    "2035": 50,
    "2040": 60,
    "2045": 70,
    "2050": 80,
    "2055": 80,
    "2060": 80,
  };
  return { vintage, equityPct: equityMap[vintage] ?? 70 };
}

function getDaysSinceListing(listingDate: string | null, asOfDate?: string): number | null {
  if (!listingDate) return null;
  const cleanList = listingDate.replace(/\D/g, "");
  if (cleanList.length < 8) return null;
  const yr = parseInt(cleanList.slice(0, 4), 10);
  const mo = parseInt(cleanList.slice(4, 6), 10) - 1;
  const da = parseInt(cleanList.slice(6, 8), 10);
  const listTime = new Date(yr, mo, da).getTime();
  
  let refTime = Date.now();
  if (asOfDate) {
    const cleanAsOf = asOfDate.replace(/\D/g, "");
    if (cleanAsOf.length >= 8) {
      const aYr = parseInt(cleanAsOf.slice(0, 4), 10);
      const aMo = parseInt(cleanAsOf.slice(4, 6), 10) - 1;
      const aDa = parseInt(cleanAsOf.slice(6, 8), 10);
      refTime = new Date(aYr, aMo, aDa).getTime();
    }
  }
  const diffDays = Math.max(0, Math.floor((refTime - listTime) / (1000 * 60 * 60 * 24)));
  return diffDays;
}

function getNewEtfThemeTag(name: string): string | null {
  const themes = [
    { key: "AI", label: "#AI" },
    { key: "반도체", label: "#반도체" },
    { key: "커버드콜", label: "#커버드콜" },
    { key: "월배당", label: "#월배당" },
    { key: "2차전지", label: "#2차전지" },
    { key: "전력", label: "#전력" },
    { key: "원자재", label: "#원자재" },
    { key: "채권", label: "#채권" },
    { key: "바이오", label: "#바이오" },
    { key: "배당", label: "#배당" },
    { key: "리츠", label: "#리츠" },
    { key: "금리", label: "#금리" },
  ];
  for (const t of themes) {
    if (name.includes(t.key)) return t.label;
  }
  return null;
}

export type DerivMultiplierType = "lev2x" | "inv2x" | "inv1x";

function getDerivMultiplierInfo(etf: Etf): { type: DerivMultiplierType; label: string; badgeClass: string } | null {
  if (etf.name.includes("2X") && etf.name.includes("인버스")) {
    return { type: "inv2x", label: "-2X 곱버스", badgeClass: "bg-purple-950 text-purple-100 border border-purple-800 font-extrabold shadow-sm" };
  }
  if (etf.name.includes("레버리지") || etf.name.includes("2X")) {
    return { type: "lev2x", label: "+2X 레버리지", badgeClass: "bg-emerald-700 text-white font-extrabold shadow-sm" };
  }
  if (etf.name.includes("인버스")) {
    return { type: "inv1x", label: "-1X 인버스", badgeClass: "bg-purple-100 text-purple-900 border border-purple-300 font-bold" };
  }
  return null;
}

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



function UnitHeaderLabel({ label, unit, align = "center" }: { label: string; unit: string; align?: "center" | "right" }) {
  return (
    <span className={`inline-flex flex-col ${align === "right" ? "items-end text-right pr-0.5" : "items-center text-center"} leading-tight`}>
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



const CORE_RETURN_PERIODS: readonly ReturnPeriod[] = ["1d", "1m", "3m", "12m", "36m"];

export function Dashboard({ etfs: initialEtfs }: { etfs?: Etf[] }) {
  const { data: fetchedEtfs } = useSWR<Etf[]>('/data/screener.json', fetcher);
  const etfs = (initialEtfs && initialEtfs.length > 0) ? initialEtfs : (fetchedEtfs || []);
  const [state, setState] = useState<ExplorerState>(DEFAULT_EXPLORER_STATE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [urlReady, setUrlReady] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [isFullPeriods, setIsFullPeriods] = useState(false);

  // Mode-specific sub-filters
  const [selectedVintage, setSelectedVintage] = useState<string | null>(null);
  const [selectedNewRange, setSelectedNewRange] = useState<"all" | "30d" | "60d" | "90d">("all");
  const [activeDerivMultipliers, setActiveDerivMultipliers] = useState<DerivMultiplierType[]>([
    "lev2x",
    "inv2x",
    "inv1x",
  ]);

  const toggleDerivMultiplier = (type: DerivMultiplierType) => {
    setActiveDerivMultipliers((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

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
  const displayPeriods = isFullPeriods || state.mode === "new"
    ? periods 
    : CORE_RETURN_PERIODS.filter((p) => periods.includes(p));
  const normalizedPeriod = periods.includes(state.period) ? state.period : getDefaultPeriod(state.mode);
  const selectedScope = scopeOptions.find((option) => option.value === state.scope) ?? scopeOptions[0];

  const scopedEtfs = state.mode === "new" ? modeEtfs : getEtfsByAumScope(modeEtfs, state.scope);
  const searchedEtfs = searchEtfs(scopedEtfs, state.query);
  const filteredEtfs = applyExplorerFilters(searchedEtfs, { assetClasses: state.assetClasses, riskTypes: activeRiskTypes });
  const results = sortExplorerEtfs(filteredEtfs, state.sort, state.direction, normalizedPeriod);

  const asOfDate = etfs[0]?.asOfDate;
  const copy = modeCopy[state.mode];
  const pendingListingDates = state.mode === "new" ? modeEtfs.filter((etf) => !etf.listingDate).length : 0;

  const derivCounts = {
    lev2x: modeEtfs.filter((e) => getDerivMultiplierInfo(e)?.type === "lev2x").length,
    inv2x: modeEtfs.filter((e) => getDerivMultiplierInfo(e)?.type === "inv2x").length,
    inv1x: modeEtfs.filter((e) => getDerivMultiplierInfo(e)?.type === "inv1x").length,
  };

  // Apply mode-specific sub-filtering
  let filteredResults = results;
  if (state.mode === "tdf" && selectedVintage) {
    filteredResults = filteredResults.filter((etf) => etf.name.includes(selectedVintage));
  } else if (state.mode === "new" && selectedNewRange !== "all") {
    filteredResults = filteredResults.filter((etf) => {
      const days = getDaysSinceListing(etf.listingDate, asOfDate);
      if (days === null) return true;
      if (selectedNewRange === "30d") return days <= 30;
      if (selectedNewRange === "60d") return days > 30 && days <= 60;
      if (selectedNewRange === "90d") return days > 60;
      return true;
    });
  } else if (state.mode === "derivatives") {
    filteredResults = filteredResults.filter((etf) => {
      const info = getDerivMultiplierInfo(etf);
      if (!info) return false;
      return activeDerivMultipliers.includes(info.type);
    });
  }

  const visibleEtfs = filteredResults;
  const activeFilterCount = state.assetClasses.length + activeRiskTypes.length;

  const isPension = state.mode === "pension";
  const isDeriv = state.mode === "derivatives";
  const isNew = state.mode === "new";

  const productInfoColSpan = 1;
  const returnsColSpan = displayPeriods.length;
  const costSizePriceColSpan = 4;
  const desktopColumnCount = productInfoColSpan + returnsColSpan + costSizePriceColSpan;

  const tableWrapperRef = useRef<HTMLDivElement>(null);

  const [tableScrollMargin, setTableScrollMargin] = useState(0);
  useLayoutEffect(() => {
    setTableScrollMargin(tableWrapperRef.current?.offsetTop ?? 0);
  }, [state.mode, filtersOpen, activeFilterCount, pendingListingDates, visibleEtfs.length]);

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

  const clearFilters = () => {
    setExplorerState({ assetClasses: [], riskTypes: [] });
    setSelectedVintage(null);
    setSelectedNewRange("all");
    setActiveDerivMultipliers(["lev2x", "inv2x", "inv1x"]);
  };

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
    <div aria-labelledby="dashboard-title" className="page-shell flex-1 py-3 sm:py-4">
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
      {state.mode === "tdf" ? <p className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/80 px-4 py-2.5 text-sm font-semibold leading-6 text-indigo-950">💡 적격 TDF는 고용노동부 기준을 통과하여 퇴직연금(DC/IRP) 위험자산 한도(70%) 규제 없이 100% 전액 편입이 가능합니다.</p> : null}
      {state.mode === "derivatives" ? <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold leading-6 text-amber-900">레버리지·인버스 ETF는 일간 수익률의 배수를 목표로 하므로 보유 기간이 길어질수록 기초지수 누적수익률과 차이가 커질 수 있습니다.</p> : null}
      {pendingListingDates ? <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold leading-6 text-amber-900">정확한 상장일 백필 전인 {pendingListingDates.toLocaleString("ko-KR")}종목은 기존 3개월 플래그로 표시하며 상장일은 확인 중입니다.</p> : null}

      <section aria-label="ETF 검색과 정렬" className="mt-3 rounded-2xl border border-brand-200 bg-brand-50/40 p-3 shadow-sm sm:p-4">
        <div
          className="relative z-50 flex flex-col gap-2 sm:flex-row sm:items-center"
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
              <div className="absolute inset-x-0 top-full z-50 mt-2 max-h-[420px] overflow-y-auto rounded-2xl border border-line bg-surface shadow-2xl">
                <ul aria-label="ETF 검색 자동완성" id="etf-search-suggestions" role="listbox">
                  {searchSuggestions.map((etf, index) => {
                    const isPositive = etf.changePct > 0;
                    const isNegative = etf.changePct < 0;
                    const cleanAssetClass = etf.assetClass.replace("주식-", "");

                    return (
                      <li key={etf.ticker}>
                        <Link
                          aria-selected={activeSuggestion === index}
                          className={`flex flex-col gap-1 border-b border-line/60 px-4 py-2.5 last:border-b-0 hover:bg-brand-50/70 transition-colors ${
                            activeSuggestion === index ? "bg-brand-50/70" : "bg-surface"
                          }`}
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
                          {/* Row 1: ETF Name + Badges + ChangePct */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="line-clamp-1 min-w-0 flex-1 text-[14px] sm:text-[15px] font-bold text-strong tracking-tight">
                              {etf.name}
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              {etf.pension === "가능" ? (
                                <span className="rounded-md bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700">
                                  연금 가능
                                </span>
                              ) : etf.pension === "불가" ? (
                                <span className="rounded-md bg-neutral-100 border border-neutral-200 px-1.5 py-0.5 text-[11px] font-medium text-neutral-500">
                                  일반 전용
                                </span>
                              ) : null}
                              <span
                                className={`text-xs font-black tabular-nums ${
                                  isPositive
                                    ? "text-rose-600"
                                    : isNegative
                                    ? "text-blue-600"
                                    : "text-neutral-500"
                                }`}
                              >
                                {isPositive ? `+${etf.changePct.toFixed(2)}%` : `${etf.changePct.toFixed(2)}%`}
                              </span>
                            </div>
                          </div>

                          {/* Row 2: Ticker + AssetClass Badge + Strategy Badge + AUM */}
                          <div className="flex items-center gap-2 text-xs text-muted">
                            <span className="font-semibold tabular-nums text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded text-[11px]">
                              {etf.ticker}
                            </span>
                            <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-800 border border-brand-200">
                              {cleanAssetClass}
                            </span>
                            {etf.classification?.strategy && etf.classification.strategy !== "패시브" && (
                              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
                                {etf.classification.strategy}
                              </span>
                            )}
                            <span className="text-neutral-300">·</span>
                            <span className="tabular-nums text-[11px] font-medium text-muted">
                              순자산 {formatMoney(etf.aum)}
                            </span>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 px-1 sm:ml-auto sm:justify-end sm:px-2"><span className="tabular-nums text-sm font-extrabold text-strong">{state.mode !== "new" ? `순자산 ${selectedScope.summary} · ` : ""}{visibleEtfs.length.toLocaleString("ko-KR")}종목</span>{asOfDate ? <AsOfDate value={asOfDate} /> : null}</div>
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

        {/* 1. TDF 탭 전용 빈티지 및 내 나이 맞춤 퀵 필터 바 */}
        {state.mode === "tdf" ? (
          <div className="mt-3 pt-3 border-t border-brand-100 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700 mr-1 flex items-center gap-1">
                <span>🎯 빈티지(목표연도)</span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedVintage(null)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  selectedVintage === null
                    ? "bg-neutral-800 text-white shadow-sm"
                    : "bg-surface border border-line text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                전체
              </button>
              {TDF_VINTAGES.map((vintage) => (
                <button
                  key={vintage}
                  type="button"
                  onClick={() => setSelectedVintage(selectedVintage === vintage ? null : vintage)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                    selectedVintage === vintage
                      ? "bg-brand-600 text-white shadow-sm"
                      : "bg-surface border border-line text-neutral-600 hover:bg-brand-50 hover:text-brand-700"
                  }`}
                >
                  {vintage}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-muted">💡 내 나이 맞춤:</span>
              {TDF_AGE_RECOMMENDATIONS.map((rec) => (
                <button
                  key={rec.label}
                  type="button"
                  onClick={() => setSelectedVintage(selectedVintage === rec.vintage ? null : rec.vintage)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                    selectedVintage === rec.vintage
                      ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300"
                      : "bg-indigo-50 border border-indigo-200 text-indigo-800 hover:bg-indigo-100"
                  }`}
                  title={`${rec.label} (${rec.birth}) 추천 빈티지 ${rec.vintage}`}
                >
                  {rec.label} ({rec.vintage})
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* 2. 신규 상장 탭 전용 상장 기간 세분화 퀵 필터 바 */}
        {state.mode === "new" ? (
          <div className="mt-3 pt-3 border-t border-brand-100 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700 mr-1 flex items-center gap-1">
              <span>⏱️ 상장 기간</span>
            </span>
            {[
              { value: "all", label: "전체 (0~90일)" },
              { value: "30d", label: "🔥 30일 이내 (HOT)" },
              { value: "60d", label: "31~60일" },
              { value: "90d", label: "61~90일" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelectedNewRange(opt.value as "all" | "30d" | "60d" | "90d")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  selectedNewRange === opt.value
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-surface border border-line text-neutral-600 hover:bg-brand-50 hover:text-brand-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        ) : null}

        {/* 3. 레버리지·인버스 탭 전용 배수 다중 체크박스 필터 바 */}
        {state.mode === "derivatives" ? (
          <div className="mt-3 pt-3 border-t border-brand-100 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-700 mr-1 flex items-center gap-1">
                <span>⚡ 배수 필터</span>
              </span>
              {[
                {
                  id: "lev2x" as const,
                  label: "+2X 레버리지",
                  count: derivCounts.lev2x,
                  activeColor: "border-emerald-500 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-400",
                },
                {
                  id: "inv2x" as const,
                  label: "-2X 곱버스",
                  count: derivCounts.inv2x,
                  activeColor: "border-purple-800 bg-purple-50 text-purple-950 ring-1 ring-purple-500",
                },
                {
                  id: "inv1x" as const,
                  label: "-1X 인버스",
                  count: derivCounts.inv1x,
                  activeColor: "border-purple-300 bg-purple-50/70 text-purple-900 ring-1 ring-purple-300",
                },
              ].map((item) => {
                const checked = activeDerivMultipliers.includes(item.id);
                return (
                  <label
                    key={item.id}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-bold cursor-pointer select-none transition-all ${
                      checked
                        ? item.activeColor + " shadow-sm"
                        : "border-neutral-200 bg-surface text-neutral-400 opacity-60 hover:opacity-80"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDerivMultiplier(item.id)}
                      className="size-3.5 rounded accent-neutral-800 cursor-pointer"
                    />
                    <span>{item.label}</span>
                    <span className="text-[11px] font-mono font-medium text-neutral-500">({item.count})</span>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveDerivMultipliers(["lev2x", "inv2x", "inv1x"])}
                className="text-xs font-bold text-brand-700 hover:text-brand-800 hover:underline cursor-pointer"
              >
                전체 선택
              </button>
              <span className="text-neutral-300">|</span>
              <button
                type="button"
                onClick={() => setActiveDerivMultipliers([])}
                className="text-xs font-medium text-muted hover:text-strong cursor-pointer"
              >
                선택 해제
              </button>
            </div>
          </div>
        ) : null}

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
          <button className="sticky bottom-0 mt-5 w-full rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-bold text-white md:hidden" onClick={() => setFiltersOpen(false)} type="button">{visibleEtfs.length.toLocaleString("ko-KR")}종목 보기</button>
        </aside>
      </> : null}

      <div className="mt-5 rounded-2xl border border-line bg-surface w-full overflow-x-auto lg:overflow-x-visible [scrollbar-width:thin]" ref={tableWrapperRef}>
        <div className="w-full">
          <table className={`w-full border-separate border-spacing-0 text-left text-sm whitespace-nowrap ${isFullPeriods ? "min-w-[1100px]" : "min-w-[770px]"}`}><caption className="sr-only">{copy.title} 목록과 기간별 가격 수익률</caption>
            {/* 명시적 열 너비 제어 */}
            <colgroup>
              <col style={{ width: 180, minWidth: 140 }} />
              {displayPeriods.map((period) => (
                <col key={period} style={{ width: 62, minWidth: 54 }} />
              ))}
              <col style={{ width: 56, minWidth: 52 }} />
              <col style={{ width: 68, minWidth: 60 }} />
              <col style={{ width: 68, minWidth: 60 }} />
              <col style={{ width: 68, minWidth: 60 }} />
            </colgroup>
            
            {/* 2단 헤더 (윈도우 스크롤 시 상단 밀착 고정) */}
            <thead className="sticky top-0 z-30 border-b-2 border-neutral-300 bg-neutral-100 text-[12px] sm:text-[13px] font-bold text-neutral-700 shadow-sm">
              {/* 1단 그룹 헤더 */}
              <tr className="border-b border-neutral-200">
                <th className="sticky left-0 z-40 h-[30px] sm:h-[32px] w-[140px] min-w-[140px] sm:w-[180px] sm:min-w-[180px] bg-neutral-100 px-2 sm:px-3 py-0 text-center shadow-[1px_0_0_0_#e5e5e5]" colSpan={productInfoColSpan} scope="colgroup">상품 정보</th>
                <th className="h-[30px] sm:h-[32px] bg-neutral-50 px-2 py-0 text-center border-l border-neutral-200" colSpan={returnsColSpan} scope="colgroup">
                  <div className="flex items-center justify-center gap-1.5">
                    <span>수익률(%)</span>
                    {state.mode !== "new" && (
                      <button
                        type="button"
                        onClick={() => setIsFullPeriods(!isFullPeriods)}
                        className="inline-flex items-center gap-0.5 rounded border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700 hover:bg-brand-100 hover:text-brand-900 transition-colors cursor-pointer"
                        title={isFullPeriods ? "핵심 5대 수익률만 보기" : "10개 전 구간 수익률 펼치기"}
                      >
                        <span>{isFullPeriods ? "5개 핵심으로 접기 ▴" : "전 구간 10개 펼치기 ▾"}</span>
                      </button>
                    )}
                  </div>
                </th>
                <th className="h-[30px] sm:h-[32px] bg-neutral-100 px-2 py-0 text-center border-l border-neutral-200" colSpan={costSizePriceColSpan} scope="colgroup">비용·규모·가격</th>
              </tr>
              {/* 2단 세부 헤더 */}
              <tr className="text-[11.5px] sm:text-[12px]">
                <th className="sticky left-0 z-40 w-[140px] min-w-[140px] sm:w-[180px] sm:min-w-[180px] bg-neutral-100 px-2 sm:px-3 py-0 h-[44px] sm:h-[48px] text-center shadow-[1px_0_0_0_#e5e5e5] border-b-2 border-neutral-300" scope="col">종목 정보</th>
                
                {displayPeriods.map((period, index) => {
                  const isYtd = period === "ytd" || period === "itd";
                  const borderL = isYtd ? 'border-l-2 border-neutral-200' : index === 0 ? 'border-l border-neutral-200' : '';
                  const isSorted = normalizedPeriod === period;
                  const bg = isSorted ? "bg-brand-100 text-brand-900" : "bg-neutral-50";
                  return (
                    <th aria-label={`${RETURN_PERIOD_LABELS[period]} 수익률`} className={`h-[44px] sm:h-[48px] min-w-[54px] sm:min-w-[60px] px-1 sm:px-1.5 py-0 text-right ${borderL} ${bg} border-b-2 border-neutral-300`} key={period} scope="col">
                      <span className="whitespace-nowrap text-[10.5px] sm:text-[11px] tracking-tighter font-bold text-strong block text-right pr-0.5">{RETURN_PERIOD_LABELS[period]}</span>
                    </th>
                  );
                })}
                
                <th aria-label="투자자 실부담 총비용, 단위 퍼센트" className="min-w-[58px] sm:min-w-[64px] h-[44px] sm:h-[48px] bg-neutral-100 px-1 sm:px-1.5 py-0 text-right border-l border-neutral-200 border-b-2 border-neutral-300" scope="col"><UnitHeaderLabel align="right" label="실부담비용" unit="%" /></th>
                <th aria-label="순자산, 단위 억원" className="min-w-[58px] sm:min-w-[64px] h-[44px] sm:h-[48px] bg-neutral-100 px-1 sm:px-1.5 py-0 text-right border-b-2 border-neutral-300" scope="col"><UnitHeaderLabel align="right" label="순자산" unit="억원" /></th>
                <th aria-label="거래대금, 단위 억원" className="min-w-[58px] sm:min-w-[64px] h-[44px] sm:h-[48px] bg-neutral-100 px-1 sm:px-1.5 py-0 text-right border-b-2 border-neutral-300" scope="col"><UnitHeaderLabel align="right" label="거래대금" unit="억원" /></th>
                <th aria-label="종가, 단위 원" className="min-w-[58px] sm:min-w-[64px] h-[44px] sm:h-[48px] bg-neutral-100 px-1 sm:px-1.5 py-0 text-right border-b-2 border-neutral-300" scope="col"><UnitHeaderLabel align="right" label="종가" unit="원" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-[12px]">
              {virtualPaddingTop > 0 ? <tr aria-hidden="true" style={{ height: virtualPaddingTop }}><td colSpan={desktopColumnCount} /></tr> : null}
              {virtualRows.map((virtualRow) => {
                const etf = visibleEtfs[virtualRow.index];
                if (!etf) return null;
                const fields = getClassificationFields(etf);
                const derivInfo = isDeriv ? getDerivMultiplierInfo(etf) : null;
                const tdfInfo = state.mode === "tdf" ? getTdfVintageInfo(etf.name) : null;
                const newThemeTag = isNew ? getNewEtfThemeTag(etf.name) : null;

                return (
                  <tr className="bg-surface transition-colors hover:bg-neutral-100 even:bg-neutral-50/60 h-[44px]" data-index={virtualRow.index} key={etf.ticker} ref={rowVirtualizer.measureElement}>
                    {/* 1. 종목 정보 (Sticky Left Column - 2단 통합) */}
                    <th className="sticky left-0 z-10 bg-white w-[140px] min-w-[140px] sm:w-[180px] sm:min-w-[180px] max-w-[210px] px-2 sm:px-3 py-1.5 text-left shadow-[1px_0_0_0_#e5e5e5]" scope="row">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <Link className="line-clamp-1 truncate block text-left text-[12px] sm:text-[13px] font-bold leading-tight text-strong hover:text-brand-700" href={`/etf/${etf.ticker}/`} title={etf.name}>{etf.name}</Link>
                        <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted">
                          <span className="font-mono font-semibold text-neutral-600 bg-neutral-100 px-1 py-0.2 rounded text-[10.5px]">{etf.ticker}</span>
                            
                            {/* 파생형 배수 뱃지 (독립 선명 표기) */}
                            {isDeriv && derivInfo ? (
                              <span className={`select-none rounded px-1.5 py-0.2 text-[10px] ${derivInfo.badgeClass}`}>
                                {derivInfo.label}
                              </span>
                            ) : null}

                            {/* 파생형 거래활성 배지 */}
                            {isDeriv && etf.tradeValue >= 30_000_000_000 ? (
                              <span className="rounded bg-amber-50 border border-amber-200 px-1 py-0.2 text-[9.5px] font-extrabold text-amber-800">거래활성 🔥</span>
                            ) : null}

                            {/* TDF 빈티지 및 주식비중 뱃지 */}
                            {state.mode === "tdf" && tdfInfo ? (
                              <span className="rounded bg-indigo-50 border border-indigo-200 px-1 py-0.2 text-[9.5px] font-bold text-indigo-800">
                                {tdfInfo.vintage} 빈티지 · 주식~{tdfInfo.equityPct}%
                              </span>
                            ) : null}

                            {/* 신규 상장 상장일 독립 표기 */}
                            {isNew && etf.listingDate ? (
                              <span className="inline-flex items-center gap-1 rounded bg-neutral-100 border border-neutral-200 px-1.5 py-0.2 text-[10px] font-semibold text-neutral-700 whitespace-nowrap" title={`상장일: ${formatAsOfDate(etf.listingDate)}`}>
                                <span aria-hidden="true">📅</span>
                                <span className="whitespace-nowrap">{formatAsOfDate(etf.listingDate)}</span>
                              </span>
                            ) : null}

                            {/* 신규 상장 테마 태그 */}
                            {isNew && newThemeTag ? (
                              <span className="text-[10px] font-bold text-brand-700 bg-brand-50 border border-brand-200 px-1 rounded">{newThemeTag}</span>
                            ) : null}

                            <span className="text-neutral-500 font-medium">{etf.assetClass}</span>
                            {fields.marketScope && fields.marketScope !== "국내" ? <span className="text-neutral-400">· {fields.marketScope}</span> : null}
                            {fields.fxHedge && fields.fxHedge !== "노출" && fields.fxHedge !== "비헤지" ? (
                              <span className="text-amber-800 font-bold text-[10px] bg-amber-50 border border-amber-200 px-1 rounded"><FxHedgeMarker value={fields.fxHedge} /></span>
                            ) : null}
                            {!isPension && !isDeriv && etf.pension === "불가" ? (
                              <span className="text-rose-800 font-bold text-[10px] bg-rose-50 border border-rose-200 px-1 rounded">연금불가</span>
                            ) : null}
                          </div>
                        </div>
                    </th>

                    {/* 2. 기간별 수익률 */}
                    {displayPeriods.map((period, index) => {
                      const isYtd = period === "ytd" || period === "itd";
                      const borderL = isYtd ? 'border-l-2 border-neutral-100' : index === 0 ? 'border-l border-neutral-100' : '';
                      const bg = normalizedPeriod === period ? "bg-brand-50" : "";
                      return (
                        <td className={`min-w-[60px] px-1 py-2 text-right font-semibold tabular-nums ${borderL} ${bg}`} key={period}>
                          <ReturnCell showUnit={false} value={etf.returns[period]} />
                        </td>
                      );
                    })}
                    
                    {/* 3. 총보수(실부담) */}
                    <td className="min-w-[64px] px-1 py-1 text-right border-l border-neutral-100 align-middle">
                      <FeeDoubleStack etf={etf} />
                    </td>
                    {/* 4. 순자산 */}
                    <td className="min-w-[64px] px-1 py-2 text-right font-semibold tabular-nums text-strong">{formatAumNumber(etf.aum)}</td>
                    {/* 5. 거래대금 */}
                    <td className="min-w-[64px] px-1 py-2 text-right font-semibold tabular-nums text-strong">{formatTradeValueNumber(etf.tradeValue)}</td>
                    {/* 6. 종가 */}
                    <td className="min-w-[64px] px-1 py-2 text-right font-semibold tabular-nums">{formatWonNumber(etf.close)}</td>
                  </tr>
                );
              })}
              {virtualPaddingBottom > 0 ? <tr aria-hidden="true" style={{ height: virtualPaddingBottom }}><td colSpan={desktopColumnCount} /></tr> : null}
            </tbody>
          </table>


          {!visibleEtfs.length ? <div className="px-5 py-16 text-center"><p className="font-extrabold text-strong">조건에 맞는 ETF가 없습니다</p><p className="mt-2 text-sm text-muted">검색어나 필터, 순자산 범위를 조정해 보세요.</p></div> : null}
        </div>
      </div>
    </div>
  );
}
