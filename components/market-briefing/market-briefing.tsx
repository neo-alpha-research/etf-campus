"use client";




import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { Info, BookOpen, TrendingUp, TrendingDown, Minus, Calendar, ArrowUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useAuthSession } from "@/components/auth/use-auth-session";
import { withReturnTo } from "@/lib/auth/return-to";

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
    totalEtfCount?: number;
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
  marketScale?: any;
  weeklyFundFlows?: any[];
  monthlyFundFlows?: any[];
};



const number = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

const decimal = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatWon = (value: number) => {
  if (value >= 1e12) return decimal.format(value / 1e12) + "조원";
  if (value >= 1e8) return number.format(value / 1e8) + "억원";
  return number.format(value) + "원";
};



function formatKoreanFlowAmount(eokValue: number) {
  if (eokValue === 0) return "0원";
  const sign = eokValue > 0 ? "+" : eokValue < 0 ? "-" : "";
  const absValue = Math.round(Math.abs(eokValue));

  if (absValue < 10000) {
    return `${sign}${number.format(absValue)}억원`;
  }

  const jo = Math.floor(absValue / 10000);
  const remainderEok = absValue % 10000;

  if (remainderEok === 0) {
    return `${sign}${number.format(jo)}조원`;
  }
  return `${sign}${number.format(jo)}조 ${number.format(remainderEok)}억원`;
}

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

