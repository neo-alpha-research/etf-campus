"use client";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { fetcher } from "@/lib/hooks/fetcher";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

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
    eyebrow: "단기 방향성 베팅 · 포트폴리오 헤지",
    title: "레버리지·인버스 ETF (Leveraged & Inverse)",
    description: "기초지수 일간 등락의 ±1배, ±2배 수익률을 추종하여 단기 방향성 매매와 하락장 위험 헤지에 활용되는 파생형 ETF입니다.",
  },
  new: {
    eyebrow: "최신 시장 트렌드 · 상장 90일 이내",
    title: "신규 상장 ETF (New Listings)",
    description: "상장 후 90일 이내의 최신 ETF를 순자산 규모 제한 없이 100% 전수 노출하여, 시장의 가장 빠른 혁신 테마와 신규 자산배분 기회를 제공합니다.",
  },
  mixed_bonds: {
    eyebrow: "안전자산 100% 적격 · 자산배분",
    title: "혼합채권 ETF (Mixed Bonds)",
    description: "퇴직연금(DC/IRP) 안전자산(30%) 한도로 100% 담을 수 있어, 실질 주식 비중을 최대 85%까지 높이고 채권 쿠션을 더하는 전략형 ETF입니다.",
  },
  tdf: {
    eyebrow: "고용노동부 적격 100% 편입 · 올인원 자산배분",
    title: "TDF ETF (Target Date Fund)",
    description: "은퇴 목표 연도에 맞춰 주식과 채권 비중을 자동으로 조절하며, 퇴직연금(DC/IRP) 위험자산 한도(70%) 규제 없이 100% 전액 편입이 가능한 올인원 ETF입니다.",
  },
  covered_call: {
    eyebrow: "월 분배금 추구 · 옵션 프리미엄 인컴",
    title: "커버드콜 ETF (Covered Call)",
    description: "기초자산 보유와 콜옵션 매도 프리미엄을 결합해 매월 높은 분배금을 추구하지만, 주가 상승 제한과 원금 삭감 위험이 공존하는 전략형 ETF입니다.",
  },
};

const scopeOptions: { value: AumScope; label: string; summary: string }[] = [
  { value: "1000plus", label: "1,000억 이상", summary: "1,000억 이상" },
  { value: "500plus", label: "500억 이상", summary: "500억 이상" },
  { value: "all", label: "전체", summary: "전체" },
];

const riskLabels: Record<RiskType, string> = { normal: "일반", leverage: "레버리지", inverse: "인버스", parking: "파킹형" };

const TDF_VINTAGES = ["2030", "2040", "2045", "2050", "2060", "2065"] as const;
const TDF_AGE_RECOMMENDATIONS = [
  { label: "20대", birth: "~97년생", vintage: "2060" },
  { label: "30대", birth: "87~96년", vintage: "2050" },
  { label: "40대", birth: "77~86년", vintage: "2045" },
  { label: "50대", birth: "67~76년", vintage: "2040" },
  { label: "60대+", birth: "~66년생", vintage: "2030" },
] as const;

