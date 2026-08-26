"use client";




import Link from "next/link";

import { useMemo, useState, useEffect } from "react";

import { Info, BookOpen, TrendingUp, TrendingDown, Minus, Calendar, ArrowUp } from "lucide-react";

import { MarketBriefingHistory } from "@/components/market-briefing/market-briefing-history";

import { FundFlowRanking } from "@/components/market-briefing/fund-flow-ranking";

import { DisparityAlert } from "@/components/market-briefing/disparity-alert";

import globalIndicesData from "@/data/market_indices.json";

import { useMarketBriefing, MarketIndex } from "@/lib/hooks/use-market-briefing";



type AssetClass = {

  asset_class: string;

  etf_count: number;

  up_count: number;

  flat_count: number;

  down_count: number;

  breadth_ratio_pct: number | null;

  aum_weighted_return_pct: number | null;

  total_aum: number;

  aum_share_pct: number;

  total_trade_value: number;

  trade_share_pct: number;

};



type AumWeightedReturn = {
  scope: "all" | "top_50" | "top_100" | "top_200";
  label: string;
  constituent_count: number;
  total_aum: number;
  aum_coverage_pct: number;
  weighted_return_pct: number;
  up_count?: number;
  flat_count?: number;
  down_count?: number;
};



type FocusEtf = {

  rank_no: number;

  ticker: string;

  etf_name: string;

  asset_class: string | null;

  close_value: number;

  change_pct: number;

  trade_value: number;

  trade_share_pct: number;

};



type Briefing = {

  asOfDate: string;

  isStale: boolean;

  staleDays: number;

  headline: { text: string | null; generationStatus: string };

  marketIndices: MarketIndex[];

  pulse: {

    generalEtfCount: number;

    upCount: number;

    flatCount: number;

    downCount: number;

    breadthRatioPct: number;

    marketTemperature: string;

    generalAumWeightedReturnPct: number;

    top50AumWeightedReturnPct: number;

    top100AumWeightedReturnPct: number;

    top200AumWeightedReturnPct: number;

    aumWeightedReturns: AumWeightedReturn[];

    generalTotalAum: number;

    generalTotalTradeValue: number;

    top10TradeSharePct: number;

    allTop10TradeSharePct?: number;

  };

  assetClasses: AssetClass[];

  focusEtfs: FocusEtf[];

  peerGroups?: any;

  fundFlow?: any;

  disparityWarning?: any;

};



const number = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

const decimal = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatWon = (value: number) => {
  if (value >= 1e12) return decimal.format(value / 1e12) + "조원";
  if (value >= 1e8) return number.format(value / 1e8) + "억원";
  return number.format(value) + "원";
};



function signedInt(value: number) {
  return `${value >= 0 ? "+" : ""}${number.format(value)}`;
}

function signed(value: number, unit = "%") {

  return `${value >= 0 ? "+" : ""}${decimal.format(value)}${unit}`;

}



function money(value: number) {

  if (value >= 1_000_000_000_000) return `${decimal.format(value / 1_000_000_000_000)}조원`;

  if (value >= 100_000_000) return `${decimal.format(value / 100_000_000)}억원`;

  return `${number.format(value)}원`;

}



function dateLabel(value?: string) {

  if (!value) return "-";

  const [year, month, day] = value.split("-");

  return `${year}.${month}.${day}`;

}



function changeTone(value?: number | null) {
  if (!value) return "text-neutral-500";
  if (value > 0) return "text-[#D92D20]";
  if (value < 0) return "text-[#175CD3]";
  return "text-neutral-500";
}



function changeSurface(value: number) {

  if (value > 0) return "bg-[#FFF0EF] text-[#B42318] ring-[#FFD7D2]";

  if (value < 0) return "bg-[#EFF8FF] text-[#175CD3] ring-[#B9E6FE]";

  return "bg-neutral-100 text-neutral-600 ring-neutral-200";

}





function InfoTooltip({
  text,
  side = "bottom",
  align = "center",
}: {
  text: React.ReactNode;
  side?: "top" | "bottom";
  align?: "left" | "center" | "right";
}) {
  const positionClasses =
    side === "top"
      ? "bottom-full mb-2"
      : "top-full mt-2";

  const alignClasses =
    align === "right"
      ? "right-0 translate-x-0"
      : align === "left"
      ? "left-0 translate-x-0"
      : "left-1/2 -translate-x-1/2";

  const arrowClasses =
    side === "top"
      ? align === "right"
        ? "-bottom-1 right-2 border-4 border-transparent border-t-neutral-900"
        : align === "left"
        ? "-bottom-1 left-2 border-4 border-transparent border-t-neutral-900"
        : "-bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-neutral-900"
      : align === "right"
      ? "-top-1 right-2 border-4 border-transparent border-b-neutral-900"
      : align === "left"
      ? "-top-1 left-2 border-4 border-transparent border-b-neutral-900"
      : "-top-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-b-neutral-900";

  return (
    <div className="group relative inline-flex items-center justify-center ml-1">
      <button
        type="button"
        aria-label="도움말"
        className="text-neutral-400 cursor-help transition-colors group-hover:text-neutral-600 focus:outline-none"
      >
        <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
      </button>
      <div
        className={`pointer-events-none absolute ${positionClasses} ${alignClasses} z-50 w-60 sm:w-64 rounded-xl bg-neutral-900/95 p-3 text-[11.5px] sm:text-xs leading-relaxed text-white opacity-0 shadow-2xl backdrop-blur-xs transition-all group-hover:pointer-events-auto group-hover:opacity-100 font-normal text-left`}
      >
        {text}
        <div className={`absolute ${arrowClasses}`} />
      </div>
    </div>
  );
}



function Skeleton() {

  return (

    <div className="space-y-6" aria-label="마켓 브리핑을 불러오는 중">

      <div className="h-64 animate-pulse rounded-[26px] bg-neutral-100" />

      <div className="h-56 animate-pulse rounded-[22px] bg-neutral-100" />

      <div className="h-72 animate-pulse rounded-[22px] bg-neutral-100" />

    </div>

  );

}



function ErrorState({ message }: { message: string }) {

  return (

    <section className="rounded-[22px] border border-amber-200 bg-amber-50 px-6 py-8 text-center">

      <p className="text-sm font-bold text-amber-950">마켓 브리핑을 준비하고 있습니다</p>

      <p className="mt-2 text-sm leading-6 text-amber-800">{message}</p>

      <p className="mt-4 text-xs text-amber-700">기준일에 일치하는 검증된 데이터가 준비되면 자동으로 표시됩니다.</p>

    </section>

  );

}



function BreadthBar({ pulse }: { pulse: Briefing["pulse"] }) {

  const total = pulse.generalEtfCount || 1;

  const up = (pulse.upCount / total) * 100;

  const flat = (pulse.flatCount / total) * 100;

  const down = (pulse.downCount / total) * 100;



  return (

    <div className="mt-3">

      <div className="flex h-2.5 overflow-hidden rounded-full bg-black/5" aria-label={`상승 ${pulse.upCount}개 보합 ${pulse.flatCount}개 하락 ${pulse.downCount}개`}>

        <span className="bg-[#E5484D]" style={{ width: `${up}%` }} />

        <span className="bg-neutral-300" style={{ width: `${flat}%` }} />

        <span className="bg-[#2879BB]" style={{ width: `${down}%` }} />

      </div>

      <div className="mt-2.5 flex flex-wrap gap-x-2 gap-y-1 text-[11px] font-medium">

        <span className="text-[#D92D20]">상승 {number.format(pulse.upCount)}</span>

        <span className="text-neutral-500">보합 {number.format(pulse.flatCount)}</span>

        <span className="text-[#175CD3]">하락 {number.format(pulse.downCount)}</span>

      </div>

    </div>

  );

}



function formatChange(code: string, changePct: number) {
  const isBondYield = code === "KR10Y" || code === "DGS10";
  if (isBondYield) {
    const sign = changePct > 0 ? "+" : changePct < 0 ? "-" : "";
    return `${sign}${Math.abs(changePct).toFixed(2)}%p`;
  }
  const sign = changePct > 0 ? "+" : changePct < 0 ? "-" : "";
  return `${sign}${Math.abs(changePct).toFixed(2)}%`;
}