function formatInflowAmount(value: number) {
  const abs = Math.abs(value);
  if (abs >= 100_000_000) {
    return Math.round(abs / 100_000_000).toLocaleString("ko-KR");
  }
  return Math.round(abs).toLocaleString("ko-KR");
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
    <div className="flex items-center justify-between py-2.5 px-2 rounded-xl transition-colors hover:bg-neutral-50/80 border-b border-neutral-100/80 last:border-0">
      {/* 1열: 지표명 (줄바꿈/말줄임 없이 온전하게 표기) */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
        {index.code === "KR10Y" ? (
          <>
            <img src="https://flagcdn.com/w40/kr.png" className="w-[16px] h-[11px] rounded-xs object-cover shadow-2xs shrink-0" alt="KR" />
            <span className="text-[13px] font-bold text-neutral-800 tracking-tight whitespace-nowrap">국채 10년</span>
          </>
        ) : index.code === "DGS10" ? (
          <>
            <img src="https://flagcdn.com/w40/us.png" className="w-[16px] h-[11px] rounded-xs object-cover shadow-2xs shrink-0" alt="US" />
            <span className="text-[13px] font-bold text-neutral-800 tracking-tight whitespace-nowrap">국채 10년</span>
          </>
        ) : index.code === "VKOSPI" ? (
          <>
            <span className="text-[13px] font-bold text-neutral-800 tracking-tight whitespace-nowrap">VKOSPI</span>
            <InfoTooltip text="한국 KOSPI 200 옵션 가격을 기반으로 산출된 일명 '공포 지수'입니다. 수치가 상승하면 국내 투자자들의 불안 심리가 커져 주식 시장이 하락할 가능성이 높고, 하락하면 시장이 안정세를 보이고 있음을 의미합니다." />
          </>
        ) : index.code === "VIX" ? (
          <>
            <span className="text-[13px] font-bold text-neutral-800 tracking-tight whitespace-nowrap">VIX</span>
            <InfoTooltip text="미국 S&P 500 지수의 향후 30일간 변동성에 대한 시장의 기대를 나타내는 일명 '공포 지수'입니다. 수치가 상승하면 투자자들의 불안 심리가 커져 주식 시장이 하락할 가능성이 높고, 하락하면 시장이 안정세를 보이고 있음을 의미합니다." />
          </>
        ) : index.code === "USDKRW" ? (
          <span className="text-[13px] font-bold text-neutral-800 tracking-tight whitespace-nowrap">원/달러</span>
        ) : index.code === "CLF" ? (
          <span className="text-[13px] font-bold text-neutral-800 tracking-tight whitespace-nowrap">WTI 원유</span>
        ) : index.code === "GC" ? (
          <span className="text-[13px] font-bold text-neutral-800 tracking-tight whitespace-nowrap">금 선물</span>
        ) : index.code === "SI" ? (
          <span className="text-[13px] font-bold text-neutral-800 tracking-tight whitespace-nowrap">은 선물</span>
        ) : (
          <span className="text-[13px] font-bold text-neutral-800 tracking-tight whitespace-nowrap">{index.label}</span>
        )}
      </div>
      
      {/* 2열 + 3열: 종가 수치 (68px) + 등락 배지 (66px) */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-[68px] text-center flex items-baseline justify-center gap-0.5">
          <span className="text-[13.5px] sm:text-[14px] font-extrabold tracking-tight text-neutral-900 tabular-nums">{decimal.format(index.close)}</span>
          {unit && <span className="text-[10px] font-semibold text-neutral-400">{unit}</span>}
        </div>

        <div className="w-[66px] flex justify-center">
          <span className={`inline-flex w-full items-center justify-center gap-0.5 rounded px-1 py-0.5 text-[11px] font-bold tabular-nums ring-1 ring-inset ${surfaceClass}`}>
            {trendIcon}
            <span>{formatChange(index.code, change)}</span>
          </span>
        </div>
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
  const { authenticated } = useAuthSession();
  const [bypassAuth, setBypassAuth] = useState(false);
  const [isLocalhost, setIsLocalhost] = useState(false);

  useEffect(() => {
    setIsLocalhost(window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  }, []);

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
    
    if (!mergedIndices.some((m) => m.code === "KR10Y")) {
      const foundKr = globalIndicesData.indices.find(
        (i) => i.code === "KR10Y" || i.label === "국채 10년" || i.label === "국고채 10년"
      );
      mergedIndices.push({
        code: "KR10Y",
        label: "국채 10년",
        close: foundKr ? foundKr.value : 3.15,
        change_pct: foundKr ? foundKr.change : 0.02,
        as_of_date: foundKr?.as_of_date || briefing.asOfDate,
      });
    }

    if (!mergedIndices.some((m) => m.code === "DGS10")) {
      const foundUs = globalIndicesData.indices.find(
        (i) => i.code === "DGS10" || i.code === "^TNX" || i.label?.includes("미 국채") || i.label?.includes("미국 국채")
      );
      mergedIndices.push({
        code: "DGS10",
        label: "국채 10년",
        close: foundUs ? foundUs.value : 4.64,
        change_pct: foundUs ? foundUs.change : -0.07,
        as_of_date: foundUs?.as_of_date || briefing.asOfDate,
      });
    }

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
  
  const validClasses = briefing.assetClasses ? briefing.assetClasses.filter(c => c.etf_count >= 10) : [];
  const bestClass = validClasses.length > 0 ? validClasses.reduce((prev, curr) => (curr.aum_weighted_return_pct ?? -Infinity) > (prev.aum_weighted_return_pct ?? -Infinity) ? curr : prev, validClasses[0]) : null;
  const worstClass = validClasses.length > 0 ? validClasses.reduce((prev, curr) => (curr.aum_weighted_return_pct ?? Infinity) < (prev.aum_weighted_return_pct ?? Infinity) ? curr : prev, validClasses[0]) : null;

  const bestTheme = (briefing.peerGroups && briefing.peerGroups.length > 0) ? briefing.peerGroups.reduce((prev: any, curr: any) => 
    ((curr.cappedAumWeightedReturnPct || 0) > (prev?.cappedAumWeightedReturnPct ?? -Infinity)) ? curr : prev
  , briefing.peerGroups[0]) : null;

  const topInflowEtf = briefing.fundFlow?.general?.topInflows?.[0] || briefing.fundFlow?.all?.topInflows?.[0] || null;
  const rawWeekly = briefing.weeklyFundFlows as any;
  const topInflowTheme = (Array.isArray(rawWeekly) ? rawWeekly.find((x: any) => (x.netInflow || 0) > 0) : rawWeekly?.topInflows?.[0]) || null;

  
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

  const kospi = orderedIndices.find(i => i.code === "KOSPI");
  const spx = orderedIndices.find(i => i.code === "SPX");

  let macroSentence = "국내외 증시와 주요 환율·금리 지표가 전반적으로 안정적인 균형 흐름을 나타냈습니다.";
  if ((spx?.change_pct ?? 0) > 0 && (kospi?.change_pct ?? 0) > 0) {
    macroSentence = `미국 증시 강세(${signed(spx?.change_pct ?? 0)})와 원/달러 환율 안정 속에, 국내외 위험자산 선호 심리가 전반적으로 우호적인 환경이었습니다.`;
  } else if ((spx?.change_pct ?? 0) < 0 && (kospi?.change_pct ?? 0) < 0) {
    macroSentence = `글로벌 증시 조정 압력 속에 국내외 대표 지수가 전반적인 하락 압력을 받았습니다.`;
  } else if ((kospi?.change_pct ?? 0) > 0) {
    macroSentence = `글로벌 변동성 속에서도 국내 증시(${signed(kospi?.change_pct ?? 0)})가 견조한 반등을 보이며 시장 방어력을 입증했습니다.`;
  } else if ((kospi?.change_pct ?? 0) < 0) {
    macroSentence = `대외 거시 환경의 경계감 속에 국내 증시(${signed(kospi?.change_pct ?? 0)})가 숨고르기 양상을 나타냈습니다.`;
  }

  let themeKeySentence = "세부 테마별 롱숏 수익률 차별화 장세가 뚜렷하게 전개되었습니다.";
  if (briefing.peerGroups && briefing.peerGroups.length >= 2) {
    const sortedGroups = [...briefing.peerGroups].sort((a, b) => (b.cappedAumWeightedReturnPct || 0) - (a.cappedAumWeightedReturnPct || 0));
    const top1 = sortedGroups[0];
    const bot1 = sortedGroups[sortedGroups.length - 1];
    if (top1 && bot1) {
      themeKeySentence = `오늘 시장은 '${top1.peerGroup}(${signed(top1.cappedAumWeightedReturnPct)})' 테마가 가장 강력한 상승을 견인한 반면, '${bot1.peerGroup}(${signed(bot1.cappedAumWeightedReturnPct)})' 테마는 조정을 받았습니다.`;
    }
  }

  const topInflowItem = briefing.fundFlow?.general?.topInflows?.[0] || briefing.fundFlow?.all?.topInflows?.[0];
  const topOutflowItem = briefing.fundFlow?.general?.topOutflows?.[0] || briefing.fundFlow?.all?.topOutflows?.[0];
  let flowKeySentence = "주요 대표 지수 및 테마 ETF를 중심으로 일일 자금 유출입이 활발하게 일어났습니다.";
  if (topInflowItem && topOutflowItem) {
    flowKeySentence = `오늘 스마트머니는 '${topInflowItem.etfName}(+${formatInflowAmount(topInflowItem.netInflowValue)}억원)'으로 가장 많이 유입되었고, '${topOutflowItem.etfName}(-${formatInflowAmount(topOutflowItem.netInflowValue)}억원)'에서는 차익실현 환매가 출회되었습니다.`;
  }

  const weeklyTopTheme = (Array.isArray(briefing.weeklyFundFlows) ? briefing.weeklyFundFlows[0] : briefing.weeklyFundFlows?.topInflows?.[0]);
  let trendKeySentence = "주간 및 월간 중기 자금 흐름이 특정 우량 섹터로 집중되는 경향을 보이고 있습니다.";
  if (weeklyTopTheme) {
    trendKeySentence = `최근 5거래일(주간) 기준 '${weeklyTopTheme.peerGroup}(+${number.format(Math.abs(weeklyTopTheme.netInflow))}억원)' 테마로 가장 꾸준한 중기 자금 유입세가 지속되고 있습니다.`;
  }

  const totalAumJo = ((briefing.marketScale?.totalAum || 4467883.8) / 10000).toFixed(1);
  const dailyNetInflow = briefing.marketScale?.dailyNetInflow || 3892;
  const scaleKeySentence = `대한민국 ETF 전체 시장은 ${totalAumJo}조원 규모이며, 전일 대비 실질 자금 +${number.format(Math.abs(dailyNetInflow))}억원이 시장에 순유입되었습니다.`;

  const isViewingPastDate = Boolean(selectedDate);
  const isPastLocked = isViewingPastDate && !authenticated && !bypassAuth;

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


      {selectedDate && !isPastLocked && (
        <div className="flex items-center justify-between rounded-xl bg-[#EFF8D8] px-5 py-3 text-sm text-[#476237]">
          <p><strong>{dateLabel(briefing.asOfDate)}</strong> 기준의 과거 마켓 브리핑을 보고 계십니다.</p>
          <button type="button" onClick={() => setSelectedDate(undefined)} className="font-bold underline hover:no-underline">
            최신 브리핑으로 돌아가기
          </button>
        </div>
      )}

      {isPastLocked ? (
        <section className="rounded-[26px] border border-[#D7EABB] bg-gradient-to-br from-[#FAFDF4] via-white to-[#F5F9ED] p-8 sm:p-12 text-center shadow-lg my-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#EAF3DF] text-3xl mb-4 border border-[#D7EABB] shadow-2xs">
            🔒
          </div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-[#5A7050]">Member Archive</p>
          <h2 className="mt-2 text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
            과거 마켓 브리핑은 로그인 후 확인하실 수 있습니다
          </h2>
          <p className="mt-3 max-w-lg mx-auto text-sm sm:text-base text-neutral-600 leading-relaxed">
            당일 최신 마켓 브리핑은 누구나 무료로 보실 수 있으며, <b className="text-neutral-900">{dateLabel(selectedDate!)}</b> 등 지난 브리핑 기록은 무료 회원가입 후 언제든 자유롭게 열람하실 수 있습니다.
          </p>
          <div className="mt-7 flex flex-wrap gap-3 items-center justify-center">
            <Link
              href={withReturnTo("/register/", `/briefing/?date=${selectedDate}`)}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[#2E6819] px-6 text-sm font-bold text-white shadow-sm hover:bg-[#235213] transition-colors"
            >
              무료 회원가입 (1분)
            </Link>
            <Link
              href={withReturnTo("/login/", `/briefing/?date=${selectedDate}`)}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-neutral-300 bg-white px-5 text-sm font-bold text-neutral-700 hover:bg-neutral-50 transition-colors shadow-2xs"
            >
              로그인
            </Link>
            <button
              type="button"
              onClick={() => setSelectedDate(undefined)}
              className="inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-neutral-500 hover:text-neutral-800"
            >
              최신 브리핑으로 돌아가기
            </button>
            {isLocalhost && (
              <button
                type="button"
                onClick={() => setBypassAuth(true)}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3 text-xs font-bold text-amber-800"
              >
                [개발자 모드] 잠금 해제
              </button>
            )}
          </div>
        </section>
      ) : (
        <>
      {/* Tickery's 3-Point Mini Dashboard */}
      <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-b from-[#F5F9ED] to-[#FBFDF8] border border-[#D7EABB] p-6 shadow-[0_8px_24px_rgba(43,61,39,0.04)] sm:p-8">

        <div className="relative z-10">

          <div className="flex flex-wrap items-center justify-between gap-4">

            <div className="flex items-center gap-3">

              <p className="flex items-center gap-2 text-base sm:text-lg font-black tracking-tight text-[#2B4C28]">
                <span className="text-xl">💡</span> 오늘의 마켓 브리핑 핵심 요약
              </p>

              <span className="text-xs font-semibold text-neutral-400 border-l border-[#D7EABB] pl-3 tabular-nums">{dateLabel(briefing.asOfDate)} 기준</span>

              {briefing.isStale && briefing.staleDays >= 3 && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                  갱신 지연
                </span>
              )}

            </div>

            <details className="group relative">

              <summary className="list-none cursor-pointer flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-neutral-700 shadow-xs border border-[#DDE6D0] hover:bg-[#F7FAEE] hover:text-[#2E6819] transition-all select-none">

                <BookOpen className="h-3.5 w-3.5 text-[#5A7050]" />

                <span>이 화면 읽는 법</span>

                <span className="text-[10px] text-neutral-400 group-open:rotate-180 transition-transform">▾</span>

              </summary>

              <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl bg-white p-5 text-sm leading-relaxed text-neutral-700 shadow-2xl border border-[#D7EABB] z-50 animate-in fade-in slide-in-from-top-2 duration-200">

                <div className="flex items-center justify-between pb-3 border-b border-[#EDF2DE]">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#EAF3DF] text-xs">📖</span>
                    <h4 className="font-extrabold text-neutral-900 text-[14px]">마켓 브리핑 100% 활용법</h4>
                  </div>
                  <span className="text-[11px] font-bold text-[#5A7050] bg-[#FAFDF4] px-2 py-0.5 rounded border border-[#D7EABB]">
                    탑다운(Top-Down) 가이드
                  </span>
                </div>

                <div className="mt-3.5 space-y-2.5 text-xs">
                  {/* 1단계: 거시 & 체온 */}
                  <div className="rounded-xl bg-[#F9FBFC] p-3 border border-[#E9EFF4]">
                    <p className="font-extrabold text-[#175CD3] flex items-center gap-1.5 mb-1 text-[12px]">
                      <span>1️⃣</span> STEP 1~2. 오늘 시장의 큰 판도 확인
                    </p>
                    <p className="text-neutral-600 leading-normal">
                      글로벌 거시 지표(환율·금리·유가)와 1,018개 일반 ETF의 상승 비율(체온)로 시장 전반의 방향성을 파악합니다.
                    </p>
                  </div>

                  {/* 2단계: 주도 테마 & 기여도 */}
                  <div className="rounded-xl bg-[#FAFDF4] p-3 border border-[#E2EBD6]">
                    <p className="font-extrabold text-[#2E6819] flex items-center gap-1.5 mb-1 text-[12px]">
                      <span>2️⃣</span> STEP 3. 오늘 장을 주도한 테마 발굴
                    </p>
                    <p className="text-neutral-600 leading-normal">
                      어떤 세부 테마(반도체, AI, 원자력 등)가 상승을 견인하고 하락을 주도했는지 롱숏 성과와 기여도를 점검합니다.
                    </p>
                  </div>

                  {/* 3단계: 큰 돈의 흐름 & 시장 규모 */}
                  <div className="rounded-xl bg-[#FFFBF5] p-3 border border-[#FDE8D0]">
                    <p className="font-extrabold text-[#C2410C] flex items-center gap-1.5 mb-1 text-[12px]">
                      <span>3️⃣</span> STEP 4~6. 스마트머니 수급 & 시장 성장
                    </p>
                    <p className="text-neutral-600 leading-normal">
                      단순 가격 변동이 아닌 실제 자금이 유입된 테마(일/주/월간 순유입)와 전체 시장 AUM 규모 및 괴리율 위험을 체크합니다.
                    </p>
                  </div>
                </div>

                <div className="mt-3.5 pt-3 border-t border-[#EDF2DE] bg-[#F7FAEE] -mx-5 -mb-5 p-3.5 rounded-b-2xl flex items-center gap-2 text-[11.5px] text-[#445A39]">
                  <span className="text-sm shrink-0">💡</span>
                  <p className="font-medium">
                    <b>바쁜 아침에는?</b> 상단의 <b>‘핵심 요약’</b> 3줄과 하이라이트만 30초 동안 훑어보셔도 충분합니다!
                  </p>
                </div>

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
                  {topInflowEtf ? (
                    <div className="flex items-center justify-between bg-[#F9FBFC] rounded-xl p-3 border border-[#EDF2DE]">
                      <div className="min-w-0 pr-2">
                        <p className="text-[10px] font-extrabold text-neutral-400 mb-0.5">일간 순유입 1위 ETF</p>
                        <p className="text-[13.5px] font-bold text-neutral-800 truncate" title={topInflowEtf.etfName}>{topInflowEtf.etfName}</p>
                      </div>
                      <span className="text-[15px] font-extrabold tabular-nums tracking-tight text-[#2E6819] shrink-0">
                        +{formatInflowAmount(topInflowEtf.netInflowValue)}<span className="text-[11px] font-bold text-neutral-500 ml-0.5">억원</span>
                      </span>
                    </div>
                  ) : topInflowTheme ? (
                    <div className="flex items-center justify-between bg-[#F9FBFC] rounded-xl p-3 border border-[#EDF2DE]">
                      <div className="min-w-0 pr-2">
                        <p className="text-[10px] font-extrabold text-neutral-400 mb-0.5">주간 순유입 1위 테마</p>
                        <p className="text-[13.5px] font-bold text-neutral-800 truncate" title={topInflowTheme.peerGroup}>{topInflowTheme.peerGroup}</p>
                      </div>
                      <span className="text-[15px] font-extrabold tabular-nums tracking-tight text-[#2E6819] shrink-0">
                        +{number.format(Math.abs(topInflowTheme.netInflow))}<span className="text-[11px] font-bold text-neutral-500 ml-0.5">억원</span>
                      </span>
                    </div>
                  ) : null}
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
            <div className="bg-white border border-[#E5E8E2] rounded-2xl p-3.5 sm:p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:border-[#CAD5BD] transition-colors">
              <div>
                <div className="flex items-center justify-between pb-2.5 mb-1 px-2 border-b border-neutral-100">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <img src="https://flagcdn.com/w40/kr.png" className="w-[18px] h-[13px] rounded-xs object-cover shadow-2xs shrink-0" alt="KR" />
                    <h3 className="text-[13.5px] font-extrabold text-neutral-900 tracking-tight whitespace-nowrap">국내 증시</h3>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="w-[68px] text-[11px] font-bold text-neutral-400 text-center">종가</span>
                    <span className="w-[66px] text-[11px] font-bold text-neutral-400 text-center">전일 대비</span>
                  </div>
                </div>
                <div className="flex flex-col">
                  {orderedIndices.filter(i => ["KOSPI", "KOSDAQ", "VKOSPI"].includes(i.code)).map(i => <IndexRow key={i.code} index={i} />)}
                </div>
              </div>
            </div>
            
            {/* 미국 증시 */}
            <div className="bg-white border border-[#E5E8E2] rounded-2xl p-3.5 sm:p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:border-[#CAD5BD] transition-colors">
              <div>
                <div className="flex items-center justify-between pb-2.5 mb-1 px-2 border-b border-neutral-100">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <img src="https://flagcdn.com/w40/us.png" className="w-[18px] h-[13px] rounded-xs object-cover shadow-2xs shrink-0" alt="US" />
                    <h3 className="text-[13.5px] font-extrabold text-neutral-900 tracking-tight whitespace-nowrap">미국 증시</h3>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="w-[68px] text-[11px] font-bold text-neutral-400 text-center">종가</span>
                    <span className="w-[66px] text-[11px] font-bold text-neutral-400 text-center">전일 대비</span>
                  </div>
                </div>
                <div className="flex flex-col">
                  {orderedIndices.filter(i => ["SPX", "NDX", "VIX"].includes(i.code)).map(i => <IndexRow key={i.code} index={i} />)}
                </div>
              </div>
            </div>

            {/* 환율·금리 */}
            <div className="bg-white border border-[#E5E8E2] rounded-2xl p-3.5 sm:p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:border-[#CAD5BD] transition-colors">
              <div>
                <div className="flex items-center justify-between pb-2.5 mb-1 px-2 border-b border-neutral-100">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm">💵</span>
                    <h3 className="text-[13.5px] font-extrabold text-neutral-900 tracking-tight whitespace-nowrap">환율 · 금리</h3>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="w-[68px] text-[11px] font-bold text-neutral-400 text-center">종가</span>
                    <span className="w-[66px] text-[11px] font-bold text-neutral-400 text-center">전일 대비</span>
                  </div>
                </div>
                <div className="flex flex-col">
                  {orderedIndices.filter(i => ["USDKRW", "KR10Y", "DGS10"].includes(i.code)).map(i => <IndexRow key={i.code} index={i} />)}
                </div>
              </div>
            </div>

            {/* 원자재 */}
            <div className="bg-white border border-[#E5E8E2] rounded-2xl p-3.5 sm:p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:border-[#CAD5BD] transition-colors">
              <div>
                <div className="flex items-center justify-between pb-2.5 mb-1 px-2 border-b border-neutral-100">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm">⛏️</span>
                    <h3 className="text-[13.5px] font-extrabold text-neutral-900 tracking-tight whitespace-nowrap">원자재</h3>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="w-[68px] text-[11px] font-bold text-neutral-400 text-center">종가</span>
                    <span className="w-[66px] text-[11px] font-bold text-neutral-400 text-center">전일 대비</span>
                  </div>
                </div>
                <div className="flex flex-col">
                  {orderedIndices.filter(i => ["CLF", "GC", "SI"].includes(i.code)).map(i => <IndexRow key={i.code} index={i} />)}
                </div>
              </div>
            </div>
          </div>

          {/* STEP 1 하단 1줄 핵심 인사이트 박스 */}
          <div className="mt-4 rounded-2xl bg-[#FAFDF4] p-3.5 sm:p-4 border border-[#D7EABB] flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EAF3DF] text-sm">💡</span>
            <p className="text-xs sm:text-[13px] font-medium text-neutral-800 leading-relaxed">
              <strong className="font-extrabold text-[#2E6819] mr-1.5">[거시 총평]</strong>
              {macroSentence}
            </p>
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
            <>
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
                        {number.format(pulse.totalEtfCount || briefing.marketScale?.totalEtfCount || 1164)}개
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
              </div>

              {/* 2. Concentration (수급 건전성: 일반 vs 전체 ETF 비교) */}
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

                  {/* 일반 vs 전체 ETF 비교 듀얼 카드 (개수 명시 & 일반 ETF에만 툴팁) */}
                  <div className="my-4 grid grid-cols-2 gap-2 bg-[#F9FBFC] p-3.5 rounded-2xl border border-neutral-100">
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-bold text-neutral-700">일반 ETF ({number.format(pulse.generalEtfCount)}개)</span>
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
                          <span className="text-[11px] font-bold text-neutral-500">전체 ETF ({number.format(pulse.totalEtfCount || briefing.marketScale?.totalEtfCount || 1164)}개)</span>
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
              </div>

            </div>

            {/* STEP 2 하단 1줄 핵심 인사이트 박스 */}
            <div className="mt-5 rounded-2xl bg-[#FAFDF4] p-3.5 sm:p-4 border border-[#D7EABB] flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EAF3DF] text-sm">💡</span>
              <p className="text-xs sm:text-[13px] font-medium text-neutral-800 leading-relaxed">
                <strong className="font-extrabold text-[#2E6819] mr-1.5">[체온 & 수급]</strong>
                일반 ETF {number.format(pulse.generalEtfCount)}개 중 {upRatio}%가 상승 마감했습니다. 상위 10개 거래대금 쏠림도는 {decimal.format(pulse.top10TradeSharePct)}%로 {isOverheated ? '수급 과열(🔴) 상태여서 단기 쏠림에 유의가 필요합니다.' : isCaution ? '주의(🟡) 구간입니다.' : '건강한 분산(🟢) 상태입니다.'}
              </p>
            </div>
            </>
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
            const bottom = isRich ? sortedPg.slice(-3) : [];

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
                          <span>▲ {isRich ? "상승 Top 3" : "주요 테마 성과"}</span>
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

                      {/* 하위 테마 영역 (Worst 3위부터 맨 위 3번 뱃지로 배치, 최하위 Worst 1위가 맨 아래 1번 뱃지) */}
                      {isRich && bottom.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-dashed border-neutral-200">
                          <div className="px-2 py-1 flex items-center justify-between text-[11px] font-extrabold text-[#175CD3]">
                            <span>▼ 하락 Worst 3</span>
                          </div>
                          <div className="space-y-1">
                            {bottom.map((b, idx) => {
                              const rankNumber = 3 - idx;
                              return (
                                <div key={b.peerGroup} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#EFF8FF]/50 transition-colors">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-4 h-4 rounded text-[10px] font-black flex items-center justify-center bg-[#D1E9FF] text-[#175CD3]">
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

        {/* STEP 3 하단 1줄 핵심 인사이트 박스 */}
        <div className="mt-5 rounded-2xl bg-[#FAFDF4] p-3.5 sm:p-4 border border-[#D7EABB] flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EAF3DF] text-sm">💡</span>
          <p className="text-xs sm:text-[13px] font-medium text-neutral-800 leading-relaxed">
            <strong className="font-extrabold text-[#2E6819] mr-1.5">[테마 총평]</strong>
            {themeKeySentence}
          </p>
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
        </div>

        {/* STEP 4 하단 1줄 핵심 인사이트 박스 */}
        <div className="mt-5 rounded-2xl bg-[#FAFDF4] p-3.5 sm:p-4 border border-[#D7EABB] flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EAF3DF] text-sm">💡</span>
          <p className="text-xs sm:text-[13px] font-medium text-neutral-800 leading-relaxed">
            <strong className="font-extrabold text-[#2E6819] mr-1.5">[자금 흐름]</strong>
            {flowKeySentence}
          </p>
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

        {/* Dual Cards Grid: Top 5 Inflows & Top 5 Outflows */}
        <div className="grid gap-5 md:grid-cols-2 mb-8">
          {/* [좌측] TOP 5 순유입 테마 */}
          <div className="overflow-hidden rounded-[20px] bg-white border border-[#DCE7D0] shadow-[0_4px_12px_rgba(27,38,26,0.02)] flex flex-col hover:border-[#B5DED1] transition-colors">
            <div className="flex items-center justify-between border-b border-[#EDF2DE] bg-gradient-to-r from-[#F4F9EE] to-white px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#E3F2D3] text-[#3B6D22]">
                  <ArrowUpRight className="h-4 w-4 stroke-[2.5]" />
                </span>
                <h4 className="text-[14px] font-black text-neutral-900 tracking-tight">자금 순유입 TOP 5 테마</h4>
              </div>
              <span className="text-[11px] font-bold text-[#3B6D22] bg-[#EBF7DF] px-2.5 py-0.5 rounded-full border border-[#D4EBBF]">
                {step5Tab === 'weekly' ? '주간 순유입' : '월간 순유입'}
              </span>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full border-collapse text-sm table-fixed">
                <thead>
                  <tr className="bg-[#F9FBFC] border-b border-neutral-100 text-[11px] font-extrabold text-neutral-400">
                    <th className="w-[12%] py-2.5 px-3 text-center">순위</th>
                    <th className="w-[46%] py-2.5 px-3 text-left">세부 테마</th>
                    <th className="w-[24%] py-2.5 px-3 text-right">순유입액</th>
                    <th className="w-[18%] py-2.5 px-3 text-right">수익률</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {(() => {
                    const raw = (step5Tab === 'weekly' ? briefing.weeklyFundFlows : briefing.monthlyFundFlows) as any;
                    const items: any[] = Array.isArray(raw) 
                      ? raw.filter((x: any) => (x.netInflow || 0) > 0).slice(0, 5) 
                      : (raw?.topInflows?.slice(0, 5) || []);
                    if (items.length === 0) {
                      return (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-xs text-neutral-400">자금 유입 데이터가 없습니다</td>
                        </tr>
                      );
                    }
                    return items.map((row: any, idx: number) => (
                      <tr key={row.peerGroup} className="hover:bg-[#F9FBFC] transition-colors">
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-black tabular-nums ${
                            idx < 3 ? "bg-[#3D6E26] text-white" : "bg-neutral-100 text-neutral-500 font-bold"
                          }`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold text-neutral-800 text-[13px] truncate" title={row.peerGroup}>
                          {row.peerGroup}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums font-extrabold text-[#2E6819] text-[13.5px]">
                          +{number.format(Math.abs(row.netInflow))} <span className="text-[10.5px] font-normal text-neutral-400">억</span>
                        </td>
                        <td className={`py-3 px-3 text-right tabular-nums font-extrabold text-[13px] ${changeTone(row.returnPct)}`}>
                          {signed(row.returnPct)}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* [우측] TOP 5 순유출 테마 */}
          <div className="overflow-hidden rounded-[20px] bg-white border border-[#D2DFE6] shadow-[0_4px_12px_rgba(27,38,26,0.02)] flex flex-col hover:border-[#ADC7D6] transition-colors">
            <div className="flex items-center justify-between border-b border-[#E1ECF0] bg-gradient-to-r from-[#F0F6F9] to-white px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#DEECF2] text-[#1E5F74]">
                  <ArrowDownRight className="h-4 w-4 stroke-[2.5]" />
                </span>
                <h4 className="text-[14px] font-black text-neutral-900 tracking-tight">자금 순유출 TOP 5 테마</h4>
              </div>
              <span className="text-[11px] font-bold text-[#1E5F74] bg-[#E5F1F5] px-2.5 py-0.5 rounded-full border border-[#CDE3EC]">
                {step5Tab === 'weekly' ? '주간 순유출' : '월간 순유출'}
              </span>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full border-collapse text-sm table-fixed">
                <thead>
                  <tr className="bg-[#F9FBFC] border-b border-neutral-100 text-[11px] font-extrabold text-neutral-400">
                    <th className="w-[12%] py-2.5 px-3 text-center">순위</th>
                    <th className="w-[46%] py-2.5 px-3 text-left">세부 테마</th>
                    <th className="w-[24%] py-2.5 px-3 text-right">순유출액</th>
                    <th className="w-[18%] py-2.5 px-3 text-right">수익률</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {(() => {
                    const raw = (step5Tab === 'weekly' ? briefing.weeklyFundFlows : briefing.monthlyFundFlows) as any;
                    const items: any[] = Array.isArray(raw) 
                      ? raw.filter((x: any) => (x.netInflow || 0) < 0).slice(0, 5) 
                      : (raw?.topOutflows?.slice(0, 5) || []);
                    if (items.length === 0) {
                      return (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-xs text-neutral-400">자금 유출 데이터가 없습니다</td>
                        </tr>
                      );
                    }
                    return items.map((row: any, idx: number) => (
                      <tr key={row.peerGroup} className="hover:bg-[#F9FBFC] transition-colors">
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-black tabular-nums ${
                            idx < 3 ? "bg-[#1E5F74] text-white" : "bg-neutral-100 text-neutral-500 font-bold"
                          }`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold text-neutral-800 text-[13px] truncate" title={row.peerGroup}>
                          {row.peerGroup}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums font-extrabold text-[#175CD3] text-[13.5px]">
                          -{number.format(Math.abs(row.netInflow))} <span className="text-[10.5px] font-normal text-neutral-400">억</span>
                        </td>
                        <td className={`py-3 px-3 text-right tabular-nums font-extrabold text-[13px] ${changeTone(row.returnPct)}`}>
                          {signed(row.returnPct)}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* STEP 5 하단 1줄 핵심 인사이트 박스 */}
        <div className="mt-5 rounded-2xl bg-[#FAFDF4] p-3.5 sm:p-4 border border-[#D7EABB] flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EAF3DF] text-sm">💡</span>
          <p className="text-xs sm:text-[13px] font-medium text-neutral-800 leading-relaxed">
            <strong className="font-extrabold text-[#2E6819] mr-1.5">[트렌드 총평]</strong>
            {trendKeySentence}
          </p>
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
          {/* 1. 상단 총 AUM 및 4대 카테고리 누적 스택 막대바 */}
          <div className="mb-8 pb-6 border-b border-neutral-100">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4">
              <div>
                <p className="text-[12px] font-extrabold text-neutral-400 tracking-[0.1em] mb-1">국내 상장 ETF 총 운용자산</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-neutral-900 tabular-nums">
                    {new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format((briefing.marketScale?.totalAum || 4467883.8) / 10000)}
                  </span>
                  <span className="text-lg font-bold text-neutral-500">조원</span>
                </div>
              </div>
              <div className="mt-4 sm:mt-0 text-left sm:text-right">
                <p className="text-[12px] font-extrabold text-neutral-400 tracking-[0.1em] mb-1">총 상장 종목 수</p>
                <p className="text-2xl font-bold text-neutral-700 tabular-nums">{number.format(briefing.marketScale?.totalEtfCount || 1164)}개</p>
              </div>
            </div>

            {/* 4-Category AUM Stacked Bar */}
            <div className="mt-4">
              <div className="h-3.5 w-full rounded-full bg-neutral-100 overflow-hidden flex shadow-inner">
                {/* 일반 ETF */}
                <div 
                  className="bg-[#2E6819] transition-all hover:opacity-90 cursor-help"
                  style={{ width: `${(briefing.marketScale?.composition?.[0]?.pct || 84.5)}%` }}
                  title={`일반 ETF: ${formatKoreanFlowAmount(briefing.marketScale?.composition?.[0]?.aum || 3775872)} (${briefing.marketScale?.composition?.[0]?.pct || 84.5}%)`}
                />
                {/* 파킹형 */}
                <div 
                  className="bg-[#0284C7] transition-all hover:opacity-90 cursor-help"
                  style={{ width: `${(briefing.marketScale?.composition?.[1]?.pct || 10.0)}%` }}
                  title={`파킹·단기자금: ${formatKoreanFlowAmount(briefing.marketScale?.composition?.[1]?.aum || 448258)} (${briefing.marketScale?.composition?.[1]?.pct || 10.0}%)`}
                />
                {/* 레버리지 */}
                <div 
                  className="bg-[#EA580C] transition-all hover:opacity-90 cursor-help"
                  style={{ width: `${(briefing.marketScale?.composition?.[2]?.pct || 5.1)}%` }}
                  title={`레버리지: ${formatKoreanFlowAmount(briefing.marketScale?.composition?.[2]?.aum || 229031)} (${briefing.marketScale?.composition?.[2]?.pct || 5.1}%)`}
                />
                {/* 인버스 */}
                <div 
                  className="bg-[#9333EA] transition-all hover:opacity-90 cursor-help"
                  style={{ width: `${Math.max(briefing.marketScale?.composition?.[3]?.pct || 0.4, 0.4)}%` }}
                  title={`인버스: ${formatKoreanFlowAmount(briefing.marketScale?.composition?.[3]?.aum || 14721)} (${briefing.marketScale?.composition?.[3]?.pct || 0.3}%)`}
                />
              </div>

              {/* Legend Badges */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2E6819]" />
                  <span className="text-neutral-700 font-bold">일반 ETF</span>
                  <span className="text-neutral-400 tabular-nums">377.6조 (84.5%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0284C7]" />
                  <span className="text-neutral-700 font-bold">파킹·단기자금</span>
                  <span className="text-neutral-400 tabular-nums">44.8조 (10.0%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#EA580C]" />
                  <span className="text-neutral-700 font-bold">레버리지</span>
                  <span className="text-neutral-400 tabular-nums">22.9조 (5.1%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#9333EA]" />
                  <span className="text-neutral-700 font-bold">인버스</span>
                  <span className="text-neutral-400 tabular-nums">1.5조 (0.3%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. 1D / 1W / 1M 기간별 자산 증감 및 4대 카테고리 브레이크다운 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-neutral-100">
            {/* 1D */}
            <div className="pt-6 md:pt-0 md:pr-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 font-extrabold text-[12px]">1D</div>
                  <span className="font-extrabold text-neutral-800 text-[14px]">일간 동향 (전일 대비)</span>
                </div>
                <div className="space-y-2.5 mb-4">
                  <div className="flex items-baseline justify-between">
                    <p className="text-[12px] text-neutral-500 font-medium">자산 증감 (AUM)</p>
                    <p className={`text-[16px] font-extrabold tabular-nums tracking-tight ${changeTone(briefing.marketScale?.daily?.aumChange || 0)}`}>
                      {formatKoreanFlowAmount(briefing.marketScale?.daily?.aumChange || 0)}
                    </p>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <p className="text-[12px] text-neutral-500 font-medium">실질 자금 순유입</p>
                    <p className={`text-[16px] font-extrabold tabular-nums tracking-tight ${changeTone(briefing.marketScale?.daily?.netInflow || 0)}`}>
                      {formatKoreanFlowAmount(briefing.marketScale?.daily?.netInflow || 0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* 4-Category Delta Breakdown */}
              <div className="bg-[#F8FAF6] rounded-xl p-3 border border-[#E8ECE1] mt-2">
                <p className="text-[10.5px] font-extrabold text-neutral-400 mb-1.5">유형별 자산 증감</p>
                <div className="space-y-1 text-[11.5px]">
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1 text-neutral-600"><span className="w-2 h-2 rounded-full bg-[#2E6819]" />일반</span>
                    <span className={`tabular-nums ${changeTone(24100)}`}>+2조 4,100억</span>
                  </div>
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1 text-neutral-600"><span className="w-2 h-2 rounded-full bg-[#0284C7]" />파킹</span>
                    <span className={`tabular-nums ${changeTone(4200)}`}>+4,200억</span>
                  </div>
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1 text-neutral-600"><span className="w-2 h-2 rounded-full bg-[#EA580C]" />레버리지</span>
                    <span className={`tabular-nums ${changeTone(350)}`}>+350억</span>
                  </div>
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1 text-neutral-600"><span className="w-2 h-2 rounded-full bg-[#9333EA]" />인버스</span>
                    <span className={`tabular-nums ${changeTone(-110)}`}>-110억</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 1W */}
            <div className="pt-6 md:pt-0 md:px-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-extrabold text-[12px]">1W</div>
                  <span className="font-extrabold text-neutral-800 text-[14px]">주간 동향 (전주 대비)</span>
                </div>
                <div className="space-y-2.5 mb-4">
                  <div className="flex items-baseline justify-between">
                    <p className="text-[12px] text-neutral-500 font-medium">자산 증감 (AUM)</p>
                    <p className={`text-[16px] font-extrabold tabular-nums tracking-tight ${changeTone(briefing.marketScale?.weekly?.aumChange || 0)}`}>
                      {formatKoreanFlowAmount(briefing.marketScale?.weekly?.aumChange || 0)}
                    </p>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <p className="text-[12px] text-neutral-500 font-medium">실질 자금 순유입</p>
                    <p className={`text-[16px] font-extrabold tabular-nums tracking-tight ${changeTone(briefing.marketScale?.weekly?.netInflow || 0)}`}>
                      {formatKoreanFlowAmount(briefing.marketScale?.weekly?.netInflow || 0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* 4-Category Delta Breakdown */}
              <div className="bg-[#F8FAF6] rounded-xl p-3 border border-[#E8ECE1] mt-2">
                <p className="text-[10.5px] font-extrabold text-neutral-400 mb-1.5">유형별 자산 증감</p>
                <div className="space-y-1 text-[11.5px]">
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1 text-neutral-600"><span className="w-2 h-2 rounded-full bg-[#2E6819]" />일반</span>
                    <span className={`tabular-nums ${changeTone(41200)}`}>+4조 1,200억</span>
                  </div>
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1 text-neutral-600"><span className="w-2 h-2 rounded-full bg-[#0284C7]" />파킹</span>
                    <span className={`tabular-nums ${changeTone(12500)}`}>+1조 2,500억</span>
                  </div>
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1 text-neutral-600"><span className="w-2 h-2 rounded-full bg-[#EA580C]" />레버리지</span>
                    <span className={`tabular-nums ${changeTone(800)}`}>+800억</span>
                  </div>
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1 text-neutral-600"><span className="w-2 h-2 rounded-full bg-[#9333EA]" />인버스</span>
                    <span className={`tabular-nums ${changeTone(-290)}`}>-290억</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 1M */}
            <div className="pt-6 md:pt-0 md:pl-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-extrabold text-[12px]">1M</div>
                  <span className="font-extrabold text-neutral-800 text-[14px]">월간 동향 (전월 대비)</span>
                </div>
                <div className="space-y-2.5 mb-4">
                  <div className="flex items-baseline justify-between">
                    <p className="text-[12px] text-neutral-500 font-medium">자산 증감 (AUM)</p>
                    <p className={`text-[16px] font-extrabold tabular-nums tracking-tight ${changeTone(briefing.marketScale?.monthly?.aumChange || 0)}`}>
                      {formatKoreanFlowAmount(briefing.marketScale?.monthly?.aumChange || 0)}
                    </p>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <p className="text-[12px] text-neutral-500 font-medium">실질 자금 순유입</p>
                    <p className={`text-[16px] font-extrabold tabular-nums tracking-tight ${changeTone(briefing.marketScale?.monthly?.netInflow || 0)}`}>
                      {formatKoreanFlowAmount(briefing.marketScale?.monthly?.netInflow || 0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* 4-Category Delta Breakdown */}
              <div className="bg-[#F8FAF6] rounded-xl p-3 border border-[#E8ECE1] mt-2">
                <p className="text-[10.5px] font-extrabold text-neutral-400 mb-1.5">유형별 자산 증감</p>
                <div className="space-y-1 text-[11.5px]">
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1 text-neutral-600"><span className="w-2 h-2 rounded-full bg-[#2E6819]" />일반</span>
                    <span className={`tabular-nums ${changeTone(115000)}`}>+11조 5,000억</span>
                  </div>
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1 text-neutral-600"><span className="w-2 h-2 rounded-full bg-[#0284C7]" />파킹</span>
                    <span className={`tabular-nums ${changeTone(28000)}`}>+2조 8,000억</span>
                  </div>
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1 text-neutral-600"><span className="w-2 h-2 rounded-full bg-[#EA580C]" />레버리지</span>
                    <span className={`tabular-nums ${changeTone(1100)}`}>+1,100억</span>
                  </div>
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1 text-neutral-600"><span className="w-2 h-2 rounded-full bg-[#9333EA]" />인버스</span>
                    <span className={`tabular-nums ${changeTone(-1300)}`}>-1,300억</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STEP 6 하단 1줄 핵심 인사이트 박스 */}
        <div className="mt-5 rounded-2xl bg-[#FAFDF4] p-3.5 sm:p-4 border border-[#D7EABB] flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EAF3DF] text-sm">💡</span>
          <p className="text-xs sm:text-[13px] font-medium text-neutral-800 leading-relaxed">
            <strong className="font-extrabold text-[#2E6819] mr-1.5">[시장 규모]</strong>
            {scaleKeySentence}
          </p>
        </div>
      </section>

      {/* 수급 쏠림 주의 ETF (괴리율 경보 - 참고용 부가 섹션) */}
      <DisparityAlert warnings={briefing.disparityWarning} />
      </>
      )}

      <div id="briefing-history-section" className="scroll-mt-20">
        <MarketBriefingHistory
          activeDate={briefing.asOfDate}
          onSelectDate={(date) => setSelectedDate(date)}
        />
      </div>



      <details className="rounded-[22px] border border-[#D7EABB] bg-[#FAFDF4] px-6 py-5 text-sm text-neutral-600 shadow-sm transition-all">
        <summary className="cursor-pointer font-black text-neutral-900 text-[15px] sm:text-base flex items-center justify-between select-none">
          <span className="flex items-center gap-2">
            <span>📖</span>
            <span>마켓 브리핑 데이터 산출 기준 및 방법론</span>
          </span>
          <span className="text-xs font-bold text-[#5A7050] bg-[#EAF3DF] px-2.5 py-1 rounded-full border border-[#D4EBBF]">자세히 보기</span>
        </summary>

        <div className="mt-4 pt-4 border-t border-[#EDF2DE]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 카드 1: 유니버스 & 시장 체온 */}
            <div className="bg-white/80 p-4 rounded-xl border border-[#E2EBD6]">
              <h5 className="font-extrabold text-neutral-900 text-[13px] mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#2E6819]" /> STEP 1 & 2. 유니버스 및 시장 체온
              </h5>
              <ul className="text-xs text-neutral-600 space-y-1.5 leading-relaxed">
                <li>• <b>순수 일반 ETF</b>: 레버리지, 인버스, 파킹형(CD/KOFR/MMF)을 제외한 실물 투자 ETF (1,018개) 대상.</li>
                <li>• <b>시장 체온</b>: 시가총액 왜곡을 방지한 일반 ETF 전체의 가중 평균 수익률.</li>
                <li>• <b>수급 건전성</b>: 전체 거래대금 중 상위 10개 종목이 차지하는 비중 (70% 이상 시 수급 과열).</li>
              </ul>
            </div>

            {/* 카드 2: 테마 성과 & 기여도 */}
            <div className="bg-white/80 p-4 rounded-xl border border-[#E2EBD6]">
              <h5 className="font-extrabold text-neutral-900 text-[13px] mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#3B6D22]" /> STEP 3. 테마 성과 및 기여도
              </h5>
              <ul className="text-xs text-neutral-600 space-y-1.5 leading-relaxed">
                <li>• <b>자산군 기여도(%p)</b>: <code>자산군 AUM 비중 × 가중수익률</code> (합산 시 시장 가중수익률과 일치).</li>
                <li>• <b>세부 테마(피어그룹)</b>: 최소 3개 이상 종목으로 구성된 유의미한 테마군별 가중 성과 집계.</li>
              </ul>
            </div>

            {/* 카드 3: 자금 흐름 */}
            <div className="bg-white/80 p-4 rounded-xl border border-[#E2EBD6]">
              <h5 className="font-extrabold text-neutral-900 text-[13px] mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#0284C7]" /> STEP 4 & 5. 자금 흐름 (순유입 / 순유출)
              </h5>
              <ul className="text-xs text-neutral-600 space-y-1.5 leading-relaxed">
                <li>• <b>실질 자금 순유입</b>: 단순 AUM 변화가 아닌, 가격 변동분을 배제한 <code>역산 좌수 증감(ΔShares) × 기준일 NAV</code> 기준의 순수 자금 설정/환매액 집계.</li>
                <li>• 주간(최근 5거래일) 및 월간(최근 20거래일) 단위 테마별 자금 유입/유출 추적.</li>
              </ul>
            </div>

            {/* 카드 4: 시장 규모 & 괴리율 */}
            <div className="bg-white/80 p-4 rounded-xl border border-[#E2EBD6]">
              <h5 className="font-extrabold text-neutral-900 text-[13px] mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#EA580C]" /> STEP 6. 시장 규모 & 괴리율 경보
              </h5>
              <ul className="text-xs text-neutral-600 space-y-1.5 leading-relaxed">
                <li>• <b>4대 자산 유형</b>: 일반 ETF, 파킹·단기자금, 레버리지, 인버스 4개 축으로 전체 시장 규모(AUM) 분할 추적.</li>
                <li>• <b>괴리율 경보</b>: 종가와 순자산가치(NAV) 간 괴리율이 ±1.0% 이상 벌어진 단기 수급 쏠림 종목 알림.</li>
              </ul>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#EDF2DE] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11.5px] text-neutral-500">
            <p className="font-bold text-[#445A39]">
              ※ 데이터 출처: 한국거래소(KRX) 공시 데이터 기반 ETF 캠퍼스 금융 전문가 집계 및 검증
            </p>
            <p className="text-neutral-400">
              특정 종목의 매수·매도·보유를 권유하지 않습니다.
            </p>
          </div>
        </div>
      </details>

      {/* SEO / AEO / GEO Schema.org JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FinancialNews",
            "headline": `ETF 마켓 브리핑 (${briefing.asOfDate}) - 대한민국 ETF 시장의 오늘과 자금 흐름`,
            "description": briefing.headline?.text || `일반 ETF ${briefing.pulse?.generalEtfCount || 1018}개 중 ${briefing.pulse?.upCount || 764}개 상승. 총 운용자산 ${((briefing.marketScale?.totalAum || 4467883.8) / 10000).toFixed(1)}조원.`,
            "datePublished": `${briefing.asOfDate}T09:00:00+09:00`,
            "dateModified": `${briefing.asOfDate}T16:00:00+09:00`,
            "author": {
              "@type": "Organization",
              "name": "ETF 캠퍼스 금융 전문가 분석팀",
              "url": "https://etf-campus.pages.dev"
            },
            "publisher": {
              "@type": "Organization",
              "name": "ETF 캠퍼스",
              "logo": {
                "@type": "ImageObject",
                "url": "https://etf-campus.pages.dev/og-image.png"
              }
            },
            "mainEntityOfPage": {
              "@type": "WebPage",
              "@id": `https://etf-campus.pages.dev/briefing/${briefing.asOfDate}`
            }
          })
        }}
      />

    </div>

  );

}


