"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

import { AsOfDate, PensionBadge, ReturnCell, RiskBadge } from "@/components/etf";
import { ReturnRankingChart } from "./return-ranking-chart";
import { IssuerMultiSelect } from "./issuer-multi-select";
import { formatAumNumber, formatWonNumber, formatTradeValueNumber } from "@/lib/domain/etf-format";
import { TER_RANGES, DEFAULT_SCREENER_FILTERS, filterEtfs, type ScreenerEtf, parseScreenerQuery, serializeScreenerQuery, type TerRange, type ScreenerFilters } from "@/lib/domain/etf-screener";
import { AUM_SCOPES, GENERAL_RETURN_PERIODS, type AumScope } from "@/lib/domain/etf-explorer";
import { ASSET_CLASSES, RISK_TYPES, MARKET_SCOPES, STRATEGIES, FX_HEDGES, RETURN_PERIOD_LABELS, type AssetClass, type Etf, type RiskType, type ReturnPeriod } from "@/lib/domain/etf-types";

const riskLabels: Record<RiskType, string> = { normal: "일반형", leverage: "레버리지", inverse: "인버스" };
const aumLabels: Record<AumScope, string> = { all: "전체", "500plus": "500억 이상", "1000plus": "1,000억 이상" };
const terLabels: Record<TerRange, string> = { "under0.1": "0.1% 미만", "0.1to0.5": "0.1~0.5%", "over0.5": "0.5% 이상" };

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function FxHedgeMarker({ value }: { value: string | null }) {
  if (!value || value === "노출" || value === "비헤지") return null;
  return (
    <span
      aria-label="환헤지 적용"
      className="inline-flex min-h-6 min-w-6 items-center justify-center rounded border border-neutral-200 bg-neutral-50 px-1 text-[10px] font-bold text-neutral-500"
      title="환헤지 적용"
    >
      (H)
    </span>
  );
}

function UnitHeaderLabel({ label, unit }: { label: string; unit: string }) {
  return (
    <div className="flex flex-col items-center justify-center leading-[1.2]">
      <span className="text-[11px] font-bold text-strong">{label}</span>
      <span className="text-[10px] font-bold text-neutral-500">({unit})</span>
    </div>
  );
}

type ScreenerSortKey = "return_1d" | "return_1m" | "return_3m" | "return_12m" | "return_custom" | "aum" | "tradeValue" | "ter";
const sortLabels: Record<ScreenerSortKey, string> = {
  return_1d: "1일 수익률",
  return_1m: "1개월 수익률",
  return_3m: "3개월 수익률",
  return_12m: "1년 수익률",
  return_custom: "비교 기간 수익률",
  aum: "순자산액",
  tradeValue: "거래대금",
  ter: "총보수",
};

