"use client";

import Link from "next/link";
import { useEffect, useState, type KeyboardEvent } from "react";

import { Tickery } from "@/components/brand/tickery";
import { AsOfDate, PensionBadge, ReturnCell } from "@/components/etf";
import { getClassificationFields } from "@/lib/domain/etf-classification";
import { formatAsOfDate, formatMoneyNumber, formatWonNumber } from "@/lib/domain/etf-format";
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
} from "@/lib/domain/etf-types";
import { isSmallEtf } from "@/lib/domain/etf-visibility";

const PAGE_SIZE = 50;

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
};

const scopeOptions: { value: AumScope; label: string }[] = [
  { value: "1000plus", label: "1,000억+" },
  { value: "500plus", label: "500억+" },
  { value: "all", label: "전체" },
];

const riskLabels: Record<RiskType, string> = { normal: "일반", leverage: "레버리지", inverse: "인버스" };

function toggleValue<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function updateUrl(state: ExplorerState): void {
  const query = serializeExplorerQuery(state);
  window.history.replaceState(null, "", `${window.location.pathname}?${query}`);
}

function getAllowedRiskTypes(mode: InvestorMode): readonly RiskType[] {
  if (mode === "derivatives") return ["leverage", "inverse"];
  if (mode === "new") return RISK_TYPES;
  return [];
}

function SearchSuggestionMeta({ etf }: { etf: Etf }) {
  const fields = getClassificationFields(etf);
  return <span className="hidden shrink-0 text-xs text-muted sm:inline">{fields.marketScope} · {fields.assetClass}</span>;
}

function CompactAssetClassLabel({ value }: { value: string }) {
  if (value === "금리/파킹" || value === "금리·파킹") {
    return <span aria-label="금리(파킹)" className="inline-flex flex-col whitespace-nowrap text-xs font-bold leading-4 text-strong" title="금리(파킹)"><span aria-hidden="true">금리</span><span aria-hidden="true">(파킹)</span></span>;
  }
  if (value === "리츠/인프라" || value === "리츠·인프라") {
    return <span aria-label="리츠/인프라" className="inline-flex flex-col whitespace-nowrap text-xs font-bold leading-4 text-strong" title="리츠/인프라"><span aria-hidden="true">리츠/</span><span aria-hidden="true">인프라</span></span>;
  }
  return <span className="whitespace-nowrap text-xs font-bold text-strong">{value}</span>;
}

function ClassificationCells({ etf }: { etf: Etf }) {
  const fields = getClassificationFields(etf);
  return (
    <>
      <td className="hidden whitespace-nowrap px-1.5 py-4 text-center text-xs font-semibold text-muted md:table-cell">{fields.marketScope}</td>
      <td className="hidden px-1.5 py-4 text-center md:table-cell">
        <div className="flex flex-wrap items-center justify-center gap-1">
          <CompactAssetClassLabel value={fields.assetClass} />
          {fields.riskLabel ? <span aria-label={fields.riskLabel} className="select-none rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-800" title={fields.riskLabel}>{fields.riskLabel}</span> : null}
        </div>
      </td>
      <td className="hidden whitespace-nowrap px-1 py-4 text-center text-xs font-bold text-muted md:table-cell">{fields.fxHedge ?? ""}</td>
    </>
  );
}