function IndexRow({ index }: { index: MarketIndex }) {
  const change = index.change_pct ?? 0;
  const isUp = change > 0;
  const isDown = change < 0;
  
  const isVol = index.code === "VIX" || index.code === "VKOSPI";
  const isBondYield = index.code === "KR10Y" || index.code === "DGS10";
  
  let surfaceClass = changeSurface(change);
  if (isVol) {
    surfaceClass = isUp ? "bg-[#FEF3C7] text-[#D97706] ring-[#FDE68A]" : isDown ? "bg-[#DCFCE7] text-[#166534] ring-[#BBF7D0]" : "bg-neutral-100 text-neutral-500 ring-neutral-200";
  } else if (isBondYield) {
    surfaceClass = isUp ? "bg-[#EFF8FF] text-[#175CD3] ring-[#B2DDFF]" : isDown ? "bg-[#FEF3F2] text-[#B42318] ring-[#FECDCA]" : "bg-neutral-100 text-neutral-500 ring-neutral-200";
  }

  const trendIcon = isUp ? (
    <TrendingUp className="w-3 h-3 stroke-[2.5]" />
  ) : isDown ? (
    <TrendingDown className="w-3 h-3 stroke-[2.5]" />
  ) : (
    <Minus className="w-2.5 h-2.5 stroke-[2.5]" />
  );

  let unit = "";
  if (["KOSPI", "KOSDAQ", "SPX", "NDX", "VKOSPI", "VIX"].includes(index.code)) unit = "pt";
  else if (isBondYield) unit = "%";
  else if (index.code === "USDKRW") unit = "원";
  else if (["CLF", "GC", "SI"].includes(index.code)) unit = "$";

  return (
    <div className="grid grid-cols-[1fr_auto_80px] items-center gap-2 py-2.5 px-2 rounded-xl transition-colors hover:bg-neutral-50/70 border-b border-neutral-100/80 last:border-0">
      {/* 1열: 지표명 */}
      <div className="flex items-center gap-1.5 min-w-0">
        {index.code === "KR10Y" ? (
          <>
            <img src="https://flagcdn.com/w40/kr.png" className="w-[18px] h-[13px] rounded-xs object-cover shadow-2xs shrink-0" alt="KR" />
            <span className="text-[13px] font-bold text-neutral-800 tracking-tight truncate">국채 10년</span>
          </>
        ) : index.code === "DGS10" ? (
          <>
            <img src="https://flagcdn.com/w40/us.png" className="w-[18px] h-[13px] rounded-xs object-cover shadow-2xs shrink-0" alt="US" />
            <span className="text-[13px] font-bold text-neutral-800 tracking-tight truncate">국채 10년</span>
          </>
        ) : index.code === "VKOSPI" ? (
          <>
            <span className="text-[13px] font-bold text-neutral-800 tracking-tight truncate">VKOSPI</span>
            <InfoTooltip text="한국 KOSPI 200 옵션 가격을 기반으로 산출된 일명 '공포 지수'입니다. 수치가 상승하면 국내 투자자들의 불안 심리가 커져 주식 시장이 하락할 가능성이 높고, 하락하면 시장이 안정세를 보이고 있음을 의미합니다." />
          </>
        ) : index.code === "VIX" ? (
          <>
            <span className="text-[13px] font-bold text-neutral-800 tracking-tight truncate">VIX</span>
            <InfoTooltip text="미국 S&P 500 지수의 향후 30일간 변동성에 대한 시장의 기대를 나타내는 일명 '공포 지수'입니다. 수치가 상승하면 투자자들의 불안 심리가 커져 주식 시장이 하락할 가능성이 높고, 하락하면 시장이 안정세를 보이고 있음을 의미합니다." />
          </>
        ) : index.code === "USDKRW" ? (
          <span className="text-[13px] font-bold text-neutral-800 tracking-tight truncate">원/달러</span>
        ) : index.code === "CLF" ? (
          <span className="text-[13px] font-bold text-neutral-800 tracking-tight truncate">WTI 원유</span>
        ) : index.code === "GC" ? (
          <span className="text-[13px] font-bold text-neutral-800 tracking-tight truncate">금 선물</span>
        ) : index.code === "SI" ? (
          <span className="text-[13px] font-bold text-neutral-800 tracking-tight truncate">은 선물</span>
        ) : (
          <span className="text-[13px] font-bold text-neutral-800 tracking-tight truncate">{index.label}</span>
        )}
      </div>
      
      {/* 2열: 종가 수치 (tabular-nums 우측 정렬) */}
      <div className="text-right flex items-baseline justify-end gap-0.5">
        <span className="text-[14px] sm:text-[15px] font-extrabold tracking-tight text-neutral-900 tabular-nums">{decimal.format(index.close)}</span>
        {unit && <span className="text-[10px] font-semibold text-neutral-400">{unit}</span>}
      </div>

      {/* 3열: 전일 대비 등락 배지 (너비 80px 고정 수직/수평 칼정렬) */}
      <div className="flex justify-end">
        <span className={`inline-flex w-[78px] items-center justify-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums ring-1 ring-inset ${surfaceClass}`}>
          {trendIcon}
          <span>{formatChange(index.code, change)}</span>
        </span>
      </div>
    </div>
  );
}

