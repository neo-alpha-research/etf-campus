"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/hooks/fetcher";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

import { AsOfDate, ReturnCell, FeeDoubleStack } from "@/components/etf";
import { ReturnRankingChart } from "./return-ranking-chart";
import { IssuerMultiSelect } from "./issuer-multi-select";
import { formatAumNumber, formatWonNumber, formatTradeValueNumber } from "@/lib/domain/etf-format";
import { TER_RANGES, DEFAULT_SCREENER_FILTERS, filterEtfs, type ScreenerEtf, parseScreenerQuery, serializeScreenerQuery, type TerRange, type ScreenerFilters } from "@/lib/domain/etf-screener";
import { AUM_SCOPES, GENERAL_RETURN_PERIODS, type AumScope } from "@/lib/domain/etf-explorer";
import { ASSET_CLASSES, RISK_TYPES, MARKET_SCOPES, STRATEGIES, FX_HEDGES, RETURN_PERIOD_LABELS, type RiskType, type ReturnPeriod } from "@/lib/domain/etf-types";

const riskLabels: Record<RiskType, string> = { normal: "일반형", leverage: "레버리지", inverse: "인버스", parking: "파킹형" };
const aumLabels: Record<AumScope, string> = { all: "전체", "500plus": "500억 이상", "1000plus": "1,000억 이상" };
const terLabels: Record<TerRange, string> = { "under0.1": "0.1% 미만", "0.1to0.5": "0.1~0.5%", "over0.5": "0.5% 이상" };

function UnitHeaderLabel({ label, unit, align = "center" }: { label: string; unit: string; align?: "center" | "right" }) {
  return (
    <div className={`flex flex-col ${align === "right" ? "items-end justify-center text-right pr-0.5" : "items-center justify-center text-center"} leading-[1.2]`}>
      <span className="text-[11px] font-bold text-strong">{label}</span>
      <span className="text-[10px] font-bold text-neutral-500">({unit})</span>
    </div>
  );
}