export function Dashboard({ etfs }: { etfs: Etf[] }) {
  const [state, setState] = useState<ExplorerState>(DEFAULT_EXPLORER_STATE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [urlReady, setUrlReady] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);

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

  const scopedEtfs = state.mode === "new" ? modeEtfs : getEtfsByAumScope(modeEtfs, state.scope);
  const searchedEtfs = searchEtfs(scopedEtfs, state.query);
  const filteredEtfs = applyExplorerFilters(searchedEtfs, { assetClasses: state.assetClasses, riskTypes: activeRiskTypes });
  const results = sortExplorerEtfs(filteredEtfs, state.sort, state.direction, normalizedPeriod);

  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const currentPage = Math.min(state.page, pageCount);
  const visibleEtfs = results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const activeFilterCount = state.assetClasses.length + activeRiskTypes.length;
  const asOfDate = etfs[0]?.asOfDate;
  const copy = modeCopy[state.mode];
  const pendingListingDates = state.mode === "new" ? modeEtfs.filter((etf) => !etf.listingDate).length : 0;

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

      <section aria-label="ETF 검색과 정렬" className="mt-3 rounded-2xl border border-line bg-neutral-50 p-3 sm:p-4">
        <div
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setSearchFocused(false);
              setActiveSuggestion(-1);
            }
          }}
        >
          <div className="relative min-w-0 flex-1">
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
                        href={`/etf/${etf.ticker}`}
                        id={`etf-suggestion-${index}`}
                        onMouseEnter={() => setActiveSuggestion(index)}
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
          <div className="flex shrink-0 items-center justify-between gap-3 px-1 sm:justify-end sm:px-2"><span className="tabular-nums text-sm font-extrabold text-strong">{results.length.toLocaleString("ko-KR")}종목</span>{asOfDate ? <AsOfDate value={asOfDate} /> : null}</div>
        </div>

        <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
            {state.mode !== "new" ? (
              <div aria-label="순자산 목록 범위" className="flex shrink-0 rounded-xl bg-surface p-1 shadow-sm" role="group">
                {scopeOptions.map((option) => <button aria-pressed={state.scope === option.value} className={`min-h-10 rounded-lg px-3 py-1.5 text-sm font-bold transition-colors ${state.scope === option.value ? "bg-brand-700 text-white" : "text-muted hover:text-strong"}`} key={option.value} onClick={() => setExplorerState({ scope: option.value })} type="button">{option.label}</button>)}
              </div>
            ) : <span className="w-fit shrink-0 rounded-full bg-brand-100 px-3 py-2 text-xs font-extrabold text-brand-800">0~90일 · 규모 제한 없음</span>}
            <span aria-hidden="true" className="hidden h-7 w-px shrink-0 bg-line sm:block" />
            <div aria-label="수익률 기간" className="scrollbar-none flex min-w-0 items-center gap-1 overflow-x-auto" role="group">
              <span className="mr-1 shrink-0 text-xs font-bold text-muted">기간</span>
              {periods.map((period) => <button aria-pressed={normalizedPeriod === period} className={`min-h-10 shrink-0 rounded-lg px-3 py-2 text-xs font-bold ${normalizedPeriod === period ? "bg-brand-100 text-brand-800" : "text-muted hover:bg-surface"}`} key={period} onClick={() => setExplorerState({ period })} type="button">{RETURN_PERIOD_LABELS[period]}</button>)}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-muted">정렬
              <select className="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-strong" onChange={(event) => setExplorerState({ sort: event.target.value as ExplorerState["sort"] })} value={state.sort}>
                <option value="return">기간 수익률</option>
                <option value="tradeValue">거래대금</option>
                <option value="aum">순자산</option>
                {state.mode === "new" ? <option value="listingDate">상장일</option> : null}
              </select>
            </label>
            <div aria-label="정렬 방향" className="flex rounded-lg border border-line bg-surface p-1" role="group">
              <button aria-pressed={state.direction === "desc"} className={`min-h-9 rounded-md px-3 text-xs font-bold ${state.direction === "desc" ? "bg-neutral-800 text-white" : "text-muted"}`} onClick={() => setExplorerState({ direction: "desc" })} type="button">높은순</button>
              <button aria-pressed={state.direction === "asc"} className={`min-h-9 rounded-md px-3 text-xs font-bold ${state.direction === "asc" ? "bg-neutral-800 text-white" : "text-muted"}`} onClick={() => setExplorerState({ direction: "asc" })} type="button">낮은순</button>
            </div>
            <button className="min-h-11 rounded-lg border border-brand-200 bg-brand-50 px-3 text-sm font-bold text-brand-800" onClick={() => setFiltersOpen(true)} type="button">필터{activeFilterCount ? ` ${activeFilterCount}` : ""}</button>
          </div>
        </div>

        {activeFilterCount ? <div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-muted">적용 중</span>{state.assetClasses.map((value) => <button className="chip" key={value} onClick={() => setExplorerState({ assetClasses: toggleValue<AssetClass>(state.assetClasses, value) })} type="button">{value} ×</button>)}{activeRiskTypes.map((value) => <button className="chip" key={value} onClick={() => setExplorerState({ riskTypes: toggleValue<RiskType>(state.riskTypes, value) })} type="button">{riskLabels[value]} ×</button>)}<button className="text-xs font-bold text-brand-700" onClick={clearFilters} type="button">모두 해제</button></div> : null}
      </section>

      {filtersOpen ? <>
        <button aria-label="필터 닫기" className="fixed inset-0 z-30 bg-neutral-900/30 md:hidden" onClick={() => setFiltersOpen(false)} type="button" />
        <aside aria-label="ETF 필터" className="fixed inset-x-0 bottom-0 z-40 max-h-[82vh] overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl md:static md:mt-4 md:rounded-2xl md:border md:border-line md:bg-neutral-50 md:shadow-none">
          <div className="flex items-center justify-between gap-4"><h2 className="text-lg font-extrabold">목록 필터</h2><div className="flex gap-3"><button className="text-xs font-bold text-brand-700" onClick={clearFilters} type="button">초기화</button><button aria-label="필터 닫기" className="rounded-lg px-2 text-xl text-muted" onClick={() => setFiltersOpen(false)} type="button">×</button></div></div>
          <div className="mt-5 grid gap-6 md:grid-cols-2">
            <fieldset><legend className="text-sm font-extrabold">자산군</legend><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">{ASSET_CLASSES.map((value) => <label className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm text-muted" key={value}><input checked={state.assetClasses.includes(value)} className="size-4 accent-brand-700" onChange={() => setExplorerState({ assetClasses: toggleValue<AssetClass>(state.assetClasses, value) })} type="checkbox" />{value}</label>)}</div></fieldset>
            {allowedRiskTypes.length ? <fieldset><legend className="text-sm font-extrabold">위험유형</legend><div className="mt-3 grid grid-cols-2 gap-2">{allowedRiskTypes.map((value) => <label className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm text-muted" key={value}><input checked={activeRiskTypes.includes(value)} className="size-4 accent-brand-700" onChange={() => setExplorerState({ riskTypes: toggleValue<RiskType>(state.riskTypes, value) })} type="checkbox" />{riskLabels[value]}</label>)}</div></fieldset> : null}
          </div>
          <button className="sticky bottom-0 mt-6 w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white md:hidden" onClick={() => setFiltersOpen(false)} type="button">{results.length.toLocaleString("ko-KR")}종목 보기</button>
        </aside>
      </> : null}

      <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm md:min-w-[1180px] md:table-fixed"><caption className="sr-only">{copy.title} 목록과 기간별 가격 수익률</caption>
            <thead className="sticky top-0 z-10 bg-neutral-50 text-xs font-bold text-muted">
              <tr>
                <th className="hidden w-[4.5%] px-1 py-3 text-center md:table-cell" scope="col">종목코드</th>
                <th className="min-w-52 px-4 py-3 text-center sm:px-5 md:sticky md:left-0 md:z-20 md:w-[18.5%] md:bg-neutral-50" scope="col">종목명</th>
                <th className="w-24 px-2 py-3 text-right md:hidden" scope="col">등락률</th>
                <th className="w-28 px-4 py-3 text-right md:hidden" scope="col">{RETURN_PERIOD_LABELS[normalizedPeriod]} 수익률</th>
                <th aria-label="종가, 단위 원" className="hidden w-[5.5%] whitespace-nowrap px-1 py-3 text-center md:table-cell" scope="col">종가(원)</th>
                <th aria-label="거래대금, 단위 억원" className="hidden w-[6%] whitespace-nowrap px-1 py-3 text-right md:table-cell" scope="col">거래대금(억원)</th>
                <th aria-label="순자산, 단위 억원" className="hidden w-[6%] whitespace-nowrap px-1 py-3 text-right md:table-cell" scope="col">순자산(억원)</th>
                {state.mode === "new" ? <th className="hidden px-3 py-3 md:table-cell" scope="col">상장일</th> : null}
                {periods.map((period) => <th aria-label={`${RETURN_PERIOD_LABELS[period]} 수익률, 단위 퍼센트`} className={`hidden w-[4.25%] whitespace-nowrap px-0.5 py-3 text-center text-[11px] md:table-cell ${normalizedPeriod === period ? "bg-brand-50 text-brand-800" : ""}`} key={period} scope="col">{RETURN_PERIOD_LABELS[period]}(%)</th>)}
                <th className="hidden w-[5.5%] bg-brand-50 px-1 py-3 text-center text-brand-800 md:table-cell" scope="col">지역</th>
                <th className="hidden w-[6.5%] bg-brand-50 px-1 py-3 text-center text-brand-800 md:table-cell" scope="col">자산</th>
                <th className="hidden w-[4.5%] bg-brand-50 px-0.5 py-3 text-center text-brand-800 md:table-cell" scope="col">환헤지</th>
                <th className="hidden w-[3.5%] px-0.5 py-3 text-center md:table-cell" scope="col">연금</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visibleEtfs.map((etf) => <tr className="transition-colors hover:bg-brand-50/50" key={etf.ticker}>
                <td className="tabular-nums hidden px-2 py-3 text-center text-xs text-muted md:table-cell">{etf.ticker}</td>
                <th className="max-w-0 bg-surface px-4 py-3 text-center font-normal sm:px-5 md:sticky md:left-0 md:z-[1]" scope="row"><Link className="line-clamp-2 [overflow-wrap:anywhere] text-center font-bold leading-5 text-strong hover:text-brand-700" href={`/etf/${etf.ticker}`} title={etf.name}>{etf.name}</Link></th>
                <td className="px-2 py-4 text-right md:hidden"><ReturnCell value={etf.changePct} /></td>
                <td className="px-4 py-4 text-right md:hidden"><ReturnCell value={etf.returns[normalizedPeriod]} /></td>
                <td className="tabular-nums hidden px-2 py-3 text-center font-semibold md:table-cell">{formatWonNumber(etf.close)}</td>
                <td className="tabular-nums hidden px-2 py-4 text-right md:table-cell">{formatMoneyNumber(etf.tradeValue)}</td>
                <td className="tabular-nums hidden px-2 py-4 text-right md:table-cell"><span className="inline-flex items-center justify-end gap-1.5"><span>{formatMoneyNumber(etf.aum)}</span>{isSmallEtf(etf) ? <span aria-label="소규모 ETF: 순자산 100억원 미만" className="size-2 shrink-0 rounded-full bg-amber-500" title="순자산 100억원 미만" /> : null}</span></td>
                {state.mode === "new" ? <td className="tabular-nums hidden px-3 py-4 text-xs text-muted md:table-cell">{etf.listingDate ? formatAsOfDate(etf.listingDate) : "확인 중"}</td> : null}
                {periods.map((period) => <td className={`hidden px-1 py-4 text-center text-xs md:table-cell ${normalizedPeriod === period ? "bg-brand-50/60" : ""}`} key={period}><ReturnCell showUnit={false} value={etf.returns[period]} /></td>)}
                <ClassificationCells etf={etf} />
                <td className="hidden px-1 py-4 text-center md:table-cell"><PensionBadge compact status={etf.pension} /></td>
              </tr>)}
            </tbody>
          </table>
          {!visibleEtfs.length ? <div className="px-5 py-16 text-center"><p className="font-extrabold text-strong">조건에 맞는 ETF가 없습니다</p><p className="mt-2 text-sm text-muted">검색어나 필터, 순자산 범위를 조정해 보세요.</p></div> : null}
        </div>
      </div>

      {pageCount > 1 ? <nav aria-label="ETF 목록 페이지" className="mt-5 flex items-center justify-center gap-4"><button className="min-h-11 rounded-lg border border-line px-4 text-sm font-bold disabled:opacity-40" disabled={currentPage === 1} onClick={() => setExplorerState({ page: currentPage - 1 }, false)} type="button">이전</button><span className="tabular-nums text-sm font-bold text-muted">{currentPage} / {pageCount}</span><button className="min-h-11 rounded-lg border border-line px-4 text-sm font-bold disabled:opacity-40" disabled={currentPage === pageCount} onClick={() => setExplorerState({ page: currentPage + 1 }, false)} type="button">다음</button></nav> : null}
      <aside aria-label="수익률 안내" className="mt-5 border-t border-line pt-4 text-[11px] leading-5 text-neutral-500">
        <p>기간 수익률은 기준일 종가와 기간 시작일 종가를 비교합니다. 휴장일은 직전 거래일, 상장 전 기간은 최초 거래일 종가를 사용하며 분배금은 포함하지 않습니다.{state.mode === "new" ? " 상장 후(ITD)는 최초 거래일 종가 대비 수익률입니다." : ""} 과거 수익률은 미래 수익을 보장하지 않으며 추천이 아닙니다.</p>
      </aside>
    </main>
  );
}
