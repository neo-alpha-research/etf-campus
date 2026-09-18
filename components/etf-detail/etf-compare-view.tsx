import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { formatMoney, formatFeePct } from "@/lib/domain/etf-format";
import { ReturnCell, AsOfDate, FeeStackedBar } from "@/components/etf";
import type { Etf, ReturnPeriod } from "@/lib/domain/etf-types";
import { RETURN_PERIOD_LABELS } from "@/lib/domain/etf-types";
import { isNewEtfForFeeMasking, getFeeDisplayContext } from "@/lib/domain/etf-fee-utils";
import type { ComparePeriod, SeriesV2Data } from "@/components/compare/etf-compare-timeseries-chart";
import { calculateStartDate } from "@/components/compare/etf-compare-timeseries-chart";
import { normalizeMulti, type SeriesInput } from "@/lib/domain/normalize-series";

type Props = {
  mainEtf?: Etf;
  basket: Etf[];
  onRemove?: (ticker: string) => void;
  mode?: string;
  selectionReasons?: Map<string, string[]>;
  comparisonProfiles?: Map<string, unknown>;
  isTrMode?: boolean;
  onToggleTr?: () => void;
  period?: ComparePeriod;
  seriesMap?: Record<string, SeriesV2Data | null>;
  focusedTicker?: string | null;
};

const CAUTION_REASONS = new Set([
  "환헤지/환노출 불일치",
  "커버드콜 ↔ 일반형 (총수익 비교 주의)",
  "수익 구조 다름 (비교 주의)",
  "만기 구간 다름",
]);

type MetricInfoKey =
  | "pension"
  | "isa"
  | "aum"
  | "tradeValue"
  | "fee"
  | "nominalFee"
  | "disparity"
  | "trackingError"
  | "dividendYield"
  | "dividendCycle"
  | "fxHedge"
  | "listingDate";

interface MetricInfo {
  title: string;
  badge: string;
  desc: string;
  items?: { label: string; text: string; color?: string }[];
  tip?: string;
}

const METRIC_INFOS: Record<MetricInfoKey, MetricInfo> = {
  pension: {
    title: "퇴직연금 (DC·IRP) 편입 한도",
    badge: "감독규정",
    desc: "퇴직연금감독규정 제12조에 따른 계좌 내 편입 가능 한도입니다.",
    items: [
      { label: "100% (안전자산)", text: "채권형 등 전액 편입 가능", color: "text-emerald-300" },
      { label: "70% (위험자산)", text: "주식형 등 최대 70%까지 가능", color: "text-blue-300" },
      { label: "불가", text: "레버리지·선물파생 등 편입 제한", color: "text-neutral-400" },
    ],
  },
  isa: {
    title: "중개형 ISA 편입",
    badge: "절세 계좌",
    desc: "조세특례제한법상 중개형 ISA 계좌 편입 가능 여부입니다.",
    items: [
      { label: "일반 ETF", text: "전액 비과세/분리과세 혜택 가능", color: "text-indigo-300" },
      { label: "레버리지/인버스", text: "금융투자교육원 사전교육 및 기본예탁금 필요", color: "text-amber-300" },
    ],
  },
  aum: {
    title: "순자산 (AUM)",
    badge: "규모",
    desc: "ETF가 실제로 운용하는 전체 자산의 총 규모입니다.",
    tip: "규모가 클수록 상장폐지 위험이 낮고 호가가 촘촘하여 매매가 유리합니다.",
  },
  tradeValue: {
    title: "일일 거래대금",
    badge: "유동성 (1일)",
    desc: "최근 1영업일 동안 시장에서 실제 거래된 총액입니다.",
    tip: "유동성이 풍부할수록 원하는 가격과 수량으로 즉시 체결하기 수월합니다.",
  },
  fee: {
    title: "실부담비용이란?",
    badge: "실제 차감 총비용",
    desc: "기본 간판 운용보수 외에 숨은 비용(주식 매매중개수수료 + 회계/전산 기타비용)을 합산한 투자자 실제 부담 총비용입니다.",
    items: [
      { label: "명목보수", text: "기본 간판 운용 수수료", color: "text-brand-300" },
      { label: "기타비용", text: "예탁원·지수사용 펀드 유지비", color: "text-sky-300" },
      { label: "매매수수료", text: "주식 매매 시 발생하는 거래비용", color: "text-orange-300" },
    ],
    tip: "별도 납부 없이 매일 펀드 순자산(수익률)에서 자동 차감되므로, 동일 지수를 추종한다면 실부담비용이 낮은 ETF를 선택하는 것이 장기 성과에 유리합니다.",
  },
  nominalFee: {
    title: "기본 운용보수 (명목 총보수)",
    badge: "간판 보수",
    desc: "운용사 상품 설명서 및 증권사 화면에 공식 고시되는 기본 간판 총보수(집합투자·신탁·사무관리·판매보수 합계)입니다.",
    tip: "실제 투자자가 매일 펀드 순자산에서 부담하는 비용은 여기에 기타비용과 매매수수료가 합산된 [실부담비용]이므로, 반드시 실부담비용과 함께 비교해야 합니다.",
  },
  disparity: {
    title: "괴리율이란?",
    badge: "시장가 vs 실제가치",
    desc: "주식시장에서 거래되는 현재 가격이 ETF의 진짜 가치(NAV) 대비 얼마나 웃돈이나 할인이 붙었는지 나타내는 지표입니다.",
    items: [
      { label: "+ (양수)", text: "실제 가치보다 웃돈(고평가)을 주고 사는 상태", color: "text-rose-400" },
      { label: "- (음수)", text: "실제 가치보다 할인(저평가)되어 싸게 사는 상태", color: "text-blue-400" },
    ],
    tip: "국내 ETF는 +0.5%, 해외 ETF는 +1.0% 이상 비정상적으로 웃돈이 붙었을 때 [고평가 주의] 경고가 켜집니다.",
  },
  trackingError: {
    title: "추적오차율이란?",
    badge: "배당 조정 (TR)",
    desc: "과거 1년간 ETF 순자산가치(NAV)가 목표 기초지수를 얼마나 똑같이 따라갔는지 나타내는 운용 복제 정밀도(표준편차)입니다.",
    tip: "배당금(분배금) 효과를 금융공학적으로 보정한 [순수 운용 추적오차(TR 기준)]이며, 숫자가 낮을수록 지수를 오차 없이 안정적으로 복제하고 있음을 의미합니다.",
  },
  dividendYield: {
    title: "연간 분배율 (TTM)",
    badge: "실질 배당 수익률",
    desc: "최근 1년간 지급된 주당 분배금 합계를 현재 가격으로 나눈 실질 연간 배당(분배) 수익률입니다.",
    tip: "고배당 및 커버드콜 ETF의 경우 분배율뿐만 아니라 원금 보전 및 총수익률(TR)을 함께 점검하는 것이 중요합니다.",
  },
  dividendCycle: {
    title: "분배 주기",
    badge: "현금흐름 주기",
    desc: "펀드 운용 수익이나 배당 재원을 투자자에게 지급하는 주기(월배당, 분기배당, 연배당 등)입니다.",
    tip: "정기적인 현금흐름(제2의 월급)이 필요한 은퇴 생활자나 연금 투자자에게는 매월 분배금을 지급하는 월배당 ETF가 적합합니다.",
  },
  fxHedge: {
    title: "환헤지 여부 (FX Hedge)",
    badge: "환율 변동성",
    desc: "해외 자산 투자 시 원/달러 등 환율 변동 위험을 회피(Hedge)하는지, 아니면 환율 변동에 노출(환노출)하는지 구분합니다.",
    items: [
      { label: "환헤지 (H)", text: "환율 변동을 제거하고 기초자산 가격 변동만 추종", color: "text-amber-300" },
      { label: "환노출 (UH)", text: "기초자산 가격 변동 + 환율 변동이 동시에 수익률에 반영", color: "text-sky-300" },
    ],
    tip: "달러 강세(원화 약세) 국면에서는 환노출이 유리하고, 달러 약세(원화 강세) 국면에서는 환헤지(H)가 상대적으로 안정적입니다.",
  },
  listingDate: {
    title: "상장일 (운용 역사)",
    badge: "트랙레코드",
    desc: "한국거래소(KRX)에 해당 ETF가 최초로 상장되어 시장 매매가 개시된 일자입니다.",
    tip: "상장 역사가 오래된 ETF일수록 다양한 시장 변동성 국면(상승장·하락장·위기)을 겪으며 검증된 운용 트랙레코드를 보유하고 있습니다.",
  },
};

function formatListingDate(d?: string | null): string {
  if (!d) return "-";
  const clean = d.replace(/[.\-]/g, "");
  if (clean.length === 8) {
    return `${clean.slice(0, 4)}.${clean.slice(4, 6)}.${clean.slice(6, 8)}`;
  }
  return d;
}

function getFxHedgeInfo(etf: Etf) {
  const isDomestic = etf.classification?.marketScope === "국내";
  if (isDomestic) {
    return { type: "domestic" as const, label: "해당없음 (원화)" };
  }
  const isHedged =
    (etf.classification?.fxHedge &&
      etf.classification.fxHedge.includes("헤지") &&
      !etf.classification.fxHedge.includes("비헤지")) ||
    etf.name.includes("(H)");
  if (isHedged) {
    return { type: "hedged" as const, label: "환헤지 (H)" };
  }
  return { type: "unhedged" as const, label: "환노출 (UH)" };
}

