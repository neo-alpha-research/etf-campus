"use client";

import Link from "next/link";
import { useEffect, useState, type KeyboardEvent } from "react";

import { Tickery } from "@/components/brand/tickery";
import { AsOfDate, AssetClassTag, PensionBadge, ReturnCell, RiskBadge } from "@/components/etf";
import { formatAsOfDate, formatMoneyNumber, formatWonNumber } from "@/lib/domain/etf-format";
import {
  DEFAULT_EXPLORER_STATE,
  applyExplorerFilters,
  filterEtfsByMode,
  getDefaultPeriod,
  getEtfSearchSuggestions,
  getEtfsByAumScope,
  getListingAgeDays,
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

function listingSummary(etf: Etf): string {
  if (!etf.listingDate) return "상장일 확인 중";
  const age = getListingAgeDays(etf.listingDate, etf.asOfDate);
  return `${formatAsOfDate(etf.listingDate)} 상장${age === null ? "" : ` · D+${age}`}`;
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
    <main aria-labelledby="dashboard-title" className="page-shell flex-1 py-8 sm:py-12">
      <div className="flex items-center justify-between gap-4 rounded-3xl bg-gradient-to-br from-brand-50/80 to-surface px-5 py-5 sm:px-7">
        <div className="max-w-3xl">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-strong sm:text-4xl" id="dashboard-title">{copy.title}</h1>
          <p className="mt-3 text-sm leading-6 text-muted sm:text-base">{copy.description}</p>
        </div>
        <Tickery className="h-24 w-24 shrink-0 sm:h-32 sm:w-32" pose={state.mode === "pension" ? "pension" : "search"} priority sizes="(max-width: 640px) 96px, 128px" />
      </div>

      {state.mode === "pension" ? <p className="mt-5 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold leading-6 text-brand-900">DC·IRP 편입 가능 여부는 금융회사별 매매 가능 목록과 위험자산 한도에 따라 달라질 수 있습니다.</p> : null}
      {state.mode === "derivatives" ? <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-900">레버리지·인버스 ETF는 일간 수익률의 배수를 목표로 하므로 보유 기간이 길어질수록 기초지수 누적수익률과 차이가 커질 수 있습니다.</p> : null}
      {pendingListingDates ? <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-900">정확한 상장일 백필 전인 {pendingListingDates.toLocaleString("ko-KR")}종목은 기존 3개월 플래그로 표시하며 상장일은 확인 중입니다.</p> : null}

      <section aria-label="ETF 검색과 정렬" className="mt-8 rounded-2xl border border-line bg-neutral-50 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {state.mode !== "new" ? (
            <div aria-label="순자산 목록 범위" className="flex rounded-xl bg-surface p-1 shadow-sm" role="group">
              {scopeOptions.map((option) => <button aria-pressed={state.scope === option.value} className={`min-h-11 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${state.scope === option.value ? "bg-brand-700 text-white" : "text-muted hover:text-strong"}`} key={option.value} onClick={() => setExplorerState({ scope: option.value })} type="button">{option.label}</button>)}
            </div>
          ) : <span className="rounded-full bg-brand-100 px-3 py-2 text-xs font-extrabold text-brand-800">0~90일 · 규모 제한 없음</span>}
          <div className="flex items-center gap-3"><span className="tabular-nums text-sm font-extrabold text-strong">{results.length.toLocaleString("ko-KR")}종목</span>{asOfDate ? <AsOfDate value={asOfDate} /> : null}</div>
        </div>

        <div
          className="relative mt-4"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setSearchFocused(false);
              setActiveSuggestion(-1);
            }
          }}
        >
          <label className="block">
            <span className="sr-only">종목명 또는 티커 검색</span>
            <input
              aria-activedescendant={activeSuggestion >= 0 ? `etf-suggestion-${activeSuggestion}` : undefined}
              aria-autocomplete="list"
              aria-controls="etf-search-suggestions"
              aria-expanded={showSearchSuggestions}
              className="min-h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm text-strong placeholder:text-neutral-400"
              onChange={(event) => {
                setExplorerState({ query: event.target.value });
                setActiveSuggestion(-1);
              }}
              onFocus={() => setSearchFocused(true)}
              onKeyDown={handleSearchKeyDown}
              placeholder="종목명·티커·기초지수 검색"
              role="combobox"
              type="search"
              value={state.query}
            />
          </label>
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
                      <span className="min-w-0 flex-1 truncate text-sm font-bold text-strong">{etf.name}</span>
                      <span className="hidden shrink-0 text-xs text-muted sm:inline">{etf.assetClass}</span>
                      <PensionBadge status={etf.pension} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold text-muted">표시 수익률</p>
            <div aria-label="수익률 기간" className="scrollbar-none flex gap-1 overflow-x-auto" role="group">
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
          <table className="w-full border-collapse text-left text-sm md:min-w-[1120px] md:table-fixed"><caption className="sr-only">{copy.title} 목록과 기간별 가격 수익률</caption>
            <thead className="sticky top-0 z-10 bg-neutral-50 text-xs font-bold text-muted">
              <tr>
                <th className="hidden w-[5.5%] px-2 py-3 text-center md:table-cell" scope="col">종목코드</th>
                <th className="min-w-44 px-4 py-3 text-center sm:px-5 md:sticky md:left-0 md:z-20 md:w-[14.5%] md:bg-neutral-50" scope="col">종목명</th>
                <th className="w-24 px-2 py-3 text-right md:hidden" scope="col">등락률</th>
                <th className="w-28 px-4 py-3 text-right md:hidden" scope="col">{RETURN_PERIOD_LABELS[normalizedPeriod]} 수익률</th>
                <th aria-label="종가, 단위 원" className="hidden w-[7%] px-2 py-2.5 text-center md:table-cell" scope="col">
                  <span className="block">종가</span><span className="mt-0.5 block text-[10px] font-medium text-neutral-400">원</span>
                </th>
                <th aria-label="거래대금, 단위 억원" className="hidden w-[7%] px-2 py-2.5 text-right md:table-cell" scope="col">
                  <span className="block">거래대금</span><span className="mt-0.5 block text-[10px] font-medium text-neutral-400">억원</span>
                </th>
                <th aria-label="순자산, 단위 억원" className="hidden w-[7%] px-2 py-2.5 text-right md:table-cell" scope="col">
                  <span className="block">순자산</span><span className="mt-0.5 block text-[10px] font-medium text-neutral-400">억원</span>
                </th>
                {state.mode === "new" ? <th className="hidden px-3 py-3 md:table-cell" scope="col">상장일</th> : null}
                {periods.map((period) => <th aria-label={`${RETURN_PERIOD_LABELS[period]} 수익률, 단위 퍼센트`} className={`hidden w-[5.5%] px-1 py-2.5 text-center md:table-cell ${normalizedPeriod === period ? "bg-brand-50 text-brand-800" : ""}`} key={period} scope="col"><span className="block">{RETURN_PERIOD_LABELS[period]}</span><span className="mt-0.5 block text-[10px] font-medium text-neutral-400">%</span></th>)}
                <th className="hidden w-[12%] bg-brand-50 px-2 py-3 text-center text-brand-800 md:table-cell" scope="col">분류</th>
                <th className="hidden w-[8%] px-2 py-3 text-center md:table-cell" scope="col">연금</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visibleEtfs.map((etf) => <tr className="transition-colors hover:bg-brand-50/50" key={etf.ticker}>
                <td className="tabular-nums hidden px-2 py-3 text-center text-xs text-muted md:table-cell">{etf.ticker}</td>
                <th className="max-w-0 bg-surface px-4 py-3 text-center font-normal sm:px-5 md:sticky md:left-0 md:z-[1]" scope="row"><div className="flex min-w-0 items-center gap-2 whitespace-nowrap"><Link className="min-w-0 flex-1 truncate text-center font-bold leading-5 text-strong hover:text-brand-700" href={`/etf/${etf.ticker}`} title={etf.name}>{etf.name}</Link>{state.mode === "new" ? <span className="hidden shrink-0 text-xs text-muted xl:inline">{listingSummary(etf)}</span> : null}{isSmallEtf(etf) ? <span className="hidden shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-xs font-bold text-amber-800 lg:inline">소규모 유의</span> : null}</div></th>
                <td className="px-2 py-4 text-right md:hidden"><ReturnCell value={etf.changePct} /></td>
                <td className="px-4 py-4 text-right md:hidden"><ReturnCell value={etf.returns[normalizedPeriod]} /></td>
                <td className="tabular-nums hidden px-2 py-3 text-center font-semibold md:table-cell">{formatWonNumber(etf.close)}</td>
                <td className="tabular-nums hidden px-2 py-4 text-right md:table-cell">{formatMoneyNumber(etf.tradeValue)}</td>
                <td className="tabular-nums hidden px-2 py-4 text-right md:table-cell">{formatMoneyNumber(etf.aum)}</td>
                {state.mode === "new" ? <td className="tabular-nums hidden px-3 py-4 text-xs text-muted md:table-cell">{etf.listingDate ? formatAsOfDate(etf.listingDate) : "확인 중"}</td> : null}
                {periods.map((period) => <td className={`hidden px-1 py-4 text-center text-xs md:table-cell ${normalizedPeriod === period ? "bg-brand-50/60" : ""}`} key={period}><ReturnCell showUnit={false} value={etf.returns[period]} /></td>)}
                <td className="hidden px-2 py-4 text-center md:table-cell"><div className="inline-flex flex-nowrap items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-brand-100 bg-brand-50/70 p-1"><AssetClassTag assetClass={etf.assetClass} /><RiskBadge riskType={etf.riskType} /></div></td>
                <td className="hidden px-2 py-4 text-center md:table-cell"><PensionBadge status={etf.pension} /></td>
              </tr>)}
            </tbody>
          </table>
          {!visibleEtfs.length ? <div className="px-5 py-16 text-center"><p className="font-extrabold text-strong">조건에 맞는 ETF가 없습니다</p><p className="mt-2 text-sm text-muted">검색어나 필터, 순자산 범위를 조정해 보세요.</p></div> : null}
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-muted">과거 수익률은 미래 수익을 보장하지 않으며 추천이 아닙니다</p>
      {pageCount > 1 ? <nav aria-label="ETF 목록 페이지" className="mt-5 flex items-center justify-center gap-4"><button className="min-h-11 rounded-lg border border-line px-4 text-sm font-bold disabled:opacity-40" disabled={currentPage === 1} onClick={() => setExplorerState({ page: currentPage - 1 }, false)} type="button">이전</button><span className="tabular-nums text-sm font-bold text-muted">{currentPage} / {pageCount}</span><button className="min-h-11 rounded-lg border border-line px-4 text-sm font-bold disabled:opacity-40" disabled={currentPage === pageCount} onClick={() => setExplorerState({ page: currentPage + 1 }, false)} type="button">다음</button></nav> : null}
      <p className="mt-5 border-t border-line pt-4 text-[11px] leading-5 text-neutral-500">수익률 산정 기준: 가격 기준·분배금 미포함 · 1일은 직전 거래일, 주·개월은 기준일에서 해당 달력 기간 전 날짜의 당일 또는 직전 거래일 종가 대비 · 값이 없으면 추정하지 않고 -로 표시{state.mode === "new" ? " · 상장 후(ITD)는 첫 거래일 종가 대비" : ""}</p>
    </main>
  );
}