function MarketBriefingStickyBar({
  asOfDate,
  generalReturnPct,
  onOpenHistory,
}: {
  asOfDate: string;
  generalReturnPct: number;
  onOpenHistory?: () => void;
}) {
  const [activeStep, setActiveStep] = useState<string>("step-macro");
  const [isScrolled, setIsScrolled] = useState<boolean>(false);

  const steps = [
    { id: "step-macro", label: "거시 지표", step: "STEP 1" },
    { id: "step-pulse", label: "시장 온도", step: "STEP 2" },
    { id: "step-micro", label: "세부 동향", step: "STEP 3" },
    { id: "step-money", label: "자금 동향", step: "STEP 4" },
    { id: "step-trend", label: "주·월간 트렌드", step: "STEP 5" },
    { id: "step-scale", label: "시장 규모", step: "STEP 6" },
  ];

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 220);

      const scrollPos = window.scrollY + 140;
      for (let i = steps.length - 1; i >= 0; i--) {
        const el = document.getElementById(steps[i].id);
        if (el && el.offsetTop <= scrollPos) {
          setActiveStep(steps[i].id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const yOffset = -75;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  const isPositive = generalReturnPct >= 0;

  return (
    <div
      className={`sticky top-0 z-30 w-full transition-all duration-300 ${
        isScrolled
          ? "bg-white/95 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.06)] border-b border-[#E2E8D8] py-2"
          : "bg-transparent py-0 pointer-events-none"
      }`}
    >
      <div className={`mx-auto max-w-7xl px-4 sm:px-6 transition-opacity duration-300 ${isScrolled ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
        <div className="flex h-10 sm:h-11 items-center justify-between gap-3">
          {/* Left: 기준일 배지 & 날짜 표시 */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenHistory}
              className="flex items-center gap-1.5 rounded-xl bg-[#F4F7EE] hover:bg-[#EBF2E0] px-2.5 py-1 text-xs font-bold text-[#365314] transition-colors border border-[#D7EABB] shadow-2xs"
            >
              <Calendar className="w-3.5 h-3.5 text-[#5A7050]" />
              <span className="tabular-nums">{dateLabel(asOfDate)} 장마감</span>
            </button>
          </div>

          {/* Center: STEP 1~6 퀵 점프 탭 */}
          <nav className="hidden md:flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            {steps.map((s) => {
              const isActive = activeStep === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => scrollToSection(s.id)}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                    isActive
                      ? "bg-[#365314] text-white shadow-xs"
                      : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100/80"
                  }`}
                >
                  <span className={`text-[10px] font-black ${isActive ? "text-[#C2E29B]" : "text-neutral-400"}`}>
                    {s.step}
                  </span>
                  <span>{s.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right: 시장 요약 & 맨 위로 */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 rounded-lg bg-neutral-50 px-2 py-0.5 border border-neutral-200/70 text-xs">
              <span className="text-[10.5px] font-bold text-neutral-400">시장</span>
              <span className={`font-black tabular-nums ${isPositive ? "text-[#D92D20]" : "text-[#175CD3]"}`}>
                {isPositive ? `+${generalReturnPct.toFixed(2)}%` : `${generalReturnPct.toFixed(2)}%`}
              </span>
            </div>

            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
              title="맨 위로 이동"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MarketBriefing() {

  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  const [step5Tab, setStep5Tab] = useState<'weekly' | 'monthly'>('weekly');

  const { briefing, isLoading, isRefreshing, error, refresh } = useMarketBriefing({

    asOfDate: selectedDate,

    revalidateOnFocus: !selectedDate,

    revalidateIntervalMs: selectedDate ? 0 : 10 * 60 * 1000,

  });



  const orderedIndices = useMemo(() => {
    if (!briefing) return [];

    const mergedIndices = [...briefing.marketIndices];

    const addGlobalIndex = (label: string, code: string) => {
      const found = globalIndicesData.indices.find(
        (i) => i.code === code || i.label === label || i.label === label.replace(" ", "")
      );
      if (found && !mergedIndices.some((m) => m.code === code)) {
        mergedIndices.push({
          code: code,
          label: label,
          close: found.value,
          change_pct: found.change,
          as_of_date: found.as_of_date || briefing.asOfDate,
        });
      }
    };

    addGlobalIndex("코스피 변동성지수", "VKOSPI");
    addGlobalIndex("S&P 500", "SPX");
    addGlobalIndex("나스닥", "NDX");
    addGlobalIndex("VIX", "VIX");
    addGlobalIndex("원/달러", "USDKRW");
    addGlobalIndex("국채 10년", "KR10Y");
    addGlobalIndex("국고채 10년", "KR10Y");
    addGlobalIndex("미 국채 10년물", "DGS10");
    addGlobalIndex("미국 국채 10년", "DGS10");
    addGlobalIndex("WTI 원유", "CLF");
    addGlobalIndex("금 선물", "GC");
    addGlobalIndex("은 선물", "SI");

    const order = [
      "KOSPI", "KOSDAQ", "VKOSPI",
      "SPX", "NDX", "VIX",
      "USDKRW", "KR10Y", "DGS10",
      "CLF", "GC", "SI",
    ];

    return mergedIndices.sort((a, b) => {
      const idxA = order.indexOf(a.code);
      const idxB = order.indexOf(b.code);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  }, [briefing]);



  const sortedAssetClasses = useMemo(() => {
    if (!briefing) return [];
    return [...briefing.assetClasses]
      .map((row) => ({
        ...row,
        contribution_pct: ((row.aum_weighted_return_pct ?? 0) * row.aum_share_pct) / 100,
      }))
      .sort((a, b) => (b.total_aum ?? 0) - (a.total_aum ?? 0));
  }, [briefing]);



  if (isLoading) return <Skeleton />;

  if (!briefing) return <ErrorState message={error ?? "검증된 브리핑이 아직 없습니다."} />;



  const { pulse } = briefing;

  const scopeReturns = new Map(pulse.aumWeightedReturns.map((item) => [item.scope, item]));

  const scaleRows = [
    { scope: "all" as const, label: "전체 ETF", value: pulse.generalAumWeightedReturnPct, detail: `일반 ETF ${number.format(pulse.generalEtfCount)}개` },
    { scope: "top_50" as const, label: "순자산 Top 50", value: pulse.top50AumWeightedReturnPct, detail: "순자산 상위 50개 ETF" },
    { scope: "top_100" as const, label: "순자산 Top 100", value: pulse.top100AumWeightedReturnPct, detail: "순자산 상위 100개 ETF" },
    { scope: "top_200" as const, label: "순자산 Top 200", value: pulse.top200AumWeightedReturnPct, detail: "순자산 상위 200개 ETF" },
  ];

  const maxScale = Math.max(...scaleRows.map((row) => Math.abs(row.value)), 0.01);

  const maxContribution = Math.max(...sortedAssetClasses.map((row) => Math.abs(row.contribution_pct)), 0.01);

    const isPositive = pulse.generalAumWeightedReturnPct >= 0;
  
  const validClasses = briefing.assetClasses.filter(c => c.etf_count >= 10);
  const bestClass = validClasses.reduce((prev, curr) => (curr.aum_weighted_return_pct ?? -Infinity) > (prev.aum_weighted_return_pct ?? -Infinity) ? curr : prev, validClasses[0]);
  const worstClass = validClasses.reduce((prev, curr) => (curr.aum_weighted_return_pct ?? Infinity) < (prev.aum_weighted_return_pct ?? Infinity) ? curr : prev, validClasses[0]);

  const bestTheme = briefing.peerGroups?.reduce((prev, curr) => 
    (curr.cappedAumWeightedReturnPct > (prev?.cappedAumWeightedReturnPct ?? -Infinity)) ? curr : prev
  , briefing.peerGroups[0]);

  const bestInflow = briefing.peerGroups?.reduce((prev, curr) => 
    ((curr.netInflowValue || 0) > ((prev?.netInflowValue || 0) ?? -Infinity)) ? curr : prev
  , briefing.peerGroups[0]);

  
    let themeSentence = "";
  if (briefing.peerGroups && briefing.peerGroups.length >= 6) {
    const sorted = [...briefing.peerGroups].sort((a, b) => b.cappedAumWeightedReturnPct - a.cappedAumWeightedReturnPct);
    const top3 = sorted.slice(0, 3);
    const bottom3 = sorted.slice(-3).reverse();
    
    const topStr = top3.map(t => `${t.peerGroup}(${signed(t.cappedAumWeightedReturnPct)})`).join(", ");
    const bottomStr = bottom3.map(t => `${t.peerGroup}(${signed(t.cappedAumWeightedReturnPct)})`).join(", ");
    
    themeSentence = `오늘 시장을 이끈 주도 테마는 ${topStr}이었으며, 반대로 ${bottomStr} 테마는 가장 부진했습니다. `;
  }
  
  let concentrationSentence = "";
  if (pulse.top10TradeSharePct > 40) {
    concentrationSentence = `또한 상위 10개 종목이 전체 거래대금의 ${decimal.format(pulse.top10TradeSharePct)}%를 차지할 만큼 쏠림 현상이 뚜렷했습니다.`;
  }

  const headline = `일반 ETF ${number.format(pulse.generalEtfCount)}개 중 상승 ${pulse.upCount}개 하락 ${pulse.downCount}개로 평균 ${signed(pulse.generalAumWeightedReturnPct)} ${isPositive ? '상승' : '하락'}하며 전반적인 ${isPositive ? '강세' : '약세'}를 보였습니다. ${themeSentence}${concentrationSentence}`.trim();



  const ret = pulse.generalAumWeightedReturnPct;

  const br = pulse.breadthRatioPct;

  let dynamicTitle = "상승과 하락이 팽팽하게 맞서며 혼조세를 보인 하루였습니다 ⚖️";
  if (ret < -1.0) {
    dynamicTitle = "시장이 큰 폭으로 하락하며 투자 심리가 얼어붙은 하루였습니다 📉";
  } else if (ret < 0) {
    dynamicTitle = "전반적인 약세 흐름 속에 하락 마감한 하루였습니다 🌧️";
  } else if (ret > 1.0) {
    dynamicTitle = "강한 매수세가 유입되며 시장이 뜨겁게 달아오른 하루였습니다 🚀";
  } else if (ret > 0) {
    dynamicTitle = "훈훈한 온기가 퍼지며 소폭 상승 마감한 하루였습니다 ☀️";
  }

  const upRatio = pulse.upCount / pulse.generalEtfCount;
  const downRatio = pulse.downCount / pulse.generalEtfCount;
  let breadthSentence = "상승과 하락 종목 수가 팽팽하게 맞서며 시장 방향성을 탐색하고 있습니다.";
  
  if (ret > 1.0) {
    if (upRatio > 0.6) {
      breadthSentence = "시장 전반에 강한 매수세가 유입되며 다수의 ETF가 동반 상승하는 강세를 보였습니다.";
    } else {
      breadthSentence = "지수 대표주 및 일부 테마가 크게 오르며 전체 시장의 강한 상승을 견인했습니다.";
    }
  } else if (ret > 0) {
    if (upRatio > 0.6) {
      breadthSentence = "시장 전반적으로 온기가 퍼지며 다수의 ETF가 상승하는 흐름을 보였습니다.";
    } else if (pulse.downCount > pulse.upCount) {
      breadthSentence = "가중수익률은 상승했으나 하락한 ETF가 더 많아, 소수 주도 테마에 상승이 집중되었습니다.";
    } else {
      breadthSentence = "상승과 하락이 엇갈리는 가운데, 지수 대표주들의 방어로 소폭 강세를 보였습니다.";
    }
  } else if (ret >= -1.0) {
    if (downRatio > 0.6) {
      breadthSentence = "대다수의 ETF가 하락을 기록하며 시장 전반이 소폭 약세를 보였습니다.";
    } else if (pulse.upCount > pulse.downCount) {
      breadthSentence = "가중수익률은 하락했으나 상승한 ETF가 더 많아, 시장 내면의 투자 심리는 비교적 양호했습니다.";
    } else {
      breadthSentence = "뚜렷한 주도 테마가 부재한 가운데, 전반적으로 약보합 흐름을 나타냈습니다.";
    }
  } else {
    // ret < -1.0
    if (downRatio > 0.6) {
      breadthSentence = "대부분의 ETF가 일제히 약세를 보이며 시장 전반의 투자 심리가 크게 위축되었습니다.";
    } else {
      breadthSentence = "지수 대표주 및 주요 테마의 낙폭이 커지며 전체 시장이 뚜렷한 하락세를 기록했습니다.";
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-12 sm:space-y-16 pb-12">
      {/* Master Hero Header */}
      <header className="pt-2">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-neutral-200/80">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EBF5DC] px-2.5 py-0.5 text-[11px] font-extrabold text-[#365314] border border-[#CDE5B1]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#65A30D] animate-pulse" />
                DAILY MARKET PULSE
              </span>
              <span className="text-xs font-semibold text-neutral-400">KRX 전종목 전수 분석</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-neutral-900">
              ETF 데일리 마켓 브리핑
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm font-medium text-neutral-600">
              대한민국 ETF 시장의 거시 맥락과 스마트머니 자금 흐름을 전수 분석한 일간 인텔리전스 리포트입니다.
            </p>
          </div>

          {/* 통합 마스터 기준일 뱃지 클러스터 */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            <div className="rounded-2xl border border-[#D7EABB] bg-[#FAFDF4] px-4 py-2.5 text-right shadow-2xs">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#5A7050]">Analysis Date</p>
              <p className="text-sm sm:text-base font-black text-neutral-900 tabular-nums">
                {dateLabel(briefing.asOfDate)} 장마감 기준
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Sticky Floating As-of-Date & Quick Step Navigation Bar */}
      <MarketBriefingStickyBar
        asOfDate={briefing.asOfDate}
        generalReturnPct={pulse.generalAumWeightedReturnPct}
        onOpenHistory={() => {
          const el = document.getElementById("briefing-history-section");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }}
      />

      {/* 서비스 준비 공지 (경량화 배너) */}
      <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-xs sm:text-sm text-amber-800 flex items-start gap-2.5">
        <span className="text-base shrink-0 mt-0.5">🚧</span>
        <div>
          <strong className="font-bold text-amber-900 mr-1.5">[서비스 안내]</strong>
          현재 마켓 브리핑 전체 데이터 및 기능 고도화 작업이 진행 중입니다. 조속히 작업을 마무리하여 더 안정적인 분석을 제공하겠습니다.
        </div>
      </div>

      {selectedDate && (
        <div className="flex items-center justify-between rounded-xl bg-[#EFF8D8] px-5 py-3 text-sm text-[#476237]">
          <p><strong>{dateLabel(briefing.asOfDate)}</strong> 기준의 과거 마켓 브리핑을 보고 계십니다.</p>
          <button type="button" onClick={() => setSelectedDate(undefined)} className="font-bold underline hover:no-underline">
            최신 브리핑으로 돌아가기
          </button>
        </div>
      )}

      {/* Tickery's 3-Point Mini Dashboard */}
      <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-b from-[#F5F9ED] to-[#FBFDF8] border border-[#D7EABB] p-6 shadow-[0_8px_24px_rgba(43,61,39,0.04)] sm:p-8">

        <div className="relative z-10">

          <div className="flex flex-wrap items-center justify-between gap-4">

            <div className="flex items-center gap-3">

              <p className="flex items-center gap-1.5 text-sm font-extrabold tracking-tight text-[#365314]">

                <span className="text-lg">💡</span> 오늘의 마켓 브리핑 핵심 포인트 3가지

              </p>

              <span className="text-xs font-medium text-neutral-400 border-l border-[#D7EABB] pl-3">{dateLabel(briefing.asOfDate)} 기준</span>

              {briefing.isStale && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">갱신 지연</span>}

            </div>

            

            <details className="group relative">

              <summary className="list-none cursor-pointer flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 shadow-sm border border-[#DDE6D0] hover:bg-neutral-50 transition-colors">

                <BookOpen className="h-3.5 w-3.5 text-[#7DAD55]" />

                <span>이 화면 읽는 법</span>

              </summary>

              <div className="absolute right-0 top-full mt-2 w-72 rounded-xl bg-white p-4 text-sm leading-6 text-neutral-700 shadow-xl border border-[#DDE6D0] z-50">

                <p>ETF 시장은 거시 경제의 영향을 가장 먼저 받습니다. 아래 순서대로 파악해 보세요!</p>

                                  <ul className="mt-3 space-y-1.5 font-medium">
                    <li><span className="text-[#5A7050]">STEP 1.</span> 거시 지표 (오늘 시장의 배경)</li>
                    <li><span className="text-[#5A7050]">STEP 2.</span> 시장 온도 (전체 ETF의 반응)</li>
                    <li><span className="text-[#5A7050]">STEP 3.</span> 세부 동향 (테마 등락률)</li>
                    <li><span className="text-[#5A7050]">STEP 4.</span> 자금 동향 (일일 순유입)</li>
                    <li><span className="text-[#5A7050]">STEP 5.</span> 트렌드 (주/월간 순유입)</li>
                    <li><span className="text-[#5A7050]">STEP 6.</span> 시장 규모 (AUM 추적)</li>
                  </ul>

              </div>

            </details>

          </div>

          

          <div className="mt-5 mb-6">

            <h2 className="text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl">

              {dynamicTitle}

            </h2>

          </div>

          

                    <div className="grid gap-4 lg:grid-cols-[1fr_2fr] md:grid-cols-[1fr_1.5fr]">
            {/* Card 1: Today's Highlights */}
            <div className="rounded-[20px] border border-[#E5E8E2] bg-white p-5 shadow-[0_4px_12px_rgba(27,38,26,0.02)] flex flex-col justify-between hover:-translate-y-0.5 transition-transform">
              <div>
                <div className="flex items-center gap-1.5 mb-5">
                  <span className="text-[15px]">🔥</span>
                  <p className="text-[12px] font-extrabold tracking-wide text-neutral-500">오늘의 시장 하이라이트</p>
                </div>
                <div className="space-y-4">
                  {/* Highlight 1: Best Theme */}
                  {bestTheme && (
                    <div className="flex items-center justify-between bg-[#F9FBFC] rounded-xl p-3 border border-[#EDF2DE]">
                      <div>
                        <p className="text-[10px] font-extrabold text-neutral-400 mb-0.5">수익률 1위 테마</p>
                        <p className="text-[14px] font-bold text-neutral-800">{bestTheme.peerGroup}</p>
                      </div>
                      <span className={`text-[16px] font-extrabold tabular-nums tracking-tight ${changeTone(bestTheme.cappedAumWeightedReturnPct)}`}>
                        {signed(bestTheme.cappedAumWeightedReturnPct)}
                      </span>
                    </div>
                  )}
                  {/* Highlight 2: Best Inflow */}
                  {bestInflow && (
                    <div className="flex items-center justify-between bg-[#F9FBFC] rounded-xl p-3 border border-[#EDF2DE]">
                      <div>
                        <p className="text-[10px] font-extrabold text-neutral-400 mb-0.5">순유입 1위 테마</p>
                        <p className="text-[14px] font-bold text-neutral-800">{bestInflow.peerGroup}</p>
                      </div>
                      <span className="text-[16px] font-extrabold tabular-nums tracking-tight text-[#EE4B58]">
                        +{number.format((bestInflow.netInflowValue || 0) / 100000000)}<span className="text-[12px] opacity-80">억원</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Card 2: Feature (Summary) */}
            <div className="rounded-[20px] border border-[#E5E8E2] bg-white p-6 shadow-[0_4px_12px_rgba(27,38,26,0.02)] flex flex-col justify-between hover:-translate-y-0.5 transition-transform">
              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[15px]">💡</span>
                    <p className="text-[12px] font-extrabold tracking-wide text-neutral-500">3줄 요약 브리핑</p>
                  </div>
                  {briefing.disparityWarning && briefing.disparityWarning.length > 0 && (
                    <span className="inline-flex items-center rounded-full bg-[#FFF5F5] px-2 py-0.5 text-[10px] font-bold text-[#D84957] ring-1 ring-inset ring-[#F3C5C9]">
                      ⚠️ 괴리율 주의
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {headline.split('. ').map((sentence, i) => {
                    if (!sentence) return null;
                    return (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#9ACD68] mt-2 shrink-0"></div>
                        <p className="text-[14px] font-medium leading-relaxed text-neutral-800">
                          {sentence.trim()}{sentence.endsWith('.') ? '' : '.'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute -right-20 -top-20 z-0 h-64 w-64 rounded-full bg-gradient-to-br from-[#E5F5D5] to-transparent blur-3xl pointer-events-none" />

      </section>



      {/* STEP 1: Macro */}


      {briefing.marketIndices.length > 0 && (
        <section id="step-macro" aria-labelledby="market-index-title" className="mb-14 scroll-mt-20">
          <div className="mb-5 border-l-4 border-[#9ACD68] pl-3.5">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#5A7050]">STEP 1. MACRO ECONOMY</p>
            </div>
            <h2 id="market-index-title" className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight text-neutral-900">
              오늘 시장의 배경은? (거시 지표)
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm text-neutral-500">
              ETF 가격 변동의 원인이 되는 주요 지표와 전 거래일 대비 변동폭입니다.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 국내 증시 */}
            <div className="bg-white border border-[#E5E8E2] rounded-2xl p-3.5 sm:p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <div className="grid grid-cols-[1fr_auto_80px] items-center gap-2 pb-2.5 mb-1 px-2 border-b border-neutral-100">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <img src="https://flagcdn.com/w40/kr.png" className="w-[18px] h-[13px] rounded-xs object-cover shadow-2xs" alt="KR" />
                    <h3 className="text-[13px] font-extrabold text-neutral-800 tracking-tight">국내 증시</h3>
                  </div>
                  <span className="text-[11px] font-bold text-neutral-400 text-right pr-0.5">종가</span>
                  <span className="text-[11px] font-bold text-neutral-400 text-center">전일 대비</span>
                </div>
                <div className="flex flex-col">
                  {orderedIndices.filter(i => ["KOSPI", "KOSDAQ", "VKOSPI"].includes(i.code)).map(i => <IndexRow key={i.code} index={i} />)}
                </div>
              </div>
            </div>
            
            {/* 미국 증시 */}
            <div className="bg-white border border-[#E5E8E2] rounded-2xl p-3.5 sm:p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <div className="grid grid-cols-[1fr_auto_80px] items-center gap-2 pb-2.5 mb-1 px-2 border-b border-neutral-100">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <img src="https://flagcdn.com/w40/us.png" className="w-[18px] h-[13px] rounded-xs object-cover shadow-2xs" alt="US" />
                    <h3 className="text-[13px] font-extrabold text-neutral-800 tracking-tight">미국 증시</h3>
                  </div>
                  <span className="text-[11px] font-bold text-neutral-400 text-right pr-0.5">종가</span>
                  <span className="text-[11px] font-bold text-neutral-400 text-center">전일 대비</span>
                </div>
                <div className="flex flex-col">
                  {orderedIndices.filter(i => ["SPX", "NDX", "VIX"].includes(i.code)).map(i => <IndexRow key={i.code} index={i} />)}
                </div>
              </div>
            </div>

            {/* 환율·금리 */}
            <div className="bg-white border border-[#E5E8E2] rounded-2xl p-3.5 sm:p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <div className="grid grid-cols-[1fr_auto_80px] items-center gap-2 pb-2.5 mb-1 px-2 border-b border-neutral-100">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm">💵</span>
                    <h3 className="text-[13px] font-extrabold text-neutral-800 tracking-tight">환율 · 금리</h3>
                  </div>
                  <span className="text-[11px] font-bold text-neutral-400 text-right pr-0.5">종가</span>
                  <span className="text-[11px] font-bold text-neutral-400 text-center">전일 대비</span>
                </div>
                <div className="flex flex-col">
                  {orderedIndices.filter(i => ["USDKRW", "KR10Y", "DGS10"].includes(i.code)).map(i => <IndexRow key={i.code} index={i} />)}
                </div>
              </div>
            </div>

            {/* 원자재 */}
            <div className="bg-white border border-[#E5E8E2] rounded-2xl p-3.5 sm:p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <div className="grid grid-cols-[1fr_auto_80px] items-center gap-2 pb-2.5 mb-1 px-2 border-b border-neutral-100">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm">⛏️</span>
                    <h3 className="text-[13px] font-extrabold text-neutral-800 tracking-tight">원자재</h3>
                  </div>
                  <span className="text-[11px] font-bold text-neutral-400 text-right pr-0.5">종가</span>
                  <span className="text-[11px] font-bold text-neutral-400 text-center">전일 대비</span>
                </div>
                <div className="flex flex-col">
                  {orderedIndices.filter(i => ["CLF", "GC", "SI"].includes(i.code)).map(i => <IndexRow key={i.code} index={i} />)}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}



      {/* STEP 2: Market Pulse & My Portfolio */}
      <section id="step-pulse" aria-labelledby="market-pulse-title" className="mb-16 scroll-mt-20">
        <div className="mb-6">
          <div className="border-l-4 border-[#9ACD68] pl-3 mb-3">
            <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#5A7050]">STEP 2. MARKET PULSE</p>
            <h2 id="market-pulse-title" className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900">
              오늘 시장의 체감 온도는? (체감 지표)
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              수익률 분포와 시장 거래대금 쏠림 현상을 통해 일반 ETF 시장의 온도를 진단합니다.
            </p>
          </div>
        </div>

        {(() => {
          const totalCount = pulse.generalEtfCount || (pulse.upCount + pulse.flatCount + pulse.downCount) || 1;
          const upRatio = ((pulse.upCount / totalCount) * 100).toFixed(1);
          const flatRatio = ((pulse.flatCount / totalCount) * 100).toFixed(1);
          const downRatio = ((pulse.downCount / totalCount) * 100).toFixed(1);

          const isOverheated = pulse.top10TradeSharePct > 60;
          const isCaution = pulse.top10TradeSharePct > 45 && pulse.top10TradeSharePct <= 60;
          const statusBadge = isOverheated 
            ? { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200', tag: '🔴 과열' }
            : isCaution 
            ? { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', tag: '🟡 주의' }
            : { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', tag: '🟢 양호' };

          const isPositive = (pulse.generalAumWeightedReturnPct ?? 0) > 0;
          const isNegative = (pulse.generalAumWeightedReturnPct ?? 0) < 0;

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* 1. Market Breadth (시장 체온) */}
              <div className="bg-white border border-[#E5E8E2] rounded-[24px] p-6 shadow-[0_4px_16px_rgba(27,38,26,0.03)] flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  {/* 카드 상단 헤더 */}
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-extrabold text-neutral-800 tracking-tight">전체 시장 체온</span>
                      <span className="text-[10px] font-bold text-[#5A7050] bg-[#F4F7EC] px-2 py-0.5 rounded-full border border-[#D7EABB]">
                        일반 가중수익률
                      </span>
                    </div>
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-50 border border-neutral-200/70 text-[11px] font-medium text-neutral-500">
                      <span className="hidden sm:inline text-neutral-400">일반</span>
                      <strong className="font-extrabold text-neutral-800 tabular-nums">
                        {number.format(pulse.generalEtfCount)}
                      </strong>
                      <span className="text-neutral-300">/</span>
                      <span className="text-[10.5px] text-neutral-400 tabular-nums">
                        <span className="hidden sm:inline">전체 </span>
                        {number.format(briefing.marketScale?.totalEtfCount || pulse.generalEtfCount)}개
                      </span>
                      <InfoTooltip 
                        text="시장 왜곡을 방지하기 위해 초단기 파킹형(CD/KOFR) 및 레버리지·인버스 상품을 제외한 실물 일반 ETF만을 정제 집계한 분석 모수입니다."
                        side="bottom"
                        align="right"
                      />
                    </div>
                  </div>

                  {/* 메인 수익률 지표 */}
                  <div className="my-5 flex items-baseline gap-2">
                    <span className={`text-4xl font-black tabular-nums tracking-tight ${changeTone(pulse.generalAumWeightedReturnPct)}`}>
                      {signed(pulse.generalAumWeightedReturnPct)}
                    </span>
                    <span className="text-xs font-semibold text-neutral-400">
                      {isPositive ? '전일 대비 상승세' : isNegative ? '전일 대비 하락세' : '보합세'}
                    </span>
                  </div>

                  {/* 게이지 바 영역 (3열 독립 범례 칩) */}
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-rose-50/80 border border-rose-100 rounded-xl py-2 px-2">
                        <p className="text-[10px] font-bold text-rose-500">상승</p>
                        <p className="text-[13px] font-extrabold text-rose-600 tabular-nums">
                          {pulse.upCount} <span className="text-[10px] font-semibold opacity-80">({upRatio}%)</span>
                        </p>
                      </div>
                      <div className="bg-neutral-50 border border-neutral-200/70 rounded-xl py-2 px-2">
                        <p className="text-[10px] font-bold text-neutral-500">보합</p>
                        <p className="text-[13px] font-extrabold text-neutral-700 tabular-nums">
                          {pulse.flatCount} <span className="text-[10px] font-semibold opacity-80">({flatRatio}%)</span>
                        </p>
                      </div>
                      <div className="bg-blue-50/80 border border-blue-100 rounded-xl py-2 px-2">
                        <p className="text-[10px] font-bold text-blue-500">하락</p>
                        <p className="text-[13px] font-extrabold text-blue-600 tabular-nums">
                          {pulse.downCount} <span className="text-[10px] font-semibold opacity-80">({downRatio}%)</span>
                        </p>
                      </div>
                    </div>

                    {/* 스택트 바 */}
                    <div className="w-full h-3.5 rounded-full flex overflow-hidden p-0.5 bg-neutral-100 ring-1 ring-neutral-200/50">
                      <div 
                        className="bg-[#EE4B58] rounded-l-full transition-all duration-500" 
                        style={{ width: `${upRatio}%` }} 
                        title={`상승 ${pulse.upCount}개 (${upRatio}%)`}
                      />
                      <div 
                        className="bg-neutral-300 transition-all duration-500 mx-[1px]" 
                        style={{ width: `${flatRatio}%` }} 
                        title={`보합 ${pulse.flatCount}개 (${flatRatio}%)`}
                      />
                      <div 
                        className="bg-[#4682EC] rounded-r-full transition-all duration-500" 
                        style={{ width: `${downRatio}%` }} 
                        title={`하락 ${pulse.downCount}개 (${downRatio}%)`}
                      />
                    </div>
                  </div>
                </div>

                {/* 하단 인사이트 박스 */}
                <div className="mt-6 pt-4 border-t border-neutral-100">
                  <div className="bg-[#F9FBFC] rounded-xl p-3.5 border border-neutral-100 min-h-[64px] flex items-center">
                    <p className="text-[12px] font-medium text-neutral-700 leading-relaxed">
                      💡 {breadthSentence}
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. Concentration (수급 건전성: 순수 일반 vs 전체 ETF 비교) */}
              <div className="bg-white border border-[#E5E8E2] rounded-[24px] p-6 shadow-[0_4px_16px_rgba(27,38,26,0.03)] flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  {/* 카드 상단 헤더 */}
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-extrabold text-neutral-800 tracking-tight">수급 건전성</span>
                      <span className="text-[10px] font-bold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
                        상위 10개 ETF 거래대금 쏠림도
                      </span>
                    </div>
                    <div className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}>
                      {statusBadge.tag}
                    </div>
                  </div>

                  {/* 일반 vs 전체 ETF 비교 듀얼 카드 (개수 명시 & 순수 일반 ETF에만 툴팁) */}
                  <div className="my-4 grid grid-cols-2 gap-2 bg-[#F9FBFC] p-3.5 rounded-2xl border border-neutral-100">
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-bold text-neutral-700">순수 일반 ETF ({number.format(pulse.generalEtfCount)}개)</span>
                        <InfoTooltip 
                          text="레버리지, 인버스, 파킹형(CD/KOFR) 상품을 제외한 순수 실물 주식·채권·섹터 ETF의 상위 10개 거래대금 쏠림도입니다. 왜곡 없는 산업/테마 시장의 실제 수급 건강도를 나타냅니다." 
                          side="bottom"
                          align="left"
                        />
                      </div>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-3xl font-black tabular-nums tracking-tight text-neutral-900">
                          {decimal.format(pulse.top10TradeSharePct)}
                        </span>
                        <span className="text-base font-extrabold text-neutral-400">%</span>
                      </div>
                    </div>

                    {pulse.allTop10TradeSharePct ? (
                      <div className="border-l border-neutral-200 pl-3.5">
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-bold text-neutral-500">전체 ETF ({number.format(briefing.marketScale?.totalEtfCount || pulse.generalEtfCount)}개)</span>
                        </div>
                        <div className="mt-1 flex items-baseline gap-1">
                          <span className="text-2xl font-extrabold text-neutral-700 tabular-nums">
                            {decimal.format(pulse.allTop10TradeSharePct)}%
                          </span>
                          {pulse.allTop10TradeSharePct > pulse.top10TradeSharePct && (
                            <span className="text-[11px] font-bold text-rose-500 ml-1">
                              (+{(pulse.allTop10TradeSharePct - pulse.top10TradeSharePct).toFixed(1)}%p)
                            </span>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* 3-Zone 수급 건전성 정밀 게이지 바 */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-[11px] font-bold text-neutral-400 px-0.5">
                      <span>0% (완전분산)</span>
                      <span className="text-emerald-700 font-extrabold">양호 (≤45%)</span>
                      <span className="text-amber-700 font-extrabold">주의 (~60%)</span>
                      <span className="text-rose-700 font-extrabold">(60%&lt;) 과열</span>
                      <span>100%</span>
                    </div>

                    <div className="relative w-full h-4 bg-neutral-100 rounded-full flex overflow-hidden ring-1 ring-neutral-200/50">
                      <div className="bg-[#A7F3D0] h-full" style={{ width: '45%' }} title="양호 구간 (0~45%)" />
                      <div className="bg-[#FDE68A] h-full border-l border-white/60" style={{ width: '15%' }} title="주의 구간 (45~60%)" />
                      <div className="bg-[#FECDD3] h-full border-l border-white/60" style={{ width: '40%' }} title="과열 구간 (60~100%)" />

                      {/* 현재 수치 마커 핀 */}
                      <div 
                        className="absolute top-0 bottom-0 w-2 bg-neutral-900 rounded-full ring-2 ring-white shadow-md transform -translate-x-1/2 transition-all duration-500"
                        style={{ left: `${Math.min(Math.max(pulse.top10TradeSharePct, 0), 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-0.5">
                      <span>수급 집중도 게이지</span>
                      <span>
                        현재 위치: <strong className="text-neutral-800 font-extrabold">{pulse.top10TradeSharePct.toFixed(1)}%</strong> ({isOverheated ? '과열 위험 구간' : isCaution ? '주의 구간' : '양호 분산 구간'})
                      </span>
                    </div>
                  </div>
                </div>

                {/* 하단 인사이트 박스 */}
                <div className="mt-6 pt-4 border-t border-neutral-100">
                  <div className="bg-[#F9FBFC] rounded-xl p-3.5 border border-neutral-100 min-h-[64px] flex items-center">
                    <p className="text-[12px] font-medium text-neutral-700 leading-relaxed">
                      {isOverheated 
                        ? "상위 10개 종목 비중이 60%를 초과하는 과열(🔴) 상태로, 소수의 주도 종목(지수 대표주, 인기 테마 등)으로 자금이 극심하게 쏠려있습니다." 
                        : isCaution 
                        ? "상위 10개 종목 비중이 45~60% 구간의 주의(🟡) 상태로, 특정 주도주나 테마를 중심으로 거래가 집중되고 있습니다." 
                        : "상위 10개 종목 비중이 45% 이하인 양호(🟢) 상태로, 시장 전반의 다양한 종목으로 자금이 건강하게 분산되어 있습니다."}
                    </p>
                  </div>
                </div>
              </div>

            </div>
          );
        })()}
      </section>

      {/* STEP 3: Micro Trends */}
      <section id="step-micro" className="scroll-mt-20">
        <div className="mb-4 border-l-4 border-[#9ACD68] pl-3">
          <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#5A7050]">STEP 3. MICRO TRENDS</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900">어떤 자산과 테마가 주도? (세부 동향)</h2>
          <p className="mt-1 text-sm text-neutral-500">자산군별 뼈대 흐름과 이를 주도한 세부 테마들의 성과입니다.</p>
        </div>

        {/* Part A: Macro Table (0-Scroll Responsive) */}
        <div className="mb-8 rounded-[20px] bg-white border border-[#E5E8E2] shadow-[0_4px_16px_rgba(27,38,26,0.03)] overflow-hidden">
          <div className="w-full">
            <table className="w-full border-collapse text-sm table-fixed">
              <thead>
                <tr className="bg-[#F8FAF6] border-b border-[#E8ECE1]">
                  <th scope="col" className="w-[26%] py-3 px-2.5 sm:px-4 md:px-5 text-left text-[11.5px] sm:text-[12px] font-extrabold text-[#5A7050]">자산군</th>
                  <th scope="col" className="w-[18%] py-3 px-2 sm:px-4 md:px-5 text-right text-[11.5px] sm:text-[12px] font-extrabold text-neutral-500">
                    <span className="hidden sm:inline">운용자산 (조원)</span>
                    <span className="sm:hidden">AUM(조)</span>
                  </th>
                  <th scope="col" className="w-[18%] py-3 px-2 sm:px-4 md:px-5 text-right text-[11.5px] sm:text-[12px] font-extrabold text-neutral-500">AUM 비중</th>
                  <th scope="col" className="w-[19%] py-3 px-2 sm:px-4 md:px-5 text-right text-[11.5px] sm:text-[12px] font-extrabold text-neutral-500">
                    <span className="inline-flex items-center justify-end gap-1">
                      <span>가중수익률</span>
                      <InfoTooltip 
                        text="해당 자산군 내 ETF들의 순자산(AUM) 규모를 가중 반영한 평균 등락률입니다." 
                        side="bottom" 
                        align="right" 
                      />
                    </span>
                  </th>
                  <th scope="col" className="w-[19%] py-3 px-2 sm:px-4 md:px-5 text-right text-[11.5px] sm:text-[12px] font-extrabold text-[#5A7050]">
                    <span className="inline-flex items-center justify-end gap-1">
                      <span>기여도 (%p)</span>
                      <InfoTooltip 
                        text="자산군 가중수익률(%) × AUM 비중(%)으로 계산되며, 시장 전체 가중수익률에 기여한 정도를 나타냅니다. 모든 자산군의 기여도 합산은 시장 전체 가중수익률과 수학적으로 일치합니다." 
                        side="bottom" 
                        align="right" 
                      />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F3EC]">
                {sortedAssetClasses.map(row => (
                  <tr key={row.asset_class} className="hover:bg-[#F9FBFC] transition-colors group">
                    <td className="py-3 px-2.5 sm:px-4 md:px-5 font-bold text-neutral-900 text-[12.5px] sm:text-[13.5px] truncate">
                      {row.asset_class}
                    </td>
                    <td className="py-3 px-2 sm:px-4 md:px-5 text-right tabular-nums text-neutral-700 font-semibold text-[12.5px] sm:text-[13px]">
                      {(row.total_aum / 1_000_000_000_000).toFixed(1)}
                      <span className="text-[10px] sm:text-[10.5px] font-normal text-neutral-400 ml-0.5">조</span>
                    </td>
                    <td className="py-3 px-2 sm:px-4 md:px-5 text-right tabular-nums font-semibold text-neutral-700 text-[12.5px] sm:text-[13px]">
                      {row.aum_share_pct.toFixed(1)}<span className="text-[10px] sm:text-[10.5px] font-normal text-neutral-400 ml-0.5">%</span>
                    </td>
                    <td className={`py-3 px-2 sm:px-4 md:px-5 text-right tabular-nums font-bold text-[12.5px] sm:text-[13px] ${changeTone(row.aum_weighted_return_pct)}`}>
                      {row.aum_weighted_return_pct === null ? "—" : signed(row.aum_weighted_return_pct)}
                    </td>
                    <td className="py-3 px-2 sm:px-4 md:px-5 text-right tabular-nums font-black text-[12.5px] sm:text-[13px]">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded ${
                        row.contribution_pct > 0 
                          ? "bg-[#FEF3F2] text-[#D92D20]" 
                          : row.contribution_pct < 0 
                          ? "bg-[#EFF8FF] text-[#175CD3]" 
                          : "text-neutral-500"
                      }`}>
                        {signed(row.contribution_pct, "%p")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-[#F4F7EE] font-bold text-neutral-900 text-[12.5px] sm:text-[13px] border-t-2 border-[#D7EABB]">
                <tr>
                  <td className="py-3 px-2.5 sm:px-4 md:px-5 font-black text-[#297160]">합계 (Total)</td>
                  <td className="py-3 px-2 sm:px-4 md:px-5 text-right tabular-nums">
                    {(sortedAssetClasses.reduce((sum, row) => sum + row.total_aum, 0) / 1_000_000_000_000).toFixed(1)}
                    <span className="text-[10px] sm:text-[10.5px] font-normal text-neutral-500 ml-0.5">조</span>
                  </td>
                  <td className="py-3 px-2 sm:px-4 md:px-5 text-right tabular-nums">100.0%</td>
                  <td className={`py-3 px-2 sm:px-4 md:px-5 text-right tabular-nums font-black ${changeTone(sortedAssetClasses.reduce((sum, row) => sum + row.contribution_pct, 0))}`}>
                    {signed(sortedAssetClasses.reduce((sum, row) => sum + row.contribution_pct, 0))}
                  </td>
                  <td className="py-3 px-2 sm:px-4 md:px-5 text-right tabular-nums font-black">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded ${
                      sortedAssetClasses.reduce((sum, row) => sum + row.contribution_pct, 0) >= 0 
                        ? "bg-[#FEF3F2] text-[#D92D20]" 
                        : "bg-[#EFF8FF] text-[#175CD3]"
                    }`}>
                      {signed(sortedAssetClasses.reduce((sum, row) => sum + row.contribution_pct, 0), "%p")}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Part B: Micro Themes 4-Col Grid */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { key: "주식-국내", label: "주식-국내", flag: "kr" },
            { key: "주식-해외", label: "주식-해외", flag: "us" },
            { key: "채권", label: "채권", emoji: "💵" },
            { key: "원자재", label: "원자재", emoji: "⛏️" },
          ].map((cat) => {
            const pg = briefing.peerGroups?.filter(g => g.assetClass === cat.key || g.assetClass?.includes(cat.key)) || [];
            const sortedPg = [...pg].sort((a, b) => b.cappedAumWeightedReturnPct - a.cappedAumWeightedReturnPct);
            
            const isRich = sortedPg.length >= 6;
            const top = isRich ? sortedPg.slice(0, 3) : sortedPg;
            const bottom = isRich ? sortedPg.slice(-3).reverse() : [];

            return (
              <div key={cat.key} className="overflow-hidden rounded-[20px] border border-[#E5E8E2] bg-white shadow-[0_2px_10px_rgba(27,38,26,0.02)] flex flex-col justify-between hover:border-[#D7EABB] hover:shadow-md transition-all">
                {/* 카드 상단 헤더 */}
                <div className="bg-[#F8FAF6] border-b border-[#EDF2DE] px-4 py-3 flex items-center justify-between">
                  <h3 className="font-extrabold text-[#297160] text-[13.5px] tracking-tight flex items-center gap-1.5">
                    {cat.flag ? (
                      <img src={`https://flagcdn.com/w40/${cat.flag}.png`} className="w-[18px] h-[13px] rounded-xs object-cover shadow-2xs shrink-0" alt={cat.flag.toUpperCase()} />
                    ) : (
                      <span>{cat.emoji}</span>
                    )}
                    <span>{cat.label} 세부 테마</span>
                  </h3>
                  <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-white border border-[#D7EABB] text-[#5A7050]">
                    {sortedPg.length}개 테마
                  </span>
                </div>

                {/* 카드 바디 */}
                <div className="flex-1 flex flex-col justify-between p-3 min-h-[280px] bg-white">
                  {sortedPg.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-neutral-400">
                      <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center mb-2 text-neutral-400 font-bold text-xs">∅</div>
                      <p className="text-[12.5px] font-medium">집계 기준(3종목 이상)에 부합하는 세부 테마가 없습니다</p>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col justify-between space-y-3">
                      {/* 상위 테마 영역 */}
                      <div className="space-y-1">
                        <div className="px-2 py-1 flex items-center justify-between text-[11px] font-extrabold text-[#D92D20]">
                          <span>▲ {isRich ? "상승 상위 Top 3" : "주요 테마 성과"}</span>
                        </div>
                        {top.map((t, idx) => (
                          <div key={t.peerGroup} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#FEF3F2]/50 transition-colors">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-4 h-4 rounded text-[10px] font-black flex items-center justify-center bg-[#FEE4E2] text-[#D92D20]">
                                {idx + 1}
                              </span>
                              <p className="truncate text-[13px] font-bold text-neutral-800" title={t.peerGroup}>
                                {t.peerGroup}
                              </p>
                              {t.etfCount ? <span className="text-[10px] text-neutral-400 font-normal">({t.etfCount})</span> : null}
                            </div>
                            <span className={`text-[13px] font-black tabular-nums tracking-tight ${changeTone(t.cappedAumWeightedReturnPct)}`}>
                              {signed(t.cappedAumWeightedReturnPct)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* 하위 테마 영역 (Worst 3위 = 최대 낙폭이 맨 위 3번 뱃지로 배치) */}
                      {isRich && bottom.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-dashed border-neutral-200">
                          <div className="px-2 py-1 flex items-center justify-between text-[11px] font-extrabold text-[#175CD3]">
                            <span>▼ 하락 하위 Worst 3</span>
                          </div>
                          <div className="space-y-1">
                            {bottom.map((b, idx) => {
                              const rankNumber = 3 - idx;
                              const isWorst3 = idx === 0; // Worst 3위 (최대 하락)
                              return (
                                <div key={b.peerGroup} className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg transition-colors ${isWorst3 ? "bg-[#F0F7FF]/80 font-bold" : "hover:bg-[#EFF8FF]/50"}`}>
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className={`w-4 h-4 rounded text-[10px] font-black flex items-center justify-center ${isWorst3 ? "bg-[#175CD3] text-white shadow-xs" : "bg-[#D1E9FF] text-[#175CD3]"}`}>
                                      {rankNumber}
                                    </span>
                                    <p className="truncate text-[13px] font-bold text-neutral-800" title={b.peerGroup}>
                                      {b.peerGroup}
                                    </p>
                                    {b.etfCount ? <span className="text-[10px] text-neutral-400 font-normal">({b.etfCount})</span> : null}
                                  </div>
                                  <span className={`text-[13px] font-black tabular-nums tracking-tight ${changeTone(b.cappedAumWeightedReturnPct)}`}>
                                    {signed(b.cappedAumWeightedReturnPct)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* STEP 4: Smart Money & Risk */}
      <section id="step-money" className="scroll-mt-20">
        <div className="mb-4 border-l-4 border-[#9ACD68] pl-3">
          <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#5A7050]">STEP 4. SMART MONEY FLOW</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900">오늘 자금은 어디로? (일일 동향)</h2>
          <p className="mt-1 text-sm text-neutral-500">스마트머니의 자금 순유입 및 순유출을 통해 일일 자금 흐름을 점검합니다.</p>
        </div>

        <div className="flex flex-col gap-8 sm:gap-10">
          {briefing.fundFlow && <FundFlowRanking fundFlow={briefing.fundFlow} />}
          <DisparityAlert warnings={briefing.disparityWarning} />
        </div>
      </section>

      {/* STEP 5: Macro Trends (Weekly / Monthly Fund Flow) */}
      <section id="step-trend" className="mb-16 scroll-mt-20">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="border-l-4 border-[#9ACD68] pl-3 mb-3">
              <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#5A7050]">STEP 5. TREND & FLOW</p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900">큰 돈의 흐름은 어디로? (주/월간 트렌드)</h2>
              <p className="mt-1 text-sm text-neutral-500">일간 노이즈를 걷어내고, 국내 ETF 시장으로 구조적 자금이 유입되는 주도 테마를 점검합니다.</p>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex bg-neutral-100 p-1 rounded-lg self-start sm:self-auto">
            <button
              onClick={() => setStep5Tab('weekly')}
              className={`px-4 py-2 text-[13px] font-bold rounded-md transition-all ${
                step5Tab === 'weekly' 
                  ? 'bg-white text-neutral-900 shadow-sm' 
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              주간 동향
            </button>
            <button
              onClick={() => setStep5Tab('monthly')}
              className={`px-4 py-2 text-[13px] font-bold rounded-md transition-all ${
                step5Tab === 'monthly' 
                  ? 'bg-white text-neutral-900 shadow-sm' 
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              월간 동향
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="mb-8 rounded-[20px] bg-white border border-[#E5E8E2] shadow-[0_4px_12px_rgba(27,38,26,0.02)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm table-fixed">
              <thead>
                <tr className="bg-[#F9FBFC] border-b border-[#EDF2DE]">
                  <th className="w-[10%] py-3 px-6 text-center text-[12px] font-extrabold text-neutral-400 tracking-wider">순위</th>
                  <th className="w-[40%] py-3 px-6 text-left text-[12px] font-extrabold text-neutral-400 tracking-wider">세부 테마 (피어그룹)</th>
                  <th className="w-[25%] py-3 px-6 text-right text-[12px] font-extrabold text-neutral-400 tracking-wider">순유입액 (억원)</th>
                  <th className="w-[25%] py-3 px-6 text-right text-[12px] font-extrabold text-neutral-400 tracking-wider">누적 수익률 (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF2DE]">
                {(step5Tab === 'weekly' ? briefing.weeklyFundFlows : briefing.monthlyFundFlows)?.map((row) => (
                  <tr key={row.rank} className="hover:bg-[#F9FBFC] transition-colors group">
                    <td className="py-3.5 px-6 text-center font-extrabold text-neutral-400 text-[14px]">{row.rank}</td>
                    <td className="py-3.5 px-6 font-extrabold text-neutral-800 text-[14px]">{row.peerGroup}</td>
                    <td className="py-3.5 px-6 text-right tabular-nums text-neutral-600 font-semibold">
                      <span className="text-[#EE4B58] font-bold">+{number.format(row.netInflow)}</span>
                    </td>
                    <td className={`py-3.5 px-6 text-right tabular-nums font-bold ${changeTone(row.returnPct)}`}>
                      {signed(row.returnPct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* STEP 6: Market Scale */}
      <section id="step-scale" className="mb-16 scroll-mt-20">
        <div className="mb-6">
          <div className="border-l-4 border-[#9ACD68] pl-3 mb-3">
            <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#5A7050]">STEP 6. MARKET SCALE</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900">국내 ETF 시장은 성장하고 있을까? (시장 규모)</h2>
            <p className="mt-1 text-sm text-neutral-500">전체 운용자산(AUM)의 증감과 실제 자금 순유입액을 일/주/월간 단위로 추적합니다.</p>
          </div>
        </div>

        <div className="bg-white border border-[#E5E8E2] rounded-[20px] shadow-[0_4px_12px_rgba(27,38,26,0.02)] p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 pb-8 border-b border-neutral-100">
            <div>
              <p className="text-[12px] font-extrabold text-neutral-400 tracking-[0.1em] mb-1">국내 상장 ETF 총 운용자산</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-neutral-900 tabular-nums">
                  {new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format((briefing.marketScale?.totalAum || 0) / 10000)}
                </span>
                <span className="text-lg font-bold text-neutral-500">조원</span>
              </div>
            </div>
            <div className="mt-4 sm:mt-0 text-left sm:text-right">
              <p className="text-[12px] font-extrabold text-neutral-400 tracking-[0.1em] mb-1">총 상장 종목 수</p>
              <p className="text-2xl font-bold text-neutral-700 tabular-nums">{number.format(briefing.marketScale?.totalEtfCount || 0)}개</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-neutral-100">
            {/* 1D */}
            <div className="pt-6 md:pt-0 md:pr-6 flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 font-extrabold text-[12px]">1D</div>
                <span className="font-extrabold text-neutral-800 text-[14px]">일간 동향 (전일 대비)</span>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-[12px] text-neutral-500 font-medium mb-1">자산 증감 (AUM)</p>
                  <p className={`text-[18px] font-extrabold tabular-nums tracking-tight ${changeTone(briefing.marketScale?.daily?.aumChange || 0)}`}>
                    {signedInt(briefing.marketScale?.daily?.aumChange || 0)} <span className="text-[14px] font-bold opacity-70">억원</span>
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-neutral-500 font-medium mb-1">실질 자금 순유입</p>
                  <p className={`text-[18px] font-extrabold tabular-nums tracking-tight ${changeTone(briefing.marketScale?.daily?.netInflow || 0)}`}>
                    {signedInt(briefing.marketScale?.daily?.netInflow || 0)} <span className="text-[14px] font-bold opacity-70">억원</span>
                  </p>
                </div>
              </div>
            </div>

            {/* 1W */}
            <div className="pt-6 md:pt-0 md:px-6 flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-extrabold text-[12px]">1W</div>
                <span className="font-extrabold text-neutral-800 text-[14px]">주간 동향 (전주 대비)</span>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-[12px] text-neutral-500 font-medium mb-1">자산 증감 (AUM)</p>
                  <p className={`text-[18px] font-extrabold tabular-nums tracking-tight ${changeTone(briefing.marketScale?.weekly?.aumChange || 0)}`}>
                    {signedInt(briefing.marketScale?.weekly?.aumChange || 0)} <span className="text-[14px] font-bold opacity-70">억원</span>
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-neutral-500 font-medium mb-1">실질 자금 순유입</p>
                  <p className={`text-[18px] font-extrabold tabular-nums tracking-tight ${changeTone(briefing.marketScale?.weekly?.netInflow || 0)}`}>
                    {signedInt(briefing.marketScale?.weekly?.netInflow || 0)} <span className="text-[14px] font-bold opacity-70">억원</span>
                  </p>
                </div>
              </div>
            </div>

            {/* 1M */}
            <div className="pt-6 md:pt-0 md:pl-6 flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-extrabold text-[12px]">1M</div>
                <span className="font-extrabold text-neutral-800 text-[14px]">월간 동향 (전월 대비)</span>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-[12px] text-neutral-500 font-medium mb-1">자산 증감 (AUM)</p>
                  <p className={`text-[18px] font-extrabold tabular-nums tracking-tight ${changeTone(briefing.marketScale?.monthly?.aumChange || 0)}`}>
                    {signedInt(briefing.marketScale?.monthly?.aumChange || 0)} <span className="text-[14px] font-bold opacity-70">억원</span>
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-neutral-500 font-medium mb-1">실질 자금 순유입</p>
                  <p className={`text-[18px] font-extrabold tabular-nums tracking-tight ${changeTone(briefing.marketScale?.monthly?.netInflow || 0)}`}>
                    {signedInt(briefing.marketScale?.monthly?.netInflow || 0)} <span className="text-[14px] font-bold opacity-70">억원</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div id="briefing-history-section" className="scroll-mt-20">
        <MarketBriefingHistory
          activeDate={briefing.asOfDate}
          onSelectDate={(date) => setSelectedDate(date)}
        />
      </div>



      <details className="rounded-[18px] border border-[#D7EABB] bg-[#FAFDF4] px-5 py-4 text-sm text-neutral-600">

        <summary className="cursor-pointer font-bold text-neutral-800">데이터 기준 및 방식</summary>

        <div className="mt-3 space-y-2 leading-6">

          <p>전체·순자산 Top 50·100·200 수익률은 해당 시장 일반 ETF들의 당일 등락률을 투자금으로 가중해 계산하며, 개별 ETF 비중 상한을 적용하지 않습니다.</p>
          <p>자산군별 수익률 기여도는 해당 자산군의 AUM 비중과 AUM 가중수익률을 곱해 계산합니다. 일반 ETF는 레버리지, 인버스, 파킹형 상품을 제외한 순수 시장/테마형 ETF만을 의미합니다.</p>

          <p>주/월간 자금 트렌드(순유입액)는 펀드의 순자산(AUM) 증감이 아닌, 실제 투자자들의 자금이 들어온 &apos;순설정액(설정액-환매액)&apos;만을 기간별(5일/20일)로 합산해 산출합니다.</p>
          <p>시장 규모 추적 시 &apos;자산 증감(AUM)&apos;은 주가 변동이 포함된 외형 성장을 의미하며, &apos;실질 자금 순유입&apos;은 주가 변동을 제외하고 시장에 새롭게 유입된 순수 현금(순설정액)만을 집계합니다.</p>
          {briefing.isStale && <p>현재 화면의 데이터는 {number.format(briefing.staleDays)}일 이전 데이터이므로 갱신 지연 상태로 표시됩니다.</p>}

          <p className="mt-4 pt-4 border-t border-[#EDF2DE] text-xs text-neutral-500">데이터 수집·검증이 완료된 기준으로만 공개되며, 특정 ETF의 매수·매도·보유를 권유하지 않습니다.</p>

        </div>

      </details>

    </div>

  );

}