export function EtfCompareView({
  mainEtf,
  basket,
  onRemove = () => {},
  mode,
  selectionReasons,
  isTrMode: controlledTrMode,
  onToggleTr,
  period,
  seriesMap,
  focusedTicker,
}: Props) {
  const compareList = useMemo(() => {
    if (!mainEtf) return basket;
    const filtered = basket.filter((e) => e.ticker !== mainEtf.ticker);
    return [mainEtf, ...filtered];
  }, [mainEtf, basket]);

  const [viewMode, setViewMode] = useState<"summary" | "detailed">("detailed");
  const [summaryPeriod, setSummaryPeriod] = useState<ReturnPeriod>("12m");
  const [activeMetricModal, setActiveMetricModal] = useState<MetricInfoKey | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showAllPeriods, setShowAllPeriods] = useState(false);
  const [internalTrMode, setInternalTrMode] = useState(false);

  // Switch to summary view automatically on mobile when 3+ ETFs are compared
  useEffect(() => {
    const mql =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(max-width: 639px)")
        : null;
    if (mql?.matches && compareList.length >= 3) {
      const raf = requestAnimationFrame(() => {
        setViewMode("summary");
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [compareList.length]);

  const isTrMode = controlledTrMode !== undefined ? controlledTrMode : internalTrMode;
  const handleToggleTr = onToggleTr || (() => setInternalTrMode((prev) => !prev));
  
  const getActiveReturns = (etf: Etf) => isTrMode ? (etf.returnsTr || etf.returnsNetTr) : etf.returns;

  const corePeriods: ReturnPeriod[] = ["1m", "3m", "6m", "12m", "ytd"];
  const allPeriods: ReturnPeriod[] = ["1d", "1w", "2w", "1m", "2m", "3m", "6m", "12m", "24m", "36m", "ytd", "itd"];
  const orderedPeriods = showAllPeriods ? allPeriods : corePeriods;

  
  const { maxSyntheticFee, lowestSyntheticTicker } = useMemo(() => {
    if (compareList.length < 2) return { maxSyntheticFee: 0, lowestSyntheticTicker: "" };
    let max = 0;
    let min = Infinity;
    let lowestTicker = "";
    compareList.forEach(e => {
      if (isNewEtfForFeeMasking(e)) return;
      const ctx = getFeeDisplayContext(e);
      // ONLY ETFs with 100% verified 3-tier synthetic fee can receive lowest badge
      if (ctx.type === "synthetic" && ctx.syntheticFee !== null) {
        if (ctx.syntheticFee > max) max = ctx.syntheticFee;
        if (ctx.syntheticFee < min) { min = ctx.syntheticFee; lowestTicker = e.ticker; }
      }
    });
    return { maxSyntheticFee: max, lowestSyntheticTicker: lowestTicker };
  }, [compareList]);

  const maxReturnsByPeriod = useMemo(() => {
    const periods: ReturnPeriod[] = ["1m", "3m", "6m", "12m", "ytd"];
    const result: Partial<Record<ReturnPeriod, number | null>> = {};
    periods.forEach((p) => {
      const vals = compareList
        .map((e) => {
          const ret = isTrMode ? (e.returnsTr || e.returnsNetTr) : e.returns;
          return ret?.[p];
        })
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      result[p] = vals.length > 0 ? Math.max(...vals) : null;
    });
    return result;
  }, [compareList, isTrMode]);

  // Derived series normalization when seriesMap and period are provided
  const normalizedData = useMemo(() => {
    if (!seriesMap || !period) return null;

    let latestDate = "2023-01-02";
    const inputs: SeriesInput[] = [];

    for (const etf of compareList) {
      const sData = seriesMap[etf.ticker];
      if (sData && sData.dates.length > 0) {
        if (sData.asOf > latestDate) {
          latestDate = sData.asOf;
        }
        const values = isTrMode ? sData.tr : sData.close;
        inputs.push({
          ticker: etf.ticker,
          dates: sData.dates,
          values,
          filled: sData.filled,
        });
      }
    }

    if (inputs.length === 0) return null;

    const fromDate = calculateStartDate(latestDate, period);
    const norm = normalizeMulti(inputs, fromDate, latestDate);

    // Compute metrics per ticker
    const metricsMap = new Map<
      string,
      {
        terminalReturn: number | null;
        maxDrawdown: number;
        volatility: number | null;
        positiveDaysRatio: number | null;
      }
    >();

    for (const s of norm.series) {
      if (s.coverage === "insufficient" || s.points.length === 0) {
        metricsMap.set(s.ticker, {
          terminalReturn: null,
          maxDrawdown: 0,
          volatility: null,
          positiveDaysRatio: null,
        });
        continue;
      }

      // Filter valid points
      const validPoints = s.points.filter((p) => p.value !== null);
      let volatility: number | null = null;
      let positiveDaysRatio: number | null = null;

      if (validPoints.length >= 2) {
        let posCount = 0;
        let totalDailyChanges = 0;
        const dailyReturns: number[] = [];

        for (let i = 1; i < validPoints.length; i++) {
          const prev = validPoints[i - 1].value!;
          const curr = validPoints[i].value!;
          const denom = 100 + prev;
          if (denom !== 0) {
            const r = (curr - prev) / denom;
            dailyReturns.push(r);
            if (curr > prev) {
              posCount++;
            }
            totalDailyChanges++;
          }
        }

        if (totalDailyChanges > 0) {
          positiveDaysRatio = (posCount / totalDailyChanges) * 100;
        }

        if (dailyReturns.length >= 2) {
          const mean = dailyReturns.reduce((acc, v) => acc + v, 0) / dailyReturns.length;
          const variance =
            dailyReturns.reduce((acc, v) => acc + (v - mean) ** 2, 0) /
            (dailyReturns.length - 1);
          const dailyStd = Math.sqrt(variance);
          volatility = dailyStd * Math.sqrt(252) * 100;
        }
      }

      metricsMap.set(s.ticker, {
        terminalReturn: s.terminalReturn,
        maxDrawdown: s.maxDrawdown,
        volatility,
        positiveDaysRatio,
      });
    }

    return metricsMap;
  }, [compareList, seriesMap, period, isTrMode]);

  const maxSelectedReturn = useMemo(() => {
    let max = -Infinity;
    for (const etf of compareList) {
      const v = normalizedData
        ? normalizedData.get(etf.ticker)?.terminalReturn ?? null
        : (isTrMode ? (etf.returnsTr || etf.returnsNetTr) : etf.returns)?.[summaryPeriod] ?? null;
      if (typeof v === "number" && Number.isFinite(v) && v > max) {
        max = v;
      }
    }
    return max === -Infinity ? null : max;
  }, [compareList, normalizedData, isTrMode, summaryPeriod]);

  const activePeriodLabel = period
    ? (period === "1M" ? "1개월" : period === "3M" ? "3개월" : period === "6M" ? "6개월" : period === "1Y" ? "1년" : "3년")
    : RETURN_PERIOD_LABELS[summaryPeriod];

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    
    el.scrollLeft = 0;
    setIsScrolled(false);

    const handleScroll = () => {
      setIsScrolled(el.scrollLeft > 5);
    };
    
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [compareList]);

  const shadowClass = isScrolled ? "shadow-[4px_0_12px_-4px_rgba(0,0,0,0.08)]" : "";

  if (compareList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/50">
        <div className="size-12 rounded-full bg-neutral-200 flex items-center justify-center mb-4">
          <svg className="size-6 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-strong mb-1">비교할 ETF가 없습니다</h3>
        <p className="text-sm text-muted max-w-[260px]">비교함에 ETF를 추가하여 핵심 정보와 성과를 한눈에 비교해보세요.</p>
      </div>
    );
  }

  const validTrades = compareList.map((e) => e.tradeValue).filter((t): t is number => typeof t === "number" && t > 0);
  const maxTrade = validTrades.length > 0 ? Math.max(...validTrades) : null;

  const validAums = compareList.map((e) => e.aum).filter((a): a is number => typeof a === "number" && a > 0);
  const maxAum = validAums.length > 0 ? Math.max(...validAums) : null;

  const validDivYields = compareList
    .map((e) => e.distributionYield)
    .filter((y): y is number => typeof y === "number" && y > 0);
  const maxDivYield = validDivYields.length > 0 ? Math.max(...validDivYields) : 0;

  return (
    <div className="space-y-3">
      {/* View Mode Switcher and Date Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div className="inline-flex p-1 rounded-xl bg-neutral-100 border border-neutral-200 text-xs font-bold w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setViewMode("detailed")}
            className={`flex-1 sm:flex-initial px-3 sm:px-3.5 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              viewMode === "detailed"
                ? "bg-white text-brand-800 shadow-xs font-black"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            <span>📊 상세 스펙 비교표</span>
            <span className="text-[10px] text-neutral-400 font-normal hidden sm:inline">(좌우 스크롤)</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("summary")}
            className={`flex-1 sm:flex-initial px-3 sm:px-3.5 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              viewMode === "summary"
                ? "bg-white text-brand-800 shadow-xs font-black"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            <span>⚡ 5종목 한눈에 뷰</span>
            {compareList.length >= 3 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-brand-100 text-brand-700 font-black sm:hidden">
                추천
              </span>
            )}
          </button>
        </div>

        {mode !== "peer-readonly" && compareList[0]?.asOfDate && (
          <div className="flex justify-end items-center pr-1 text-xs text-neutral-500">
            <AsOfDate value={compareList[0]?.asOfDate} />
          </div>
        )}
      </div>

      {/* VIEW 1: 5-ETF TRANSPOSED SUMMARY VIEW (RESPONSIVE HYBRID) */}
      {viewMode === "summary" && (
        <div className="relative rounded-2xl border border-line bg-surface overflow-hidden shadow-sm animate-in fade-in duration-200">
          {/* Period selector & dashboard toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-neutral-50 border-b border-neutral-200 text-xs">
            {/* Mobile: single period selector */}
            {period ? (
              <div className="flex md:hidden items-center gap-1.5 py-1">
                <span className="font-extrabold text-neutral-600 text-[11px]">선택 기간:</span>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-white text-brand-800 shadow-2xs border border-neutral-200">
                  {activePeriodLabel}
                </span>
              </div>
            ) : (
              <div className="flex md:hidden items-center gap-1.5 overflow-x-auto py-1">
                <span className="font-extrabold text-neutral-600 text-[11px]">수익률 기준:</span>
                <div className="inline-flex rounded-lg bg-neutral-200/80 p-0.5">
                  {(["1m", "3m", "6m", "12m", "ytd"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSummaryPeriod(p)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                        summaryPeriod === p
                          ? "bg-white text-brand-800 shadow-2xs font-black"
                          : "text-neutral-600 hover:text-neutral-900"
                      }`}
                    >
                      {RETURN_PERIOD_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Desktop: High-density Executive Dashboard Header */}
            <div className="hidden md:flex items-center gap-2">
              <span className="font-extrabold text-brand-900 text-xs">⚡ 5종목 핵심 지표 대시보드</span>
              <span className="text-[11px] text-neutral-400 font-normal">
                (성과 · 위험 · 실부담비용 · 순자산 · 유동성 · 괴리율 한눈에 비교)
              </span>
            </div>

            {/* TR Toggle Button (Shared & Responsive) */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                role="switch"
                aria-checked={isTrMode}
                onClick={handleToggleTr}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-neutral-600 bg-white border border-neutral-200 rounded-lg shadow-2xs hover:text-brand-800 active:scale-95"
              >
                <span>TR {isTrMode ? "ON" : "OFF"}</span>
                <div className={`relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors ${isTrMode ? 'bg-brand-600' : 'bg-neutral-300'}`}>
                  <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${isTrMode ? 'translate-x-3' : 'translate-x-0.5'}`} />
                </div>
              </button>
            </div>
          </div>

          {/* Unified Responsive Table: 4 cols on mobile, 10 cols executive table on desktop */}
          <div className="overflow-x-auto [scrollbar-width:thin]">
            <table className="w-full text-left border-collapse table-fixed min-w-full md:min-w-[860px]">
              <thead className="bg-neutral-100 border-b border-neutral-200 text-[11px] font-black text-neutral-600">
                <tr>
                  {/* 1. ETF 종목: Mobile 35%, Desktop 22% */}
                  <th className="py-2.5 px-2 sm:px-3 text-left w-[35%] md:w-[22%]">ETF 종목</th>

                  {/* 2. Mobile-only: Selected Period Return */}
                  <th className="py-2.5 px-1 sm:px-1.5 text-right whitespace-nowrap md:hidden w-[21%]">
                    {activePeriodLabel} 수익률
                  </th>

                  {/* 3. Desktop-only: Selected Period Return */}
                  <th className="py-2.5 px-1.5 text-right whitespace-nowrap hidden md:table-cell md:w-[8.5%]">
                    {activePeriodLabel} 수익률
                  </th>

                  {/* 4. Desktop-only: MDD */}
                  <th className="py-2.5 px-1.5 text-right whitespace-nowrap hidden md:table-cell md:w-[7.5%]">
                    최대낙폭(MDD)
                  </th>

                  {/* 5. Desktop-only: 변동성 */}
                  <th className="py-2.5 px-1.5 text-right whitespace-nowrap hidden md:table-cell md:w-[7%]">
                    변동성
                  </th>

                  {/* 6. Desktop-only: 상승일 비율 */}
                  <th className="py-2.5 px-1.5 text-right whitespace-nowrap hidden md:table-cell md:w-[7%]">
                    상승일 비율
                  </th>

                  {/* 7. 실부담비용: Mobile 17%, Desktop 11.5% */}
                  <th className="py-2.5 px-1 sm:px-1.5 text-center whitespace-nowrap w-[17%] md:w-[11.5%]">실부담비용</th>

                  {/* 8. Mobile-only: 순자산/연금 */}
                  <th className="py-2.5 px-1.5 sm:px-3 text-right whitespace-nowrap md:hidden w-[27%]">순자산/연금</th>

                  {/* 9. Desktop-only: 순자산 */}
                  <th className="py-2.5 px-2 text-right whitespace-nowrap hidden md:table-cell md:w-[10%]">순자산</th>

                  {/* 10. Desktop-only: 일 거래대금 */}
                  <th className="py-2.5 px-2 text-right whitespace-nowrap hidden md:table-cell md:w-[9.5%]">일 거래대금</th>

                  {/* 11. Desktop-only: 괴리율 */}
                  <th className="py-2.5 px-1.5 text-center whitespace-nowrap hidden md:table-cell md:w-[8%]">괴리율</th>

                  {/* 12. Desktop-only: 퇴직연금 한도 */}
                  <th className="py-2.5 px-2 text-center whitespace-nowrap hidden md:table-cell md:w-[8%]">퇴직연금</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-xs">
                {compareList.map((etf) => {
                  const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                  const returnVal = normalizedData
                    ? normalizedData.get(etf.ticker)?.terminalReturn ?? null
                    : getActiveReturns(etf)?.[summaryPeriod] ?? null;
                  const isTopReturn = typeof maxSelectedReturn === "number" && returnVal === maxSelectedReturn && compareList.length > 1;

                  const mddVal = normalizedData?.get(etf.ticker)
                    ? normalizedData.get(etf.ticker)!.maxDrawdown
                    : null;
                  const volVal = normalizedData?.get(etf.ticker)
                    ? normalizedData.get(etf.ticker)!.volatility
                    : null;
                  const posDaysVal = normalizedData?.get(etf.ticker)
                    ? normalizedData.get(etf.ticker)!.positiveDaysRatio
                    : null;

                  const ret12M = getActiveReturns(etf)?.["12m"] ?? null;
                  const max12M = maxReturnsByPeriod["12m"];
                  const isTop12M = typeof max12M === "number" && ret12M === max12M && compareList.length > 1;

                  const feeCtx = getFeeDisplayContext(etf);
                  const isLowestFee = etf.ticker === lowestSyntheticTicker;

                  const isTopAum = maxAum !== null && etf.aum === maxAum && compareList.length > 1;
                  const isTopTrade = maxTrade !== null && etf.tradeValue === maxTrade && compareList.length > 1;

                  // Disparity calculation & alert
                  const d = etf.disparity;
                  const hasDisparity = typeof d === "number" && Number.isFinite(d);
                  const isOverseas = etf.classification?.marketScope === "미국" || etf.classification?.marketScope === "글로벌" || etf.classification?.marketScope === "신흥국";
                  const overvalueThreshold = isOverseas ? 1.0 : 0.5;
                  const isAbnormallyOvervalued = hasDisparity && d > overvalueThreshold;

                  // Pension limit label & style
                  const limit = etf.pensionLimit;
                  const is100 = limit?.includes("100%");
                  const is70 = limit?.includes("70%");
                  const pensionLabel = limit
                    ? (is100 ? "안전 100%" : is70 ? "위험 70%" : limit)
                    : (etf.pension === "가능" ? "연금가능" : "불가");
                  const pensionBadgeClass = is100
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : is70
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : etf.pension === "가능"
                    ? "border-brand-200 bg-brand-50 text-brand-700"
                    : "border-neutral-200 bg-neutral-100 text-neutral-400";

                  return (
                    <tr
                      key={etf.ticker}
                      className={`transition-colors ${
                        focusedTicker === etf.ticker
                          ? "bg-blue-50/70 ring-1 ring-inset ring-blue-300 font-semibold"
                          : isBase
                          ? "bg-brand-50/30 font-semibold"
                          : "hover:bg-neutral-50/80"
                      }`}
                    >
                      {/* 1. ETF 종목 info */}
                      <td className="py-2.5 px-2 sm:px-3 align-middle">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-mono font-extrabold text-neutral-400">
                                {etf.ticker}
                              </span>
                              {isBase && (
                                <span className="text-[9px] font-black px-1 rounded bg-brand-100 text-brand-800">
                                  기준
                                </span>
                              )}
                            </div>
                            {!isBase && mode !== "peer-readonly" && (
                              <button
                                type="button"
                                onClick={() => onRemove(etf.ticker)}
                                className="p-0.5 text-rose-400 hover:text-rose-600 transition-colors active:scale-90"
                                aria-label={`${etf.name} 제외하기`}
                                title="제외하기"
                              >
                                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                          <Link
                            href={`/etf/${etf.ticker}`}
                            className="text-[12px] sm:text-[13px] font-black text-strong hover:text-brand-700 transition-colors line-clamp-1 break-words"
                            title={etf.name}
                          >
                            {etf.name}
                          </Link>
                          {/* Smart Advantage Chips */}
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {isLowestFee && (
                              <span
                                data-testid="smart-advantage-badge"
                                className="inline-flex items-center px-1 py-0.2 rounded text-[8.5px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200"
                              >
                                최저 🥇
                              </span>
                            )}
                            {(isTopReturn || isTop12M) && (
                              <span
                                data-testid="smart-advantage-badge"
                                className="inline-flex items-center px-1 py-0.2 rounded text-[8.5px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200"
                              >
                                1위 📈
                              </span>
                            )}
                            {isTopAum && (
                              <span
                                data-testid="smart-advantage-badge"
                                className="inline-flex items-center px-1 py-0.2 rounded text-[8.5px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200"
                              >
                                규모 🏛️
                              </span>
                            )}
                            {isTopTrade && (
                              <span
                                data-testid="smart-advantage-badge"
                                className="inline-flex items-center px-1 py-0.2 rounded text-[8.5px] font-extrabold bg-sky-100 text-sky-800 border border-sky-200"
                              >
                                유동 💧
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Mobile-only Single Period Return */}
                      <td className="py-2.5 px-1 sm:px-1.5 text-right align-middle whitespace-nowrap tabular-nums font-mono md:hidden">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className={`text-[11.5px] sm:text-[13px] font-black ${isTopReturn ? "text-rose-600" : ""}`}>
                            <ReturnCell value={returnVal} isTr={isTrMode} />
                          </span>
                          {isTopReturn && (
                            <span className="text-[8px] sm:text-[8.5px] font-black text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200 font-sans">
                              1위
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 3. Desktop Selected Period Return */}
                      <td className="py-2.5 px-1.5 text-right align-middle whitespace-nowrap tabular-nums font-mono hidden md:table-cell">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className={`text-[12px] font-black ${isTopReturn ? "text-rose-600" : ""}`}>
                            <ReturnCell value={returnVal} isTr={isTrMode} />
                          </span>
                          {isTopReturn && (
                            <span className="text-[8px] font-black text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200 font-sans">
                              1위
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 4. Desktop MDD (최대낙폭) */}
                      <td className="py-2.5 px-1.5 text-right align-middle whitespace-nowrap tabular-nums font-mono hidden md:table-cell">
                        <span className="text-[12px] font-bold text-neutral-700">
                          {mddVal !== null ? `${mddVal.toFixed(2)}%` : "-"}
                        </span>
                      </td>

                      {/* 5. Desktop Volatility (변동성) */}
                      <td className="py-2.5 px-1.5 text-right align-middle whitespace-nowrap tabular-nums font-mono hidden md:table-cell">
                        <span className="text-[12px] font-bold text-neutral-700">
                          {volVal !== null ? `${volVal.toFixed(2)}%` : "-"}
                        </span>
                      </td>

                      {/* 6. Desktop Positive Days Ratio (상승일 비율) */}
                      <td className="py-2.5 px-1.5 text-right align-middle whitespace-nowrap tabular-nums font-mono hidden md:table-cell">
                        <span className="text-[12px] font-bold text-neutral-700">
                          {posDaysVal !== null ? `${posDaysVal.toFixed(1)}%` : "-"}
                        </span>
                      </td>

                      {/* 7. 실부담비용 (Shared) */}
                      <td className="py-2.5 px-1 sm:px-1.5 text-center align-middle whitespace-nowrap tabular-nums font-mono">
                        <div className="flex flex-col items-center gap-0.5">
                          {feeCtx.type === "masked_new" ? (
                            <span className="text-[10px] font-bold text-neutral-400 bg-neutral-100 px-1 py-0.5 rounded font-sans">
                              신규상장*
                            </span>
                          ) : feeCtx.syntheticFee !== null ? (
                            <div className="flex items-center justify-center gap-0.5 text-[11px] sm:text-[12px] font-extrabold text-neutral-800">
                              <span>{feeCtx.syntheticFee.toFixed(2)}%</span>
                              {isLowestFee && (
                                <span className="text-[8.5px] text-emerald-700 font-sans font-black">
                                  🥇
                                </span>
                              )}
                            </div>
                          ) : feeCtx.nominalFee !== null ? (
                            <span className="text-[10.5px] font-bold text-neutral-600">
                              {feeCtx.nominalFee.toFixed(2)}%
                            </span>
                          ) : (
                            <span className="text-neutral-400">-</span>
                          )}
                          {/* Desktop subtext: nominal fee */}
                          {feeCtx.syntheticFee !== null && feeCtx.nominalFee !== null && (
                            <span className="hidden md:inline-block text-[9.5px] text-neutral-400 font-sans font-normal">
                              총보수 {feeCtx.nominalFee.toFixed(2)}%
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 8. Mobile-only 순자산 / 연금 */}
                      <td className="py-2.5 px-1.5 sm:px-3 text-right align-middle whitespace-nowrap tabular-nums md:hidden">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-[10.5px] sm:text-[12px] font-extrabold text-neutral-800 font-mono tracking-tight">
                            {formatMoney(etf.aum)}
                          </span>
                          <span className={`text-[8.5px] sm:text-[9px] font-bold px-1 py-0.2 rounded border ${pensionBadgeClass}`}>
                            {pensionLabel}
                          </span>
                        </div>
                      </td>

                      {/* 9. Desktop-only 순자산 */}
                      <td className="py-2.5 px-2 text-right align-middle whitespace-nowrap tabular-nums hidden md:table-cell">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-[12px] font-extrabold text-neutral-800 font-mono tracking-tight">
                            {formatMoney(etf.aum)}
                          </span>
                          {isTopAum && (
                            <span className="text-[8px] font-black text-indigo-700 bg-indigo-50 px-1 py-0.2 rounded border border-indigo-200 font-sans">
                              순자산 1위 🏛️
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 10. Desktop-only 일 거래대금 */}
                      <td className="py-2.5 px-2 text-right align-middle whitespace-nowrap tabular-nums hidden md:table-cell">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-[12px] font-bold text-neutral-700 font-mono tracking-tight">
                            {formatMoney(etf.tradeValue)}
                          </span>
                          {isTopTrade && (
                            <span className="text-[8px] font-black text-sky-700 bg-sky-50 px-1 py-0.2 rounded border border-sky-200 font-sans">
                              유동성 1위 💧
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 11. Desktop-only 괴리율 */}
                      <td className="py-2.5 px-1.5 text-center align-middle whitespace-nowrap tabular-nums hidden md:table-cell">
                        {hasDisparity ? (
                          <div className="flex flex-col items-center justify-center gap-0.5 font-bold">
                            <span className={`text-[12px] font-mono ${d > 0 ? "text-rose-600" : d < 0 ? "text-blue-600" : "text-neutral-700"}`}>
                              {d > 0 ? `+${d.toFixed(2)}%` : `${d.toFixed(2)}%`}
                            </span>
                            {isAbnormallyOvervalued && (
                              <span className="text-[8px] font-extrabold px-1 py-0.2 rounded border text-rose-800 bg-rose-50 border-rose-300 shadow-2xs leading-none font-sans">
                                ⚠️ 주의
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-neutral-400 text-xs">-</span>
                        )}
                      </td>

                      {/* 12. Desktop-only 퇴직연금 */}
                      <td className="py-2.5 px-2 text-center align-middle whitespace-nowrap hidden md:table-cell">
                        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10.5px] font-bold border ${pensionBadgeClass}`}>
                          {pensionLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer note */}
          <div className="px-3 sm:px-4 py-2.5 bg-neutral-50/70 border-t border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10.5px] text-neutral-500 font-medium">
            <span>* 괴리율, 추적오차율, 보수 세부 내역(기타비용·매매수수료) 등 심층 분석은 [상세 스펙 비교표] 탭에서 확인하실 수 있습니다.</span>
            <span className="font-mono text-neutral-400">{compareList[0]?.asOfDate ? `${compareList[0].asOfDate.replace(/-/g, ".")} 기준` : ""}</span>
          </div>
        </div>
      )}

      {/* VIEW 2: DETAILED SIDE-BY-SIDE COMPARISON TABLE */}
      {viewMode === "detailed" && (() => {
        const hasPlaceholder = compareList.length === 1 && mode !== "peer-readonly";
        const totalCols = hasPlaceholder ? 2 : compareList.length;
        const colWidthPercent = totalCols > 0 ? `${(100 / totalCols).toFixed(2)}%` : "100%";

        // Winner Snapshot Highlights
        const lowestFeeEtf = compareList.find((e) => e.ticker === lowestSyntheticTicker);
        const lowestFeeCtx = lowestFeeEtf ? getFeeDisplayContext(lowestFeeEtf) : null;

        const maxAumEtf = maxAum !== null ? compareList.find((e) => e.aum === maxAum) : null;
        const maxTradeEtf = maxTrade !== null ? compareList.find((e) => e.tradeValue === maxTrade) : null;

        const preferredPeriods: ReturnPeriod[] = ["12m", "ytd", "6m", "3m", "1m"];
        const winnerPeriod = preferredPeriods.find((p) => maxReturnsByPeriod[p] !== null) || "12m";
        const bestPeriodVal = maxReturnsByPeriod[winnerPeriod] ?? null;
        const bestPeriodEtf = bestPeriodVal !== null
          ? compareList.find((e) => getActiveReturns(e)?.[winnerPeriod] === bestPeriodVal)
          : null;

        return (
          <div className="space-y-2.5">
            {/* Top Highlights Winner Snapshot Banner (Option A: Ultra-compact horizontal ribbon) */}
            {compareList.length >= 2 && (
              <div className="flex items-center gap-1.5 sm:gap-2 px-2 py-1 rounded-xl border border-slate-200/80 bg-slate-50/70 text-xs overflow-x-auto [scrollbar-width:none]">
                <div className="flex items-center gap-1 shrink-0 bg-white border border-slate-200/90 px-1.5 py-0.5 rounded shadow-2xs">
                  <span className="text-xs">🏆</span>
                  <span className="text-[10px] sm:text-[10.5px] font-black text-slate-800 tracking-tight whitespace-nowrap">
                    비교군 핵심 지표 1위 스냅샷
                  </span>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  {/* 최저 실부담비용 */}
                  {lowestFeeEtf && lowestFeeCtx?.syntheticFee != null ? (
                    <div className="inline-flex items-center gap-1 bg-white border border-emerald-200/90 rounded px-1.5 py-0.5 shadow-2xs text-[9.5px] sm:text-[10.5px]">
                      <span className="text-slate-500 font-bold whitespace-nowrap">최저비용</span>
                      <span className="font-mono font-black text-emerald-700 whitespace-nowrap">연 {lowestFeeCtx.syntheticFee.toFixed(2)}%</span>
                      <span className="font-bold text-slate-800 max-w-[80px] sm:max-w-[120px] truncate" title={lowestFeeEtf.name}>{lowestFeeEtf.name}</span>
                    </div>
                  ) : null}

                  {/* 최대 순자산 */}
                  {maxAumEtf ? (
                    <div className="inline-flex items-center gap-1 bg-white border border-indigo-200/90 rounded px-1.5 py-0.5 shadow-2xs text-[9.5px] sm:text-[10.5px]">
                      <span className="text-slate-500 font-bold whitespace-nowrap">최대규모</span>
                      <span className="font-mono font-black text-indigo-700 whitespace-nowrap">{formatMoney(maxAumEtf.aum)}</span>
                      <span className="font-bold text-slate-800 max-w-[80px] sm:max-w-[120px] truncate" title={maxAumEtf.name}>{maxAumEtf.name}</span>
                    </div>
                  ) : null}

                  {/* 기간 최고 성과 */}
                  {bestPeriodEtf && bestPeriodVal !== null ? (
                    <div className="inline-flex items-center gap-1 bg-white border border-amber-200/90 rounded px-1.5 py-0.5 shadow-2xs text-[9.5px] sm:text-[10.5px]">
                      <span className="text-slate-500 font-bold whitespace-nowrap">{RETURN_PERIOD_LABELS[winnerPeriod]} 1위</span>
                      <span className="font-mono font-black whitespace-nowrap">
                        <ReturnCell value={bestPeriodVal} isTr={isTrMode} />
                      </span>
                      <span className="font-bold text-slate-800 max-w-[80px] sm:max-w-[120px] truncate" title={bestPeriodEtf.name}>{bestPeriodEtf.name}</span>
                    </div>
                  ) : null}

                  {/* 일 거래대금 */}
                  {maxTradeEtf ? (
                    <div className="inline-flex items-center gap-1 bg-white border border-sky-200/90 rounded px-1.5 py-0.5 shadow-2xs text-[9.5px] sm:text-[10.5px]">
                      <span className="text-slate-500 font-bold whitespace-nowrap">최대유동성</span>
                      <span className="font-mono font-black text-sky-700 whitespace-nowrap">{formatMoney(maxTradeEtf.tradeValue)}</span>
                      <span className="font-bold text-slate-800 max-w-[80px] sm:max-w-[120px] truncate" title={maxTradeEtf.name}>{maxTradeEtf.name}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {/* Table Container */}
            <div className="relative rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-xs animate-in fade-in duration-200">
            <div 
              ref={scrollRef}
              className="relative text-center overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]" 
              role="region" 
              aria-label="ETF 비교 표. 좌우로 스크롤할 수 있습니다." 
              tabIndex={0}
            >
              <table className="w-full min-w-full md:table-fixed border-separate border-spacing-0 text-xs">
                <colgroup>
                  <col className="w-[36px] sm:w-[50px]" style={{ width: "50px" }} />
                  <col className="w-[64px] sm:w-[76px]" style={{ width: "76px" }} />
                  {compareList.map((etf) => (
                    <col key={etf.ticker} style={{ width: colWidthPercent }} />
                  ))}
                  {hasPlaceholder && (
                    <col style={{ width: colWidthPercent }} />
                  )}
                </colgroup>
                <thead className="shadow-[0_1px_0_0_#e2e8f0] bg-slate-50/60">
                  <tr>
                    {/* 1. 구분 열 헤더 */}
                    <th className="sticky left-0 z-40 w-[36px] sm:w-[50px] min-w-[36px] sm:min-w-[50px] max-w-[36px] sm:max-w-[50px] bg-slate-100/95 backdrop-blur px-0.5 py-1 text-center align-middle border-b border-r border-slate-200/80">
                      <span className="text-[9.5px] sm:text-[10.5px] font-extrabold text-slate-500">구분</span>
                    </th>
                    {/* 2. 비교 항목 열 헤더 */}
                    <th className={`sticky left-[36px] sm:left-[50px] z-40 w-[64px] sm:w-[76px] min-w-[64px] sm:min-w-[76px] max-w-[64px] sm:max-w-[76px] bg-slate-50/95 backdrop-blur px-0.5 sm:px-1 py-1 text-center align-middle border-b border-r border-slate-200/70 transition-shadow duration-200 ${shadowClass}`}>
                      <span className="text-[9.5px] sm:text-[10.5px] font-extrabold text-slate-600">비교 항목</span>
                    </th>
                    {compareList.map((etf) => {
                      const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                      const reasons = selectionReasons?.get(etf.ticker) || [];
                      return (
                        <th key={etf.ticker} className={`relative px-1 py-1 min-w-[105px] sm:min-w-[125px] md:min-w-0 border-b border-r border-slate-200/70 font-bold text-strong align-middle transition-colors ${isBase ? "bg-emerald-50/40 border-t-2 border-t-emerald-600 shadow-[inset_0_1px_0_0_#059669]" : "bg-slate-50/70 backdrop-blur-sm"}`}>
                          <div className="flex flex-col items-center justify-center text-center gap-0.5 w-full relative">
                            {/* 상단 티커 + 기준 태그 + 제외(X) 버튼 */}
                            <div className="flex items-center justify-center gap-1 w-full relative min-h-[14px]">
                              {isBase ? (
                                <div className="flex items-center gap-1">
                                  <span className="inline-flex rounded px-1 py-0.2 text-[7.5px] sm:text-[8px] font-black bg-emerald-600 text-white leading-none shadow-2xs font-sans">
                                    기준 ETF
                                  </span>
                                  <span className="text-[9px] sm:text-[10px] font-extrabold tracking-wider font-mono text-emerald-800 group-hover:text-emerald-900 group-hover:underline transition-colors">
                                    {etf.ticker}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[9px] sm:text-[10px] font-extrabold tracking-wider font-mono text-slate-400 group-hover:text-slate-600 group-hover:underline transition-colors">
                                  {etf.ticker}
                                </span>
                              )}
                              {!isBase && mode !== "peer-readonly" && (
                                <button 
                                  onClick={() => onRemove(etf.ticker)}
                                  className="absolute -right-1 -top-0.5 size-4 rounded-full flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all duration-200 group/btn active:scale-90"
                                  aria-label={`${etf.name} 제외하기`}
                                  title="제외하기"
                                >
                                  <svg className="size-2.5 transition-transform duration-200 group-hover/btn:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>

                            {/* 종목명 (여백 없이 컴팩트한 2줄 컨테이너) */}
                            <Link
                              href={`/etf/${etf.ticker}`}
                              onClick={() => {
                                if (typeof window !== "undefined" && window.location.pathname.includes(`/etf/${etf.ticker}`)) {
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                }
                              }}
                              className="group w-full cursor-pointer min-h-[24px] sm:min-h-[26px] flex items-center justify-center px-0.5"
                              title={isBase ? `${etf.name} (${etf.ticker}) [현재 기준 ETF]` : `${etf.name} (${etf.ticker}) 상세 보기`}
                              aria-label={isBase ? `${etf.name} (기준 ETF)` : etf.name}
                            >
                              <span className="text-[10.5px] sm:text-[11.5px] font-bold leading-tight break-words [overflow-wrap:anywhere] line-clamp-2 text-slate-900 group-hover:text-emerald-700 transition-colors text-center" title={etf.name}>
                                {etf.name}
                              </span>
                            </Link>

                            {/* 절세 계좌 적격성 칩 (퇴직연금 한도 + 중개형 ISA) */}
                            {(() => {
                              const limit = etf.pensionLimit;
                              const is100 = limit === "100% (안전자산)";
                              const is70 = limit === "70% (위험자산)";
                              const pensionLabel = is100 ? "연금 100%" : is70 ? "연금 70%" : etf.pension === "가능" ? "연금 가능" : "연금 불가";
                              const pensionBadgeClass = is100
                                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                : is70
                                ? "border-sky-300 bg-sky-50 text-sky-700"
                                : etf.pension === "가능"
                                ? "border-brand-200 bg-brand-50 text-brand-700"
                                : "border-neutral-200 bg-neutral-100 text-neutral-400";

                              const isEdu = etf.riskType === "leverage" || etf.isaEducationRequired === "Y";
                              const isaLabel = isEdu ? "ISA (교육)" : "ISA 가능";
                              const isaBadgeClass = isEdu
                                ? "border-amber-300 bg-amber-50 text-amber-800"
                                : "border-purple-300 bg-purple-100/80 text-purple-800";

                              return (
                                <div className="flex flex-wrap justify-center items-center gap-1">
                                  <span
                                    data-testid="pension-account-chip"
                                    className={`inline-flex items-center rounded px-1.5 py-0.2 text-[7.5px] sm:text-[8px] font-bold border leading-none shadow-2xs ${pensionBadgeClass}`}
                                    title={`퇴직연금(DC·IRP) 편입 한도: ${limit || pensionLabel}`}
                                  >
                                    {pensionLabel}
                                  </span>
                                  <span
                                    data-testid="isa-account-chip"
                                    className={`inline-flex items-center rounded px-1.5 py-0.2 text-[7.5px] sm:text-[8px] font-bold border leading-none shadow-2xs ${isaBadgeClass}`}
                                    title={isEdu ? "중개형 ISA 편입 가능 (사전교육 필요)" : "중개형 ISA 편입 가능"}
                                  >
                                    {isaLabel}
                                  </span>
                                </div>
                              );
                            })()}
                            {mode === "peer-readonly" && !isBase && (
                              (() => {
                                const cautionReasons = reasons.filter((r) => CAUTION_REASONS.has(r));
                                if (cautionReasons.length === 0) return null;
                                return (
                                  <div className="flex flex-wrap justify-center gap-1">
                                    {cautionReasons.map((reason, idx) => (
                                      <span
                                        key={idx}
                                        data-testid="peer-reason-badge"
                                        className="inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[7.5px] sm:text-[8px] font-bold leading-tight border border-amber-300 bg-amber-50 text-amber-900 shadow-2xs"
                                      >
                                        <span aria-hidden="true">⚠️</span> {reason}
                                      </span>
                                    ))}
                                  </div>
                                );
                              })()
                            )}
                          </div>
                        </th>
                      );
                    })}
                    {hasPlaceholder && (
                      <th className="relative px-1.5 py-1 min-w-[105px] sm:min-w-[125px] md:min-w-0 border-b border-r border-slate-200/70 bg-slate-50/40 align-middle text-center font-normal">
                        <button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById("compare-search-input");
                            if (el) {
                              el.focus();
                              el.scrollIntoView({ behavior: "smooth", block: "center" });
                            }
                          }}
                          className="group/add flex flex-col items-center justify-center w-full py-1.5 px-1 rounded-xl border border-dashed border-slate-300 hover:border-emerald-500 bg-white hover:bg-emerald-50/30 transition-all cursor-pointer shadow-2xs active:scale-98"
                          title="상단 검색창으로 이동하여 비교할 ETF를 추가합니다"
                        >
                          <div className="size-3.5 rounded-full bg-emerald-50 group-hover/add:bg-emerald-100 text-emerald-600 flex items-center justify-center font-black text-[9px] mb-0.5 transition-colors">
                            +
                          </div>
                          <span className="text-[10px] sm:text-[11px] font-black text-slate-700 group-hover/add:text-emerald-800 leading-tight">
                            비교할 ETF 추가하기
                          </span>
                          <span className="text-[8px] text-slate-400 font-medium">
                            상단 검색 또는 테마 클릭
                          </span>
                        </button>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs [&>tr:hover]:bg-slate-50/70 [&>tr:nth-child(even)]:bg-slate-50/30 [&>tr:nth-child(even)>th]:!bg-slate-50/90">

                  {/* ────────────────────────────────────────── */}
                  {/* GROUP 1: 규모 및 유동성 (순자산, 일 거래대금) */}
                  {/* ────────────────────────────────────────── */}

                  {/* 순자산 */}
                  <tr className="hover:bg-slate-50/70 hover:z-40 relative">
                    <th
                      rowSpan={2}
                      className="sticky left-0 z-30 w-[36px] sm:w-[50px] min-w-[36px] sm:min-w-[50px] max-w-[36px] sm:max-w-[50px] bg-slate-100/90 text-slate-700 font-extrabold text-[10px] sm:text-[10.5px] text-center align-middle border-b border-r border-slate-200/80 px-0.5 py-0.5 leading-snug"
                    >
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <span className="text-[11px]">📊</span>
                        <span className="sm:hidden text-[8.5px] font-black leading-none">규모</span>
                        <span className="hidden sm:inline break-keep">규모 및 유동성</span>
                      </div>
                    </th>
                    <th className={`sticky left-[36px] sm:left-[50px] z-20 hover:z-50 bg-slate-50/95 backdrop-blur-md px-0.5 sm:px-1 py-0.5 text-[10px] sm:text-[11px] font-semibold text-slate-600 border-b border-r border-slate-200/60 transition-all duration-200 text-center align-middle ${shadowClass}`}>
                      <div className="flex items-center justify-center gap-0.5 group relative w-fit mx-auto">
                        <button
                          type="button"
                          onClick={() => setActiveMetricModal("aum")}
                          aria-label="순자산 (AUM) 안내 보기"
                          className="inline-flex items-center justify-center gap-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-sm group/btn"
                        >
                          <span className="leading-tight group-hover/btn:text-emerald-700 transition-colors">순자산</span>
                          <svg className="size-2.5 text-slate-400 group-hover/btn:text-emerald-600 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        <div className="hidden sm:block absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 w-64 p-3 rounded-xl bg-slate-900/98 backdrop-blur-md text-white text-left shadow-2xl border border-slate-700/80 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none group-focus-within:pointer-events-auto transition-all duration-200 z-[120] whitespace-normal break-keep">
                          <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 border-[6px] border-transparent border-r-slate-900/98" />
                          <div className="flex items-center justify-between gap-1 mb-1 pb-1 border-b border-slate-700/60">
                            <span className="text-[12px] font-black text-brand-300">순자산 (AUM)</span>
                            <span className="text-[9.5px] text-slate-400 font-mono">규모</span>
                          </div>
                          <p className="text-[11.5px] text-neutral-200 leading-snug mb-1 font-medium">
                            ETF가 실제로 운용하는 전체 자산의 총 규모입니다.
                          </p>
                          <div className="text-[11px] text-amber-200/95 bg-amber-500/10 rounded-md p-1.5 leading-snug border border-amber-500/20">
                            <strong className="text-amber-300">💡 팁:</strong> 규모가 클수록 상장폐지 위험이 낮고 호가가 촘촘하여 매매가 유리합니다.
                          </div>
                        </div>
                      </div>
                    </th>
                    {compareList.map((etf) => {
                      const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                      const isTopAum = maxAum !== null && etf.aum === maxAum && compareList.length > 1;
                      const aumPercent = maxAum && etf.aum ? Math.round((etf.aum / maxAum) * 100) : 0;
                      return (
                        <td key={etf.ticker} className={`whitespace-nowrap border-b border-r border-slate-100 relative px-0.5 sm:px-1.5 py-0.5 text-center tabular-nums transition-colors ${isBase ? "bg-emerald-50/30" : ""} text-slate-900 font-extrabold text-[10.5px] sm:text-[11.5px]`}>
                          <div className="relative w-full h-full py-0.5 flex items-center justify-center font-mono">
                            <div className="inline-flex items-center justify-end w-[84px] sm:w-[98px] text-right">
                              {isTopAum && (
                                <span
                                  data-testid="smart-advantage-badge"
                                  className="inline-flex items-center rounded px-0.5 py-0.2 text-[7.5px] sm:text-[8px] font-black leading-none bg-indigo-100/90 text-indigo-900 border border-indigo-300 shadow-2xs font-sans mr-1 shrink-0"
                                  title="비교군 중 순자산(AUM) 1위"
                                >
                                  1위
                                </span>
                              )}
                              <span className="ml-auto text-slate-900">{formatMoney(etf.aum)}</span>
                            </div>
                            {compareList.length > 1 && maxAum && (
                              <div className="absolute bottom-0 left-1 right-1 h-[2px] bg-slate-100/80 rounded-full overflow-hidden pointer-events-none">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${isTopAum ? "bg-indigo-500" : "bg-slate-300"}`}
                                  style={{ width: `${Math.max(aumPercent, 4)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    {hasPlaceholder && (
                      <td className="border-b border-r border-slate-100 px-0.5 sm:px-1 py-0.5 text-center text-neutral-300 bg-slate-50/20 align-middle">
                        <span className="text-xs text-neutral-300 select-none">-</span>
                      </td>
                    )}
                  </tr>

                  {/* 일일 거래대금 */}
                  <tr className="hover:bg-slate-50/70 hover:z-40 relative">
                    <th className={`sticky left-[36px] sm:left-[50px] z-20 hover:z-50 bg-slate-50/95 backdrop-blur-md px-0.5 sm:px-1 py-0.5 text-[10px] sm:text-[11px] font-semibold text-slate-600 border-b border-r border-slate-200/60 transition-all duration-200 text-center align-middle ${shadowClass}`}>
                      <div className="flex items-center justify-center gap-0.5 group relative w-fit mx-auto">
                        <button
                          type="button"
                          onClick={() => setActiveMetricModal("tradeValue")}
                          aria-label="일일 거래대금 (유동성) 안내 보기"
                          className="inline-flex items-center justify-center gap-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-sm group/btn"
                        >
                          <span className="leading-tight group-hover/btn:text-emerald-700 transition-colors">거래대금</span>
                          <svg className="size-2.5 text-slate-400 group-hover/btn:text-emerald-600 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        <div className="hidden sm:block absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 w-64 p-3 rounded-xl bg-slate-900/98 backdrop-blur-md text-white text-left shadow-2xl border border-slate-700/80 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none group-focus-within:pointer-events-auto transition-all duration-200 z-[120] whitespace-normal break-keep">
                          <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 border-[6px] border-transparent border-r-slate-900/98" />
                          <div className="flex items-center justify-between gap-1 mb-1 pb-1 border-b border-slate-700/60">
                            <span className="text-[12px] font-black text-brand-300">거래대금 (유동성)</span>
                            <span className="text-[9.5px] text-slate-400 font-mono">1일</span>
                          </div>
                          <p className="text-[11.5px] text-neutral-200 leading-snug mb-1 font-medium">
                            최근 1영업일 동안 시장에서 실제 거래된 총액입니다.
                          </p>
                          <div className="text-[11px] text-sky-200/95 bg-sky-500/10 rounded-md p-1.5 leading-snug border border-sky-500/20">
                            <strong className="text-sky-300">💡 팁:</strong> 유동성이 풍부할수록 원하는 가격과 수량으로 즉시 체결하기 수월합니다.
                          </div>
                        </div>
                      </div>
                    </th>
                    {compareList.map((etf) => {
                      const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                      const isTopTrade = maxTrade !== null && etf.tradeValue === maxTrade && compareList.length > 1;
                      const tradePercent = maxTrade && etf.tradeValue ? Math.round((etf.tradeValue / maxTrade) * 100) : 0;
                      return (
                        <td key={etf.ticker} className={`whitespace-nowrap border-b border-r border-slate-100 relative px-0.5 sm:px-1.5 py-0.5 text-center tabular-nums transition-colors ${isBase ? "bg-emerald-50/30" : ""} text-slate-900 font-extrabold text-[10.5px] sm:text-[11.5px]`}>
                          <div className="relative w-full h-full py-0.5 flex items-center justify-center font-mono">
                            <div className="inline-flex items-center justify-end w-[84px] sm:w-[98px] text-right">
                              {isTopTrade && (
                                <span
                                  data-testid="smart-advantage-badge"
                                  className="inline-flex items-center rounded px-0.5 py-0.2 text-[7.5px] sm:text-[8px] font-black leading-none bg-sky-100/90 text-sky-900 border border-sky-300 shadow-2xs font-sans mr-1 shrink-0"
                                  title="비교군 중 일 거래대금(유동성) 1위"
                                >
                                  1위
                                </span>
                              )}
                              <span className="ml-auto text-slate-900">{formatMoney(etf.tradeValue)}</span>
                            </div>
                            {compareList.length > 1 && maxTrade && (
                              <div className="absolute bottom-0 left-1 right-1 h-[2px] bg-slate-100/80 rounded-full overflow-hidden pointer-events-none">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${isTopTrade ? "bg-sky-500" : "bg-slate-300"}`}
                                  style={{ width: `${Math.max(tradePercent, 4)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    {hasPlaceholder && (
                      <td className="border-b border-r border-slate-100 px-0.5 sm:px-1 py-0.5 text-center text-neutral-300 bg-slate-50/20 align-middle">
                        <span className="text-xs text-neutral-300 select-none">-</span>
                      </td>
                    )}
                  </tr>

                  {/* ────────────────────────────────────────── */}
                  {/* GROUP 2: 기간별 성과 (1개월~연초이후 + 토글) */}
                  {/* ────────────────────────────────────────── */}

                  {orderedPeriods.map((period, pIdx) => {
                    const periodValues = compareList
                      .map((e) => getActiveReturns(e)?.[period])
                      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
                    const maxReturnForPeriod = periodValues.length > 0 ? Math.max(...periodValues) : null;
                    const minReturnForPeriod = periodValues.length > 0 ? Math.min(...periodValues) : null;
                    const hasVariation = maxReturnForPeriod !== null && minReturnForPeriod !== null && maxReturnForPeriod !== minReturnForPeriod;

                    return (
                      <tr key={period} className="hover:bg-slate-50/70">
                        {pIdx === 0 && (
                          <th
                            rowSpan={orderedPeriods.length + 1}
                            className="sticky left-0 z-30 w-[36px] sm:w-[50px] min-w-[36px] sm:min-w-[50px] max-w-[36px] sm:max-w-[50px] bg-slate-100/90 text-slate-700 font-extrabold text-[10px] sm:text-[10.5px] text-center align-middle border-b border-r border-slate-200/80 px-0.5 py-0.5 leading-snug"
                          >
                            <div className="flex flex-col items-center justify-center gap-0.5">
                              <span className="text-[11px]">📈</span>
                              <span className="sm:hidden text-[8.5px] font-black leading-none">성과</span>
                              <span className="hidden sm:inline break-keep">기간별 성과</span>
                            </div>
                          </th>
                        )}
                        <th className={`sticky left-[36px] sm:left-[50px] z-20 bg-slate-50/95 backdrop-blur px-0.5 sm:px-1 py-0.5 text-[10px] sm:text-[11px] font-semibold text-slate-600 border-b border-r border-slate-200/60 transition-shadow duration-200 text-center align-middle ${shadowClass}`}>
                          {RETURN_PERIOD_LABELS[period]}
                        </th>
                        {compareList.map((etf) => {
                          const val = getActiveReturns(etf)?.[period] ?? null;
                          const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                          const isTop = hasVariation && maxReturnForPeriod !== null && val === maxReturnForPeriod && compareList.length > 1;
                          return (
                            <td key={`${etf.ticker}-${period}`} className={`whitespace-nowrap border-b border-r border-slate-100 px-0.5 sm:px-1.5 py-0.5 text-center tabular-nums transition-colors ${isBase ? "bg-emerald-50/30" : ""}`}>
                              <div className="inline-flex items-center justify-center font-mono w-full">
                                <div className="inline-flex items-center justify-end w-[84px] sm:w-[98px] text-right">
                                  {isTop && val != null && (
                                    <span
                                      data-testid="smart-advantage-badge"
                                      className="inline-flex items-center rounded px-0.5 py-0.2 text-[7.5px] sm:text-[8px] font-black leading-none bg-amber-100/90 text-amber-900 border border-amber-300 shadow-2xs font-sans mr-1 shrink-0"
                                      title={val < 0 ? "해당 기간 비교군 최고 방어 성과 (1위)" : "해당 기간 비교군 1위 성과"}
                                    >
                                      1위
                                    </span>
                                  )}
                                  <span className={`${isTop ? "font-black" : "font-semibold"} ml-auto text-[10.5px] sm:text-[11.5px]`}>
                                    <ReturnCell value={val} isTr={isTrMode} />
                                  </span>
                                </div>
                              </div>
                            </td>
                          );
                        })}
                        {hasPlaceholder && (
                          <td className="border-b border-r border-slate-100 px-0.5 sm:px-1 py-0.5 text-center text-neutral-300 bg-slate-50/20 align-middle">
                            <span className="text-xs text-neutral-300 select-none">-</span>
                          </td>
                        )}
                      </tr>
                    );
                  })}

                  {/* 세부 기간 펼치기 / 접기 토글 전용 행 */}
                  <tr className="hover:bg-slate-100/60 transition-colors">
                    <th className={`sticky left-[36px] sm:left-[50px] z-20 bg-slate-50/95 backdrop-blur px-0.5 sm:px-1 py-0.5 text-[9.5px] sm:text-[10px] font-semibold text-slate-500 border-b border-r border-slate-200/60 text-center align-middle ${shadowClass}`}>
                      기간 선택
                    </th>
                    <td
                      colSpan={totalCols}
                      className="border-b border-r border-slate-100 px-1 py-0.5 bg-slate-50/40 text-center align-middle"
                    >
                      <button
                        type="button"
                        onClick={() => setShowAllPeriods((prev) => !prev)}
                        title={showAllPeriods ? "핵심 5개 기간(1m~1y)만 보기" : "1일~3년 전체 12개 기간 펼치기"}
                        className="group inline-flex items-center justify-center gap-1 text-[10px] sm:text-[10.5px] font-semibold text-slate-600 hover:text-emerald-800 bg-white hover:bg-slate-100 border border-slate-200/80 transition-all cursor-pointer py-0.2 px-2.5 rounded-full shadow-2xs active:scale-98"
                      >
                        <span className="text-[9px] text-slate-400 group-hover:text-emerald-600 transition-colors">
                          {showAllPeriods ? "▲" : "▼"}
                        </span>
                        <span>
                          {showAllPeriods
                            ? "핵심 5개 기간 접기"
                            : "+ 전체 12개 기간 펼쳐보기"}
                        </span>
                      </button>
                    </td>
                  </tr>

                  {/* ────────────────────────────────────────── */}
                  {/* GROUP 3: 배당 및 분배금 (연간 분배율, 분배 주기) */}
                  {/* ────────────────────────────────────────── */}

                  {/* 연간 분배율 (TTM) */}
                  <tr className="hover:bg-slate-50/70 hover:z-40 relative">
                    <th
                      rowSpan={2}
                      className="sticky left-0 z-30 w-[36px] sm:w-[50px] min-w-[36px] sm:min-w-[50px] max-w-[36px] sm:max-w-[50px] bg-slate-100/90 text-slate-700 font-extrabold text-[10px] sm:text-[10.5px] text-center align-middle border-b border-r border-slate-200/80 px-0.5 py-0.5 leading-snug"
                    >
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <span className="text-[11px]">💰</span>
                        <span className="sm:hidden text-[8.5px] font-black leading-none">배당</span>
                        <span className="hidden sm:inline break-keep">배당 및 분배금</span>
                      </div>
                    </th>
                    <th className={`sticky left-[36px] sm:left-[50px] z-20 hover:z-50 bg-slate-50/95 backdrop-blur-md px-0.5 sm:px-1 py-0.5 text-[10px] sm:text-[11px] font-semibold text-slate-600 border-b border-r border-slate-200/60 transition-all duration-200 text-center align-middle ${shadowClass}`}>
                      <div className="flex items-center justify-center gap-0.5 group relative w-fit mx-auto">
                        <button
                          type="button"
                          onClick={() => setActiveMetricModal("dividendYield")}
                          aria-label="연간 분배율 (TTM) 안내 보기"
                          className="inline-flex items-center justify-center gap-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-sm group/btn"
                        >
                          <span className="leading-tight group-hover/btn:text-emerald-700 transition-colors">연간 분배율</span>
                          <svg className="size-2.5 text-slate-400 group-hover/btn:text-emerald-600 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        <div className="hidden sm:block absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 w-72 p-3.5 rounded-xl bg-slate-900/98 backdrop-blur-md text-white text-left shadow-2xl border border-slate-700/80 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none group-focus-within:pointer-events-auto transition-all duration-200 z-[120] whitespace-normal break-keep">
                          <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 border-[6px] border-transparent border-r-slate-900/98" />
                          <div className="flex items-center justify-between gap-1 mb-1 pb-1 border-b border-slate-700/60">
                            <span className="text-[12px] font-black text-rose-300">연간 분배율 (TTM)</span>
                            <span className="text-[9.5px] text-slate-400 font-mono">연 배당 수익률</span>
                          </div>
                          <p className="text-[11.5px] text-neutral-200 leading-snug mb-1 font-medium">
                            최근 1년간 지급된 주당 분배금 합계를 현재 가격으로 나눈 실질 연간 배당(분배) 수익률입니다.
                          </p>
                          <div className="text-[11px] text-amber-200/95 bg-amber-500/10 rounded-md p-1.5 leading-snug border border-amber-500/20">
                            <strong className="text-amber-300">💡 팁:</strong> 고배당 및 커버드콜 ETF는 분배율뿐만 아니라 원금 보전 및 총수익률(TR)을 함께 점검하는 것이 중요합니다.
                          </div>
                        </div>
                      </div>
                    </th>
                    {compareList.map((etf) => {
                      const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                      const divYield = etf.distributionYield;
                      const hasDivYield = typeof divYield === "number" && divYield > 0;
                      const isTopDiv = hasDivYield && maxDivYield > 0 && divYield === maxDivYield && compareList.length > 1;
                      return (
                        <td key={`div-${etf.ticker}`} className={`whitespace-nowrap border-b border-r border-slate-100 relative px-0.5 sm:px-1.5 py-0.5 text-center tabular-nums transition-colors ${isBase ? "bg-emerald-50/30" : ""} text-slate-900 font-extrabold text-[10.5px] sm:text-[11.5px]`}>
                          <div className="inline-flex items-center justify-center font-mono w-full">
                            <div className="inline-flex items-center justify-end w-[84px] sm:w-[98px] text-right">
                              {isTopDiv && (
                                <span
                                  data-testid="smart-advantage-badge"
                                  className="inline-flex items-center rounded px-0.5 py-0.2 text-[7.5px] sm:text-[8px] font-black leading-none bg-rose-100/90 text-rose-900 border border-rose-300 shadow-2xs font-sans mr-1 shrink-0"
                                  title="비교군 중 연간 분배율 1위"
                                >
                                  1위
                                </span>
                              )}
                              <span className={`ml-auto ${hasDivYield ? "text-slate-900 font-mono" : "text-muted font-mono"}`}>
                                {hasDivYield ? `연 ${divYield.toFixed(2)}%` : "-"}
                              </span>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                    {hasPlaceholder && (
                      <td className="border-b border-r border-slate-100 px-0.5 sm:px-1 py-0.5 text-center text-neutral-300 bg-slate-50/20 align-middle">
                        <span className="text-xs text-neutral-300 select-none">-</span>
                      </td>
                    )}
                  </tr>

                  {/* 분배 주기 */}
                  <tr className="hover:bg-slate-50/70 hover:z-40 relative">
                    <th className={`sticky left-[36px] sm:left-[50px] z-20 hover:z-50 bg-slate-50/95 backdrop-blur-md px-0.5 sm:px-1 py-0.5 text-[10px] sm:text-[11px] font-semibold text-slate-600 border-b border-r border-slate-200/60 transition-all duration-200 text-center align-middle ${shadowClass}`}>
                      <div className="flex items-center justify-center gap-0.5 group relative w-fit mx-auto">
                        <button
                          type="button"
                          onClick={() => setActiveMetricModal("dividendCycle")}
                          aria-label="분배 주기 안내 보기"
                          className="inline-flex items-center justify-center gap-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-sm group/btn"
                        >
                          <span className="leading-tight group-hover/btn:text-emerald-700 transition-colors">분배 주기</span>
                          <svg className="size-2.5 text-slate-400 group-hover/btn:text-emerald-600 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        <div className="hidden sm:block absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 w-64 p-3 rounded-xl bg-slate-900/98 backdrop-blur-md text-white text-left shadow-2xl border border-slate-700/80 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none group-focus-within:pointer-events-auto transition-all duration-200 z-[120] whitespace-normal break-keep">
                          <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 border-[6px] border-transparent border-r-slate-900/98" />
                          <div className="flex items-center justify-between gap-1 mb-1 pb-1 border-b border-slate-700/60">
                            <span className="text-[12px] font-black text-brand-300">분배 주기</span>
                            <span className="text-[9.5px] text-slate-400 font-mono">현금흐름</span>
                          </div>
                          <p className="text-[11.5px] text-neutral-200 leading-snug mb-1 font-medium">
                            펀드 운용 수익이나 배당 재원을 투자자에게 지급하는 주기입니다.
                          </p>
                          <div className="text-[11px] text-emerald-200/95 bg-emerald-500/10 rounded-md p-1.5 leading-snug border border-emerald-500/20">
                            <strong className="text-emerald-300">💡 팁:</strong> 정기적인 현금흐름이 필요한 은퇴/연금 투자자에게는 매월 분배금을 지급하는 월배당 ETF가 적합합니다.
                          </div>
                        </div>
                      </div>
                    </th>
                    {compareList.map((etf) => {
                      const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                      const cycle = etf.distributionCycle;
                      const isMonthly = cycle?.includes("월");
                      return (
                        <td key={`cycle-${etf.ticker}`} className={`border-b border-r border-slate-100 px-0.5 sm:px-1.5 py-0.5 transition-colors text-center align-middle ${isBase ? "bg-emerald-50/30" : ""}`}>
                          {isMonthly ? (
                            <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.2 text-[8.5px] sm:text-[9.5px] font-black bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
                              🗓️ {cycle}
                            </span>
                          ) : cycle ? (
                            <span className="text-[10px] sm:text-[11px] font-bold text-slate-700">
                              {cycle}
                            </span>
                          ) : (
                            <span className="text-muted text-xs font-mono">-</span>
                          )}
                        </td>
                      );
                    })}
                    {hasPlaceholder && (
                      <td className="border-b border-r border-slate-100 px-0.5 sm:px-1 py-0.5 text-center text-neutral-300 bg-slate-50/20 align-middle">
                        <span className="text-xs text-neutral-300 select-none">-</span>
                      </td>
                    )}
                  </tr>

                  {/* ────────────────────────────────────────── */}
                  {/* GROUP 4: 총비용 및 보수 (실부담비용, 기본 운용보수) */}
                  {/* ────────────────────────────────────────── */}

                  {/* 실부담비용 */}
                  <tr className="hover:bg-slate-50/70 hover:z-40 relative">
                    <th
                      rowSpan={2}
                      className="sticky left-0 z-30 w-[36px] sm:w-[50px] min-w-[36px] sm:min-w-[50px] max-w-[36px] sm:max-w-[50px] bg-slate-100/90 text-slate-700 font-extrabold text-[10px] sm:text-[10.5px] text-center align-middle border-b border-r border-slate-200/80 px-0.5 py-0.5 leading-snug"
                    >
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <span className="text-[11px]">🏷️</span>
                        <span className="sm:hidden text-[8.5px] font-black leading-none">비용</span>
                        <span className="hidden sm:inline break-keep">총비용 및 보수</span>
                      </div>
                    </th>
                    <th className={`sticky left-[36px] sm:left-[50px] z-20 hover:z-50 bg-slate-50/95 backdrop-blur-md px-0.5 sm:px-1 py-0.5 text-[10px] sm:text-[11px] font-semibold text-slate-600 border-b border-r border-slate-200/60 transition-all duration-200 text-center align-middle ${shadowClass}`}>
                      <div className="flex items-center justify-center gap-0.5 group relative w-fit mx-auto">
                        <button
                          type="button"
                          onClick={() => setActiveMetricModal("fee")}
                          aria-label="실부담비용 상세 안내 보기"
                          className="inline-flex items-center justify-center gap-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-sm group/btn"
                        >
                          <span className="leading-tight group-hover/btn:text-emerald-700 transition-colors">실부담비용</span>
                          <svg className="size-2.5 text-slate-400 group-hover/btn:text-emerald-600 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        <div className="hidden sm:block absolute left-[calc(100%+8px)] bottom-[-20px] w-80 p-4 rounded-xl bg-slate-900/98 backdrop-blur-md text-white text-left shadow-2xl border border-slate-700/90 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none group-focus-within:pointer-events-auto transition-all duration-200 z-[120] whitespace-normal break-keep">
                          <div className="absolute bottom-6 -left-1.5 border-[6px] border-transparent border-r-slate-900/98" />
                          <div className="flex items-center justify-between gap-1 mb-2 pb-1.5 border-b border-slate-800">
                            <span className="text-[12.5px] font-black text-emerald-400">실부담비용이란?</span>
                            <span className="text-[10px] font-bold text-slate-300 bg-slate-800 border border-slate-700/80 px-2 py-0.5 rounded-full">
                              실제 차감 총비용
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-100 leading-relaxed mb-2.5 font-normal">
                            광고에 표기되는 <strong>기본 간판 보수</strong> 외에, 펀드 운용 중 발생하는 <strong>모든 숨은 비용(주식 매매수수료 + 회계/전산 유지비)</strong>을 합산한 <strong>투자자 실제 부담 비용</strong>입니다.
                          </p>
                          <div className="space-y-1 text-xs bg-slate-800/90 p-2.5 rounded-lg border border-slate-700/60 mb-2.5">
                            <div className="flex items-center justify-between text-slate-200">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-brand-400 shrink-0" />
                                <strong className="text-white text-[11px]">명목보수</strong>
                              </span>
                              <span className="text-[10.5px] text-slate-300">기본 간판 운용 수수료</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-200">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                                <strong className="text-white text-[11px]">기타비용</strong>
                              </span>
                              <span className="text-[10.5px] text-slate-300">예탁원·지수사용 펀드 유지비</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-200">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                                <strong className="text-white text-[11px]">매매수수료</strong>
                              </span>
                              <span className="text-[10.5px] text-slate-300">주식 매매 시 발생하는 거래비용</span>
                            </div>
                          </div>
                          <div className="text-[11px] text-emerald-300 bg-emerald-950/60 rounded-lg p-2 leading-relaxed border border-emerald-800/60">
                            <p className="text-emerald-200 font-medium">
                              별도 납부 없이 매일 펀드 순자산(수익률)에서 자동 차감되므로, <strong>동일 지수를 추종한다면 실부담비용이 낮은 ETF를 선택하는 것이 장기 성과에 유리</strong>합니다.
                            </p>
                          </div>
                        </div>
                      </div>
                    </th>
                    {compareList.map((etf, index) => {
                      const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                      const align =
                        index === compareList.length - 1
                          ? "right"
                          : index === 0
                          ? "left"
                          : "center";
                      return (
                        <td key={etf.ticker} className={`border-b border-r border-slate-100 px-0.5 sm:px-1 py-0.5 transition-colors align-middle whitespace-nowrap tabular-nums ${isBase ? "bg-emerald-50/30" : ""}`}>
                          <FeeStackedBar
                            etf={etf}
                            isLowest={etf.ticker === lowestSyntheticTicker}
                            maxFee={maxSyntheticFee}
                            align={align}
                          />
                        </td>
                      );
                    })}
                    {hasPlaceholder && (
                      <td className="border-b border-r border-slate-100 px-0.5 sm:px-1 py-0.5 text-center text-neutral-300 bg-slate-50/20 align-middle">
                        <span className="text-xs text-neutral-300 select-none">-</span>
                      </td>
                    )}
                  </tr>

                  {/* 기본 운용보수 (명목 총보수) */}
                  <tr className="hover:bg-slate-50/70 hover:z-40 relative">
                    <th className={`sticky left-[36px] sm:left-[50px] z-20 hover:z-50 bg-slate-50/95 backdrop-blur-md px-0.5 sm:px-1 py-0.5 text-[10px] sm:text-[11px] font-semibold text-slate-600 border-b border-r border-slate-200/60 transition-all duration-200 text-center align-middle ${shadowClass}`}>
                      <div className="flex items-center justify-center gap-0.5 group relative w-fit mx-auto">
                        <button
                          type="button"
                          onClick={() => setActiveMetricModal("nominalFee")}
                          aria-label="기본 운용보수 안내 보기"
                          className="inline-flex items-center justify-center gap-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-sm group/btn"
                        >
                          <span className="leading-tight group-hover/btn:text-emerald-700 transition-colors">기본 보수</span>
                          <svg className="size-2.5 text-slate-400 group-hover/btn:text-emerald-600 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        <div className="hidden sm:block absolute left-[calc(100%+8px)] bottom-[-20px] w-72 p-3.5 rounded-xl bg-slate-900/98 backdrop-blur-md text-white text-left shadow-2xl border border-slate-700/90 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none group-focus-within:pointer-events-auto transition-all duration-200 z-[120] whitespace-normal break-keep">
                          <div className="absolute bottom-6 -left-1.5 border-[6px] border-transparent border-r-slate-900/98" />
                          <div className="flex items-center justify-between gap-1 mb-1 pb-1 border-b border-slate-800">
                            <span className="text-[12px] font-black text-emerald-400">기본 운용보수 (총보수)</span>
                            <span className="text-[9.5px] text-slate-400 font-mono">간판 보수</span>
                          </div>
                          <p className="text-[11px] text-neutral-200 leading-relaxed mb-1 font-normal">
                            운용사 설명서 및 증권사 화면에 공식 고시되는 기본 간판 총보수입니다.
                          </p>
                          <div className="text-[10.5px] text-amber-200/95 bg-amber-500/10 rounded-md p-1.5 leading-snug border border-amber-500/20">
                            <strong className="text-amber-300">💡 팁:</strong> 실제 투자자 부담은 여기에 기타비용과 매매수수료가 더해진 [실부담비용]이므로, 반드시 실부담비용과 함께 비교하세요.
                          </div>
                        </div>
                      </div>
                    </th>
                    {compareList.map((etf) => {
                      const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                      const nominalFee = etf.fee?.totalFeePct;
                      const hasNominal = typeof nominalFee === "number" && Number.isFinite(nominalFee);
                      return (
                        <td key={`nominal-${etf.ticker}`} className={`whitespace-nowrap border-b border-r border-slate-100 relative px-0.5 sm:px-1.5 py-0.5 text-center tabular-nums transition-colors ${isBase ? "bg-emerald-50/30" : ""} text-slate-800 font-bold text-[10.5px] sm:text-[11.5px]`}>
                          <div className="inline-flex items-center justify-center font-mono w-full">
                            <div className="inline-flex items-center justify-end w-[84px] sm:w-[98px] text-right">
                              <span className={`ml-auto ${hasNominal ? "text-slate-800 font-mono" : "text-muted font-mono"}`}>
                                {hasNominal ? formatFeePct(nominalFee) : "-"}
                              </span>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                    {hasPlaceholder && (
                      <td className="border-b border-r border-slate-100 px-0.5 sm:px-1 py-0.5 text-center text-neutral-300 bg-slate-50/20 align-middle">
                        <span className="text-xs text-neutral-300 select-none">-</span>
                      </td>
                    )}
                  </tr>

                  {/* ────────────────────────────────────────── */}
                  {/* GROUP 5: 운용 품질 및 정밀도 (괴리율, 추적오차율) */}
                  {/* ────────────────────────────────────────── */}

                  {/* 괴리율 */}
                  <tr className="hover:bg-slate-50/70 hover:z-40 relative">
                    <th
                      rowSpan={2}
                      className="sticky left-0 z-30 w-[36px] sm:w-[50px] min-w-[36px] sm:min-w-[50px] max-w-[36px] sm:max-w-[50px] bg-slate-100/90 text-slate-700 font-extrabold text-[10px] sm:text-[10.5px] text-center align-middle border-b border-r border-slate-200/80 px-0.5 py-0.5 leading-snug"
                    >
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <span className="text-[11px]">🎯</span>
                        <span className="sm:hidden text-[8.5px] font-black leading-none">품질</span>
                        <span className="hidden sm:inline break-keep">운용 품질 및 정밀도</span>
                      </div>
                    </th>
                    <th className={`sticky left-[36px] sm:left-[50px] z-20 hover:z-50 bg-slate-50/95 backdrop-blur-md px-0.5 sm:px-1 py-0.5 text-[10px] sm:text-[11px] font-semibold text-slate-600 border-b border-r border-slate-200/60 transition-all duration-200 text-center align-middle ${shadowClass}`}>
                      <div className="flex items-center justify-center gap-0.5 group relative w-fit mx-auto">
                        <button
                          type="button"
                          onClick={() => setActiveMetricModal("disparity")}
                          aria-label="괴리율 상세 안내 보기"
                          className="inline-flex items-center justify-center gap-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-sm group/btn"
                        >
                          <span className="leading-tight group-hover/btn:text-emerald-700 transition-colors">괴리율</span>
                          <svg className="size-2.5 text-slate-400 group-hover/btn:text-emerald-600 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        <div className="hidden sm:block absolute left-[calc(100%+8px)] bottom-[-20px] w-80 p-4 rounded-xl bg-slate-900/98 backdrop-blur-md text-white text-left shadow-2xl border border-slate-700/90 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none group-focus-within:pointer-events-auto transition-all duration-200 z-[120] whitespace-normal break-keep">
                          <div className="absolute bottom-6 -left-1.5 border-[6px] border-transparent border-r-slate-900/98" />
                          <div className="flex items-center justify-between gap-1 mb-2 pb-1.5 border-b border-slate-800">
                            <span className="text-[12.5px] font-black text-emerald-400">괴리율이란?</span>
                            <span className="text-[9.5px] text-neutral-400 font-mono bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                              시장가 vs 실제가치
                            </span>
                          </div>
                          <p className="text-[11.5px] text-slate-100 leading-relaxed mb-2.5 font-normal">
                            주식시장에서 거래되는 <strong>현재 가격이 ETF의 진짜 가치(NAV) 대비 얼마나 웃돈이나 할인이 붙었는지</strong> 나타내는 지표입니다.
                          </p>
                          <div className="space-y-1 text-xs bg-slate-800/90 p-2.5 rounded-lg border border-slate-700/60 mb-2.5">
                            <div className="flex items-start gap-1.5 text-slate-200">
                              <span className="text-rose-400 font-bold shrink-0 text-[11px]">• + (양수):</span>
                              <span className="text-[11px]">실제 가치보다 <strong>웃돈(고평가)</strong>을 주고 사는 상태</span>
                            </div>
                            <div className="flex items-start gap-1.5 text-slate-200">
                              <span className="text-blue-400 font-bold shrink-0 text-[11px]">• - (음수):</span>
                              <span className="text-[11px]">실제 가치보다 <strong>할인(저평가)</strong>되어 싸게 사는 상태</span>
                            </div>
                          </div>
                          <div className="text-[11px] text-amber-300 bg-amber-950/60 rounded-lg p-2 leading-relaxed border border-amber-800/60">
                            <strong className="text-amber-200 block mb-0.5">⚠️ 고평가 주의 기준:</strong>
                            국내 ETF는 +0.5%, 해외 ETF는 +1.0% 이상 비정상적으로 웃돈이 붙었을 때만 <strong>[고평가 주의]</strong> 경고가 켜집니다.
                          </div>
                        </div>
                      </div>
                    </th>
                    {compareList.map((etf) => {
                      const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                      const d = etf.disparity;
                      const hasDisparity = typeof d === "number" && Number.isFinite(d);
                      const isOverseas = etf.classification?.marketScope === "미국" || etf.classification?.marketScope === "글로벌" || etf.classification?.marketScope === "신흥국";
                      const overvalueThreshold = isOverseas ? 1.0 : 0.5;
                      const isAbnormallyOvervalued = hasDisparity && d > overvalueThreshold;

                      return (
                        <td key={etf.ticker} className={`whitespace-nowrap border-b border-r border-slate-100 px-0.5 sm:px-1.5 py-0.5 text-center tabular-nums font-bold text-[10.5px] sm:text-[11.5px] ${isBase ? "bg-emerald-50/30" : ""}`}>
                          <div className="inline-flex items-center justify-center font-mono w-full">
                            <div className="inline-flex items-center justify-end w-[84px] sm:w-[98px] text-right">
                              {hasDisparity ? (
                                <>
                                  {isAbnormallyOvervalued && (
                                    <span
                                      className="text-[7.5px] sm:text-[8px] font-black px-0.5 py-0.2 rounded border text-rose-800 bg-rose-50 border-rose-300 shadow-2xs leading-none font-sans mr-1 shrink-0"
                                      title={`실제 가치(NAV)보다 ${d.toFixed(2)}% 비싸게 거래되는 비정상 고평가 상태입니다. 매수 시 주의하세요.`}
                                    >
                                      주의
                                    </span>
                                  )}
                                  <span className={`ml-auto ${d > 0 ? "text-rose-600 font-mono" : d < 0 ? "text-blue-600 font-mono" : "text-slate-900 font-mono"}`}>
                                    {d > 0 ? `+${d.toFixed(2)}%` : `${d.toFixed(2)}%`}
                                  </span>
                                </>
                              ) : (
                                <span className="text-muted ml-auto font-mono">-</span>
                              )}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                    {hasPlaceholder && (
                      <td className="border-b border-r border-slate-100 px-0.5 sm:px-1 py-0.5 text-center text-neutral-300 bg-slate-50/20 align-middle">
                        <span className="text-xs text-neutral-300 select-none">-</span>
                      </td>
                    )}
                  </tr>
                  
                  {/* 추적 오차율 */}
                  <tr className="hover:bg-slate-50/70 hover:z-40 relative">
                    <th className={`sticky left-[36px] sm:left-[50px] z-20 hover:z-50 bg-slate-50/95 backdrop-blur-md px-0.5 sm:px-1 py-0.5 text-[10px] sm:text-[11px] font-semibold text-slate-600 border-b border-r border-slate-200/60 transition-all duration-200 text-center align-middle ${shadowClass}`}>
                      <div className="flex items-center justify-center gap-0.5 group relative w-fit mx-auto">
                        <button
                          type="button"
                          onClick={() => setActiveMetricModal("trackingError")}
                          aria-label="추적오차율 상세 안내 보기"
                          className="inline-flex items-center justify-center gap-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-sm group/btn"
                        >
                          <span className="leading-tight group-hover/btn:text-emerald-700 transition-colors">추적오차율</span>
                          <svg className="size-2.5 text-slate-400 group-hover/btn:text-emerald-600 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        <div className="hidden sm:block absolute left-[calc(100%+8px)] bottom-[-20px] w-84 p-4 rounded-xl bg-slate-900/98 backdrop-blur-md text-white text-left shadow-2xl border border-slate-700/90 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none group-focus-within:pointer-events-auto transition-all duration-200 z-[120] whitespace-normal break-keep">
                          <div className="absolute bottom-6 -left-1.5 border-[6px] border-transparent border-r-slate-900/98" />
                          <div className="flex items-center justify-between gap-1 mb-2 pb-1.5 border-b border-slate-800">
                            <span className="text-[12.5px] font-black text-emerald-400">추적오차율이란?</span>
                            <span className="text-[9.5px] text-emerald-300 font-mono bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-700/60 font-semibold">
                              배당 조정(TR)
                            </span>
                          </div>
                          <p className="text-[11.5px] text-slate-100 leading-relaxed mb-2.5 font-normal">
                            과거 1년간 ETF 순자산가치(NAV)가 목표 기초지수를 얼마나 똑같이 따라갔는지 나타내는 <strong>운용 복제 정밀도(표준편차)</strong>입니다.
                          </p>
                          <div className="text-[11px] text-emerald-200 bg-emerald-950/90 rounded-lg p-2 leading-snug border border-emerald-600/80 mb-2 shadow-inner">
                            <strong>배당금(분배금) 효과를 금융공학적으로 보정한 [순수 운용 추적오차(TR 기준)]입니다.</strong>
                          </div>
                          <div className="space-y-1 text-xs bg-slate-800/90 p-2 rounded-lg border border-slate-700/60 mb-2">
                            <div className="flex items-start gap-1.5 text-slate-200">
                              <span className="text-emerald-400 font-bold shrink-0 text-[11px]">• 숫자가 낮을수록:</span>
                              <span className="text-[11px]">운용사가 지수를 <strong>오차 없이 안정적이고 완벽하게 복제</strong>하고 있음을 의미합니다.</span>
                            </div>
                          </div>
                          <div className="text-[10px] text-neutral-400">
                            💡 액티브 ETF는 펀드매니저의 초과수익 추구로 추적오차율이 상대적으로 높게 나타납니다.
                          </div>
                        </div>
                      </div>
                    </th>
                    {compareList.map((etf) => {
                      const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                      const te = etf.trackingError;
                      const hasTE = typeof te === "number" && Number.isFinite(te);
                      return (
                        <td key={`te-${etf.ticker}`} className={`whitespace-nowrap border-b border-r border-slate-100 px-0.5 sm:px-1.5 py-0.5 text-center tabular-nums font-bold text-[10.5px] sm:text-[11.5px] ${isBase ? "bg-emerald-50/30" : ""}`}>
                          <div className="inline-flex items-center justify-center font-mono w-full">
                            <div className="inline-flex items-center justify-end w-[84px] sm:w-[98px] text-right">
                              {hasTE ? (
                                <span className="text-slate-900 ml-auto font-mono">
                                  {te.toFixed(2)}%
                                </span>
                              ) : (
                                <span className="text-muted ml-auto font-mono">-</span>
                              )}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                    {hasPlaceholder && (
                      <td className="border-b border-r border-slate-100 px-0.5 sm:px-1 py-0.5 text-center text-neutral-300 bg-slate-50/20 align-middle">
                        <span className="text-xs text-neutral-300 select-none">-</span>
                      </td>
                    )}
                  </tr>

                  {/* ────────────────────────────────────────── */}
                  {/* GROUP 6: 상품 프로필 및 구조 (운용사, 상장일, 환헤지, 기초지수) */}
                  {/* ────────────────────────────────────────── */}

                  {/* 운용사 */}
                  <tr className="hover:bg-slate-50/70">
                    <th
                      rowSpan={4}
                      className="sticky left-0 z-30 w-[36px] sm:w-[50px] min-w-[36px] sm:min-w-[50px] max-w-[36px] sm:max-w-[50px] bg-slate-100/90 text-slate-700 font-extrabold text-[10px] sm:text-[10.5px] text-center align-middle border-b border-r border-slate-200/80 px-0.5 py-0.5 leading-snug"
                    >
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <span className="text-[11px]">📋</span>
                        <span className="sm:hidden text-[8.5px] font-black leading-none">정보</span>
                        <span className="hidden sm:inline break-keep">상품 프로필 및 구조</span>
                      </div>
                    </th>
                    <th className={`sticky left-[36px] sm:left-[50px] z-20 bg-slate-50/95 backdrop-blur px-0.5 sm:px-1 py-0.5 text-[10px] sm:text-[11px] font-semibold text-slate-600 border-b border-r border-slate-200/60 transition-shadow duration-200 text-center align-middle ${shadowClass}`}>
                      운용사
                    </th>
                    {compareList.map((etf) => {
                      const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                      return (
                        <td key={`issuer-${etf.ticker}`} className={`border-b border-r border-slate-100 px-0.5 sm:px-1.5 py-0.5 transition-colors text-center align-middle ${isBase ? "bg-emerald-50/30" : ""}`}>
                          <span className="text-[10px] sm:text-[11px] font-bold text-slate-800 truncate block max-w-full" title={etf.issuer?.issuerName || ""}>
                            {etf.issuer?.issuerName || "-"}
                          </span>
                        </td>
                      );
                    })}
                    {hasPlaceholder && (
                      <td className="border-b border-r border-slate-100 px-0.5 sm:px-1 py-0.5 text-center text-neutral-300 bg-slate-50/20 align-middle">
                        <span className="text-xs text-neutral-300 select-none">-</span>
                      </td>
                    )}
                  </tr>

                  {/* 상장일 */}
                  <tr className="hover:bg-slate-50/70 hover:z-40 relative">
                    <th className={`sticky left-[36px] sm:left-[50px] z-20 hover:z-50 bg-slate-50/95 backdrop-blur-md px-0.5 sm:px-1 py-0.5 text-[10px] sm:text-[11px] font-semibold text-slate-600 border-b border-r border-slate-200/60 transition-all duration-200 text-center align-middle ${shadowClass}`}>
                      <div className="flex items-center justify-center gap-0.5 group relative w-fit mx-auto">
                        <button
                          type="button"
                          onClick={() => setActiveMetricModal("listingDate")}
                          aria-label="상장일 안내 보기"
                          className="inline-flex items-center justify-center gap-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-sm group/btn"
                        >
                          <span className="leading-tight group-hover/btn:text-emerald-700 transition-colors">상장일</span>
                          <svg className="size-2.5 text-slate-400 group-hover/btn:text-emerald-600 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        <div className="hidden sm:block absolute left-[calc(100%+8px)] bottom-[-10px] w-64 p-3 rounded-xl bg-slate-900/98 backdrop-blur-md text-white text-left shadow-2xl border border-slate-700/80 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none group-focus-within:pointer-events-auto transition-all duration-200 z-[120] whitespace-normal break-keep">
                          <div className="absolute bottom-5 -left-1.5 border-[6px] border-transparent border-r-slate-900/98" />
                          <div className="flex items-center justify-between gap-1 mb-1 pb-1 border-b border-slate-700/60">
                            <span className="text-[12px] font-black text-brand-300">상장일</span>
                            <span className="text-[9.5px] text-slate-400 font-mono">운용 역사</span>
                          </div>
                          <p className="text-[11px] text-neutral-200 leading-snug mb-1 font-medium">
                            한국거래소(KRX)에 최초 상장된 일자입니다.
                          </p>
                          <div className="text-[10.5px] text-slate-400">
                            💡 상장 역사가 오래될수록 다양한 시장 위기를 겪으며 검증된 트랙레코드를 보유합니다.
                          </div>
                        </div>
                      </div>
                    </th>
                    {compareList.map((etf) => {
                      const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                      return (
                        <td key={`listing-${etf.ticker}`} className={`whitespace-nowrap border-b border-r border-slate-100 px-0.5 sm:px-1.5 py-0.5 transition-colors text-center align-middle font-mono text-[10px] sm:text-[11px] text-slate-700 font-semibold ${isBase ? "bg-emerald-50/30" : ""}`}>
                          {formatListingDate(etf.listingDate)}
                        </td>
                      );
                    })}
                    {hasPlaceholder && (
                      <td className="border-b border-r border-slate-100 px-0.5 sm:px-1 py-0.5 text-center text-neutral-300 bg-slate-50/20 align-middle">
                        <span className="text-xs text-neutral-300 select-none">-</span>
                      </td>
                    )}
                  </tr>

                  {/* 환헤지 여부 */}
                  <tr className="hover:bg-slate-50/70 hover:z-40 relative">
                    <th className={`sticky left-[36px] sm:left-[50px] z-20 hover:z-50 bg-slate-50/95 backdrop-blur-md px-0.5 sm:px-1 py-0.5 text-[10px] sm:text-[11px] font-semibold text-slate-600 border-b border-r border-slate-200/60 transition-all duration-200 text-center align-middle ${shadowClass}`}>
                      <div className="flex items-center justify-center gap-0.5 group relative w-fit mx-auto">
                        <button
                          type="button"
                          onClick={() => setActiveMetricModal("fxHedge")}
                          aria-label="환헤지 여부 안내 보기"
                          className="inline-flex items-center justify-center gap-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-sm group/btn"
                        >
                          <span className="leading-tight group-hover/btn:text-emerald-700 transition-colors">환헤지</span>
                          <svg className="size-2.5 text-slate-400 group-hover/btn:text-emerald-600 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        <div className="hidden sm:block absolute left-[calc(100%+8px)] bottom-[-10px] w-72 p-3.5 rounded-xl bg-slate-900/98 backdrop-blur-md text-white text-left shadow-2xl border border-slate-700/90 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none group-focus-within:pointer-events-auto transition-all duration-200 z-[120] whitespace-normal break-keep">
                          <div className="absolute bottom-5 -left-1.5 border-[6px] border-transparent border-r-slate-900/98" />
                          <div className="flex items-center justify-between gap-1 mb-1.5 pb-1 border-b border-slate-800">
                            <span className="text-[12px] font-black text-amber-300">환헤지 여부</span>
                            <span className="text-[9.5px] text-slate-400 font-mono">환율 위험</span>
                          </div>
                          <div className="space-y-1 text-xs bg-slate-800/90 p-2 rounded-lg border border-slate-700/60 mb-2">
                            <div className="flex items-start gap-1.5">
                              <span className="text-amber-300 font-bold shrink-0 text-[10.5px]">• 환헤지(H):</span>
                              <span className="text-slate-200 text-[10.5px]">환율 변동을 제거하고 자산 가치만 추종</span>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <span className="text-sky-300 font-bold shrink-0 text-[10.5px]">• 환노출(UH):</span>
                              <span className="text-slate-200 text-[10.5px]">자산 가격 변동 + 환율 변동이 동시 반영</span>
                            </div>
                          </div>
                          <div className="text-[10.5px] text-slate-300">
                            💡 달러 강세 시 환노출이, 달러 약세 시 환헤지가 유리합니다.
                          </div>
                        </div>
                      </div>
                    </th>
                    {compareList.map((etf) => {
                      const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                      const hedgeInfo = getFxHedgeInfo(etf);
                      return (
                        <td key={`fx-${etf.ticker}`} className={`border-b border-r border-slate-100 px-0.5 sm:px-1.5 py-0.5 transition-colors text-center align-middle ${isBase ? "bg-emerald-50/30" : ""}`}>
                          {hedgeInfo.type === "hedged" ? (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[8.5px] sm:text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs">
                              {hedgeInfo.label}
                            </span>
                          ) : hedgeInfo.type === "unhedged" ? (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[8.5px] sm:text-[9px] font-bold bg-sky-50 text-sky-800 border border-sky-200 shadow-2xs">
                              {hedgeInfo.label}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs font-medium">{hedgeInfo.label}</span>
                          )}
                        </td>
                      );
                    })}
                    {hasPlaceholder && (
                      <td className="border-b border-r border-slate-100 px-0.5 sm:px-1 py-0.5 text-center text-neutral-300 bg-slate-50/20 align-middle">
                        <span className="text-xs text-neutral-300 select-none">-</span>
                      </td>
                    )}
                  </tr>

                  {/* 기초 지수 */}
                  <tr className="hover:bg-slate-50/70">
                    <th className={`sticky left-[36px] sm:left-[50px] z-20 bg-slate-50/95 backdrop-blur px-0.5 sm:px-1 py-0.5 text-[10px] sm:text-[11px] font-semibold text-slate-600 border-b border-r border-slate-200/60 transition-shadow duration-200 text-center align-middle ${shadowClass}`}>
                      기초 지수
                    </th>
                    {compareList.map((etf) => {
                      const isBase = mainEtf && etf.ticker === mainEtf.ticker;
                      return (
                        <td key={etf.ticker} className={`border-b border-r border-slate-100 px-0.5 sm:px-1.5 py-0.5 transition-colors text-center align-middle ${isBase ? "bg-emerald-50/30" : ""}`}>
                          <span className="text-[9.5px] sm:text-[10.5px] font-semibold text-slate-700 leading-tight break-words [overflow-wrap:anywhere] line-clamp-2 block max-w-full" title={etf.baseIndex || ""}>{etf.baseIndex || "-"}</span>
                        </td>
                      );
                    })}
                    {hasPlaceholder && (
                      <td className="border-b border-r border-slate-100 px-0.5 sm:px-1 py-0.5 text-center text-neutral-300 bg-slate-50/20 align-middle">
                        <span className="text-xs text-neutral-300 select-none">-</span>
                      </td>
                    )}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 기간 더보기 & TR 토글 바 */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 py-2.5 sm:py-3 px-3 sm:px-4 bg-slate-50/70 border-t border-slate-200/80">
              <button
                type="button"
                role="switch"
                aria-checked={isTrMode}
                onClick={handleToggleTr}
                className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-1.5 text-xs font-bold text-slate-700 hover:text-emerald-800 hover:bg-slate-100 rounded-full transition-all active:scale-95 shadow-2xs border border-slate-200/80 bg-white"
              >
                <span className={isTrMode ? "text-emerald-700" : ""}>TR (배당 재투자) {isTrMode ? "ON" : "OFF"}</span>
                <div className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${isTrMode ? 'bg-emerald-600' : 'bg-slate-300'}`}>
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isTrMode ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                </div>
              </button>
              
              <button
                type="button"
                onClick={() => setShowAllPeriods(!showAllPeriods)}
                className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 text-xs font-bold text-slate-700 hover:text-emerald-800 hover:bg-slate-100 rounded-full transition-all active:scale-95 shadow-2xs border border-slate-200/80 bg-white"
              >
                <span>{showAllPeriods ? "핵심 기간만 보기 (1개월~1년)" : "전체 세부 기간 보기 (1일~3년)"}</span>
                <span className="text-[10px] text-slate-400">{showAllPeriods ? "▲" : "▼"}</span>
              </button>
            </div>

            {/* 법적 컴플라이언스 및 데이터 기준 각주 */}
            <div className="px-3 sm:px-4 py-2.5 bg-slate-50/50 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[10.5px] sm:text-[11px] text-slate-400 font-medium">
              <p>
                * 실부담비용: 금융투자협회 최근 공시 기준 · 수익률/순자산/괴리율: 최근 영업일 종가 기준 · 본 자료는 투자 참고용이며 권유 목적이 아닙니다.
              </p>
              <span className="font-mono text-[10px] sm:text-[10.5px] text-slate-400 shrink-0">
                {compareList[0]?.asOfDate ? `${compareList[0].asOfDate.replace(/-/g, ".")} 기준` : ""}
              </span>
            </div>
          </div>
        </div>
        );
      })()}

      {/* MOBILE METRIC DETAIL MODAL (BOTTOM SHEET / CENTER MODAL) */}
      {activeMetricModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={METRIC_INFOS[activeMetricModal].title}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setActiveMetricModal(null)}
        >
          <div
            className="w-full max-w-md bg-slate-900 text-white rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl border border-slate-700 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-black text-emerald-400">
                  {METRIC_INFOS[activeMetricModal].title}
                </h3>
                <span className="text-[10px] font-bold text-slate-300 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full">
                  {METRIC_INFOS[activeMetricModal].badge}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveMetricModal(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
                aria-label="닫기"
              >
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed mb-3">
              {METRIC_INFOS[activeMetricModal].desc}
            </p>

            {METRIC_INFOS[activeMetricModal].items && (
              <div className="space-y-1.5 text-xs bg-slate-800/90 p-3 rounded-xl border border-slate-700/60 mb-3">
                {METRIC_INFOS[activeMetricModal].items!.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className={`font-bold shrink-0 ${item.color || "text-slate-300"}`}>
                      • {item.label}:
                    </span>
                    <span className="text-slate-200">{item.text}</span>
                  </div>
                ))}
              </div>
            )}

            {METRIC_INFOS[activeMetricModal].tip && (
              <div className="text-[11.5px] text-amber-200/95 bg-amber-500/10 rounded-xl p-2.5 leading-snug border border-amber-500/20">
                <strong className="text-amber-300">💡 팁:</strong> {METRIC_INFOS[activeMetricModal].tip}
              </div>
            )}

            <div className="mt-4 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setActiveMetricModal(null)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors text-center cursor-pointer"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