function getTdfVintageInfo(name: string): { vintage: string; equityPct: number } | null {
  const match = name.match(/20(30|40|45|50|60|65)/);
  if (!match) return null;
  const vintage = "20" + match[1];
  const equityMap: Record<string, number> = {
    "2030": 40,
    "2040": 55,
    "2045": 70,
    "2050": 80,
    "2060": 80,
    "2065": 80,
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

export type MixedBondSubCategory = "all" | "single_stock" | "us_global" | "domestic" | "income" | "trf";

export const MIXED_BOND_CATEGORIES = [
  { id: "all", label: "전체", emoji: "" },
  { id: "single_stock", label: "빅테크·단일종목", emoji: "🎯" },
  { id: "us_global", label: "미국·글로벌", emoji: "🇺🇸" },
  { id: "domestic", label: "국내 대표지수·배당", emoji: "🇰🇷" },
  { id: "income", label: "인컴·원자재", emoji: "💰" },
  { id: "trf", label: "TRF(자산배분)", emoji: "⚖️" },
] as const;

export function getMixedBondSubCategory(name: string): "trf" | "income" | "single_stock" | "us_global" | "domestic" {
  if (name.includes("TRF")) return "trf";
  if (/커버드콜|리츠|부동산|금채권|은채권|골드/.test(name)) return "income";
  if (/삼성|SK하이닉스|테슬라|엔비디아|애플|현대차|반도체|우주테크|샌디스크|기아/.test(name)) return "single_stock";
  if (/미국|나스닥|TOP5|테크TOP10/.test(name)) return "us_global";
  return "domestic";
}

export type CoveredCallThemeCategory =
  | "all"
  | "pension_safe"
  | "us_tech"
  | "dividend_growth"
  | "bonds_mixed"
  | "domestic_index"
  | "sp500_global";

export const COVERED_CALL_THEMES: { id: CoveredCallThemeCategory; label: string; icon: string }[] = [
  { id: "all", label: "전체", icon: "전체" },
  { id: "pension_safe", label: "안전자산 100%", icon: "🛡️" },
  { id: "us_tech", label: "빅테크·AI·나스닥", icon: "🇺🇸" },
  { id: "dividend_growth", label: "배당성장·배당다우존스", icon: "💰" },
  { id: "bonds_mixed", label: "미국채·채권혼합", icon: "🛡️" },
  { id: "domestic_index", label: "국내대표지수·밸류업", icon: "🇰🇷" },
  { id: "sp500_global", label: "미국 S&P500·글로벌", icon: "🌍" },
];

export function getCoveredCallThemeCategory(name: string): Exclude<CoveredCallThemeCategory, "all" | "pension_safe"> {
  if (/미국채|30년국채|채권|국채/.test(name)) {
    return "bonds_mixed";
  }
  if (/빅테크|나스닥|테크|반도체|AI|인공지능|소프트웨어|차이나테크|항셍테크/.test(name)) {
    return "us_tech";
  }
  if (/배당|고배당/.test(name)) {
    return "dividend_growth";
  }
  if (/200|코스피|코스닥|밸류업/.test(name)) {
    return "domestic_index";
  }
  return "sp500_global";
}

export function getCoveredCallTag(name: string): string | null {
  if (name.includes("타겟데일리")) return "타겟데일리";
  if (name.includes("데일리고정")) return "데일리고정";
  if (name.includes("데일리")) return "데일리옵션";
  if (name.includes("타겟위클리")) return "타겟위클리";
  if (name.includes("위클리고정")) return "위클리고정";
  if (name.includes("위클리")) return "위클리옵션";
  if (name.includes("OTM")) return "OTM옵션";
  if (name.includes("타겟")) return "타겟프리미엄";
  if (name.includes("ATM")) return "ATM옵션";
  return null;
}


function toggleValue<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function updateUrl(
  state: ExplorerState,
  subFilters?: {
    vintage?: string | null;
    range?: "all" | "30d" | "60d" | "90d";
    theme?: CoveredCallThemeCategory;
    category?: MixedBondSubCategory;
    multipliers?: DerivMultiplierType[];
    returnType?: "pr" | "tr";
  }
): void {
  if (typeof window === "undefined") return;
  const queryStr = serializeExplorerQuery(state);
  const query = new URLSearchParams(queryStr);
  if (subFilters) {
    if (state.mode === "tdf" && subFilters.vintage) {
      query.set("vintage", subFilters.vintage);
    }
    if (state.mode === "new" && subFilters.range && subFilters.range !== "all") {
      query.set("range", subFilters.range);
    }
    if (state.mode === "covered_call" && subFilters.theme && subFilters.theme !== "all") {
      query.set("theme", subFilters.theme);
    }
    if (state.mode === "mixed_bonds" && subFilters.category && subFilters.category !== "all") {
      query.set("category", subFilters.category);
    }
    if (state.mode === "derivatives" && subFilters.multipliers && subFilters.multipliers.length < 3) {
      query.set("mult", subFilters.multipliers.join(","));
    }
    if (subFilters.returnType === "tr") {
      query.set("returnType", "tr");
    }
  }
  if (!window.location.pathname.includes('/quick')) return;
  window.history.replaceState(window.history.state, "", `${window.location.pathname}?${query.toString()}`);
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
  const etfs = useMemo(() => {
    return (initialEtfs && initialEtfs.length > 0) ? initialEtfs : (fetchedEtfs || []);
  }, [initialEtfs, fetchedEtfs]);
  const [state, setState] = useState<ExplorerState>(DEFAULT_EXPLORER_STATE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [urlReady, setUrlReady] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [isFullPeriods, setIsFullPeriods] = useState(false);
  const [isTrMode, setIsTrMode] = useState(false);
  const [showMobileTrTooltip, setShowMobileTrTooltip] = useState(false);

  // Mode-specific sub-filters
  const [selectedVintage, setSelectedVintage] = useState<string | null>(null);
  const [selectedNewRange, setSelectedNewRange] = useState<"all" | "30d" | "60d" | "90d">("all");
  const [selectedCoveredCallTheme, setSelectedCoveredCallTheme] = useState<CoveredCallThemeCategory>("all");
  const [selectedMixedBondCategory, setSelectedMixedBondCategory] = useState<MixedBondSubCategory>("all");
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

  const syncSubFiltersFromParams = (params: URLSearchParams) => {
    const v = params.get("vintage");
    if (v && TDF_VINTAGES.includes(v as any)) setSelectedVintage(v);
    const r = params.get("range");
    if (r && ["30d", "60d", "90d"].includes(r)) setSelectedNewRange(r as any);
    const th = params.get("theme");
    if (th && COVERED_CALL_THEMES.some((t) => t.id === th)) setSelectedCoveredCallTheme(th as any);
    const cat = params.get("category");
    if (cat && MIXED_BOND_CATEGORIES.some((c) => c.id === cat)) setSelectedMixedBondCategory(cat as any);
    const m = params.get("mult");
    if (m) {
      const parsed = m.split(",").filter((item): item is DerivMultiplierType => ["lev2x", "inv2x", "inv1x"].includes(item));
      if (parsed.length > 0) setActiveDerivMultipliers(parsed);
    }
    const rt = params.get("returnType") || params.get("return_type");
    if (rt === "tr") setIsTrMode(true);
    else if (rt === "pr") setIsTrMode(false);
  };

  // We handle initial load and popstate in a separate effect just to be safe,
  // but SearchParamsSync handles Next.js router soft-navigations.
  useEffect(() => {
    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      setState(parseExplorerQuery(params));
      syncSubFiltersFromParams(params);
      setUrlReady(true);
    };

    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  useEffect(() => {
    if (!urlReady) return;
    updateUrl(state, {
      vintage: selectedVintage,
      range: selectedNewRange,
      theme: selectedCoveredCallTheme,
      category: selectedMixedBondCategory,
      multipliers: activeDerivMultipliers,
      returnType: isTrMode ? "tr" : "pr",
    });
  }, [state, urlReady, selectedVintage, selectedNewRange, selectedCoveredCallTheme, selectedMixedBondCategory, activeDerivMultipliers, isTrMode]);

  const setExplorerState = (patch: Partial<ExplorerState>, resetPage = true) => {
    setState((current) => {
      const next = { ...current, ...patch, page: resetPage ? 1 : patch.page ?? current.page };
      return next;
    });
  };

  const isStrategyMode = ["mixed_bonds", "tdf", "covered_call", "derivatives", "new"].includes(state.mode);
  const modeEtfs = useMemo(() => filterEtfsByMode(etfs, state.mode), [etfs, state.mode]);
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

  const scopedEtfs = isStrategyMode ? modeEtfs : getEtfsByAumScope(modeEtfs, state.scope);
  const searchedEtfs = searchEtfs(scopedEtfs, state.query);
  const filteredEtfs = applyExplorerFilters(searchedEtfs, { assetClasses: state.assetClasses, riskTypes: activeRiskTypes });
  const results = sortExplorerEtfs(filteredEtfs, state.sort, state.direction, normalizedPeriod, isTrMode);

  const asOfDate = etfs[0]?.asOfDate;
  const copy = modeCopy[state.mode];
  const pendingListingDates = state.mode === "new" ? modeEtfs.filter((etf) => !etf.listingDate).length : 0;

  const coveredCallPensionCount = useMemo(() => {
    if (state.mode !== "covered_call") return 0;
    return modeEtfs.filter((e) => e.pension !== "불가").length;
  }, [modeEtfs, state.mode]);

  const coveredCallEquityCount = useMemo(() => {
    if (state.mode !== "covered_call") return 0;
    return modeEtfs.filter((e) => !e.pensionLimit?.includes("100%") && e.pension !== "불가").length;
  }, [modeEtfs, state.mode]);

  const coveredCallBondCount = useMemo(() => {
    if (state.mode !== "covered_call") return 0;
    return modeEtfs.filter((e) => e.pensionLimit?.includes("100%")).length;
  }, [modeEtfs, state.mode]);

  const tdfVintageCounts = useMemo(() => {
    if (state.mode !== "tdf") return null;
    const counts: Record<string, number> = { all: modeEtfs.length };
    for (const v of TDF_VINTAGES) {
      counts[v] = modeEtfs.filter((e) => e.name.includes(v)).length;
    }
    return counts;
  }, [modeEtfs, state.mode]);

  const newRangeCounts = useMemo(() => {
    if (state.mode !== "new") return null;
    const counts = { all: modeEtfs.length, "30d": 0, "60d": 0, "90d": 0 };
    for (const etf of modeEtfs) {
      const days = getDaysSinceListing(etf.listingDate, asOfDate);
      if (days === null) continue;
      if (days <= 30) counts["30d"]++;
      else if (days <= 60) counts["60d"]++;
      else counts["90d"]++;
    }
    return counts;
  }, [modeEtfs, state.mode, asOfDate]);

  const derivCounts = {
    lev2x: modeEtfs.filter((e) => getDerivMultiplierInfo(e)?.type === "lev2x").length,
    inv2x: modeEtfs.filter((e) => getDerivMultiplierInfo(e)?.type === "inv2x").length,
    inv1x: modeEtfs.filter((e) => getDerivMultiplierInfo(e)?.type === "inv1x").length,
  };

  const coveredCallThemeCounts = useMemo(() => {
    if (state.mode !== "covered_call") return null;
    const counts: Record<CoveredCallThemeCategory, number> = {
      all: modeEtfs.length,
      pension_safe: modeEtfs.filter((e) => e.pensionLimit?.includes("100%")).length,
      us_tech: 0,
      dividend_growth: 0,
      bonds_mixed: 0,
      domestic_index: 0,
      sp500_global: 0,
    };
    for (const etf of modeEtfs) {
      const cat = getCoveredCallThemeCategory(etf.name);
      counts[cat]++;
    }
    return counts;
  }, [modeEtfs, state.mode]);

  const mixedBondCounts = useMemo(() => {
    if (state.mode !== "mixed_bonds") return null;
    const counts: Record<MixedBondSubCategory, number> = {
      all: modeEtfs.length,
      single_stock: 0,
      us_global: 0,
      domestic: 0,
      income: 0,
      trf: 0,
    };
    for (const etf of modeEtfs) {
      const cat = getMixedBondSubCategory(etf.name);
      counts[cat]++;
    }
    return counts;
  }, [modeEtfs, state.mode]);

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
  } else if (state.mode === "covered_call" && selectedCoveredCallTheme !== "all") {
    filteredResults = filteredResults.filter((etf) => {
      if (selectedCoveredCallTheme === "pension_safe") {
        return etf.pensionLimit?.includes("100%");
      }
      const cat = getCoveredCallThemeCategory(etf.name);
      return cat === selectedCoveredCallTheme;
    });
  } else if (state.mode === "mixed_bonds" && selectedMixedBondCategory !== "all") {
    filteredResults = filteredResults.filter((etf) => {
      const cat = getMixedBondSubCategory(etf.name);
      return cat === selectedMixedBondCategory;
    });
  }

  const visibleEtfs = filteredResults;
  const activeFilterCount = state.assetClasses.length + activeRiskTypes.length;

  const isPension = state.mode === "pension";
  const isDeriv = state.mode === "derivatives";
  const isNew = state.mode === "new";
  const isCoveredCall = state.mode === "covered_call";
  const isMixedBonds = state.mode === "mixed_bonds";

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
    estimateSize: () => 52,
    overscan: 12,
    scrollMargin: tableScrollMargin,
    getItemKey: (index) => visibleEtfs[index]?.ticker ?? index,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualPaddingTop = virtualRows.length > 0 ? virtualRows[0].start - tableScrollMargin : 0;
  const virtualPaddingBottom = virtualRows.length > 0 ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end : 0;

  const clearFilters = () => {
    setExplorerState({ assetClasses: [], riskTypes: [], query: "" });
    setSelectedVintage(null);
    setSelectedNewRange("all");
    setSelectedCoveredCallTheme("all");
    setSelectedMixedBondCategory("all");
    setActiveDerivMultipliers(["lev2x", "inv2x", "inv1x"]);
    setIsTrMode(false);
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
          syncSubFiltersFromParams(params);
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

      {state.mode === "mixed_bonds" ? (
        <div className="mt-2.5 rounded-xl border border-indigo-200/80 bg-indigo-50/50 p-2.5 sm:p-3 text-xs sm:text-sm">
          <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-indigo-200/60">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center rounded-md bg-indigo-600 px-2 py-0.5 text-[11px] font-extrabold text-white tracking-tight">
                퇴직연금 82% 자산배분 전략
              </span>
              <span className="text-[11px] font-bold text-indigo-950">
                근퇴법상 안전자산 100% 인정 (위험자산 70% 한도 미적용)
              </span>
            </div>
            <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-extrabold text-indigo-900 tabular-nums">
              전 종목 {modeEtfs.length}개 DC·IRP 적격
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
            <div className="rounded-lg border border-indigo-100 bg-white/90 p-2.5 shadow-2xs">
              <div className="flex items-center gap-1.5 font-extrabold text-indigo-950 text-xs">
                <span>🚀</span>
                <span>실질 주식 비중 최대 85% 극대화</span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-neutral-600">
                안전자산 30% 한도에 주식 40~50% 혼합형을 채우면, 계좌 전체 주식 비중을 <strong>70% ➔ 82~85%</strong>까지 합법적으로 확장할 수 있습니다.
              </p>
            </div>

            <div className="rounded-lg border border-indigo-100 bg-white/90 p-2.5 shadow-2xs">
              <div className="flex items-center gap-1.5 font-extrabold text-indigo-950 text-xs">
                <span>🛡️</span>
                <span>주식+채권 분산 쿠션 및 단일종목 집중</span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-neutral-600">
                주식 하락 시 국채·우량채 편입분이 완충재(쿠션) 역할을 하며, 삼성전자·엔비디아·테슬라 등 <strong>우량 빅테크 집중투자</strong>도 지원합니다.
              </p>
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-indigo-200/50 flex flex-wrap items-center justify-between gap-1.5 text-xs">
            <span className="text-[10.5px] font-semibold text-indigo-900/80 flex items-center gap-1">
              <span>💡</span>
              <span>{modeEtfs.length}개 전 종목 DC/IRP 100% 편입 가능 · 기초자산 변동에 따른 원금 손실 위험 유의</span>
            </span>
            <Link
              href="/explore?account=pension&pension_tier=safe"
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-white border border-indigo-200 text-indigo-800 hover:bg-indigo-50 hover:border-indigo-400 transition-colors shadow-2xs shrink-0"
            >
              <span>🛡️ 퇴직연금 안전자산 계좌로 이동</span>
              <span className="text-[9px] text-indigo-500">→</span>
            </Link>
          </div>
        </div>
      ) : null}

      {state.mode === "pension" ? <p className="mt-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-semibold leading-6 text-brand-900">DC·IRP 편입 가능 여부는 금융회사별 매매 가능 목록과 위험자산 한도에 따라 달라질 수 있습니다.</p> : null}
      {state.mode === "tdf" ? (
        <div className="mt-2.5 rounded-xl border border-indigo-200/80 bg-indigo-50/50 p-2.5 sm:p-3 text-xs sm:text-sm">
          <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-indigo-200/60">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center rounded-md bg-indigo-600 px-2 py-0.5 text-[11px] font-extrabold text-white tracking-tight">
                생애주기 자동 자산배분 전략
              </span>
              <span className="text-[11px] font-bold text-indigo-950">
                근퇴법상 적격 TDF 100% 편입 특례 (위험자산 70% 한도 미적용)
              </span>
            </div>
            <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-extrabold text-indigo-900 tabular-nums">
              전 종목 {modeEtfs.length}개 DC·IRP 적격
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
            <div className="rounded-lg border border-indigo-100 bg-white/90 p-2.5 shadow-2xs">
              <div className="flex items-center gap-1.5 font-extrabold text-indigo-950 text-xs">
                <span>🎯</span>
                <span>글라이드패스(Glide Path) 자동 리밸런싱</span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-neutral-600">
                청년기엔 주식 비중을 최대 80%로 높여 복리 성장을 추구하고, 은퇴 시점이 다가올수록 채권 비중을 높여 은퇴 자산을 안전하게 보존합니다.
              </p>
            </div>

            <div className="rounded-lg border border-indigo-100 bg-white/90 p-2.5 shadow-2xs">
              <div className="flex items-center gap-1.5 font-extrabold text-indigo-950 text-xs">
                <span>🛡️</span>
                <span>고용노동부 적격 판정 · 100% 전액 편입</span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-neutral-600">
                일반 주식형(70% 한도)과 달리 계좌 자산의 100%를 단일 TDF로 올인원 분산 투자할 수 있어, 퇴직연금(DC/IRP) 초보자에게 최적입니다.
              </p>
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-indigo-200/50 flex flex-wrap items-center justify-between gap-1.5 text-xs">
            <span className="text-[10.5px] font-semibold text-indigo-900/80 flex items-center gap-1">
              <span>💡</span>
              <span>빈티지 숫자(예: 2050)는 은퇴 목표 연도입니다 · 시장 변동 및 위험자산 편입에 따른 원금 손실 위험 유의</span>
            </span>
            <Link
              href="/explore?account=pension"
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-white border border-indigo-200 text-indigo-800 hover:bg-indigo-50 hover:border-indigo-400 transition-colors shadow-2xs shrink-0"
            >
              <span>🛡️ 퇴직연금 전체 계좌로 이동</span>
              <span className="text-[9px] text-indigo-500">→</span>
            </Link>
          </div>
        </div>
      ) : null}
      {state.mode === "derivatives" ? (
        <div className="mt-2.5 rounded-xl border border-rose-200/80 bg-rose-50/40 p-2.5 sm:p-3 text-xs sm:text-sm">
          <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-rose-200/60">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center rounded-md bg-rose-600 px-2 py-0.5 text-[11px] font-extrabold text-white tracking-tight">
                단기 매매 & 리스크 헤지 전략
              </span>
              <span className="text-[11px] font-bold text-rose-950">
                근퇴법상 연금 편입 전면 금지 (일반 위탁 · 중개형 ISA 전용)
              </span>
            </div>
            <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-extrabold text-rose-900 tabular-nums">
              전 종목 {modeEtfs.length}개 (사전의무교육 대상)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
            <div className="rounded-lg border border-rose-100 bg-white/90 p-2.5 shadow-2xs">
              <div className="flex items-center gap-1.5 font-extrabold text-rose-950 text-xs">
                <span>⚡</span>
                <span>일간 배수 추종 & 단기 방향성 매매</span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-neutral-600">
                기초지수 <strong>&apos;일간(Daily)&apos;</strong> 수익률의 +2배(레버리지) 또는 -1배/-2배(인버스/곱버스)를 추종하며, 단기 급등락 국면의 방향성 베팅과 포트폴리오 하락 헤지에 최적화되어 있습니다.
              </p>
            </div>

            <div className="rounded-lg border border-rose-100 bg-white/90 p-2.5 shadow-2xs">
              <div className="flex items-center gap-1.5 font-extrabold text-rose-950 text-xs">
                <span>⚠️</span>
                <span>음의 복리(변동성 잠식) & 장기 보유 금지</span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-neutral-600">
                기초지수가 등락을 반복하는 횡보장에서는 지수가 제자리로 돌아와도 <strong>ETF 기준가는 지속적으로 깎여나갑니다(원금 잠식)</strong>. 장기 적립식 투자는 절대 금물입니다.
              </p>
            </div>
          </div>

          <p className="mt-2 text-[10.5px] font-semibold text-rose-900/80 flex items-center gap-1">
            <span>💡</span>
            <span>연금계좌(DC/IRP/연금저축) 편입 불가 · 매수 전 기본예탁금(최소 1천만원) 및 금융투자협회 사전의무교육 필수</span>
          </p>
        </div>
      ) : null}
      {state.mode === "covered_call" ? (
        <div className="mt-2.5 rounded-xl border border-amber-200/80 bg-amber-50/50 p-2.5 sm:p-3 text-xs sm:text-sm">
          <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-amber-200/60">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center rounded-md bg-amber-600 px-2 py-0.5 text-[11px] font-extrabold text-white tracking-tight">
                월배당 인컴 & 옵션 매도 전략
              </span>
              <span className="text-[11px] font-bold text-amber-950">
                자본시장법 제101조 분배금 성격 및 원금 손실 유의
              </span>
            </div>
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-900 tabular-nums">
              전 종목 {modeEtfs.length}개 (퇴직연금 {coveredCallPensionCount}개 적격)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
            <div className="rounded-lg border border-amber-100 bg-white/90 p-2.5 shadow-2xs">
              <div className="flex items-center gap-1.5 font-extrabold text-amber-950 text-xs">
                <span>📈</span>
                <span>상방 제한 & 하방 개방 (비대칭 손익 구조)</span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-neutral-600">
                주가 상승 시 콜옵션 매도로 상승 참여가 제한(Cap)되는 반면, 하락 시에는 프리미엄 방어분을 초과하는 <strong>원금 손실 위험을 온전히 부담</strong>합니다.
              </p>
            </div>

            <div className="rounded-lg border border-amber-100 bg-white/90 p-2.5 shadow-2xs">
              <div className="flex items-center gap-1.5 font-extrabold text-amber-950 text-xs">
                <span>⚠️</span>
                <span>제자리 깎기(원금 분배) & TR 수익률 확인</span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-neutral-600">
                고배당 분배금의 일부는 운용수익이 아닌 <strong>투자 원금 환급(자본 잠식)</strong>일 수 있습니다. 순수 주가가 아닌 &apos;분배금 재투자(TR)&apos; 총수익률을 반드시 비교해야 합니다.
              </p>
            </div>
          </div>

          <p className="mt-2 text-[10.5px] font-semibold text-amber-900/80 flex items-center gap-1">
            <span>💡</span>
            <span>퇴직연금(DC/IRP): 주식형({coveredCallEquityCount}개)은 위험자산 70%, 채권·혼합형({coveredCallBondCount}개)은 안전자산 100% 적격 · 목표 분배율은 미보장</span>
          </p>
        </div>
      ) : null}
      {state.mode === "new" ? (
        <div className="mt-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-2.5 sm:p-3 text-xs sm:text-sm">
          <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-emerald-200/60">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-extrabold text-white tracking-tight">
                최신 트렌드 & 상장 90일 탐색
              </span>
              <span className="text-[11px] font-bold text-emerald-950">
                순자산 규모 제한 해제 (1,000억 미만 전 종목 전수 노출)
              </span>
            </div>
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-900 tabular-nums">
              전 종목 {modeEtfs.length}개 (퇴직연금 100% 적격)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
            <div className="rounded-lg border border-emerald-100 bg-white/90 p-2.5 shadow-2xs">
              <div className="flex items-center gap-1.5 font-extrabold text-emerald-950 text-xs">
                <span>🚀</span>
                <span>최신 테마 발굴 & 규모 제한 해제</span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-neutral-600">
                순자산 1,000억 이상 필터에 가려지지 않고 최근 90일 내 상장된 모든 신규 종목을 투명하게 노출하여, AI·빅테크 등 시장의 <strong>가장 빠른 혁신 테마</strong>를 선점할 수 있습니다.
              </p>
            </div>

            <div className="rounded-lg border border-emerald-100 bg-white/90 p-2.5 shadow-2xs">
              <div className="flex items-center gap-1.5 font-extrabold text-emerald-950 text-xs">
                <span>⚠️</span>
                <span>초기 괴리율(지정가 매수) & 결산 전 보수 유의</span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-neutral-600">
                상장 초기 얇은 호가로 인한 가격 왜곡 방지를 위해 <strong>시장가 대신 &apos;지정가 주문&apos;을 권장</strong>하며, 최초 결산 전 표기 보수는 운용사 명목보수 기준임에 유의해야 합니다.
              </p>
            </div>
          </div>

          <p className="mt-2 text-[10.5px] font-semibold text-emerald-900/80 flex items-center gap-1">
            <span>💡</span>
            <span>{modeEtfs.length}개 전 종목 DC/IRP 편입 적격 (안전자산 13개 · 위험자산 31개) · 장 시작 직후(09:05 이전) 시장가 매매 지양</span>
          </p>
        </div>
      ) : null}
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
          <div className="flex shrink-0 items-center justify-between gap-3 px-1 sm:ml-auto sm:justify-end sm:px-2">
            <span className="tabular-nums text-sm font-extrabold text-strong">
              {!isStrategyMode ? `순자산 ${selectedScope.summary} · ` : ""}
              {visibleEtfs.length.toLocaleString("ko-KR")}종목
            </span>
            {asOfDate ? <AsOfDate value={asOfDate} /> : null}
          </div>
        </div>

        <div className="mt-3 grid gap-2 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
            {!isStrategyMode ? (
              <label className="flex items-center gap-2 text-xs font-bold text-strong">
                순자산 기준
                <select className="min-h-10 rounded-lg border border-line bg-surface px-2 py-1 text-sm font-semibold text-strong" onChange={(e) => setExplorerState({ scope: e.target.value as AumScope })} value={state.scope}>
                  {scopeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            ) : (
              <span className="w-fit shrink-0 rounded-full bg-brand-100 px-3 py-1.5 text-xs font-extrabold text-brand-900">
                {state.mode === "mixed_bonds"
                  ? `전 종목 ${modeEtfs.length}개 전수 노출 · 안전자산 100%`
                  : state.mode === "tdf"
                  ? `전 빈티지 ${modeEtfs.length}종 전수 노출`
                  : state.mode === "covered_call"
                  ? `전 종목 ${modeEtfs.length}개 전수 노출 · 월배당 옵션`
                  : state.mode === "derivatives"
                  ? `전 종목 ${modeEtfs.length}개 전수 노출 · 레버리지/인버스`
                  : "0~90일 · 규모 제한 없음"}
              </span>
            )}
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
          <p className="mt-0 text-[11px] font-semibold leading-5 text-muted xl:col-start-2 xl:max-w-[520px] xl:text-right">
            기간 수익률: 기준일 대비 선택 기간({isTrMode ? "분배금 재투자 TR" : "단순 가격 PR"}) / 순자산·거래대금: 기준일
          </p>
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
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 ${
                  selectedVintage === null
                    ? "bg-brand-700 text-white shadow-2xs"
                    : "bg-surface border border-line text-neutral-600 hover:bg-brand-50 hover:text-brand-900"
                }`}
              >
                <span>전체</span>{" "}
                <span className={`text-[11px] font-mono ${selectedVintage === null ? "text-brand-100" : "text-neutral-400"}`}>
                  {modeEtfs.length}
                </span>
              </button>
              {TDF_VINTAGES.map((vintage) => {
                const count = tdfVintageCounts ? tdfVintageCounts[vintage] ?? 0 : 0;
                const isSelected = selectedVintage === vintage;
                return (
                  <button
                    key={vintage}
                    type="button"
                    onClick={() => setSelectedVintage(selectedVintage === vintage ? null : vintage)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 ${
                      isSelected
                        ? "bg-brand-700 text-white shadow-2xs"
                        : "bg-surface border border-line text-neutral-600 hover:bg-brand-50 hover:text-brand-900"
                    }`}
                  >
                    <span>{vintage}</span>{" "}
                    <span className={`text-[11px] font-mono ${isSelected ? "text-brand-100" : "text-neutral-400"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-muted">💡 내 나이 맞춤:</span>
              {TDF_AGE_RECOMMENDATIONS.map((rec) => {
                const isSelected = selectedVintage === rec.vintage;
                return (
                  <button
                    key={rec.label}
                    type="button"
                    onClick={() => setSelectedVintage(selectedVintage === rec.vintage ? null : rec.vintage)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300"
                        : "bg-indigo-50 border border-indigo-200 text-indigo-800 hover:bg-indigo-100"
                    }`}
                    title={`${rec.label} (${rec.birth}) 추천 빈티지 ${rec.vintage}`}
                  >
                    {rec.label} ({rec.vintage})
                  </button>
                );
              })}
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
              { value: "all", label: "전체" },
              { value: "30d", label: "🔥 30일 이내" },
              { value: "60d", label: "31~60일" },
              { value: "90d", label: "61~90일" },
            ].map((opt) => {
              const count = newRangeCounts ? newRangeCounts[opt.value as keyof typeof newRangeCounts] ?? 0 : 0;
              const isSelected = selectedNewRange === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelectedNewRange(opt.value as "all" | "30d" | "60d" | "90d")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 ${
                    isSelected
                      ? "bg-brand-700 text-white shadow-2xs"
                      : "bg-surface border border-line text-neutral-600 hover:bg-brand-50 hover:text-brand-900"
                  }`}
                >
                  <span>{opt.label}</span>{" "}
                  <span className={`text-[11px] font-mono ${isSelected ? "text-brand-100" : "text-neutral-400"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {/* 3. 레버리지·인버스 탭 전용 배수 다중 토글 칩 필터 바 */}
        {state.mode === "derivatives" ? (
          <div className="mt-3 pt-3 border-t border-brand-100 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700 mr-1 flex items-center gap-1">
                <span>⚡ 배수 필터</span>
              </span>
              {[
                {
                  id: "lev2x" as const,
                  label: "+2X 레버리지",
                  count: derivCounts.lev2x,
                  activeStyle: "bg-emerald-700 text-white shadow-2xs border-emerald-700",
                },
                {
                  id: "inv2x" as const,
                  label: "-2X 곱버스",
                  count: derivCounts.inv2x,
                  activeStyle: "bg-purple-950 text-purple-100 shadow-2xs border-purple-950",
                },
                {
                  id: "inv1x" as const,
                  label: "-1X 인버스",
                  count: derivCounts.inv1x,
                  activeStyle: "bg-purple-700 text-white shadow-2xs border-purple-700",
                },
              ].map((item) => {
                const checked = activeDerivMultipliers.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleDerivMultiplier(item.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 border cursor-pointer ${
                      checked
                        ? item.activeStyle
                        : "bg-surface border-line text-neutral-400 opacity-60 hover:opacity-100 hover:border-neutral-300"
                    }`}
                  >
                    <span>{item.label}</span>{" "}
                    <span className={`text-[11px] font-mono ${checked ? "text-white/80" : "text-neutral-400"}`}>
                      {item.count}
                    </span>
                  </button>
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

        {/* 4. 커버드콜 탭 전용 5대 실전 테마 퀵 필터 바 */}
        {state.mode === "covered_call" ? (
          <div className="mt-3 pt-3 border-t border-brand-100 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700 mr-1 flex items-center gap-1">
                <span>📂 투자 테마</span>
              </span>
              {COVERED_CALL_THEMES.map((theme) => {
                const count = coveredCallThemeCounts ? coveredCallThemeCounts[theme.id] ?? 0 : 0;
                const isSelected = selectedCoveredCallTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setSelectedCoveredCallTheme(theme.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 ${
                      isSelected
                        ? "bg-brand-700 text-white shadow-2xs"
                        : "bg-surface border border-line text-neutral-600 hover:bg-brand-50 hover:text-brand-900"
                    }`}
                  >
                    <span>{theme.icon !== "전체" ? theme.icon + " " : ""}{theme.label}</span>{" "}
                    <span className={`text-[11px] font-mono ${isSelected ? "text-brand-100" : "text-neutral-400"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="text-[11px] font-bold text-amber-950/80 hidden sm:block">
              💡 월배당 및 TR(총수익률) 비교 필수
            </div>
          </div>
        ) : null}

        {/* 5. 혼합채권 탭 전용 5대 투자 유형 퀵 필터 바 */}
        {state.mode === "mixed_bonds" && mixedBondCounts ? (
          <div className="mt-3 pt-3 border-t border-brand-100 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700 mr-1 flex items-center gap-1">
                <span>🎯 투자 유형</span>
              </span>
              {MIXED_BOND_CATEGORIES.map((cat) => {
                const isSelected = selectedMixedBondCategory === cat.id;
                const count = mixedBondCounts[cat.id];
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedMixedBondCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 ${
                      isSelected
                        ? "bg-brand-700 text-white shadow-2xs"
                        : "bg-surface border border-line text-neutral-600 hover:bg-brand-50 hover:text-brand-900"
                    }`}
                  >
                    {cat.emoji ? <span aria-hidden="true">{cat.emoji}</span> : null}
                    <span>{cat.label}</span>{" "}
                    <span className={`text-[11px] font-mono ${isSelected ? "text-brand-100" : "text-neutral-400"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="text-[11px] font-bold text-indigo-950/80 hidden sm:block">
              💡 퇴직연금 30% 안전자산 한도 100% 편입 가능
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

      <div className="mt-5 rounded-2xl border border-line bg-surface w-full max-w-full min-w-0 overflow-x-auto lg:overflow-x-visible [scrollbar-width:thin] overscroll-x-contain" ref={tableWrapperRef}>
        <div className="w-full max-w-full min-w-0">
          <table className={`w-full border-separate border-spacing-0 text-left text-sm whitespace-nowrap ${isFullPeriods ? "min-w-[1100px]" : "min-w-[770px]"}`}><caption className="sr-only">{copy.title} 목록과 기간별 가격 수익률</caption>
            {/* 명시적 열 너비 제어 */}
            <colgroup>
              <col style={{ width: 130, minWidth: 120 }} />
              {displayPeriods.map((period) => (
                <col key={period} style={{ width: 62, minWidth: 54 }} />
              ))}
              <col style={{ width: 56, minWidth: 52 }} />
              <col style={{ width: 68, minWidth: 60 }} />
              <col style={{ width: 68, minWidth: 60 }} />
              <col style={{ width: 68, minWidth: 60 }} />
            </colgroup>
            
            {/* 2단 헤더 (윈도우 스크롤 시 상단 밀착 고정) */}
            <thead className="relative z-10 lg:sticky lg:top-[var(--site-header-height,140px)] lg:z-30 border-b-2 border-neutral-300 bg-neutral-100 text-[12px] sm:text-[13px] font-bold text-neutral-700 shadow-sm">
              {/* 1단 그룹 헤더 */}
              <tr className="border-b border-neutral-200">
                <th className="sticky left-0 z-20 h-[30px] sm:h-[32px] w-[130px] min-w-[120px] sm:w-[180px] sm:min-w-[180px] bg-neutral-100 px-1.5 sm:px-3 py-0 text-center shadow-[1px_0_0_0_#e5e5e5]" colSpan={productInfoColSpan} scope="colgroup">상품 정보</th>
                <th className="h-[30px] sm:h-[32px] bg-neutral-50 px-2 py-0 text-center border-l border-neutral-200" colSpan={returnsColSpan} scope="colgroup">
                  <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                    <span>수익률(%)</span>
                    <button
                      type="button"
                      onClick={() => setIsTrMode((prev) => !prev)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] sm:text-[10px] font-bold rounded-full transition-all active:scale-95 border cursor-pointer ${
                        isTrMode
                          ? "bg-brand-50 border-brand-300 text-brand-700 shadow-xs"
                          : "bg-white border-neutral-200 text-neutral-600 hover:text-brand-800 hover:bg-neutral-100"
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
                      className="group relative inline-flex items-center justify-center w-5 h-5 rounded-full text-neutral-400 hover:text-neutral-600 cursor-pointer"
                      aria-label="TR 모드 안내"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      {/* Desktop Tooltip */}
                      <div className="hidden sm:block absolute left-1/2 bottom-[calc(100%+8px)] -translate-x-1/2 w-64 max-w-[calc(100vw-32px)] p-3 rounded-xl bg-slate-900/98 backdrop-blur-md text-white text-left shadow-2xl border border-slate-700/90 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-[120] text-[11px] font-normal tracking-tight leading-snug whitespace-normal break-keep">
                        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-900/98" />
                        <strong>TR(Total Return) 모드 안내</strong><br/>
                        <span className="text-brand-300 font-bold mt-1.5 block">분배금 100% 전액 재투자 (세전 Gross TR)</span>
                        <p className="text-neutral-200">분배금을 세금 차감 없이 전액 재투자했을 때의 복리 총수익률을 표시합니다. (ISA·연금저축 등 과세이연 계좌 기준)</p>
                        <p className="text-neutral-300 text-[10.5px] mt-1.5 pt-1.5 border-t border-slate-700/60">💡 상장 기간이 미달되거나 TR 미산출 종목은 정합성을 위해 하이픈(—)으로 표기됩니다.</p>
                      </div>
                    </button>
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
                <th className="sticky left-0 z-20 w-[130px] min-w-[120px] sm:w-[180px] sm:min-w-[180px] bg-neutral-100 px-1.5 sm:px-3 py-0 h-[44px] sm:h-[48px] text-center shadow-[1px_0_0_0_#e5e5e5] border-b-2 border-neutral-300" scope="col">종목 정보</th>
                
                {displayPeriods.map((period, index) => {
                  const isYtd = period === "ytd" || period === "itd";
                  const borderL = isYtd ? 'border-l-2 border-neutral-200' : index === 0 ? 'border-l border-neutral-200' : '';
                  const isSorted = state.sort === "return" && normalizedPeriod === period;
                  const bg = isSorted ? "bg-brand-100 text-brand-900" : "bg-neutral-50";
                  return (
                    <th 
                      aria-label={`${RETURN_PERIOD_LABELS[period]} 수익률`} 
                      className={`h-[44px] sm:h-[48px] min-w-[54px] sm:min-w-[60px] px-1 sm:px-1.5 py-0 text-right ${borderL} ${bg} border-b-2 border-neutral-300 cursor-pointer select-none hover:bg-brand-50 transition-colors`} 
                      key={period} 
                      scope="col"
                      onClick={() => {
                        if (state.sort === "return" && normalizedPeriod === period) {
                          setExplorerState({ direction: state.direction === "desc" ? "asc" : "desc" });
                        } else {
                          setExplorerState({ sort: "return", period, direction: "desc" });
                        }
                      }}
                      title={isTrMode ? `${RETURN_PERIOD_LABELS[period]} 분배금 재투자(TR) 총수익률 (클릭 시 정렬)` : `${RETURN_PERIOD_LABELS[period]} 가격 수익률 (클릭 시 정렬)`}
                    >
                      <div className="flex items-center justify-end gap-0.5">
                        <span className="whitespace-nowrap text-[10.5px] sm:text-[11px] tracking-tighter font-bold text-strong block text-right pr-0.5">{RETURN_PERIOD_LABELS[period]}</span>
                        {isSorted && (
                          <span className="text-[9px] font-black text-brand-700" aria-hidden="true">{state.direction === "desc" ? "▼" : "▲"}</span>
                        )}
                      </div>
                    </th>
                  );
                })}
                
                <th aria-label="투자자 실부담 총비용, 단위 퍼센트" className="min-w-[58px] sm:min-w-[64px] h-[44px] sm:h-[48px] bg-neutral-100 px-1 sm:px-1.5 py-0 text-right border-l border-neutral-200 border-b-2 border-neutral-300" scope="col"><UnitHeaderLabel align="right" label="실부담비용" unit="%" /></th>
                <th 
                  aria-label="순자산, 단위 억원" 
                  className={`min-w-[58px] sm:min-w-[64px] h-[44px] sm:h-[48px] px-1 sm:px-1.5 py-0 text-right border-b-2 border-neutral-300 cursor-pointer select-none hover:bg-brand-50 transition-colors ${state.sort === "aum" ? "bg-brand-100 text-brand-900" : "bg-neutral-100"}`} 
                  scope="col"
                  onClick={() => {
                    if (state.sort === "aum") {
                      setExplorerState({ direction: state.direction === "desc" ? "asc" : "desc" });
                    } else {
                      setExplorerState({ sort: "aum", direction: "desc" });
                    }
                  }}
                  title="순자산 기준 정렬 (클릭 시 오름차순/내림차순 토글)"
                >
                  <div className="flex items-center justify-end gap-0.5">
                    <UnitHeaderLabel align="right" label="순자산" unit="억원" />
                    {state.sort === "aum" && (
                      <span className="text-[9px] font-black text-brand-700" aria-hidden="true">{state.direction === "desc" ? "▼" : "▲"}</span>
                    )}
                  </div>
                </th>
                <th 
                  aria-label="거래대금, 단위 억원" 
                  className={`min-w-[58px] sm:min-w-[64px] h-[44px] sm:h-[48px] px-1 sm:px-1.5 py-0 text-right border-b-2 border-neutral-300 cursor-pointer select-none hover:bg-brand-50 transition-colors ${state.sort === "tradeValue" ? "bg-brand-100 text-brand-900" : "bg-neutral-100"}`} 
                  scope="col"
                  onClick={() => {
                    if (state.sort === "tradeValue") {
                      setExplorerState({ direction: state.direction === "desc" ? "asc" : "desc" });
                    } else {
                      setExplorerState({ sort: "tradeValue", direction: "desc" });
                    }
                  }}
                  title="거래대금 기준 정렬 (클릭 시 오름차순/내림차순 토글)"
                >
                  <div className="flex items-center justify-end gap-0.5">
                    <UnitHeaderLabel align="right" label="거래대금" unit="억원" />
                    {state.sort === "tradeValue" && (
                      <span className="text-[9px] font-black text-brand-700" aria-hidden="true">{state.direction === "desc" ? "▼" : "▲"}</span>
                    )}
                  </div>
                </th>
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
                  <tr className="group bg-surface transition-colors hover:bg-neutral-100 even:bg-neutral-50/60 h-[48px]" data-index={virtualRow.index} key={etf.ticker}>
                    {/* 1. 종목 정보 (Sticky Left Column - 2단 통합) */}
                    <th className="sticky left-0 z-10 bg-white group-even:bg-neutral-50/90 group-hover:bg-neutral-100 w-[130px] min-w-[120px] sm:w-[180px] sm:min-w-[180px] max-w-[210px] px-1.5 sm:px-3 py-1.5 text-left shadow-[1px_0_0_0_#e5e5e5] transition-colors" scope="row">
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

                            {/* TDF 빈티지 및 주식비중 뱃지 */}
                            {state.mode === "tdf" && tdfInfo ? (
                              <>
                                <span className="rounded bg-indigo-50 border border-indigo-200 px-1 py-0.2 text-[9.5px] font-bold text-indigo-800">
                                  {tdfInfo.vintage} 빈티지 · 주식~{tdfInfo.equityPct}%
                                </span>
                                <span className="rounded bg-emerald-50 border border-emerald-200 px-1 py-0.2 text-[9.5px] font-bold text-emerald-800">
                                  적격 100%편입
                                </span>
                              </>
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

                            {/* 커버드콜 전용 분배율 실적, 옵션 태그 및 퇴직연금 편입 한도 뱃지 */}
                            {isCoveredCall ? (
                              <>
                                {getCoveredCallTag(etf.name) ? (
                                  <span className="rounded bg-amber-50 border border-amber-200 px-1 py-0.2 text-[9.5px] font-bold text-amber-800">
                                    {getCoveredCallTag(etf.name)}
                                  </span>
                                ) : null}
                                {etf.distributionYield != null ? (
                                  <span className="rounded bg-emerald-50 border border-emerald-200 px-1 py-0.2 text-[9.5px] font-bold text-emerald-800">
                                    연 {etf.distributionYield.toFixed(1)}%{etf.distributionCycle ? ` · ${etf.distributionCycle}` : ""}
                                  </span>
                                ) : (
                                  <span className="text-neutral-400 text-[9.5px]">분배율 —</span>
                                )}
                                {etf.pension === "불가" ? (
                                  <span className="text-rose-800 font-bold text-[9.5px] bg-rose-50 border border-rose-200 px-1 rounded">
                                    연금불가
                                  </span>
                                ) : etf.pensionLimit?.includes("100%") ? (
                                  <span className="text-emerald-800 font-bold text-[9.5px] bg-emerald-50 border border-emerald-200 px-1 rounded">
                                    안전자산100%
                                  </span>
                                ) : (
                                  <span className="text-brand-800 font-bold text-[9.5px] bg-brand-50 border border-brand-200 px-1 rounded">
                                    위험70%
                                  </span>
                                )}
                              </>
                            ) : null}

                            {/* 혼합채권 전용 투자유형 및 안전자산 뱃지 */}
                            {isMixedBonds ? (
                              <>
                                <span className="rounded bg-indigo-50 border border-indigo-200 px-1 py-0.2 text-[9.5px] font-bold text-indigo-800">
                                  {MIXED_BOND_CATEGORIES.find((c) => c.id === getMixedBondSubCategory(etf.name))?.label ?? "혼합채권"}
                                </span>
                                <span className="rounded bg-emerald-50 border border-emerald-200 px-1 py-0.2 text-[9.5px] font-bold text-emerald-800">
                                  안전자산100%
                                </span>
                              </>
                            ) : null}

                            <span className="text-neutral-500 font-medium">{etf.assetClass}</span>
                            {fields.marketScope && fields.marketScope !== "국내" ? <span className="text-neutral-400">· {fields.marketScope}</span> : null}
                            {fields.fxHedge && fields.fxHedge !== "노출" && fields.fxHedge !== "비헤지" ? (
                              <span className="text-amber-800 font-bold text-[10px] bg-amber-50 border border-amber-200 px-1 rounded"><FxHedgeMarker value={fields.fxHedge} /></span>
                            ) : null}
                            {!isPension && !isDeriv && !isCoveredCall && etf.pension === "불가" ? (
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
                      const tr = etf.returnsTr || etf.returnsNetTr;
                      const cellValue = isTrMode
                        ? (tr && tr[period] !== undefined && tr[period] !== null ? tr[period] : null)
                        : etf.returns[period];
                      return (
                        <td className={`min-w-[60px] px-1 py-2 text-right font-semibold tabular-nums ${borderL} ${bg}`} key={period}>
                          <ReturnCell showUnit={false} value={cellValue} isTr={isTrMode} />
                        </td>
                      );
                    })}
                    
                    {/* 3. 총보수(실부담) */}
                    <td className="min-w-[64px] px-1 py-1 text-right border-l border-neutral-100 align-middle">
                      <FeeDoubleStack etf={etf} />
                    </td>
                    {/* 4. 순자산 */}
                    <td className={`min-w-[64px] px-1 py-2 text-right font-semibold tabular-nums text-strong ${state.sort === "aum" ? "bg-brand-50" : ""}`}>{formatAumNumber(etf.aum)}</td>
                    {/* 5. 거래대금 */}
                    <td className={`min-w-[64px] px-1 py-2 text-right font-semibold tabular-nums text-strong ${state.sort === "tradeValue" ? "bg-brand-50" : ""}`}>{formatTradeValueNumber(etf.tradeValue)}</td>
                    {/* 6. 종가 */}
                    <td className="min-w-[64px] px-1 py-2 text-right font-semibold tabular-nums">{formatWonNumber(etf.close)}</td>
                  </tr>
                );
              })}
              {virtualPaddingBottom > 0 ? <tr aria-hidden="true" style={{ height: virtualPaddingBottom }}><td colSpan={desktopColumnCount} /></tr> : null}
            </tbody>
          </table>


          {!visibleEtfs.length ? (
            <div className="px-5 py-16 text-center">
              <p className="font-extrabold text-strong">조건에 맞는 ETF가 없습니다</p>
              <p className="mt-2 text-sm text-muted">검색어나 필터, 순자산 범위를 조정해 보세요.</p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-brand-700 bg-brand-50 border border-brand-200 rounded-xl hover:bg-brand-100 transition-colors shadow-2xs cursor-pointer"
              >
                <span>🔄 검색 및 필터 초기화</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {showMobileTrTooltip && (
        <div className="fixed inset-0 z-[200] flex items-end sm:hidden bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setShowMobileTrTooltip(false)}>
          <div className="w-full bg-white rounded-t-2xl p-5 pb-8 animate-in slide-in-from-bottom-full duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-neutral-200 rounded-full mx-auto mb-4" />
            <h3 className="text-lg font-bold text-strong mb-1 text-left">TR(Total Return) 모드 안내</h3>
            <div className="space-y-4 mt-5 text-[14px] leading-relaxed text-neutral-600 text-left">
              <div className="bg-brand-50/50 p-3.5 rounded-xl border border-brand-100/50">
                <strong className="text-brand-700 block mb-1">분배금 100% 전액 재투자 (세전 Gross TR)</strong>
                분배금(배당금)을 세금 차감 없이 100% 전액 재투자했을 때의 복리 총수익률입니다. ISA·연금저축 등 과세이연 계좌 기준이며, 일반계좌는 세금 차감 전 기준입니다.
                <p className="text-neutral-500 text-[12px] mt-2 pt-2 border-t border-brand-200/50">💡 상장 기간이 미달되거나 TR 미산출 종목은 정합성을 위해 하이픈(—)으로 표기됩니다.</p>
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
    </div>
  );
}