function FilterChips<T extends string>({
  options,
  selected,
  onChange,
  labels,
  className,
}: {
  options: readonly T[];
  selected: readonly T[];
  onChange: (values: T[]) => void;
  labels?: Record<string, string>;
  className?: string;
}) {
  const isAll = selected.length === 0;
  return (
    <div className={`flex flex-wrap gap-1 ${className || ""}`}>
      <label className={`cursor-pointer rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors ${isAll ? "border-brand-700 bg-brand-700 text-white shadow-sm" : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"}`}>
        <input type="checkbox" checked={isAll} className="sr-only" onChange={() => onChange([])} />
        전체
      </label>
      {options.map((value) => {
        const isChecked = selected.includes(value);
        return (
          <label key={value} className={`cursor-pointer rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors ${isChecked ? "border-brand-700 bg-brand-700 text-white shadow-sm" : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"}`}>
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

export function Screener({ etfs }: { etfs: ScreenerEtf[] }) {
  const [filters, setFilters] = useState<ScreenerFilters>(DEFAULT_SCREENER_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<ReturnPeriod>("1d");
  const [sort, setSort] = useState<ScreenerSortKey>("return_1d");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [comparisonPeriod, setComparisonPeriod] = useState<ReturnPeriod | null>(null);
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string } | null>(null);
  // Inputs held as local state until user clicks 적용
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  const syncFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    setFilters(parseScreenerQuery(params));
    const p = params.get("period") as ReturnPeriod;
    setSelectedPeriod((GENERAL_RETURN_PERIODS as readonly string[]).includes(p) ? p : "1d");
    const s = params.get("sort") as ScreenerSortKey;
    setSort(Object.keys(sortLabels).includes(s) ? s : "return_1d");
    const sd = params.get("dir") as "desc" | "asc";
    setSortDir(sd === "asc" ? "asc" : "desc");
    const cp = params.get("compare") as ReturnPeriod;
    setComparisonPeriod((GENERAL_RETURN_PERIODS as readonly string[]).includes(cp) ? cp : null);
    const cstart = params.get("cstart") || "";
    const cend = params.get("cend") || "";
    if (cstart && cend) {
      setCustomDateRange({ start: cstart, end: cend });
      setCustomStart(cstart);
      setCustomEnd(cend);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  const updateStateAndUrl = (nextFilters: ScreenerFilters, nextPeriod: ReturnPeriod, nextSort: ScreenerSortKey, nextSortDir: "desc" | "asc" = sortDir, nextComparePeriod: ReturnPeriod | null = comparisonPeriod) => {
    setFilters(nextFilters);
    setSelectedPeriod(nextPeriod);
    setSort(nextSort);
    setSortDir(nextSortDir);
    setComparisonPeriod(nextComparePeriod);
    const query = new URLSearchParams(serializeScreenerQuery(nextFilters));
    if (nextPeriod !== "1d") query.set("period", nextPeriod);
    if (nextSort !== "return_1d") query.set("sort", nextSort);
    if (nextSortDir !== "desc") query.set("dir", nextSortDir);
    if (nextComparePeriod) query.set("compare", nextComparePeriod);
    if (customDateRange) { query.set("cstart", customDateRange.start); query.set("cend", customDateRange.end); }
    const queryString = query.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${queryString ? `?${queryString}` : ""}`);
  };

  const updateFilters = (next: ScreenerFilters) => updateStateAndUrl(next, selectedPeriod, sort, sortDir);
  const handlePeriodChange = (nextPeriod: ReturnPeriod) => updateStateAndUrl(filters, nextPeriod, sort, sortDir);
  const handleSortChange = (nextSort: ScreenerSortKey) => {
    // When changing sort key, reset direction if it's changing to/from TER, otherwise keep desc.
    // Actually, usually users want desc for everything except TER.
    let nextSortDir: "desc" | "asc" = "desc";
    if (nextSort === "ter") nextSortDir = "asc";
    updateStateAndUrl(filters, selectedPeriod, nextSort, nextSortDir);
  };
  const handleComparisonPeriodChange = (next: ReturnPeriod | null) => {
    setCustomDateRange(null);
    const nextSort = next ? "return_custom" : (sort === "return_custom" ? "return_1d" : sort);
    updateStateAndUrl(filters, selectedPeriod, nextSort, sortDir, next);
  };
  const handleApplyCustomDateRange = () => {
    // Use state value if changed by user, otherwise fall back to the computed defaults
    const effectiveStart = customStart || defaultStartDate;
    const effectiveEnd = customEnd || defaultEndDate;
    if (!effectiveStart || !effectiveEnd || effectiveStart >= effectiveEnd) return;
    setCustomStart(effectiveStart);
    setCustomEnd(effectiveEnd);
    setCustomDateRange({ start: effectiveStart, end: effectiveEnd });
    setComparisonPeriod(null); // clear fixed period when custom date range applied
    // update URL
    const query = new URLSearchParams(serializeScreenerQuery(filters));
    if (selectedPeriod !== "1d") query.set("period", selectedPeriod);
    if (sort !== "return_1d") query.set("sort", sort);
    if (sortDir !== "desc") query.set("dir", sortDir);
    query.set("cstart", effectiveStart);
    query.set("cend", effectiveEnd);
    const qs = query.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  };
  const handleClearCustomDateRange = () => {
    setCustomDateRange(null);
    setCustomStart("");
    setCustomEnd("");
    const query = new URLSearchParams(serializeScreenerQuery(filters));
    if (selectedPeriod !== "1d") query.set("period", selectedPeriod);
    if (sort !== "return_1d") query.set("sort", sort);
    if (sortDir !== "desc") query.set("dir", sortDir);
    const qs = query.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  };
  // Initialize date inputs from etf data on mount
  // asOfDate may be "2026.08.07" or "20260807" — normalize to YYYY-MM-DD
  const defaultEndDate = (() => {
    const raw = etfs[0]?.asOfDate ?? "";
    if (!raw) return "";
    // "2026.08.07" → "2026-08-07", "20260807" → "2026-08-07"
    const normalized = raw.replace(/\./g, "-").replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
    return normalized;
  })();
  const defaultStartDate = (() => {
    if (!defaultEndDate) return "";
    const d = new Date(defaultEndDate);
    if (isNaN(d.getTime())) return "";
    d.setMonth(d.getMonth() - 4); // Default to 4 months prior
    return d.toISOString().slice(0, 10);
  })();

  const { data: customReturnsData, isLoading: isCustomReturnsLoading } = useSWR<{ returns: Record<string, number | null> }>(
    customDateRange ? `/api/returns?ticker=ALL&start=${customDateRange.start}&end=${customDateRange.end}` : null,
    fetcher
  );

  const results = useMemo(() => {
    return filterEtfs(etfs, filters).sort((a, b) => {
      let cmp = 0;
      if (sort === "return_1d" || sort === "return_1m" || sort === "return_3m" || sort === "return_12m" || sort === "return_custom") {
        let aVal = a.returns[(sort === "return_custom" ? (comparisonPeriod ?? "1d") : sort.replace("return_", "")) as ReturnPeriod] ?? -Infinity;
        let bVal = b.returns[(sort === "return_custom" ? (comparisonPeriod ?? "1d") : sort.replace("return_", "")) as ReturnPeriod] ?? -Infinity;
        
        if (sort === "return_custom" && customDateRange && customReturnsData?.returns) {
          const aCustom = customReturnsData.returns[a.ticker];
          const bCustom = customReturnsData.returns[b.ticker];
          aVal = aCustom !== undefined && aCustom !== null ? aCustom : -Infinity;
          bVal = bCustom !== undefined && bCustom !== null ? bCustom : -Infinity;
        }

        cmp = aVal - bVal;
        if (cmp === 0) cmp = a.tradeValue - b.tradeValue;
        if (cmp === 0) cmp = a.aum - b.aum;
      } else if (sort === "aum") {
        cmp = a.aum - b.aum;
        if (cmp === 0) cmp = a.tradeValue - b.tradeValue;
      } else if (sort === "tradeValue") {
        cmp = a.tradeValue - b.tradeValue;
        if (cmp === 0) cmp = a.aum - b.aum;
      } else if (sort === "ter") {
        const aFee = a.fee?.totalFeePct ?? 0;
        const bFee = b.fee?.totalFeePct ?? 0;
        cmp = bFee - aFee;
      }
      
      if (cmp !== 0) {
        return sortDir === "desc" ? -cmp : cmp;
      }
      return a.ticker.localeCompare(b.ticker);
    });
  }, [etfs, filters, sort, sortDir, comparisonPeriod, customDateRange, customReturnsData]);
  
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const [tableOffsetTop, setTableOffsetTop] = useState(0);

  useEffect(() => {
    if (!tbodyRef.current) return;
    
    const updateOffset = () => {
      if (tbodyRef.current) {
        const rect = tbodyRef.current.getBoundingClientRect();
        setTableOffsetTop(rect.top + window.scrollY);
      }
    };
    
    // Initial update
    updateOffset();
    
    // Track layout shifts (e.g., banner loading)
    const observer = new ResizeObserver(updateOffset);
    observer.observe(document.body);
    
    return () => observer.disconnect();
  }, [results, filters]);

  const rowVirtualizer = useWindowVirtualizer({
    count: results.length,
    estimateSize: () => 36, // Approximate height of a row in the screener table
    overscan: 15,
    scrollMargin: tableOffsetTop,
  });

  const activeCount = Number(filters.pensionOnly) + filters.marketScopes.length + filters.assetClasses.length + filters.riskTypes.length + filters.strategies.length + filters.fxHedges.length + (filters.aumScope !== "all" ? 1 : 0) + filters.terRanges.length + filters.issuerIds.length;

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

  const hasUnsupportedFilters = filters.marketScopes.length > 0 || filters.strategies.length > 0 || filters.fxHedges.length > 0 || filters.terRanges.length > 0 || filters.issuerIds.length > 0;

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
  if (filters.pensionOnly) {
    activeFilters.push({ label: "DC·IRP 가능", remove: () => updateFilters({ ...filters, pensionOnly: false }) });
  }

  if (filters.aumScope !== "all") {
    activeFilters.push({ label: `순자산 ${aumLabels[filters.aumScope]}`, remove: () => updateFilters({ ...filters, aumScope: "all" }) });
  }
  filters.terRanges.forEach(v => {
    activeFilters.push({ label: `총보수 ${terLabels[v]}`, remove: () => updateFilters({ ...filters, terRanges: filters.terRanges.filter(i => i !== v) }) });
  });
  filters.fxHedges.forEach(v => {
    activeFilters.push({ label: v, remove: () => updateFilters({ ...filters, fxHedges: filters.fxHedges.filter(i => i !== v) }) });
  });
  const allIssuers = useMemo(() => {
    const map = new Map<string, { id: string, name: string, count: number }>();
    etfs.forEach(e => {
      const { issuerId, issuerName } = e.issuer;
      const cur = map.get(issuerId) || { id: issuerId, name: issuerName, count: 0 };
      cur.count++;
      map.set(issuerId, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [etfs]);

  if (filters.issuerIds.length > 0) {
    if (filters.issuerIds.length <= 2) {
      filters.issuerIds.forEach(v => {
        const issuer = allIssuers.find(i => i.id === v);
        const label = issuer ? issuer.name : v;
        activeFilters.push({ label, remove: () => updateFilters({ ...filters, issuerIds: filters.issuerIds.filter(i => i !== v) }) });
      });
    } else {
      activeFilters.push({ 
        label: `운용사 ${filters.issuerIds.length}곳`, 
        remove: () => updateFilters({ ...filters, issuerIds: [] }) 
      });
    }
  }

  return (
    <main className="page-shell flex flex-col flex-1 pt-2 pb-6 sm:pt-4 sm:pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="shrink-0 mb-1 sm:mb-0">
          <p className="eyebrow text-xs">ETF Screener</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.04em] text-strong sm:text-3xl">내 기준으로 ETF 찾기</h1>
          <p className="mt-1 text-[13px] leading-tight text-muted">선택한 조건은 URL에 저장되어 같은 결과를 다시 열거나 공유할 수 있습니다.</p>
        </div>

        <div className="flex-1 w-full lg:w-auto lg:min-w-[540px] flex flex-col justify-center lg:items-end mt-2 lg:mt-0">
          <div className="flex flex-col items-start lg:items-end w-full max-w-[600px] lg:max-w-[540px]">
            <a
              href="https://nlink.munpia.com/link/munpia/novel/578267"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="알파를 읽는 자 무료 1화 보기"
              className="block w-full leading-[0] cursor-pointer hover:brightness-[1.035] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c9a45c] focus-visible:outline-offset-2 transition-all rounded-md overflow-hidden"
            >
              <picture className="block w-full">
                <source
                  media="(max-width: 639px)"
                  srcSet="/images/Banners_Alpha_Reader/03_ETFCampus_Responsive/00_RECOMMENDED_10POINT/15_etfcampus_mobile_600x170_safezone_aihook_storyhook.gif"
                  type="image/gif"
                />
                <source
                  media="(min-width: 640px)"
                  srcSet="/images/Banners_Alpha_Reader/03_ETFCampus_Responsive/00_RECOMMENDED_10POINT/16_etfcampus_desktop_920x140_safezone_aihook_storyhook.gif"
                  type="image/gif"
                />
                <img
                  src="/images/Banners_Alpha_Reader/03_ETFCampus_Responsive/00_RECOMMENDED_10POINT/16_etfcampus_desktop_920x140_safezone_aihook_storyhook.png"
                  alt="웹소설 알파를 읽는 자 홍보 배너. 342억을 잃고 죽은 천재매매가가 AI가 공개된 첫날로 돌아갔다. 무료 1화 읽기."
                  className="block h-auto w-full object-contain aspect-[600/170] sm:aspect-[920/140]"
                  loading="eager"
                  decoding="async"
                />
              </picture>
            </a>
            
          </div>
        </div>

        <button className="rounded-xl bg-brand-700 px-3 py-2.5 text-xs font-bold text-white md:hidden shrink-0 self-end" onClick={() => setFiltersOpen(true)} type="button">필터 {activeCount ? `${activeCount}개` : ""}</button>
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

      </div>

      <div className="mt-4 grid gap-5 md:grid-cols-[260px_minmax(0,1fr)]">
        {filtersOpen ? <button aria-label="필터 닫기" className="fixed inset-0 z-30 bg-neutral-900/30 md:hidden" onClick={() => setFiltersOpen(false)} type="button" /> : null}
        <aside aria-label="ETF 필터" className={`${filtersOpen ? "fixed inset-x-0 bottom-0 z-40 max-h-[82vh] overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl" : "hidden"} md:static md:block md:max-h-none md:rounded-2xl md:border md:border-line md:bg-neutral-50 md:p-5 md:shadow-none`}>


          <fieldset className="border-b border-line pb-3">
            <legend className="flex items-center justify-between w-full mb-1.5">
              <span className="text-[15px] font-extrabold text-strong">계좌 편입</span>
              <button className="flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2 py-1 text-[11px] font-bold text-brand-700 shadow-sm transition-colors hover:bg-brand-100 hover:text-brand-900" onClick={() => updateFilters(DEFAULT_SCREENER_FILTERS)} type="button">
                <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                초기화
              </button>
            </legend>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl bg-brand-50 px-3 py-2 text-xs font-bold text-brand-800">
              <span>DC·IRP 가능만</span>
              <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${filters.pensionOnly ? "bg-brand-600" : "bg-neutral-300"}`}>
                <input aria-label="DC·IRP 가능만" checked={filters.pensionOnly} className="peer sr-only" onChange={(event) => updateFilters({ ...filters, pensionOnly: event.target.checked })} type="checkbox" role="switch" />
                <span className={`inline-block size-4 transform rounded-full bg-white transition-transform ${filters.pensionOnly ? "translate-x-4" : "translate-x-1"}`} />
              </div>
            </label>
          </fieldset>
          <fieldset className="border-b border-line py-3"><legend className="text-[15px] font-extrabold text-strong block w-full mb-1.5">자산군</legend><FilterChips options={ASSET_CLASSES} selected={filters.assetClasses} onChange={(v) => updateFilters({ ...filters, assetClasses: v })} /></fieldset>
          <fieldset className="border-b border-line py-3"><legend className="text-[15px] font-extrabold text-strong block w-full mb-1.5">지역</legend><FilterChips options={MARKET_SCOPES} selected={filters.marketScopes} onChange={(v) => updateFilters({ ...filters, marketScopes: v })} /></fieldset>
          <fieldset className="border-b border-line py-3">
            <legend className="text-[15px] font-extrabold text-strong block w-full mb-1.5">순자산 구간</legend>
            <div className="flex flex-wrap gap-1">
              {AUM_SCOPES.map((value) => {
                const isChecked = filters.aumScope === value;
                return (
                  <label key={value} className={`cursor-pointer rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${isChecked ? "border-brand-700 bg-brand-700 text-white shadow-sm" : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"}`}>
                    <input checked={isChecked} className="sr-only" onChange={() => updateFilters({ ...filters, aumScope: value })} type="radio" name="aumScope" />
                    {aumLabels[value]}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="border-b border-line py-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[15px] font-extrabold text-strong">비교 수익률 추가</span>
              {(comparisonPeriod || customDateRange) && (
                <button type="button" onClick={() => { handleComparisonPeriodChange(null); handleClearCustomDateRange(); }} className="text-[11px] font-bold text-muted hover:text-brand-700">초기화</button>
              )}
            </div>
            
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-1">
                {(GENERAL_RETURN_PERIODS.filter(p => p !== "1d") as readonly ReturnPeriod[]).map((period) => (
                  <label key={period} className={`cursor-pointer rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors ${comparisonPeriod === period && !customDateRange ? "border-brand-700 bg-brand-700 text-white shadow-sm" : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"}`}>
                    <input type="radio" name="comparisonPeriod" className="sr-only" checked={comparisonPeriod === period && !customDateRange} onChange={() => handleComparisonPeriodChange(period)} />
                    {RETURN_PERIOD_LABELS[period]}
                  </label>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <style dangerouslySetInnerHTML={{ __html: `
                  .micro-date::-webkit-inner-spin-button, 
                  .micro-date::-webkit-clear-button { 
                    display: none; 
                    -webkit-appearance: none; 
                  }
                  .micro-date::-webkit-calendar-picker-indicator { 
                    margin-left: 2px;
                    cursor: pointer;
                    opacity: 0.6;
                  }
                `}} />

                <div className="flex flex-1 flex-col gap-1 min-w-0">
                  <div className="flex items-center justify-between rounded border border-line bg-neutral-50 px-1.5 py-0.5">
                    <span className="shrink-0 text-[9px] font-bold text-muted mr-1">시작</span>
                    <input
                      type="date"
                      value={customStart || defaultStartDate}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="micro-date w-full bg-transparent text-right text-[10px] tracking-tighter font-bold text-strong focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between rounded border border-line bg-neutral-50 px-1.5 py-0.5">
                    <span className="shrink-0 text-[9px] font-bold text-muted mr-1">종료</span>
                    <input
                      type="date"
                      value={customEnd || defaultEndDate}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="micro-date w-full bg-transparent text-right text-[10px] tracking-tighter font-bold text-strong focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleApplyCustomDateRange}
                  className="shrink-0 rounded bg-neutral-800 px-2.5 py-2 text-[10px] font-bold text-white transition-colors hover:bg-black"
                >
                  적용
                </button>
              </div>
            </div>
          </div>
          <fieldset className="border-b border-line py-3">
            <legend className="text-[15px] font-extrabold text-strong block w-full mb-1.5">상품 구조</legend>
            <div><FilterChips options={RISK_TYPES} selected={filters.riskTypes} labels={riskLabels} onChange={(v) => updateFilters({ ...filters, riskTypes: v })} /></div>
          </fieldset>
          <fieldset className="border-b border-line py-3"><legend className="text-[15px] font-extrabold text-strong block w-full mb-1.5">운용 전략</legend><div><FilterChips options={STRATEGIES} selected={filters.strategies} onChange={(v) => updateFilters({ ...filters, strategies: v })} /></div></fieldset>
          <fieldset className="border-b border-line py-3"><legend className="text-[15px] font-extrabold text-strong block w-full mb-1.5">환헤지</legend><div><FilterChips options={FX_HEDGES} selected={filters.fxHedges} onChange={(v) => updateFilters({ ...filters, fxHedges: v })} /></div></fieldset>
          <fieldset className="border-b border-line py-3"><legend className="text-[15px] font-extrabold text-strong block w-full mb-1.5">총보수</legend><div><FilterChips className="!flex-nowrap *:flex-1 *:text-center *:whitespace-nowrap *:px-1" options={TER_RANGES} selected={filters.terRanges} labels={terLabels} onChange={(v) => updateFilters({ ...filters, terRanges: v })} /></div></fieldset>
          <fieldset className="py-3">
            <legend className="text-[15px] font-extrabold text-strong block w-full mb-1.5">운용사</legend>
            <IssuerMultiSelect
              allIssuers={allIssuers}
              selectedIds={[...filters.issuerIds]}
              onChange={(ids) => updateFilters({ ...filters, issuerIds: ids })}
            />
          </fieldset>
          

          <button className="sticky bottom-0 w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white md:hidden" onClick={() => setFiltersOpen(false)} type="button">{results.length.toLocaleString("ko-KR")}종목 보기</button>
        </aside>

        <section aria-labelledby="results-title" className="min-w-0">
          <ReturnRankingChart 
            etfs={results} 
            selectedPeriod={selectedPeriod}
            onPeriodChange={(period) => {
              if (period !== "custom") handlePeriodChange(period);
            }}
            activeFilterLabels={activeFilters.map(f => f.label)}
            comparisonPeriod={comparisonPeriod}
            onComparisonPeriodChange={handleComparisonPeriodChange}
            customDateRange={customDateRange}
            customReturnsData={customReturnsData}
          />
          
          <div className="mt-8 mb-4 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2" aria-label="선택된 ETF 조건">
              {activeFilters.map(f => (
                <button key={f.label} onClick={f.remove} aria-label={`${f.label} 조건 제거`} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-strong hover:bg-neutral-50">
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
                <div className="flex items-center rounded-lg border border-line bg-white shadow-sm overflow-hidden focus-within:ring-1 focus-within:ring-brand-500 focus-within:border-brand-500">
                  <select
                    id="results-sort"
                    value={sort}
                    onChange={(e) => handleSortChange(e.target.value as ScreenerSortKey)}
                    className="appearance-none bg-transparent py-2 pl-3 pr-8 text-sm font-bold text-strong focus:outline-none"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                  >
                    {(Object.keys(sortLabels) as ScreenerSortKey[]).filter(key => key !== "return_custom" || comparisonPeriod !== null).map((key) => (
                      <option key={key} value={key}>{sortLabels[key]}</option>
                    ))}
                  </select>
                  <div className="w-px h-5 bg-line mx-1"></div>
                  <button
                    type="button"
                    onClick={() => updateStateAndUrl(filters, selectedPeriod, sort, sortDir === "desc" ? "asc" : "desc")}
                    className="flex h-full min-w-10 items-center justify-center bg-transparent px-2 text-muted hover:bg-neutral-50 hover:text-strong focus:outline-none"
                    aria-label={sortDir === "desc" ? "내림차순 (높은순) 정렬 중. 클릭하여 오름차순으로 변경" : "오름차순 (낮은순) 정렬 중. 클릭하여 내림차순으로 변경"}
                    title={sortDir === "desc" ? "높은순 정렬" : "낮은순 정렬"}
                  >
                    {sortDir === "desc" ? (
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    ) : (
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-2 mb-4">
            <p className="text-xs font-semibold text-muted">수익률: {RETURN_PERIOD_LABELS[selectedPeriod]} 기준 · 분배금 미포함</p>
            {etfs[0] ? <AsOfDate value={etfs[0].asOfDate} /> : null}
          </div>
          
          <div className="overflow-hidden rounded-2xl border border-line">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <colgroup>
                  <col style={{ width: 56 }} />
                  <col style={{ width: 168 }} />
                  <col style={{ width: 40 }} />
                  <col style={{ width: 36 }} />
                  <col style={{ width: 40 }} />
                  <col style={{ width: 36 }} />
                  <col style={{ width: 54 }} />
                  <col style={{ width: 54 }} />
                  <col style={{ width: 54 }} />
                  <col style={{ width: 54 }} />
                  {(comparisonPeriod || customDateRange) && <col style={{ width: 54 }} />}
                  <col style={{ width: 40 }} />
                  <col style={{ width: 48 }} />
                  <col style={{ width: 52 }} />
                  <col style={{ width: 48 }} />
                </colgroup>
                <thead className="bg-neutral-100 text-[13px] font-bold text-neutral-700 border-b-2 border-neutral-300">
                  <tr className="border-b border-neutral-200">
                    <th className="px-2 py-0 h-[32px] text-center" colSpan={6} scope="colgroup">상품 정보</th>
                    <th className="px-2 py-0 h-[32px] text-center border-l border-neutral-200" colSpan={(comparisonPeriod || customDateRange) ? 5 : 4} scope="colgroup">수익률(%)</th>
                    <th className="px-2 py-0 h-[32px] text-center border-l border-neutral-200" colSpan={4} scope="colgroup">비용·규모·가격</th>
                  </tr>
                  <tr className="text-[12px]">
                    <th className="px-0.5 py-0 h-[48px] text-center" scope="col">종목코드</th>
                    <th className="px-2 py-0 h-[48px] text-center shadow-[1px_0_0_0_#e5e5e5]" scope="col">종목명</th>
                    <th className="px-0.5 py-0 h-[48px] text-center" scope="col">자산</th>
                    <th className="px-0.5 py-0 h-[48px] text-center" scope="col">지역</th>
                    <th className="px-0.5 py-0 h-[48px] text-center tracking-tighter" scope="col">환헤지</th>
                    <th className="px-0.5 py-0 h-[48px] text-center" scope="col">연금</th>
                    
                    <th className={`px-0.5 py-0 h-[48px] text-center border-l border-neutral-200 ${sort === "return_1d" ? "bg-brand-100 text-brand-900" : ""}`} scope="col">
                      <span className="whitespace-nowrap text-[11px] tracking-tighter font-bold text-strong">1일</span>
                    </th>
                    <th className={`px-0.5 py-0 h-[48px] text-center ${sort === "return_1m" ? "bg-brand-100 text-brand-900" : ""}`} scope="col">
                      <span className="whitespace-nowrap text-[11px] tracking-tighter font-bold text-strong">1개월</span>
                    </th>
                    <th className={`px-0.5 py-0 h-[48px] text-center ${sort === "return_3m" ? "bg-brand-100 text-brand-900" : ""}`} scope="col">
                      <span className="whitespace-nowrap text-[11px] tracking-tighter font-bold text-strong">3개월</span>
                    </th>
                    <th className={`px-0.5 py-0 h-[48px] text-center ${sort === "return_12m" ? "bg-brand-100 text-brand-900" : ""}`} scope="col">
                      <span className="whitespace-nowrap text-[11px] tracking-tighter font-bold text-strong">1년</span>
                    </th>
                    {comparisonPeriod && (
                      <th className="px-0.5 py-0 h-[48px] text-center bg-brand-100" scope="col">
                        <span className="whitespace-nowrap text-[11px] tracking-tighter font-bold text-brand-900">{RETURN_PERIOD_LABELS[comparisonPeriod]}</span>
                      </th>
                    )}
                    {customDateRange && !comparisonPeriod && (
                      <th className="px-0.5 py-0 h-[48px] text-center bg-amber-50" scope="col">
                        <span className="block text-[9px] tracking-tighter font-bold text-amber-700">{customDateRange.start.slice(2).replace(/-/g, ".")}</span>
                        <span className="block text-[9px] tracking-tighter font-bold text-amber-700">~{customDateRange.end.slice(2).replace(/-/g, ".")}</span>
                      </th>
                    )}
                    

                    <th className="px-0.5 py-0 h-[48px] text-center border-l border-neutral-200" scope="col"><UnitHeaderLabel label="총보수" unit="%" /></th>
                    <th className="px-0.5 py-0 h-[48px] text-center" scope="col"><UnitHeaderLabel label="순자산" unit="억원" /></th>
                    <th className="px-0.5 py-0 h-[48px] text-center" scope="col"><UnitHeaderLabel label="거래대금" unit="억원" /></th>
                    <th className="px-0.5 py-0 h-[48px] text-center" scope="col"><UnitHeaderLabel label="종가" unit="원" /></th>
                  </tr>
                </thead>
                <tbody ref={tbodyRef} className="divide-y divide-line text-[12px]">
                  {rowVirtualizer.getVirtualItems().length > 0 && (
                    <tr style={{ height: `${Math.max(0, rowVirtualizer.getVirtualItems()[0].start - tableOffsetTop)}px` }}>
                      <td colSpan={14} className="p-0 border-0"></td>
                    </tr>
                  )}
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const etf = results[virtualRow.index];
                    return (
                    <tr className="bg-surface transition-colors hover:bg-neutral-100 even:bg-neutral-100/40" key={etf.ticker} data-index={virtualRow.index} ref={rowVirtualizer.measureElement}>
                      <td className="px-0.5 py-2 text-center text-[11px] font-bold text-muted tabular-nums">{etf.ticker}</td>
                      <th className="w-[168px] px-2 py-2 text-left shadow-[1px_0_0_0_#e5e5e5]" scope="row">
                        <Link className="line-clamp-2 break-all whitespace-normal text-left text-[13px] font-bold leading-[18px] text-strong hover:text-brand-700" href={`/etf/${etf.ticker}`} title={etf.name}>{etf.name}</Link>
                      </th>
                      <td className="px-0.5 py-2 text-center text-[11px] font-semibold text-muted">
                        {etf.assetClass}
                      </td>
                      <td className="px-0.5 py-2 text-center text-[11px] font-semibold text-muted">
                        {etf.classification?.marketScope}
                      </td>
                      <td className="px-0.5 py-2 text-center text-[11px] font-bold text-muted"><FxHedgeMarker value={etf.classification?.fxHedge || null} /></td>
                      <td className="px-0.5 py-2 text-center"><PensionBadge compact status={etf.pension} /></td>
                      
                      <td className={`px-1 py-2 text-right font-semibold tabular-nums border-l border-neutral-100 ${sort === "return_1d" ? "bg-brand-50" : ""}`}>
                        <ReturnCell showUnit={false} value={etf.returns["1d"]} />
                      </td>
                      <td className={`px-1 py-2 text-right font-semibold tabular-nums ${sort === "return_1m" ? "bg-brand-50" : ""}`}>
                        <ReturnCell showUnit={false} value={etf.returns["1m"]} />
                      </td>
                      <td className={`px-1 py-2 text-right font-semibold tabular-nums ${sort === "return_3m" ? "bg-brand-50" : ""}`}>
                        <ReturnCell showUnit={false} value={etf.returns["3m"]} />
                      </td>
                      <td className={`px-1 py-2 text-right font-semibold tabular-nums ${sort === "return_12m" ? "bg-brand-50" : ""}`}>
                        <ReturnCell showUnit={false} value={etf.returns["12m"]} />
                      </td>
                      {comparisonPeriod && (
                        <td className="px-1 py-2 text-right font-semibold tabular-nums bg-brand-50">
                          <ReturnCell showUnit={false} value={etf.returns[comparisonPeriod]} />
                        </td>
                      )}
                      {customDateRange && !comparisonPeriod && (
                        <td className="px-3 py-3 font-semibold text-right border-l-2 border-line bg-amber-50/30">
                          {isCustomReturnsLoading ? (
                            <span className="text-muted text-xs">...</span>
                          ) : customReturnsData?.returns?.[etf.ticker] !== undefined && customReturnsData?.returns?.[etf.ticker] !== null ? (
                            <ReturnCell showUnit={false} value={customReturnsData.returns[etf.ticker]} />
                          ) : (
                            <span className="text-neutral-400 text-xs font-semibold">-</span>
                          )}
                        </td>
                      )}
                      
                      <td className="px-1 py-1 text-right font-semibold tabular-nums text-muted border-l border-neutral-100">{(etf.fee?.verificationStatus === "verified_official" || etf.fee?.verificationStatus === "official_single_source") && etf.fee.totalFeePct !== null ? etf.fee.totalFeePct.toFixed(2) : "-"}</td>
                      <td className="px-1 py-2 text-right font-semibold tabular-nums">{formatAumNumber(etf.aum)}</td>
                      <td className="px-1 py-2 text-right font-semibold tabular-nums">{formatTradeValueNumber(etf.tradeValue)}</td>
                      <td className="px-1 py-2 text-right font-semibold tabular-nums">{formatWonNumber(etf.close)}</td>
                    </tr>
                    );
                  })}
                  {rowVirtualizer.getVirtualItems().length > 0 && (
                    <tr style={{ height: `${rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end}px` }}>
                      <td colSpan={14} className="p-0 border-0"></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