type ScreenerSortKey = "return_1d" | "return_1m" | "return_3m" | "return_12m" | "return_36m" | "return_custom" | "aum" | "tradeValue" | "ter";
const sortLabels: Record<ScreenerSortKey, string> = {
  return_1d: "1일 수익률",
  return_1m: "1개월 수익률",
  return_3m: "3개월 수익률",
  return_12m: "1년 수익률",
  return_36m: "3년 수익률",
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
      <label className={`cursor-pointer rounded-lg border px-2.5 py-1.5 sm:px-2 sm:py-1 text-xs sm:text-[11px] font-semibold transition-colors ${isAll ? "border-brand-700 bg-brand-700 text-white shadow-sm" : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"}`}>
        <input type="checkbox" checked={isAll} className="sr-only" onChange={() => onChange([])} />
        전체
      </label>
      {options.map((value) => {
        const isChecked = selected.includes(value);
        return (
          <label key={value} className={`cursor-pointer rounded-lg border px-2.5 py-1.5 sm:px-2 sm:py-1 text-xs sm:text-[11px] font-semibold transition-colors ${isChecked ? "border-brand-700 bg-brand-700 text-white shadow-sm" : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"}`}>
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

export function Screener({ etfs: initialEtfs }: { etfs?: ScreenerEtf[] }) {
  const { data: fetchedEtfs } = useSWR<ScreenerEtf[]>('/data/screener.json', fetcher);
  const etfs = useMemo(() => {
    return (initialEtfs && initialEtfs.length > 0) ? initialEtfs : (fetchedEtfs || []);
  }, [initialEtfs, fetchedEtfs]);
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
  const [isTrMode, setIsTrMode] = useState(false);
  const [showMobileTrTooltip, setShowMobileTrTooltip] = useState(false);

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
    const rt = params.get("returnType") || params.get("return_type");
    if (rt === "tr") setIsTrMode(true);
    else if (rt === "pr") setIsTrMode(false);
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
    if (isTrMode) query.set("returnType", "tr");
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
  const toggleColumnSort = (targetKey: ScreenerSortKey) => {
    if (sort === targetKey) {
      updateStateAndUrl(filters, selectedPeriod, targetKey, sortDir === "desc" ? "asc" : "desc");
    } else {
      const nextDir: "desc" | "asc" = targetKey === "ter" ? "asc" : "desc";
      updateStateAndUrl(filters, selectedPeriod, targetKey, nextDir);
    }
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
      if (sort === "return_1d" || sort === "return_1m" || sort === "return_3m" || sort === "return_12m" || sort === "return_36m" || sort === "return_custom") {
        const periodKey = (sort === "return_custom" ? (comparisonPeriod ?? "1d") : sort.replace("return_", "")) as ReturnPeriod;
        
        let aVal = -Infinity;
        let bVal = -Infinity;
        const aTr = a.returnsTr || a.returnsNetTr;
        const bTr = b.returnsTr || b.returnsNetTr;

        if (isTrMode) {
          aVal = (aTr && aTr[periodKey] !== undefined && aTr[periodKey] !== null) ? aTr[periodKey]! : -Infinity;
          bVal = (bTr && bTr[periodKey] !== undefined && bTr[periodKey] !== null) ? bTr[periodKey]! : -Infinity;
        } else {
          aVal = a.returns[periodKey] ?? -Infinity;
          bVal = b.returns[periodKey] ?? -Infinity;
        }
        
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
  }, [etfs, filters, sort, sortDir, comparisonPeriod, customDateRange, customReturnsData, isTrMode]);
  
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

  const isPensionActive = filters.accountMode === "pension" && filters.pensionOnly;
  const isPersonalPensionActive = filters.accountMode === "personal_pension";
  const isIsaActive = filters.accountMode === "isa";
  const activeCount = Number(isPensionActive || isPersonalPensionActive || isIsaActive) + (filters.pensionTier !== "all" ? 1 : 0) + (filters.personalTier && filters.personalTier !== "all" ? 1 : 0) + filters.marketScopes.length + filters.assetClasses.length + filters.riskTypes.length + filters.strategies.length + filters.fxHedges.length + (filters.aumScope !== "all" ? 1 : 0) + filters.terRanges.length + filters.issuerIds.length;

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

  const isUsStockQuickActive = filters.assetClasses.length === 1 && filters.assetClasses.includes("주식-해외") && filters.marketScopes.length === 1 && filters.marketScopes.includes("미국") && filters.keyword === "" && filters.strategies.length === 0;
  const toggleUsStockQuick = () => {
    if (isUsStockQuickActive) {
      updateFilters({ ...filters, assetClasses: [], marketScopes: [] });
    } else {
      updateFilters({ ...filters, assetClasses: ["주식-해외"], marketScopes: ["미국"], keyword: "", strategies: [] });
    }
  };

  const isKrStockQuickActive = filters.assetClasses.length === 1 && filters.assetClasses.includes("주식-국내") && filters.marketScopes.length === 1 && filters.marketScopes.includes("국내") && filters.keyword === "" && filters.strategies.length === 0;
  const toggleKrStockQuick = () => {
    if (isKrStockQuickActive) {
      updateFilters({ ...filters, assetClasses: [], marketScopes: [] });
    } else {
      updateFilters({ ...filters, assetClasses: ["주식-국내"], marketScopes: ["국내"], keyword: "", strategies: [] });
    }
  };

  const isDivGrowthQuickActive = filters.keyword === "배당" && filters.assetClasses.length === 0 && filters.marketScopes.length === 0 && filters.strategies.length === 0;
  const toggleDivGrowthQuick = () => {
    if (isDivGrowthQuickActive) {
      updateFilters({ ...filters, keyword: "" });
    } else {
      updateFilters({ ...filters, assetClasses: [], marketScopes: [], strategies: [], keyword: "배당" });
    }
  };

  const isSemiconductorQuickActive = filters.keyword === "반도체" && filters.assetClasses.length === 0 && filters.marketScopes.length === 0 && filters.strategies.length === 0;
  const toggleSemiconductorQuick = () => {
    if (isSemiconductorQuickActive) {
      updateFilters({ ...filters, keyword: "" });
    } else {
      updateFilters({ ...filters, assetClasses: [], marketScopes: [], strategies: [], keyword: "반도체" });
    }
  };

  const isAiQuickActive = filters.keyword === "ai" && filters.assetClasses.length === 0 && filters.marketScopes.length === 0 && filters.strategies.length === 0;
  const toggleAiQuick = () => {
    if (isAiQuickActive) {
      updateFilters({ ...filters, keyword: "" });
    } else {
      updateFilters({ ...filters, assetClasses: [], marketScopes: [], strategies: [], keyword: "ai" });
    }
  };

  const isBondParkingQuickActive = filters.assetClasses.length === 2 && filters.assetClasses.includes("채권") && filters.assetClasses.includes("금리·파킹") && filters.marketScopes.length === 0 && filters.keyword === "" && filters.strategies.length === 0;
  const toggleBondParkingQuick = () => {
    if (isBondParkingQuickActive) {
      updateFilters({ ...filters, assetClasses: [] });
    } else {
      updateFilters({ ...filters, assetClasses: ["채권", "금리·파킹"], marketScopes: [], strategies: [], keyword: "" });
    }
  };

  const isCoveredCallQuickActive = filters.strategies.length === 1 && filters.strategies.includes("커버드콜") && filters.assetClasses.length === 0 && filters.marketScopes.length === 0 && filters.keyword === "";
  const toggleCoveredCallQuick = () => {
    if (isCoveredCallQuickActive) {
      updateFilters({ ...filters, strategies: [] });
    } else {
      updateFilters({ ...filters, assetClasses: [], marketScopes: [], strategies: ["커버드콜"], keyword: "" });
    }
  };

  const isGoldCommodityQuickActive = filters.assetClasses.length === 1 && filters.assetClasses.includes("원자재") && filters.marketScopes.length === 0 && filters.keyword === "" && filters.strategies.length === 0;
  const toggleGoldCommodityQuick = () => {
    if (isGoldCommodityQuickActive) {
      updateFilters({ ...filters, assetClasses: [] });
    } else {
      updateFilters({ ...filters, assetClasses: ["원자재"], marketScopes: [], strategies: [], keyword: "" });
    }
  };

  const isPowerNuclearQuickActive = filters.keyword === "전력" && filters.assetClasses.length === 0 && filters.marketScopes.length === 0 && filters.strategies.length === 0;
  const togglePowerNuclearQuick = () => {
    if (isPowerNuclearQuickActive) {
      updateFilters({ ...filters, keyword: "" });
    } else {
      updateFilters({ ...filters, assetClasses: [], marketScopes: [], strategies: [], keyword: "전력" });
    }
  };

  const isMonthlyDivQuickActive = filters.distributionCycles.length === 1 && filters.distributionCycles.includes("월 분배") && filters.assetClasses.length === 0 && filters.marketScopes.length === 0 && filters.strategies.length === 0 && filters.keyword === "";
  const toggleMonthlyDivQuick = () => {
    if (isMonthlyDivQuickActive) {
      updateFilters({ ...filters, distributionCycles: [] });
    } else {
      updateFilters({ ...filters, assetClasses: [], marketScopes: [], strategies: [], distributionCycles: ["월 분배"], keyword: "" });
    }
  };

  const quickFilterItems: {
    id: string;
    icon: React.ReactNode;
    label: string;
    active: boolean;
    toggle: () => void;
  }[] = [
    { id: "us-stock", icon: <img src="https://flagcdn.com/w40/us.png" alt="미국" width={18} height={13} className="w-[18px] h-[13px] rounded-xs object-cover shadow-2xs shrink-0 inline-block" />, label: "미국 주식", active: isUsStockQuickActive, toggle: toggleUsStockQuick },
    { id: "kr-stock", icon: <img src="https://flagcdn.com/w40/kr.png" alt="한국" width={18} height={13} className="w-[18px] h-[13px] rounded-xs object-cover shadow-2xs shrink-0 inline-block" />, label: "국내 주식", active: isKrStockQuickActive, toggle: toggleKrStockQuick },
    { id: "div-growth", icon: "💰", label: "배당성장", active: isDivGrowthQuickActive, toggle: toggleDivGrowthQuick },
    { id: "monthly-div", icon: "🗓️", label: "월배당", active: isMonthlyDivQuickActive, toggle: toggleMonthlyDivQuick },
    { id: "semi", icon: "⚡", label: "반도체", active: isSemiconductorQuickActive, toggle: toggleSemiconductorQuick },
    { id: "ai", icon: "🤖", label: "AI·빅테크", active: isAiQuickActive, toggle: toggleAiQuick },
    { id: "bond-parking", icon: "🛡️", label: "채권·파킹", active: isBondParkingQuickActive, toggle: toggleBondParkingQuick },
    { id: "covered-call", icon: "📈", label: "커버드콜", active: isCoveredCallQuickActive, toggle: toggleCoveredCallQuick },
    { id: "gold-commodity", icon: "🪙", label: "금·원자재", active: isGoldCommodityQuickActive, toggle: toggleGoldCommodityQuick },
    { id: "power-nuclear", icon: "⚛️", label: "전력·원자력", active: isPowerNuclearQuickActive, toggle: togglePowerNuclearQuick },
  ];

  const activeQuickItem = quickFilterItems.find((item) => item.active);

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
  if (filters.accountMode === "pension" && filters.pensionOnly) {
    if (filters.pensionTier === "safe") {
      activeFilters.push({ label: "안전자산 100% 한도", remove: () => updateFilters({ ...filters, pensionTier: "all" }) });
    } else if (filters.pensionTier === "risk") {
      activeFilters.push({ label: "위험자산 70% 한도", remove: () => updateFilters({ ...filters, pensionTier: "all" }) });
    } else {
      activeFilters.push({ label: "DC·IRP 가능", remove: () => updateFilters({ ...filters, pensionOnly: false, accountMode: "all" }) });
    }
  } else if (filters.accountMode === "personal_pension") {
    if (filters.personalTier === "personal_only") {
      activeFilters.push({ label: "개인연금 전용 (퇴직연금 불가)", remove: () => updateFilters({ ...filters, personalTier: "all" }) });
    } else {
      activeFilters.push({ label: "연금저축 가능", remove: () => updateFilters({ ...filters, accountMode: "all" }) });
    }
  } else if (filters.accountMode === "isa") {
    activeFilters.push({ label: "중개형 ISA (절세 혜택형)", remove: () => updateFilters({ ...filters, accountMode: "all", isaTier: "all" }) });
  } else if (filters.accountMode === "all") {
    if (filters.generalTier === "tax_free") {
      activeFilters.push({ label: "매매차익 비과세(국내주식)", remove: () => updateFilters({ ...filters, generalTier: "all" }) });
    } else if (filters.generalTier === "taxable") {
      activeFilters.push({ label: "매매차익 과세(해외·채권 등)", remove: () => updateFilters({ ...filters, generalTier: "all" }) });
    }
  } else if (filters.pensionOnly) {
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
  filters.distributionCycles.forEach(v => {
    activeFilters.push({ label: v === "월 분배" ? "월배당" : v, remove: () => updateFilters({ ...filters, distributionCycles: filters.distributionCycles.filter(i => i !== v) }) });
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

  const pensionCounts = useMemo(() => {
    let all = 0;
    let safe = 0;
    let risk = 0;
    for (const e of etfs) {
      if (e.pension === "가능") {
        all++;
        if (e.pensionLimit === "100% (안전자산)") safe++;
        else if (e.pensionLimit === "70% (위험자산)") risk++;
      }
    }
    return { all, safe, risk };
  }, [etfs]);

  const isaCounts = useMemo(() => {
    let all = 0;
    let high = 0;
    let normal = 0;
    for (const e of etfs) {
      if (e.isaEligible === "가능") {
        all++;
        if (e.isaTaxBenefit === "높음") high++;
        else normal++;
      }
    }
    return { all, high, normal };
  }, [etfs]);

  const personalCounts = useMemo(() => {
    let eligible = 0;
    let personalOnly = 0;
    let ineligible = 0;
    for (const e of etfs) {
      if (e.personalPension === "가능") {
        eligible++;
        if (e.pension === "불가" || e.pensionLimit === "불가") personalOnly++;
      } else if (e.personalPension === "불가") {
        ineligible++;
      }
    }
    return {
      eligible,
      personalOnly,
      ineligible,
      covered: eligible + ineligible,
      total: etfs.length,
    };
  }, [etfs]);

  return (
    <div className="page-shell flex flex-col flex-1 pt-1 pb-4 sm:pt-2 sm:pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="shrink-0 mb-1 sm:mb-0">
          <p className="eyebrow text-xs">ETF Screener</p>
          <h1 className="mt-0.5 text-xl font-extrabold tracking-[-0.04em] text-strong sm:text-2xl">내 기준으로 ETF 찾기</h1>
          <p className="mt-0.5 text-xs leading-normal text-muted">선택한 조건은 URL에 저장되어 같은 결과를 다시 열거나 공유할 수 있습니다.</p>
        </div>

        <div className="flex-1 w-full lg:w-auto lg:min-w-[500px] flex flex-col justify-center lg:items-end mt-1.5 lg:mt-0">
          <div className="flex flex-col items-start lg:items-end w-full max-w-[460px] lg:max-w-[420px]">
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

        <button className="rounded-xl bg-brand-700 px-3 py-2 text-xs font-bold text-white md:hidden shrink-0 self-end" onClick={() => setFiltersOpen(true)} type="button">필터 {activeCount ? `${activeCount}개` : ""}</button>
      </div>

      {/* 🛡️ 대안 A: 1단 계좌 선택 & 2단 법정 한도 구분 섹션 */}
      <section aria-label="계좌 유형 및 법정 한도 선택" className="mt-2.5 rounded-xl border border-neutral-200/90 bg-white p-3 sm:p-3.5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-strong flex items-center gap-1.5">
              <span>계좌 유형</span>
              <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-800">절세·연금</span>
            </span>
            <p className="text-xs text-neutral-500 hidden sm:inline">
              {filters.accountMode === "isa"
                ? "중개형 ISA: 15.4% 배당소득세 절세 실익이 큰 813개 종목만 선별하여 나열했습니다 (전 종목은 '전체계좌' 탭)"
                : "투자하려는 계좌를 선택하면 해당 계좌의 세제 혜택과 법정 편입 한도가 적용됩니다"}
            </p>
          </div>

          {/* 1단: 4대 계좌 모드 탭 (순서: 전체계좌 -> 퇴직연금 -> 연금저축 -> 중개형 ISA) */}
          <div className="flex items-center gap-1 rounded-xl bg-neutral-100 p-1" aria-label="계좌 유형 선택">
            <button
              type="button"
              onClick={() => updateFilters({ ...filters, accountMode: "all", pensionOnly: false, generalTier: "all", pensionTier: "all", personalTier: "all", isaTier: "all" })}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                filters.accountMode === "all" && !filters.pensionOnly
                  ? "bg-white text-brand-900 shadow-xs border border-brand-200/60"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              <span>🌐 전체계좌</span>
              <span className="text-[10px] font-semibold text-neutral-700 bg-neutral-200/70 px-1.5 py-0.5 rounded">일반 위탁</span>
            </button>
            <button
              type="button"
              onClick={() => updateFilters({ ...filters, accountMode: "pension", pensionOnly: true, personalTier: "all", isaTier: "all" })}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                filters.accountMode === "pension" && filters.pensionOnly
                  ? "bg-white text-brand-900 shadow-xs border border-brand-200/60"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              <span>🛡️ 퇴직연금</span>
              <span className="text-[10px] font-semibold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded">DC·IRP</span>
            </button>
            <button
              type="button"
              onClick={() => updateFilters({ ...filters, accountMode: "personal_pension", pensionOnly: false, pensionTier: "all", personalTier: "all", isaTier: "all" })}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                filters.accountMode === "personal_pension"
                  ? "bg-white text-brand-900 shadow-xs border border-brand-200/60"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              <span>🌱 연금저축</span>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">개인연금</span>
            </button>
            <button
              type="button"
              onClick={() => updateFilters({ ...filters, accountMode: "isa", pensionOnly: false, pensionTier: "all", personalTier: "all", isaTier: "high_benefit" })}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                filters.accountMode === "isa"
                  ? "bg-white text-brand-900 shadow-xs border border-brand-200/60"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              <span>✨ 중개형 ISA</span>
              <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">절세</span>
            </button>
          </div>
        </div>

        {/* 2단: 계좌별 슬림·고밀도 컴팩트 가이드 바 (4대 계좌 100% 완전 대칭) */}
        {filters.accountMode === "pension" ? (
          <div className="mt-2 rounded-xl border border-brand-200/80 bg-brand-50/60 p-2.5 sm:p-3 text-brand-950">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-brand-950">퇴직연금 법정 편입 한도</span>
                <span className="rounded bg-brand-200/70 px-1.5 py-0.5 text-[10px] font-bold text-brand-900" title="근로자퇴직급여보장법 제21조 및 퇴직연금감독규정 제12조">
                  근로자퇴직급여보장법 제21조
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="퇴직연금 법정 한도 선택">
                <button
                  type="button"
                  onClick={() => updateFilters({ ...filters, pensionTier: "all" })}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition-all ${
                    filters.pensionTier === "all"
                      ? "border-neutral-900 bg-neutral-900 text-white shadow-xs"
                      : "border-brand-200 bg-white text-neutral-700 hover:bg-brand-100/50"
                  }`}
                >
                  <span>전체 적격 ({pensionCounts.all.toLocaleString()}개)</span>
                </button>
                <button
                  type="button"
                  onClick={() => updateFilters({ ...filters, pensionTier: "safe" })}
                  title="퇴직연금 100% 한도 법정 안전자산: 채권·금리파킹·적격TDF·혼합50 등"
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition-all ${
                    filters.pensionTier === "safe"
                      ? "border-emerald-700 bg-emerald-700 text-white shadow-xs"
                      : "border-brand-200 bg-white text-emerald-800 hover:bg-brand-100/50"
                  }`}
                >
                  <span className={`size-2 rounded-full shrink-0 ${filters.pensionTier === "safe" ? "bg-white" : "bg-emerald-500"}`} />
                  <span>안전자산 100% 한도 ({pensionCounts.safe.toLocaleString()}개)</span>
                </button>
                <button
                  type="button"
                  onClick={() => updateFilters({ ...filters, pensionTier: "risk" })}
                  title="퇴직연금 70% 한도 위험자산: 국내외 주식형·리츠 등"
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition-all ${
                    filters.pensionTier === "risk"
                      ? "border-brand-700 bg-brand-700 text-white shadow-xs"
                      : "border-brand-200 bg-white text-brand-800 hover:bg-brand-100/50"
                  }`}
                >
                  <span className={`size-2 rounded-full shrink-0 ${filters.pensionTier === "risk" ? "bg-white" : "bg-blue-500"}`} />
                  <span>위험자산 70% 한도 ({pensionCounts.risk.toLocaleString()}개)</span>
                </button>
              </div>
            </div>

            {/* 2열 슬림 카드 그리드 (70:30 Rule 가이드) */}
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs border-t border-brand-200/60 pt-2">
              <div className="rounded-lg bg-white/70 py-1.5 px-2.5 border border-brand-200/60">
                <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                  <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                  <span>안전자산 100% 한도 ({pensionCounts.safe.toLocaleString()}개)</span>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded">최소 30% 의무 편입</span>
                </div>
                <p className="mt-0.5 text-[11px] text-neutral-700 leading-snug">
                  계좌 평가금액의 <strong>100%까지</strong> 제한 없이 편입 가능한 법정 안전자산(채권·금리파킹·채권혼합)입니다.
                </p>
              </div>
              <div className="rounded-lg bg-white/70 py-1.5 px-2.5 border border-brand-200/60">
                <div className="flex items-center gap-1.5 font-bold text-brand-950">
                  <span className="size-2 rounded-full bg-blue-500 shrink-0" />
                  <span>위험자산 70% 한도 ({pensionCounts.risk.toLocaleString()}개)</span>
                  <span className="text-[10px] font-semibold text-brand-700 bg-brand-50 px-1 py-0.2 rounded">최대 70% 제한</span>
                </div>
                <p className="mt-0.5 text-[11px] text-neutral-700 leading-snug">
                  국내외 주식형·주식혼합 등은 계좌 내 <strong>최대 70%까지만</strong> 편입 가능하며 70% 초과 매수는 법정 제한됩니다.
                </p>
              </div>
            </div>

            <div className="mt-1.5 pt-1.5 border-t border-brand-200/40 text-[11px] text-brand-900/75">
              <span>💡 근로자퇴직급여보장법에 따라 레버리지·인버스 ETF 등 배율 상품(137개)은 편입 대상에서 제외됩니다.</span>
            </div>

            <div className="mt-2 pt-2 border-t border-brand-200/50 flex flex-wrap items-center justify-between gap-1.5 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-brand-950 flex items-center gap-1">
                  <span>안전자산 30% 채우기 추천:</span>
                </span>
                <Link
                  href="/quick?mode=mixed_bonds"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white border border-indigo-200 text-indigo-800 hover:bg-indigo-50 hover:border-indigo-400 transition-colors shadow-2xs"
                >
                  <span>🎯 채권혼합 (주식 최대 50% 편입)</span>
                  <span className="text-[10px] text-indigo-500">바로가기 →</span>
                </Link>
                <Link
                  href="/quick?mode=tdf"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50 hover:border-emerald-400 transition-colors shadow-2xs"
                >
                  <span>🎯 적격 TDF (은퇴 시점별 자동 리밸런싱)</span>
                  <span className="text-[10px] text-emerald-500">바로가기 →</span>
                </Link>
              </div>
              <span className="text-neutral-500 text-[10px] sm:text-[11px]">※ 주식형 100% 편입을 원하시면 &apos;연금저축&apos; 탭을 이용하세요.</span>
            </div>
          </div>
        ) : filters.accountMode === "personal_pension" ? (
          <div className="mt-2 rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-2.5 sm:p-3 text-emerald-950">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-emerald-950">연금저축(개인연금) 편입 가이드</span>
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800" title="소득세법 제59조의3 및 시행령 제40조의2">
                  소득세법 시행령 제40조의2
                </span>
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800" title="금융투자협회 연금저축 표준약관 제8조">
                  금투협 표준약관 제8조
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="연금저축 한도 및 전용 종목 선택">
                <button
                  type="button"
                  onClick={() => updateFilters({ ...filters, personalTier: "all" })}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition-all ${
                    filters.personalTier === "all" || filters.personalTier === "eligible"
                      ? "border-emerald-700 bg-emerald-700 text-white shadow-xs"
                      : "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-100/50"
                  }`}
                >
                  <span className={`size-2 rounded-full shrink-0 ${filters.personalTier === "all" || filters.personalTier === "eligible" ? "bg-white" : "bg-emerald-500"}`} />
                  <span>전체 적격 ({personalCounts.eligible.toLocaleString()}개)</span>
                </button>
                <button
                  type="button"
                  onClick={() => updateFilters({ ...filters, personalTier: "personal_only" })}
                  title="퇴직연금(DC/IRP)에는 편입 불가하지만 연금저축펀드에는 100% 편입 가능한 종목 (원자재 선물 등)"
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition-all ${
                    filters.personalTier === "personal_only"
                      ? "border-amber-600 bg-amber-600 text-white shadow-xs"
                      : "border-amber-200 bg-white text-amber-800 hover:bg-amber-50"
                  }`}
                >
                  <span className="text-amber-500 shrink-0 text-xs">✨</span>
                  <span>개인연금 전용 ({personalCounts.personalOnly.toLocaleString()}개)</span>
                </button>
              </div>
            </div>

            {/* 2열 슬림 카드 그리드 (연금저축 핵심 가이드) */}
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs border-t border-emerald-200/60 pt-2">
              <div className="rounded-lg bg-white/70 py-1.5 px-2.5 border border-emerald-200/60">
                <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                  <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                  <span>100% 한도 자율 편입 ({personalCounts.eligible.toLocaleString()}개)</span>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded">위험자산 한도 무제한</span>
                </div>
                <p className="mt-0.5 text-[11px] text-neutral-700 leading-snug">
                  퇴직연금의 70% 위험자산 규제가 없어, 국내외 주식형·혼합형 등 <strong>모든 1배수 ETF를 100% 전액 편입</strong>할 수 있습니다.
                </p>
              </div>
              <div className="rounded-lg bg-white/70 py-1.5 px-2.5 border border-emerald-200/60">
                <div className="flex items-center gap-1.5 font-bold text-amber-950">
                  <span className="text-amber-500 shrink-0 text-xs">✨</span>
                  <span>개인연금 전용 편입 ({personalCounts.personalOnly.toLocaleString()}개)</span>
                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1 py-0.2 rounded">퇴직연금 편입불가 포용</span>
                </div>
                <p className="mt-0.5 text-[11px] text-neutral-700 leading-snug">
                  퇴직연금(DC·IRP)에서 금지된 <strong>원자재·금선물·원유선물 등 파생결합 ETF</strong>를 연금저축에서는 <strong>100% 편입</strong>할 수 있습니다.
                </p>
              </div>
            </div>

            <div className="mt-1.5 pt-1.5 border-t border-emerald-200/50 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-emerald-900/75">
              <div className="flex flex-wrap items-center gap-2">
                <span>📊 연금저축 적격 ETF: {personalCounts.eligible.toLocaleString()}/{personalCounts.total.toLocaleString()}개 (표준약관 제8조 1배수 정방향)</span>
                <span className="text-emerald-300 hidden sm:inline">|</span>
                <span>🚫 법정 편입 제외: 레버리지·인버스 ETF 등 배율 상품({personalCounts.ineligible.toLocaleString()}개)</span>
              </div>
              <span className="text-neutral-500 text-[10px] sm:text-[11px]">※ 실제 연금저축 매매 가능 여부는 증권사마다 다릅니다.</span>
            </div>
          </div>
        ) : filters.accountMode === "isa" ? (
          <div className="mt-2 rounded-xl border border-amber-200/90 bg-amber-50/80 p-2.5 sm:p-3 text-amber-950">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-amber-950">중개형 ISA 절세 실익 안내</span>
                <span className="rounded bg-amber-200/70 px-1.5 py-0.5 text-[10px] font-bold text-amber-900" title="조세특례제한법 제91조의18 (개인종합자산관리계좌에 대한 과세특례: 비과세 한도 200만원/서민형 400만원, 초과분 9.9% 분리과세)">
                  조세특례제한법 제91조의18
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-700 px-2.5 py-1 text-xs font-bold text-white shadow-xs">
                  <span>절세 실익 종목만 나열 ({isaCounts.high.toLocaleString()}개 전수 선별)</span>
                </span>
              </div>
            </div>

            {/* 단일 슬림 카드 (절세 실익 극대화 안내) */}
            <div className="mt-2 rounded-lg bg-white/75 py-2 px-3 border border-amber-200/60 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-950">
                <span className="text-amber-500 shrink-0 text-xs">✨</span>
                <span>해외주식 · 채권 · 리츠 · 커버드콜 절세 실익 극대화</span>
                <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">15.4% 배당소득세 절세</span>
              </div>
              <p className="mt-1 text-[11.5px] text-amber-950/90 leading-snug">
                일반 계좌에서 15.4% 과세되는 매매차익 및 분배금이 중개형 ISA에서는 <strong>200만원(서민형 400만원)까지 비과세</strong>되며, 초과분도 <strong>9.9% 분리과세(금융소득종합과세 배제)</strong>됩니다.
              </p>
            </div>

            <div className="mt-1.5 pt-1.5 border-t border-amber-200/50 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-amber-950/85">
              <div className="flex flex-wrap items-center gap-2">
                <span>💡 중개형 ISA는 국내 상장 전 종목(1,167개) 편입이 가능하나, 일반 계좌에서도 매매차익이 비과세인 국내주식형을 제외하고 15.4% 배당소득세 절세 실익이 큰 {isaCounts.high.toLocaleString()}개 종목만 엄선하여 나열했습니다. (국내주식형 포함 전 종목은 &apos;전체계좌&apos; 탭 이용)</span>
                <Link
                  href="/quick?mode=covered_call"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors"
                >
                  <span>💰 월배당 커버드콜 절세 탐색 →</span>
                </Link>
              </div>
              <span className="text-neutral-500 text-[10px] sm:text-[11px]">※ 의무가입기간 3년, 연간 납입한도 2,000만원 (총 1억원)</span>
            </div>
          </div>
        ) : (
          <div className="mt-2 rounded-xl border border-slate-200/90 bg-slate-50/70 p-2.5 sm:p-3 text-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-950">일반 위탁 계좌 거래 가이드</span>
                <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-800" title="소득세법 제16조(배당소득) 및 제17조: 국내주식형 매매차익 비과세, 해외/채권/기타 ETF 15.4% 배당소득세 과세">
                  소득세법 제16조·제17조
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="일반 위탁 계좌 과세 구분 선택">
                <button
                  type="button"
                  onClick={() => updateFilters({ ...filters, generalTier: "all" })}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition-all ${
                    filters.generalTier === "all" || !filters.generalTier
                      ? "border-neutral-900 bg-neutral-900 text-white shadow-xs"
                      : "border-slate-300/80 bg-white text-neutral-700 hover:bg-slate-100/60"
                  }`}
                >
                  <span className={`size-2 rounded-full shrink-0 ${filters.generalTier === "all" || !filters.generalTier ? "bg-white" : "bg-neutral-400"}`} />
                  <span>전체 ({etfs.length.toLocaleString()}개)</span>
                </button>
                <button
                  type="button"
                  onClick={() => updateFilters({ ...filters, generalTier: "tax_free" })}
                  title="국내주식형 ETF: 일반 위탁 계좌에서도 매매차익 세금 0원 (비과세)"
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition-all ${
                    filters.generalTier === "tax_free"
                      ? "border-blue-700 bg-blue-700 text-white shadow-xs"
                      : "border-slate-300/80 bg-white text-blue-900 hover:bg-slate-100/60"
                  }`}
                >
                  <span className={`size-2 rounded-full shrink-0 ${filters.generalTier === "tax_free" ? "bg-white" : "bg-blue-500"}`} />
                  <span>매매차익 비과세 ({isaCounts.normal.toLocaleString()}개)</span>
                </button>
                <button
                  type="button"
                  onClick={() => updateFilters({ ...filters, generalTier: "taxable" })}
                  title="해외주식·채권·기타 ETF: 매매차익 15.4% 배당소득세 과세 (절세 원할 시 ISA·연금 권장)"
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition-all ${
                    filters.generalTier === "taxable"
                      ? "border-amber-700 bg-amber-700 text-white shadow-xs"
                      : "border-slate-300/80 bg-white text-amber-900 hover:bg-slate-100/60"
                  }`}
                >
                  <span className={`size-2 rounded-full shrink-0 ${filters.generalTier === "taxable" ? "bg-white" : "bg-amber-500"}`} />
                  <span>매매차익 과세 ({isaCounts.high.toLocaleString()}개)</span>
                </button>
              </div>
            </div>

            {/* 2열 슬림 가이드 카드 그리드 */}
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs border-t border-slate-200/70 pt-2">
              <div className="rounded-lg bg-white/80 py-1.5 px-2.5 border border-slate-200/70">
                <div className="flex items-center gap-1.5 font-bold text-slate-950">
                  <span className="size-2 rounded-full bg-blue-500 shrink-0" />
                  <span>국내 주식형 ({isaCounts.normal.toLocaleString()}개)</span>
                  <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1 py-0.2 rounded">매매차익 비과세 · 일반계좌 최적</span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-700 leading-snug">
                  KOSPI200·국내 섹터 등은 일반 위탁 계좌에서도 <strong>매매차익 세금이 0원(비과세)</strong>이므로 한도 없이 거래하기 가장 유리합니다.
                </p>
              </div>
              <div className="rounded-lg bg-white/80 py-1.5 px-2.5 border border-slate-200/70">
                <div className="flex items-center gap-1.5 font-bold text-slate-950">
                  <span className="size-2 rounded-full bg-amber-500 shrink-0" />
                  <span>해외·채권·기타 ({isaCounts.high.toLocaleString()}개)</span>
                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1 py-0.2 rounded">15.4% 과세 · 절세 권장</span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-700 leading-snug">
                  해외지수·채권·원자재 등은 매매차익에 <strong>15.4% 세금</strong>이 부과되므로 절세를 원하시면 <strong>중개형 ISA나 연금계좌</strong>가 유리합니다.
                </p>
              </div>
            </div>

            <div className="mt-1.5 pt-1.5 border-t border-slate-200/50 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-700">
              <span>💡 일반 위탁 계좌: 전 종목({etfs.length.toLocaleString()}개) 거래 가능 · 레버리지·인버스 거래 자유</span>
              <span className="text-neutral-500 text-[10px] sm:text-[11px]">※ 별도 법정 편입 한도 없음 · 연간 납입한도 무제한</span>
            </div>
          </div>
        )}
      </section>

      {/* 🔥 TOP 10 인기 테마 퀵 필터 전용 섹션 */}
      <section aria-label="인기 테마 퀵 필터" className="mt-2.5 rounded-xl border border-neutral-200/90 bg-gradient-to-br from-neutral-50/90 via-white to-brand-50/25 p-3 sm:p-3.5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-black text-amber-950 border border-amber-300 shadow-2xs">
              <span aria-hidden="true">🔥</span>
              <span>TOP 10 인기 테마</span>
            </span>
            <p className="text-xs font-medium text-neutral-600 hidden sm:inline">
              가장 많이 찾는 핵심 테마 ETF를 원클릭으로 빠르게 확인하세요
            </p>
          </div>
          {activeQuickItem && (
            <button
              type="button"
              onClick={activeQuickItem.toggle}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-800 hover:text-brand-950 bg-brand-100/70 hover:bg-brand-100 px-2 py-0.5 rounded-md border border-brand-200 transition-colors"
            >
              <span>{activeQuickItem.label} 필터 해제</span>
              <span aria-hidden="true">✕</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2" role="group" aria-label="빠른 시작 조건">
          {quickFilterItems.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={item.active}
              onClick={item.toggle}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs sm:text-[13px] font-bold transition-all active:scale-[0.97] ${
                item.active
                  ? "border-brand-700 bg-brand-700 text-white shadow-sm ring-2 ring-brand-700/20"
                  : "border-neutral-200/90 bg-white text-neutral-700 hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-900 shadow-2xs"
              }`}
            >
              <span aria-hidden="true" className="text-sm shrink-0">{item.icon}</span>
              <span>{item.label}</span>
              {item.active && <span aria-hidden="true" className="text-[11px] font-black text-amber-300">✓</span>}
            </button>
          ))}
        </div>
      </section>

      <div className="mt-4 grid gap-5 md:grid-cols-[260px_minmax(0,1fr)]">
        {filtersOpen ? <button aria-label="필터 닫기" className="fixed inset-0 z-30 bg-neutral-900/30 md:hidden" onClick={() => setFiltersOpen(false)} type="button" /> : null}
        <aside aria-label="ETF 필터" className={`${filtersOpen ? "fixed inset-x-0 bottom-0 z-40 max-h-[82vh] overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl" : "hidden"} md:static md:block md:max-h-none md:rounded-2xl md:border md:border-line md:bg-neutral-50 md:p-5 md:shadow-none`}>


          <div className="flex items-center justify-between border-b border-line pb-3 mb-2">
            <span className="text-[15px] font-extrabold text-strong">상세 필터</span>
            <button
              className="flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2 py-1 text-[11px] font-bold text-brand-700 shadow-sm transition-colors hover:bg-brand-100 hover:text-brand-900"
              onClick={() => updateFilters(DEFAULT_SCREENER_FILTERS)}
              type="button"
            >
              <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              초기화
            </button>
          </div>
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
            accountMode={filters.accountMode}
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
            <p className="text-xs font-semibold text-muted">
              수익률: {RETURN_PERIOD_LABELS[selectedPeriod]} 기준 · {isTrMode ? "분배금 100% 재투자(TR) 기준" : "단순 가격(PR)·분배금 미포함"}
            </p>
            {etfs[0] ? <AsOfDate value={etfs[0].asOfDate} /> : null}
          </div>
          
          <div className="rounded-2xl border border-line w-full bg-surface shadow-xs overflow-x-auto lg:overflow-x-visible [scrollbar-width:thin]">
            <div className="w-full">
              <table className="w-full border-separate border-spacing-0 text-left text-sm whitespace-nowrap min-w-[770px]">
                {/* 명시적 열 너비 제어 */}
                <colgroup>
                  <col style={{ width: 180, minWidth: 140 }} />
                  <col style={{ width: 56, minWidth: 50 }} />
                  <col style={{ width: 56, minWidth: 50 }} />
                  <col style={{ width: 56, minWidth: 50 }} />
                  <col style={{ width: 56, minWidth: 50 }} />
                  <col style={{ width: 56, minWidth: 50 }} />
                  {(comparisonPeriod || customDateRange) && <col style={{ width: 62, minWidth: 54 }} />}
                  <col style={{ width: 56, minWidth: 52 }} />
                  <col style={{ width: 68, minWidth: 60 }} />
                  <col style={{ width: 68, minWidth: 60 }} />
                  <col style={{ width: 68, minWidth: 60 }} />
                </colgroup>
                {/* 2단 헤더 (윈도우 스크롤 시 상단 밀착 고정) */}
                <thead className="sticky top-0 z-30 bg-neutral-100 text-[12px] sm:text-[13px] font-bold text-neutral-700 border-b-2 border-neutral-300 shadow-sm">
                  <tr className="border-b border-neutral-200">
                    <th className="sticky left-0 z-40 px-2 sm:px-3 py-0 h-[30px] sm:h-[32px] w-[140px] min-w-[140px] sm:w-[180px] sm:min-w-[180px] text-center bg-neutral-100 shadow-[1px_0_0_0_#e5e5e5]" colSpan={1} scope="colgroup">상품 정보</th>
                    <th className="px-2 py-0 h-[30px] sm:h-[32px] text-center border-l border-neutral-200 bg-neutral-50" colSpan={(comparisonPeriod || customDateRange) ? 6 : 5} scope="colgroup">
                      <div className="flex items-center justify-center gap-2">
                        <span>수익률(%)</span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsTrMode(prev => {
                              const next = !prev;
                              const query = new URLSearchParams(window.location.search);
                              if (next) query.set("returnType", "tr");
                              else query.delete("returnType");
                              const qs = query.toString();
                              window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
                              return next;
                            });
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-2 sm:py-0.5 text-[12px] sm:text-[10px] font-bold rounded-full transition-all active:scale-95 border cursor-pointer ${
                            isTrMode 
                              ? "bg-brand-50 border-brand-300 text-brand-700 shadow-xs" 
                              : "bg-white border-neutral-200 text-neutral-600 hover:text-brand-800 hover:bg-neutral-200/70"
                          }`}
                          title={isTrMode ? "분배금 재투자(TR) 수익률 표시 중 (클릭 시 단순 가격 PR로 전환)" : "단순 가격(PR) 수익률 표시 중 (클릭 시 분배금 재투자 TR로 전환)"}
                        >
                          <span className={isTrMode ? "text-brand-700" : ""}>
                            TR {isTrMode ? "ON" : "OFF"}
                          </span>
                        </button>
                        <button 
                          type="button"
                          onClick={() => setShowMobileTrTooltip(true)}
                          className="group relative inline-flex items-center justify-center w-7 h-7 sm:w-auto sm:h-auto rounded-full text-neutral-400 hover:text-neutral-600 bg-neutral-100 sm:bg-transparent"
                        >
                          <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                          
                          {/* Desktop Tooltip */}
                          <div className="hidden sm:block absolute left-1/2 bottom-[calc(100%+8px)] -translate-x-1/2 w-64 max-w-[calc(100vw-32px)] p-3 rounded-xl bg-slate-900/98 backdrop-blur-md text-white text-left shadow-2xl border border-slate-700/90 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-[120] text-[11px] font-normal tracking-tight leading-snug whitespace-normal break-keep">
                            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-900/98" />
                            <strong>TR(Total Return) 모드 안내</strong><br/>
                            <span className="text-brand-300 font-bold mt-1.5 block">분배금 100% 전액 재투자 (세전 Gross TR)</span>
                            <p className="text-neutral-200">분배금을 세금 차감 없이 전액 재투자했을 때의 복리 총수익률을 표시합니다. (ISA·연금저축 등 과세이연 계좌 기준)</p>
                            <p className="text-neutral-300 text-[10.5px] mt-1.5 pt-1.5 border-t border-slate-700/60">💡 상장 기간이 미달된 구간은 정합성을 위해 공백(—)으로 표기됩니다.</p>
                          </div>
                        </button>
                      </div>
                      {showMobileTrTooltip && (
                        <div className="fixed inset-0 z-[200] flex items-end sm:hidden bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setShowMobileTrTooltip(false)}>
                          <div className="w-full bg-white rounded-t-2xl p-5 pb-8 animate-in slide-in-from-bottom-full duration-300" onClick={e => e.stopPropagation()}>
                            <div className="w-12 h-1.5 bg-neutral-200 rounded-full mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-strong mb-1 text-left">TR(Total Return) 모드 안내</h3>
                            <div className="space-y-4 mt-5 text-[14px] leading-relaxed text-neutral-600 text-left">
                              <div className="bg-brand-50/50 p-3.5 rounded-xl border border-brand-100/50">
                                <strong className="text-brand-700 block mb-1">분배금 100% 전액 재투자 (세전 Gross TR)</strong>
                                분배금(배당금)을 세금 차감 없이 100% 전액 재투자했을 때의 복리 총수익률입니다. ISA·연금저축 등 과세이연 계좌 기준이며, 일반계좌는 세금 차감 전 기준입니다.
                                <p className="text-neutral-500 text-[12px] mt-2 pt-2 border-t border-brand-200/50">💡 상장 기간이 미달된 구간은 정합성을 위해 공백(—)으로 표기됩니다.</p>
                              </div>
                            </div>
                            <button 
                              className="w-full py-3.5 mt-6 bg-neutral-900 text-white text-[15px] font-bold rounded-xl active:scale-[0.98] transition-transform"
                              onClick={() => setShowMobileTrTooltip(false)}
                            >
                              확인
                            </button>
                          </div>
                        </div>
                      )}
                    </th>
                    <th className="px-2 py-0 h-[30px] sm:h-[32px] text-center border-l border-neutral-200 bg-neutral-100" colSpan={4} scope="colgroup">비용·규모·가격</th>
                  </tr>
                  <tr className="text-[11.5px] sm:text-[12px]">
                    <th className="sticky left-0 z-40 w-[140px] min-w-[140px] sm:w-[180px] sm:min-w-[180px] bg-neutral-100 px-2 sm:px-3 py-0 h-[44px] sm:h-[48px] text-center shadow-[1px_0_0_0_#e5e5e5] border-b-2 border-neutral-300" scope="col">종목 정보</th>
                    
                    <th 
                      aria-label="1일 수익률 (클릭 시 정렬)"
                      className={`min-w-[50px] sm:min-w-[60px] px-1 sm:px-1.5 py-0 h-[44px] sm:h-[48px] text-right border-l border-neutral-200 border-b-2 border-neutral-300 cursor-pointer select-none hover:bg-brand-50 transition-colors ${sort === "return_1d" ? "bg-brand-100 text-brand-900" : "bg-neutral-50"}`} 
                      scope="col"
                      onClick={() => toggleColumnSort("return_1d")}
                      title="1일 수익률 기준 정렬 (클릭 시 오름차순/내림차순 토글)"
                    >
                      <div className="flex items-center justify-end gap-0.5">
                        <span className="whitespace-nowrap text-[10.5px] sm:text-[11px] tracking-tighter font-bold text-strong block text-right pr-0.5">1일</span>
                        {sort === "return_1d" && (
                          <span className="text-[9px] font-black text-brand-700" aria-hidden="true">{sortDir === "desc" ? "▼" : "▲"}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      aria-label="1개월 수익률 (클릭 시 정렬)"
                      className={`min-w-[50px] sm:min-w-[60px] px-1 sm:px-1.5 py-0 h-[44px] sm:h-[48px] text-right border-b-2 border-neutral-300 cursor-pointer select-none hover:bg-brand-50 transition-colors ${sort === "return_1m" ? "bg-brand-100 text-brand-900" : "bg-neutral-50"}`} 
                      scope="col"
                      onClick={() => toggleColumnSort("return_1m")}
                      title="1개월 수익률 기준 정렬 (클릭 시 오름차순/내림차순 토글)"
                    >
                      <div className="flex items-center justify-end gap-0.5">
                        <span className="whitespace-nowrap text-[10.5px] sm:text-[11px] tracking-tighter font-bold text-strong block text-right pr-0.5">1개월</span>
                        {sort === "return_1m" && (
                          <span className="text-[9px] font-black text-brand-700" aria-hidden="true">{sortDir === "desc" ? "▼" : "▲"}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      aria-label="3개월 수익률 (클릭 시 정렬)"
                      className={`min-w-[50px] sm:min-w-[60px] px-1 sm:px-1.5 py-0 h-[44px] sm:h-[48px] text-right border-b-2 border-neutral-300 cursor-pointer select-none hover:bg-brand-50 transition-colors ${sort === "return_3m" ? "bg-brand-100 text-brand-900" : "bg-neutral-50"}`} 
                      scope="col"
                      onClick={() => toggleColumnSort("return_3m")}
                      title="3개월 수익률 기준 정렬 (클릭 시 오름차순/내림차순 토글)"
                    >
                      <div className="flex items-center justify-end gap-0.5">
                        <span className="whitespace-nowrap text-[10.5px] sm:text-[11px] tracking-tighter font-bold text-strong block text-right pr-0.5">3개월</span>
                        {sort === "return_3m" && (
                          <span className="text-[9px] font-black text-brand-700" aria-hidden="true">{sortDir === "desc" ? "▼" : "▲"}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      aria-label="1년 수익률 (클릭 시 정렬)"
                      className={`min-w-[50px] sm:min-w-[60px] px-1 sm:px-1.5 py-0 h-[44px] sm:h-[48px] text-right border-b-2 border-neutral-300 cursor-pointer select-none hover:bg-brand-50 transition-colors ${sort === "return_12m" ? "bg-brand-100 text-brand-900" : "bg-neutral-50"}`} 
                      scope="col"
                      onClick={() => toggleColumnSort("return_12m")}
                      title={isTrMode ? "상장 1년 이상 경과 종목 대상 (클릭 시 정렬)" : "1년 수익률 (클릭 시 정렬)"}
                    >
                      <div className="flex items-center justify-end gap-0.5">
                        <span className="whitespace-nowrap text-[10.5px] sm:text-[11px] tracking-tighter font-bold text-strong block text-right pr-0.5">1년</span>
                        {sort === "return_12m" && (
                          <span className="text-[9px] font-black text-brand-700" aria-hidden="true">{sortDir === "desc" ? "▼" : "▲"}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      aria-label="3년 수익률 (클릭 시 정렬)"
                      className={`min-w-[50px] sm:min-w-[60px] px-1 sm:px-1.5 py-0 h-[44px] sm:h-[48px] text-right border-b-2 border-neutral-300 cursor-pointer select-none hover:bg-brand-50 transition-colors ${sort === "return_36m" ? "bg-brand-100 text-brand-900" : "bg-neutral-50"}`} 
                      scope="col"
                      onClick={() => toggleColumnSort("return_36m")}
                      title={isTrMode ? "상장 3년 이상 경과 종목 대상 (클릭 시 정렬)" : "3년 수익률 (클릭 시 정렬)"}
                    >
                      <div className="flex items-center justify-end gap-0.5">
                        <span className="whitespace-nowrap text-[10.5px] sm:text-[11px] tracking-tighter font-bold text-strong block text-right pr-0.5">3년</span>
                        {sort === "return_36m" && (
                          <span className="text-[9px] font-black text-brand-700" aria-hidden="true">{sortDir === "desc" ? "▼" : "▲"}</span>
                        )}
                      </div>
                    </th>
                    {comparisonPeriod && (
                      <th 
                        className="min-w-[54px] sm:min-w-[60px] px-1 sm:px-1.5 py-0 h-[44px] sm:h-[48px] text-right bg-brand-100 border-b-2 border-neutral-300 cursor-pointer select-none hover:bg-brand-200 transition-colors" 
                        scope="col"
                        onClick={() => toggleColumnSort("return_custom")}
                        title={`${RETURN_PERIOD_LABELS[comparisonPeriod]} 수익률 기준 정렬`}
                      >
                        <div className="flex items-center justify-end gap-0.5">
                          <span className="whitespace-nowrap text-[10.5px] sm:text-[11px] tracking-tighter font-bold text-brand-900 block text-right pr-0.5">{RETURN_PERIOD_LABELS[comparisonPeriod]}</span>
                          {sort === "return_custom" && (
                            <span className="text-[9px] font-black text-brand-700" aria-hidden="true">{sortDir === "desc" ? "▼" : "▲"}</span>
                          )}
                        </div>
                      </th>
                    )}
                    {customDateRange && !comparisonPeriod && (
                      <th 
                        className="min-w-[54px] sm:min-w-[60px] px-1 sm:px-1.5 py-0 h-[44px] sm:h-[48px] text-right bg-amber-50 border-b-2 border-neutral-300 cursor-pointer select-none hover:bg-amber-100 transition-colors" 
                        scope="col"
                        onClick={() => toggleColumnSort("return_custom")}
                        title="사용자 지정 기간 수익률 기준 정렬"
                      >
                        <div className="flex items-center justify-end gap-0.5">
                          <div>
                            <span className="block text-[9px] tracking-tighter font-bold text-amber-700 text-right pr-0.5">{customDateRange.start.slice(2).replace(/-/g, ".")}</span>
                            <span className="block text-[9px] tracking-tighter font-bold text-amber-700 text-right pr-0.5">~{customDateRange.end.slice(2).replace(/-/g, ".")}</span>
                          </div>
                          {sort === "return_custom" && (
                            <span className="text-[9px] font-black text-amber-900" aria-hidden="true">{sortDir === "desc" ? "▼" : "▲"}</span>
                          )}
                        </div>
                      </th>
                    )}

                    <th 
                      aria-label="투자자 실부담 총비용, 단위 퍼센트 (클릭 시 정렬)" 
                      className={`min-w-[58px] sm:min-w-[64px] px-1 sm:px-1.5 py-0 h-[44px] sm:h-[48px] text-right border-l border-neutral-200 border-b-2 border-neutral-300 cursor-pointer select-none hover:bg-brand-50 transition-colors ${sort === "ter" ? "bg-brand-100 text-brand-900" : "bg-neutral-100"}`} 
                      scope="col"
                      onClick={() => toggleColumnSort("ter")}
                      title="실부담비용 기준 정렬 (클릭 시 낮은순/높은순 토글)"
                    >
                      <div className="flex items-center justify-end gap-0.5">
                        <UnitHeaderLabel align="right" label="실부담비용" unit="%" />
                        {sort === "ter" && (
                          <span className="text-[9px] font-black text-brand-700" aria-hidden="true">{sortDir === "desc" ? "▼" : "▲"}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      aria-label="순자산, 단위 억원 (클릭 시 정렬)" 
                      className={`min-w-[58px] sm:min-w-[64px] px-1 sm:px-1.5 py-0 h-[44px] sm:h-[48px] text-right border-b-2 border-neutral-300 cursor-pointer select-none hover:bg-brand-50 transition-colors ${sort === "aum" ? "bg-brand-100 text-brand-900" : "bg-neutral-100"}`} 
                      scope="col"
                      onClick={() => toggleColumnSort("aum")}
                      title="순자산 기준 정렬 (클릭 시 높은순/낮은순 토글)"
                    >
                      <div className="flex items-center justify-end gap-0.5">
                        <UnitHeaderLabel align="right" label="순자산" unit="억원" />
                        {sort === "aum" && (
                          <span className="text-[9px] font-black text-brand-700" aria-hidden="true">{sortDir === "desc" ? "▼" : "▲"}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      aria-label="거래대금, 단위 억원 (클릭 시 정렬)" 
                      className={`min-w-[58px] sm:min-w-[64px] px-1 sm:px-1.5 py-0 h-[44px] sm:h-[48px] text-right border-b-2 border-neutral-300 cursor-pointer select-none hover:bg-brand-50 transition-colors ${sort === "tradeValue" ? "bg-brand-100 text-brand-900" : "bg-neutral-100"}`} 
                      scope="col"
                      onClick={() => toggleColumnSort("tradeValue")}
                      title="거래대금 기준 정렬 (클릭 시 높은순/낮은순 토글)"
                    >
                      <div className="flex items-center justify-end gap-0.5">
                        <UnitHeaderLabel align="right" label="거래대금" unit="억원" />
                        {sort === "tradeValue" && (
                          <span className="text-[9px] font-black text-brand-700" aria-hidden="true">{sortDir === "desc" ? "▼" : "▲"}</span>
                        )}
                      </div>
                    </th>
                    <th aria-label="종가, 단위 원" className="min-w-[58px] sm:min-w-[64px] px-1 sm:px-1.5 py-0 h-[44px] sm:h-[48px] text-right border-b-2 border-neutral-300 bg-neutral-100" scope="col"><UnitHeaderLabel align="right" label="종가" unit="원" /></th>
                  </tr>
                </thead>
                <tbody ref={tbodyRef} className="divide-y divide-line text-[12px]">
                  {rowVirtualizer.getVirtualItems().length > 0 && (
                    <tr style={{ height: `${Math.max(0, rowVirtualizer.getVirtualItems()[0].start - tableOffsetTop)}px` }}>
                      <td colSpan={(comparisonPeriod || customDateRange) ? 11 : 10} className="p-0 border-0"></td>
                    </tr>
                  )}
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const etf = results[virtualRow.index];
                    const getRet = (key: ReturnPeriod) => {
                      if (isTrMode) {
                        const tr = etf.returnsTr || etf.returnsNetTr;
                        if (tr && tr[key] !== undefined && tr[key] !== null) return tr[key];
                        return null;
                      }
                      return etf.returns[key];
                    };
                    return (
                    <tr className="bg-surface transition-colors hover:bg-neutral-100 even:bg-neutral-50/60" key={etf.ticker} data-index={virtualRow.index} ref={rowVirtualizer.measureElement}>
                      {/* 1. 종목 정보 (종목명 + 티커 + 자산/지역/환헤지/연금 뱃지 통합) */}
                      <th className="sticky left-0 z-10 bg-white w-[140px] min-w-[140px] sm:w-[180px] sm:min-w-[180px] max-w-[210px] px-2 sm:px-3 py-1.5 text-left shadow-[1px_0_0_0_#e5e5e5]" scope="row">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <Link className="line-clamp-1 truncate block text-left text-[12px] sm:text-[13px] font-bold leading-tight text-strong hover:text-brand-700" href={`/etf/${etf.ticker}`} title={etf.name}>
                            {etf.name}
                          </Link>
                          <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted">
                            <span className="font-mono font-semibold text-neutral-600 bg-neutral-100 px-1 py-0.2 rounded text-[10.5px]">{etf.ticker}</span>
                            <span className="text-neutral-500 font-medium">{etf.assetClass}</span>
                            {etf.classification?.marketScope && etf.classification.marketScope !== "국내" && (
                              <span className="text-neutral-400">· {etf.classification.marketScope}</span>
                            )}
                            {etf.classification?.fxHedge && etf.classification.fxHedge !== "환노출" && (
                              <span className="text-amber-800 font-bold text-[10px] bg-amber-50 border border-amber-200 px-1 rounded">{etf.classification.fxHedge}</span>
                            )}
                            {filters.accountMode === "pension" ? (
                              etf.pensionLimit === "100% (안전자산)" ? (
                                <>
                                  <span className="text-emerald-800 font-bold text-[10px] bg-emerald-50 border border-emerald-200 px-1 rounded" title="퇴직연금감독규정 제12조 제4항상 100% 전액 투자 가능 (안전자산) · 금융투자협회 전자공시 대조 완료">안전자산100%</span>
                                  {etf.pensionVerified === "N" && (
                                    <span
                                      className={
                                        etf.pensionConfidence === "낮음"
                                          ? "text-neutral-600 font-bold text-[10px] bg-neutral-100 border border-neutral-300 px-1 rounded cursor-help"
                                          : "text-amber-800 font-bold text-[10px] bg-amber-50 border border-amber-300 px-1 rounded cursor-help"
                                      }
                                      title="운용사·증권사 공시로 확인되지 않은 규칙 기반 추정값입니다. 실제 편입 가능 여부는 가입하신 금융회사에서 확인해 주세요."
                                    >
                                      추정
                                    </span>
                                  )}
                                  {etf.pensionConfidence === "보통" && (
                                    <span className="text-amber-800 font-bold text-[10px] bg-amber-50 border border-amber-300 px-1 rounded cursor-help" title="법령 조문 직접 적용 등 간접 근거로 판정된 항목입니다. 실제 편입 가능 여부는 가입하신 금융회사에서 확인해 주세요.">확인권장</span>
                                  )}
                                </>
                              ) : etf.pensionLimit === "70% (위험자산)" ? (
                                <>
                                  <span className="text-blue-800 font-bold text-[10px] bg-blue-50 border border-blue-200 px-1 rounded" title="퇴직연금감독규정 제12조 제4항상 70% 한도 내 투자 가능 (위험자산) · 금융투자협회 전자공시 대조 완료">위험70%</span>
                                  {etf.pensionVerified === "N" && (
                                    <span
                                      className={
                                        etf.pensionConfidence === "낮음"
                                          ? "text-neutral-600 font-bold text-[10px] bg-neutral-100 border border-neutral-300 px-1 rounded cursor-help"
                                          : "text-amber-800 font-bold text-[10px] bg-amber-50 border border-amber-300 px-1 rounded cursor-help"
                                      }
                                      title="운용사·증권사 공시로 확인되지 않은 규칙 기반 추정값입니다. 실제 편입 가능 여부는 가입하신 금융회사에서 확인해 주세요."
                                    >
                                      추정
                                    </span>
                                  )}
                                  {etf.pensionConfidence === "보통" && (
                                    <span className="text-amber-800 font-bold text-[10px] bg-amber-50 border border-amber-300 px-1 rounded cursor-help" title="법령 조문 직접 적용 등 간접 근거로 판정된 항목입니다. 실제 편입 가능 여부는 가입하신 금융회사에서 확인해 주세요.">확인권장</span>
                                  )}
                                </>
                              ) : (
                                <>
                                  <span className="text-rose-800 font-bold text-[10px] bg-rose-50 border border-rose-200 px-1 rounded">연금불가</span>
                                  {etf.pensionConfidence === "보통" && (
                                    <span
                                      className="text-amber-800 font-bold text-[10px] bg-amber-50 border border-amber-300 px-1 rounded cursor-help"
                                      title="선물 파생평가액 규정상 원칙적 편입 불가이나, 증권사별 예외 취급 정책 여부는 거래 증권사에서 최종 확인하십시오"
                                    >
                                      정책확인
                                    </span>
                                  )}
                                </>
                              )
                            ) : filters.accountMode === "personal_pension" ? (
                              <>
                                {etf.personalPension === "가능" ? (
                                  etf.pensionLimit === "불가" && (
                                    <span className="text-amber-800 font-bold text-[10px] bg-amber-50 border border-amber-200 px-1 rounded" title="퇴직연금(DC/IRP)은 불가하나 개인연금저축에서는 100% 편입 가능">개인연금전용</span>
                                  )
                                ) : (
                                  <span className="text-rose-800 font-bold text-[10px] bg-rose-50 border border-rose-200 px-1 rounded" title="금융투자협회 연금저축계좌 표준약관 제8조에 따라 지수 대비 1배 초과 또는 음(-)의 배율로 운용되는 ETF는 연금저축계좌에서 매입할 수 없습니다.">연금불가</span>
                                )}
                              </>
                            ) : filters.accountMode === "isa" ? (
                              <>
                                {etf.isaEducationRequired === "Y" && (
                                  <span className="text-amber-800 font-bold text-[10px] bg-amber-50 border border-amber-200 px-1 rounded" title="중개형 ISA 편입 가능 (사전교육 및 기본예탁금 필요)">교육필요</span>
                                )}
                              </>
                            ) : (
                              <>
                                {(etf.riskType === "leverage" || etf.isaEducationRequired === "Y") && (
                                  <span className="text-amber-800 font-bold text-[10px] bg-amber-50 border border-amber-200 px-1 rounded" title="일반 위탁계좌 편입 가능 (금융투자교육원 사전교육 및 기본예탁금 필요)">교육필요</span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </th>
                      
                      {/* 2. 핵심 5대 수익률 (1일, 1개월, 3개월, 1년, 3년) */}
                      <td className={`min-w-[60px] px-1 py-2 text-right font-semibold tabular-nums border-l border-neutral-100 ${sort === "return_1d" ? "bg-brand-50" : ""}`}>
                        <ReturnCell showUnit={false} value={getRet("1d")} />
                      </td>
                      <td className={`min-w-[60px] px-1 py-2 text-right font-semibold tabular-nums ${sort === "return_1m" ? "bg-brand-50" : ""}`}>
                        <ReturnCell showUnit={false} value={getRet("1m")} />
                      </td>
                      <td className={`min-w-[60px] px-1 py-2 text-right font-semibold tabular-nums ${sort === "return_3m" ? "bg-brand-50" : ""}`}>
                        <ReturnCell showUnit={false} value={getRet("3m")} />
                      </td>
                      <td className={`min-w-[60px] px-1 py-2 text-right font-semibold tabular-nums ${sort === "return_12m" ? "bg-brand-50" : ""}`}>
                        <ReturnCell showUnit={false} value={getRet("12m")} />
                      </td>
                      <td className={`min-w-[60px] px-1 py-2 text-right font-semibold tabular-nums ${sort === "return_36m" ? "bg-brand-50" : ""}`}>
                        <ReturnCell showUnit={false} value={getRet("36m")} />
                      </td>
                      {comparisonPeriod && (
                        <td className="min-w-[60px] px-1 py-2 text-right font-semibold tabular-nums bg-brand-50">
                          <ReturnCell showUnit={false} value={getRet(comparisonPeriod)} />
                        </td>
                      )}
                      {customDateRange && !comparisonPeriod && (
                        <td className="min-w-[60px] px-2 py-2 font-semibold text-right border-l-2 border-line bg-amber-50/30">
                          {isCustomReturnsLoading ? (
                            <span className="text-muted text-xs">...</span>
                          ) : customReturnsData?.returns?.[etf.ticker] !== undefined && customReturnsData?.returns?.[etf.ticker] !== null ? (
                            <ReturnCell showUnit={false} value={customReturnsData.returns[etf.ticker]} />
                          ) : (
                            <span className="text-neutral-400 text-xs font-semibold">-</span>
                          )}
                        </td>
                      )}
                      
                      {/* 3. 총보수(실부담), 순자산, 거래대금, 종가 */}
                      <td className={`min-w-[64px] px-1.5 py-1 text-right border-l border-neutral-100 align-middle ${sort === "ter" ? "bg-brand-50" : ""}`}>
                        <FeeDoubleStack etf={etf} />
                      </td>
                      <td className={`min-w-[64px] px-1 py-2 text-right font-semibold tabular-nums text-strong ${sort === "aum" ? "bg-brand-50" : ""}`}>{formatAumNumber(etf.aum)}</td>
                      <td className={`min-w-[64px] px-1 py-2 text-right font-semibold tabular-nums text-strong ${sort === "tradeValue" ? "bg-brand-50" : ""}`}>{formatTradeValueNumber(etf.tradeValue)}</td>
                      <td className="min-w-[64px] px-1 py-2 text-right font-semibold tabular-nums">{formatWonNumber(etf.close)}</td>
                    </tr>
                    );
                  })}
                  {rowVirtualizer.getVirtualItems().length > 0 && (
                    <tr style={{ height: `${rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end}px` }}>
                      <td colSpan={(comparisonPeriod || customDateRange) ? 11 : 10} className="p-0 border-0"></td>
                    </tr>
                  )}
                </tbody>
              </table>

              {!results.length ? (
                <div className="px-5 py-16 text-center">
                  <p className="font-extrabold text-strong">조건에 맞는 ETF가 없습니다</p>
                  <p className="mt-2 text-sm text-muted">검색어나 선택하신 필터 조건을 조정해 보세요.</p>
                  <button
                    type="button"
                    onClick={() => updateFilters(DEFAULT_SCREENER_FILTERS)}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-brand-700 bg-brand-50 border border-brand-200 rounded-xl hover:bg-brand-100 transition-colors shadow-2xs cursor-pointer"
                  >
                    <span>🔄 검색 및 필터 초기화</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
