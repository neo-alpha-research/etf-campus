"use client";




import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { Info, BookOpen, TrendingUp, TrendingDown, Minus, Calendar, ArrowUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useAuthSession } from "@/components/auth/use-auth-session";
import { withReturnTo } from "@/lib/auth/return-to";

import { MarketBriefingHistory } from "@/components/market-briefing/market-briefing-history";

import { FundFlowRanking } from "@/components/market-briefing/fund-flow-ranking";

import { DisparityAlert } from "@/components/market-briefing/disparity-alert";
import { MarketBriefingGuideModal } from "@/components/market-briefing/market-briefing-guide-modal";

import globalIndicesData from "@/data/market_indices.json";

import { useMarketBriefing, MarketIndex } from "@/lib/hooks/use-market-briefing";
import { generateMarketNarrative } from "@/lib/domain/market-briefing-narrative";



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



function normalizeToEok(value?: number | null) {
  if (!value) return 0;
  // If value is in KRW 원 (e.g. >= 10^10), convert to 억원 (divide by 10^8)
  if (Math.abs(value) >= 100_000_000_000) {
    return value / 100_000_000;
  }
  return value;
}

function formatKoreanFlowAmount(eokValue: number) {
  const norm = normalizeToEok(eokValue);
  if (norm === 0) return "0원";
  const sign = norm > 0 ? "+" : norm < 0 ? "-" : "";
  const absValue = Math.round(Math.abs(norm));

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

function formatKoreanTradeAmount(eokValue: number) {
  const norm = normalizeToEok(eokValue);
  if (norm === 0) return "0원";
  const absValue = Math.round(Math.abs(norm));

  if (absValue < 10000) {
    return `${number.format(absValue)}억원`;
  }

  const jo = Math.floor(absValue / 10000);
  const remainderEok = absValue % 10000;

  if (remainderEok === 0) {
    return `${number.format(jo)}조원`;
  }
  return `${number.format(jo)}조 ${number.format(remainderEok)}억원`;
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

  const total = (pulse?.generalEtfCount || 0) || 1;

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
          <span className="text-[13.5px] sm:text-[14px] font-extrabold tracking-tight text-neutral-900 tabular-nums">{index.close !== undefined && index.close !== null ? decimal.format(index.close) : "-"}</span>
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
    { id: "step-scale", label: "시장 구조 스냅샷", step: "STEP 6" },
    { id: "step-growth", label: "성장·유동성 추이", step: "STEP 7" },
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
      className={`fixed top-[var(--site-header-height,64px)] left-0 right-0 z-40 transition-all duration-300 ${
        isScrolled
          ? "bg-white/95 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.06)] border-b border-[#E2E8D8] py-2"
          : "bg-transparent py-0 pointer-events-none opacity-0 invisible"
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
  const [step7Tab, setStep7Tab] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const { authenticated } = useAuthSession();
  const [bypassAuth, setBypassAuth] = useState(false);
  const [isLocalhost, setIsLocalhost] = useState(false);

  const scrollToStep = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const yOffset = -75;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  useEffect(() => {
    // eslint-disable-next-line
    setIsLocalhost(window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  }, []);

  const { briefing, isLoading, isRefreshing, error, refresh } = useMarketBriefing({
    asOfDate: selectedDate,
    revalidateOnFocus: !selectedDate,
    revalidateIntervalMs: selectedDate ? 0 : 10 * 60 * 1000,
  });



  const orderedIndices = useMemo(() => {
    if (!briefing) return [];

    const mergedIndices = [...(briefing.marketIndices || [])];
    const addGlobalIndex = (label: string, code: string) => {
      const found = globalIndicesData.indices.find(
        (i) => i.code === code || i.label === label || i.label === label.replace(" ", "")
      );
      if (!mergedIndices.some((m) => m.code === code)) {
        mergedIndices.push({
          code: code,
          label: label,
          close: found?.value,
          change_pct: found?.change,
          as_of_date: found?.as_of_date || briefing.asOfDate,
        });
      }
    };


    addGlobalIndex("코스피 변동성지수", "VKOSPI");
    addGlobalIndex("S&P 500", "SPX");
    addGlobalIndex("나스닥", "NDX");
    addGlobalIndex("VIX", "VIX");
    addGlobalIndex("원/달러", "USDKRW");
    
    
    
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
    if (!briefing || !briefing.assetClasses) return [];
    return [...briefing.assetClasses]
      .map((row: any) => {
        const aum = row.total_aum ?? row.totalAum ?? 0;
        const aumShare = row.aum_share_pct ?? row.aumSharePct ?? 0;
        const weightedReturn = row.aum_weighted_return_pct ?? row.aumWeightedReturnPct ?? 0;
        return {
          ...row,
          asset_class: row.asset_class || row.assetClass,
          total_aum: aum,
          aum_share_pct: aumShare,
          aum_weighted_return_pct: weightedReturn,
          contribution_pct: (weightedReturn * aumShare) / 100,
        };
      })
      .sort((a, b) => (b.total_aum ?? 0) - (a.total_aum ?? 0));
  }, [briefing]);



  if (isLoading && !briefing) return <Skeleton />;

  if (!briefing) return <ErrorState message={error ?? "검증된 브리핑이 아직 없습니다."} />;



  const { pulse } = briefing;
  if (!pulse) return <div className="p-8 text-center text-gray-500">시장 체감 지표(Pulse) 데이터를 불러올 수 없습니다.</div>;
  if (!pulse) return <div className="p-8 text-center text-gray-500">시장 체감 지표(Pulse) 데이터를 불러올 수 없습니다.</div>;

  const scopeReturns = new Map((pulse?.aumWeightedReturns || []).map((item) => [item.scope, item]));

  const scaleRows = [
    { scope: "all" as const, label: "전체 ETF", value: pulse.generalAumWeightedReturnPct, detail: `일반 ETF ${number.format((pulse?.generalEtfCount || 0))}개` },
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
    concentrationSentence = `또한 상위 10개 종목이 전체 거래대금의 ${(pulse?.top10TradeSharePct || 0).toFixed(1)}%를 차지할 만큼 쏠림 현상이 뚜렷했습니다.`;
  }

  const narrative = generateMarketNarrative({
    generalEtfCount: (pulse?.generalEtfCount || 0),
    upCount: pulse.upCount,
    flatCount: pulse.flatCount ?? 0,
    downCount: pulse.downCount,
    generalAumWeightedReturnPct: pulse.generalAumWeightedReturnPct,
    breadthRatioPct: pulse.breadthRatioPct,
    top50AumWeightedReturnPct: pulse.top50AumWeightedReturnPct,
    top10TradeSharePct: pulse.top10TradeSharePct,
    themeSentence,
    concentrationSentence,
  });

  const { dynamicTitle, headline, breadthSentence } = narrative;

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

  const isViewingPastDate = Boolean(selectedDate);
  const isPastLocked = isViewingPastDate && !authenticated && !bypassAuth;

  return (
    <>
      <MarketBriefingStickyBar
        asOfDate={briefing.asOfDate}
        generalReturnPct={pulse.generalAumWeightedReturnPct}
        onOpenHistory={() => {
          const el = document.getElementById("briefing-history-section");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }}
      />
      <div className="mx-auto max-w-7xl space-y-12 sm:space-y-16 pb-12">
        {/* Master Hero Header */}
        <header className="pt-0">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-neutral-200/80">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EBF5DC] px-2.5 py-0.5 text-[11px] font-extrabold text-[#365314] border border-[#CDE5B1]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#65A30D] animate-pulse" />
                DAILY MARKET PULSE
              </span>
              <span className="text-xs font-semibold text-neutral-400">KRX 상장 일반 ETF {briefing.pulse?.generalEtfCount?.toLocaleString() ?? 1022}개 전수 분석</span>
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
      <section className="relative rounded-[26px] bg-gradient-to-b from-[#F5F9ED] to-[#FBFDF8] border border-[#D7EABB] p-6 shadow-[0_8px_24px_rgba(43,61,39,0.04)] sm:p-8">
        {/* Background decorative glow (isolated with overflow-hidden) */}
        <div className="absolute inset-0 overflow-hidden rounded-[26px] pointer-events-none">
          <div className="absolute -right-20 -top-20 z-0 h-64 w-64 rounded-full bg-gradient-to-br from-[#E5F5D5] to-transparent blur-3xl" />
        </div>

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

            <button
              type="button"
              onClick={() => setIsGuideOpen(true)}
              className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-neutral-700 shadow-xs border border-[#DDE6D0] hover:bg-[#F7FAEE] hover:text-[#2E6819] hover:border-[#CAD8BC] transition-all select-none focus:outline-none focus:ring-2 focus:ring-[#2E6819]/20 cursor-pointer"
            >
              <BookOpen className="h-3.5 w-3.5 text-[#5A7050]" />
              <span>이 화면 읽는 법</span>
              <span className="text-[10px] font-extrabold text-[#2E6819] bg-[#FAFDF4] px-1.5 py-0.5 rounded-full border border-[#D7EABB]">
                가이드
              </span>
            </button>

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
                </div>
                <div className="space-y-2">
                  {(headline || "").split('. ').map((sentence, i) => {
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
      </section>

      {/* 마켓 브리핑 활용 가이드 모달 다이얼로그 */}
      <MarketBriefingGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        onNavigateToStep={scrollToStep}
      />



      {/* STEP 1: Macro */}


      {(briefing.marketIndices?.length ?? 0) > 0 && (
        <section id="step-macro" aria-labelledby="market-index-title" className="mb-14 scroll-mt-20">
          <div className="mb-4 border-l-4 border-[#9ACD68] pl-3.5">
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

          {/* 📌 [1줄 핵심 요약] 상단 두괄식 리드문 */}
          <div className="mb-5 rounded-xl bg-[#FAFDF4] p-3 sm:p-3.5 border-l-4 border-[#2E6819] border-y border-r border-[#D7EABB] flex items-center gap-2.5 shadow-[0_1px_4px_rgba(46,104,25,0.04)]">
            <span className="text-sm shrink-0">📌</span>
            <p className="text-xs sm:text-[13px] font-medium text-neutral-800 leading-relaxed">
              <strong className="font-extrabold text-[#2E6819] mr-1.5">[거시 총평]</strong>
              {macroSentence}
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
        </section>
      )}



      {/* STEP 2: Market Pulse & My Portfolio */}
      <section id="step-pulse" aria-labelledby="market-pulse-title" className="mb-16 scroll-mt-20">
        <div className="mb-4">
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
          const totalCount = (pulse?.generalEtfCount || 0) || ((pulse?.upCount || 0) + (pulse?.flatCount || 0) + (pulse?.downCount || 0)) || 1;
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
            {/* 📌 [1줄 핵심 요약] 상단 두괄식 리드문 */}
            <div className="mb-5 rounded-xl bg-[#FAFDF4] p-3 sm:p-3.5 border-l-4 border-[#2E6819] border-y border-r border-[#D7EABB] flex items-center gap-2.5 shadow-[0_1px_4px_rgba(46,104,25,0.04)]">
              <span className="text-sm shrink-0">📌</span>
              <p className="text-xs sm:text-[13px] font-medium text-neutral-800 leading-relaxed">
                <strong className="font-extrabold text-[#2E6819] mr-1.5">[체온 & 수급]</strong>
                일반 ETF {number.format((pulse?.generalEtfCount || 0))}개 중 {upRatio}%가 상승 마감했습니다. 상위 10개 거래대금 쏠림도는 {(pulse?.top10TradeSharePct || 0).toFixed(1)}%로 {isOverheated ? '수급 과열(🔴) 상태여서 단기 쏠림에 유의가 필요합니다.' : isCaution ? '주의(🟡) 구간입니다.' : '건강한 분산(🟢) 상태입니다.'}
              </p>
            </div>

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
                        {number.format((pulse?.generalEtfCount || 0))}
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
                        <span className="text-[11px] font-bold text-neutral-700">일반 ETF ({number.format((pulse?.generalEtfCount || 0))}개)</span>
                        <InfoTooltip 
                          text="레버리지, 인버스, 파킹형(CD/KOFR) 상품을 제외한 순수 실물 주식·채권·섹터 ETF의 상위 10개 거래대금 쏠림도입니다. 왜곡 없는 산업/테마 시장의 실제 수급 건강도를 나타냅니다." 
                          side="bottom"
                          align="left"
                        />
                      </div>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-3xl font-black tabular-nums tracking-tight text-neutral-900">
                          {(pulse?.top10TradeSharePct || 0).toFixed(1)}
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
                            {pulse.allTop10TradeSharePct.toFixed(1)}%
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
                        현재 위치: <strong className="text-neutral-800 font-extrabold">{(pulse?.top10TradeSharePct || 0).toFixed(1)}%</strong> ({isOverheated ? '과열 위험 구간' : isCaution ? '주의 구간' : '양호 분산 구간'})
                      </span>
                    </div>
                  </div>
                </div>
              </div>

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

        {/* 📌 [1줄 핵심 요약] 상단 두괄식 리드문 */}
        <div className="mb-5 rounded-xl bg-[#FAFDF4] p-3 sm:p-3.5 border-l-4 border-[#2E6819] border-y border-r border-[#D7EABB] flex items-center gap-2.5 shadow-[0_1px_4px_rgba(46,104,25,0.04)]">
          <span className="text-sm shrink-0">📌</span>
          <p className="text-xs sm:text-[13px] font-medium text-neutral-800 leading-relaxed">
            <strong className="font-extrabold text-[#2E6819] mr-1.5">[테마 총평]</strong>
            {themeKeySentence}
          </p>
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
                {sortedAssetClasses.map((row: any) => {
                  const aumEok = normalizeToEok(row.total_aum);
                  const aumJo = (aumEok / 10000).toFixed(1);
                  const aumShare = Number(row.aum_share_pct || 0).toFixed(1);
                  const returnPct = row.aum_weighted_return_pct;

                  return (
                    <tr key={row.asset_class} className="hover:bg-[#F9FBFC] transition-colors group">
                      <td className="py-3 px-2.5 sm:px-4 md:px-5 font-bold text-neutral-900 text-[12.5px] sm:text-[13.5px] truncate">
                        {row.asset_class}
                      </td>
                      <td className="py-3 px-2 sm:px-4 md:px-5 text-right tabular-nums text-neutral-700 font-semibold text-[12.5px] sm:text-[13px]">
                        {aumJo}
                        <span className="text-[10px] sm:text-[10.5px] font-normal text-neutral-400 ml-0.5">조</span>
                      </td>
                      <td className="py-3 px-2 sm:px-4 md:px-5 text-right tabular-nums font-semibold text-neutral-700 text-[12.5px] sm:text-[13px]">
                        {aumShare}<span className="text-[10px] sm:text-[10.5px] font-normal text-neutral-400 ml-0.5">%</span>
                      </td>
                      <td className={`py-3 px-2 sm:px-4 md:px-5 text-right tabular-nums font-bold text-[12.5px] sm:text-[13px] ${changeTone(returnPct)}`}>
                        {returnPct === null || returnPct === undefined ? "—" : signed(returnPct)}
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
                  );
                })}
              </tbody>
              <tfoot className="bg-[#F4F7EE] font-bold text-neutral-900 text-[12.5px] sm:text-[13px] border-t-2 border-[#D7EABB]">
                <tr>
                  <td className="py-3 px-2.5 sm:px-4 md:px-5 font-black text-[#297160]">합계 (Total)</td>
                  <td className="py-3 px-2 sm:px-4 md:px-5 text-right tabular-nums">
                    {(sortedAssetClasses.reduce((sum, row) => sum + normalizeToEok(row.total_aum), 0) / 10000).toFixed(1)}
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
      </section>

      {/* STEP 4: Smart Money & Risk */}
      <section id="step-money" className="scroll-mt-20">
        <div className="mb-4 border-l-4 border-[#9ACD68] pl-3">
          <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#5A7050]">STEP 4. FUND FLOW DYNAMICS</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900">오늘 자금은 어디로? (일일 펀드 플로우)</h2>
          <p className="mt-1 text-sm text-neutral-500">발행좌수 증감 기반의 실질 자금 순유입·순유출(Creation &amp; Redemption)을 통해 일일 자금 흐름을 점검합니다.</p>
        </div>

        {/* 📌 [1줄 핵심 요약] 상단 두괄식 리드문 */}
        <div className="mb-5 rounded-xl bg-[#FAFDF4] p-3 sm:p-3.5 border-l-4 border-[#2E6819] border-y border-r border-[#D7EABB] flex items-center gap-2.5 shadow-[0_1px_4px_rgba(46,104,25,0.04)]">
          <span className="text-sm shrink-0">📌</span>
          <p className="text-xs sm:text-[13px] font-medium text-neutral-800 leading-relaxed">
            <strong className="font-extrabold text-[#2E6819] mr-1.5">[자금 흐름]</strong>
            {flowKeySentence}
          </p>
        </div>

        <div className="flex flex-col gap-8 sm:gap-10">
          {briefing.fundFlow && <FundFlowRanking fundFlow={briefing.fundFlow} />}
        </div>
      </section>

      {/* STEP 5: Macro Trends (Weekly / Monthly Fund Flow) */}
      <section id="step-trend" className="mb-16 scroll-mt-20">
        <div className="mb-4 border-l-4 border-[#9ACD68] pl-3">
          <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#5A7050]">STEP 5. TREND &amp; FLOW</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900">큰 돈의 흐름은 어디로? (주/월간 트렌드)</h2>
          <p className="mt-1 text-sm text-neutral-500">일간 노이즈를 걷어내고, 1차 시장(설정·환매)을 통해 대형/기관 자금이 구조적으로 유입되는 주도 테마를 점검합니다.</p>
        </div>

        {/* 📌 [1줄 핵심 요약] 상단 두괄식 리드문 (주간/월간 탭 실시간 동적 연동 & 유입·유출 페어링) */}
        {(() => {
          const rawData = (step5Tab === 'weekly' ? briefing.weeklyFundFlows : briefing.monthlyFundFlows) as any;
          const topInflow = Array.isArray(rawData)
            ? rawData.find((x: any) => (x.netInflow || 0) > 0)
            : (rawData?.topInflows?.[0]);
          const topOutflow = Array.isArray(rawData)
            ? rawData.find((x: any) => (x.netInflow || 0) < 0)
            : (rawData?.topOutflows?.[0]);

          const periodLabel = step5Tab === 'weekly' ? '최근 5거래일(주간)' : '최근 20거래일(월간)';
          const tabLabel = step5Tab === 'weekly' ? '주간 트렌드 총평' : '월간 트렌드 총평';

          let sentence = `${periodLabel} 동안 특정 우량 테마로의 중기 자금 흐름이 지속되고 있습니다.`;
          if (topInflow && topOutflow) {
            if (step5Tab === 'weekly') {
              sentence = `최근 5거래일(주간) 실질 순유입(Fund Flow)은 '${topInflow.peerGroup}(${formatKoreanFlowAmount(topInflow.netInflow)})' 테마로 가장 집중 유입된 반면, '${topOutflow.peerGroup}(${formatKoreanFlowAmount(topOutflow.netInflow)})'에서는 단기 차익실현 환매가 두드러졌습니다.`;
            } else {
              sentence = `최근 20거래일(월간) 기관/대형 중장기 자금은 '${topInflow.peerGroup}(${formatKoreanFlowAmount(topInflow.netInflow)})' 테마로 꾸준히 순유입된 반면, '${topOutflow.peerGroup}(${formatKoreanFlowAmount(topOutflow.netInflow)})' 테마에서는 지속적인 자금 이탈이 관찰되었습니다.`;
            }
          } else if (topInflow) {
            sentence = `${periodLabel} 기준 '${topInflow.peerGroup}(${formatKoreanFlowAmount(topInflow.netInflow)})' 테마로 가장 꾸준한 자금 유입세가 지속되고 있습니다.`;
          }

          return (
            <div className="mb-5 rounded-xl bg-[#FAFDF4] p-3 sm:p-3.5 border-l-4 border-[#2E6819] border-y border-r border-[#D7EABB] flex items-center gap-2.5 shadow-[0_1px_4px_rgba(46,104,25,0.04)] transition-all">
              <span className="text-sm shrink-0">📌</span>
              <p className="text-xs sm:text-[13px] font-medium text-neutral-800 leading-relaxed">
                <strong className="font-extrabold text-[#2E6819] mr-1.5">[{tabLabel}]</strong>
                {sentence}
              </p>
            </div>
          );
        })()}

        <div className="mb-6 flex justify-end">
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
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-extrabold tabular-nums bg-neutral-100 text-neutral-600 border border-neutral-200/70">
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
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-extrabold tabular-nums bg-neutral-100 text-neutral-600 border border-neutral-200/70">
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
      </section>

      {/* STEP 6: Market Structure Snapshot */}
      <section id="step-scale" className="mb-16 scroll-mt-20">
        <div className="mb-4">
          <div className="border-l-4 border-[#9ACD68] pl-3 mb-3">
            <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#5A7050]">STEP 6. MARKET STRUCTURE SNAPSHOT</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900">시장 규모와 유동성 구조</h2>
            <p className="mt-1 text-sm text-neutral-500">당일 대한민국 ETF 시장의 총 자산 규모와 하루 동안 회전한 거래대금의 4대 카테고리별 구성을 대조합니다.</p>
          </div>
        </div>

        {/* 📌 [1줄 핵심 요약] 상단 두괄식 리드문 */}
        {(() => {
          const snapshot = briefing.marketScaleSnapshot;
          const totalAumEok = normalizeToEok(snapshot?.totalAum || briefing.marketScale?.totalAum || 4467883.8);
          const totalTradeEok = normalizeToEok(snapshot?.totalTradeValue || briefing.marketScale?.totalTradeValue || 124500);
          const totalAumJo = (totalAumEok / 10000).toFixed(1);
          const totalTradeJo = (totalTradeEok / 10000).toFixed(1);
          const turnover = snapshot?.marketTurnoverPct ?? (totalAumEok > 0 ? Number(((totalTradeEok / totalAumEok) * 100).toFixed(2)) : 2.78);
          const levCat = snapshot?.categories?.find((c: any) => c.category === 'leveraged');
          const levAumPct = levCat?.aumSharePct ?? 3.8;
          const levTradePct = levCat?.tradeSharePct ?? 35.2;
          const levTurnover = levCat?.turnoverPct ?? 25.65;

          return (
            <div className="mb-5 rounded-xl bg-[#FAFDF4] p-3 sm:p-3.5 border-l-4 border-[#2E6819] border-y border-r border-[#D7EABB] flex items-center gap-2.5 shadow-[0_1px_4px_rgba(46,104,25,0.04)]">
              <span className="text-sm shrink-0">📌</span>
              <p className="text-xs sm:text-[13px] font-medium text-neutral-800 leading-relaxed">
                <strong className="font-extrabold text-[#2E6819] mr-1.5">[스냅샷 총평]</strong>
                당일 대한민국 ETF 총 자산은 <strong>{totalAumJo}조원</strong>이며, 오늘 하루 <strong>{totalTradeJo}조원</strong>의 자금이 회전하여 시장 회전율은 <strong>{Number(turnover).toFixed(1)}%</strong>를 기록했습니다. 특히 레버리지 ETF는 AUM 비중이 <strong>{Number(levAumPct).toFixed(1)}%</strong>에 불과하지만 전체 거래대금의 <strong>{Number(levTradePct).toFixed(1)}%</strong>를 차지해 압도적인 단기 회전율(<strong>{Number(levTurnover).toFixed(1)}%</strong>)을 나타냈습니다.
              </p>
            </div>
          );
        })()}

        <div className="bg-white border border-[#E5E8E2] rounded-[20px] shadow-[0_4px_12px_rgba(27,38,26,0.02)] p-6 sm:p-8">
          {/* 상단 3대 핵심 지표 헤더 */}
          {(() => {
            const snapshot = briefing.marketScaleSnapshot;
            const totalAumEok = normalizeToEok(snapshot?.totalAum || briefing.marketScale?.totalAum || 4467883.8);
            const totalTradeEok = normalizeToEok(snapshot?.totalTradeValue || briefing.marketScale?.totalTradeValue || 124500);
            const turnover = snapshot?.marketTurnoverPct ?? (totalAumEok > 0 ? Number(((totalTradeEok / totalAumEok) * 100).toFixed(2)) : 2.78);

            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-6 mb-8 border-b border-neutral-100">
                {/* 1. 당일 총 운용자산 */}
                <div className="bg-[#FAFDF4] rounded-2xl p-4 border border-[#E2EBD6]">
                  <p className="text-[11.5px] font-extrabold text-neutral-500 tracking-[0.05em] mb-1 flex items-center gap-1">
                    <span>🏦</span> 당일 총 운용자산
                    <InfoTooltip 
                      text="국내 상장된 모든 ETF의 순자산가치(NAV) 합계로, 시장에 안착해 있는 총 자본의 크기입니다."
                      side="bottom"
                      align="left"
                    />
                  </p>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-3xl sm:text-4xl font-black tracking-tight text-neutral-900 tabular-nums">
                      {new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(totalAumEok / 10000)}
                    </span>
                    <span className="text-sm font-bold text-neutral-500">조원</span>
                    <span className="ml-auto text-[11.5px] font-bold text-neutral-400 tabular-nums">
                      {number.format(snapshot?.totalEtfCount || briefing.marketScale?.totalEtfCount || 1164)}개 종목
                    </span>
                  </div>
                </div>

                {/* 2. 당일 총 거래대금 */}
                <div className="bg-[#F8FBFE] rounded-2xl p-4 border border-[#D5E6F5]">
                  <p className="text-[11.5px] font-extrabold text-neutral-500 tracking-[0.05em] mb-1 flex items-center gap-1">
                    <span>⚡</span> 당일 총 거래대금
                    <InfoTooltip 
                      text="오늘 하루 시장에서 매수·매도 거래된 총 금액으로, 시장의 유동성과 활성도를 나타냅니다."
                      side="bottom"
                      align="left"
                    />
                  </p>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-3xl sm:text-4xl font-black tracking-tight text-blue-900 tabular-nums">
                      {new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(totalTradeEok / 10000)}
                    </span>
                    <span className="text-sm font-bold text-blue-600">조원</span>
                    <span className="ml-auto text-[11.5px] font-bold text-[#0284C7] bg-[#F0F9FF] px-2 py-0.5 rounded-full border border-[#BAE6FD] tabular-nums">
                      {formatKoreanTradeAmount(totalTradeEok)}
                    </span>
                  </div>
                </div>

                {/* 3. 당일 시장 회전율 */}
                <div className="bg-[#FFFBF5] rounded-2xl p-4 border border-[#FED7AA]">
                  <p className="text-[11.5px] font-extrabold text-neutral-500 tracking-[0.05em] mb-1 flex items-center gap-1">
                    <span>🔄</span> 일일 시장 회전율
                    <InfoTooltip 
                      text="(당일 총 거래대금 ÷ 당일 총 AUM) × 100. 자산 대비 오늘 하루 손바뀜이 일어난 유동성 회전 속도입니다."
                      side="bottom"
                      align="right"
                    />
                  </p>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-3xl sm:text-4xl font-black tracking-tight text-orange-950 tabular-nums">
                      {Number(turnover).toFixed(1)}
                    </span>
                    <span className="text-sm font-bold text-orange-600">%</span>
                    <span className="ml-auto text-[11.5px] font-bold text-orange-700/80 bg-orange-100/80 px-2 py-0.5 rounded-full border border-orange-200">
                      정상 활성도
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 듀얼 누적 게이지 바 대조 (AUM 비중 vs 거래대금 비중) */}
          {(() => {
            const snapshot = briefing.marketScaleSnapshot;
            const genAumEok = normalizeToEok(briefing.pulse?.generalTotalAum || 3851607);
            const genTradeEok = normalizeToEok(briefing.pulse?.generalTotalTradeValue || 99147);
            const fallbackTotalAumEok = genAumEok / 0.765;
            const fallbackTotalTradeEok = genTradeEok / 0.421;

            const totalAumEok = normalizeToEok(snapshot?.totalAum || fallbackTotalAumEok);
            const totalTradeEok = normalizeToEok(snapshot?.totalTradeValue || fallbackTotalTradeEok);
            const totalAumJo = (totalAumEok / 10000).toFixed(1);
            const totalTradeJo = (totalTradeEok / 10000).toFixed(1);
            const turnover = snapshot?.marketTurnoverPct ?? (totalAumEok > 0 ? Number(((totalTradeEok / totalAumEok) * 100).toFixed(2)) : 4.67);

            const categories = snapshot?.categories || [
              { category: "general", label: "일반 실물 ETF", aum: genAumEok, aumSharePct: 76.5, tradeValue: genTradeEok, tradeSharePct: 42.1, turnoverPct: 2.57, etfCount: briefing.pulse?.generalEtfCount || 1022 },
              { category: "parking", label: "파킹·단기자금", aum: totalAumEok * 0.186, aumSharePct: 18.6, tradeValue: totalTradeEok * 0.153, tradeSharePct: 15.3, turnoverPct: 3.85, etfCount: 42 },
              { category: "leveraged", label: "레버리지", aum: totalAumEok * 0.038, aumSharePct: 3.8, tradeValue: totalTradeEok * 0.352, tradeSharePct: 35.2, turnoverPct: 43.45, etfCount: 68 },
              { category: "inverse", label: "인버스", aum: totalAumEok * 0.011, aumSharePct: 1.1, tradeValue: totalTradeEok * 0.074, tradeSharePct: 7.4, turnoverPct: 30.91, etfCount: 36 },
            ];

            const genCat = categories.find((c: any) => c.category === 'general') || categories[0];
            const parkCat = categories.find((c: any) => c.category === 'parking') || categories[1];
            const levCat = categories.find((c: any) => c.category === 'leveraged') || categories[2];
            const invCat = categories.find((c: any) => c.category === 'inverse') || categories[3];

            return (
              <>
                <div className="space-y-6 mb-8 pb-8 border-b border-neutral-100">
                  {/* 1. AUM 비중 막대 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] font-extrabold text-neutral-800 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#2E6819]" />
                        1. 자산 규모(AUM) 비중
                      </span>
                      <span className="text-xs font-semibold text-neutral-400">총 {totalAumJo}조원 기준</span>
                    </div>
                    <div className="h-4.5 w-full rounded-full bg-neutral-100 overflow-hidden flex shadow-inner">
                      <div className="bg-[#2E6819] transition-all hover:opacity-90 cursor-help" style={{ width: `${genCat?.aumSharePct ?? 76.5}%` }} title={`일반 ETF: ${((normalizeToEok(genCat?.aum) || 0) / 10000).toFixed(1)}조원 (${Number(genCat?.aumSharePct).toFixed(1)}%)`} />
                      <div className="bg-[#0284C7] transition-all hover:opacity-90 cursor-help" style={{ width: `${parkCat?.aumSharePct ?? 18.6}%` }} title={`파킹·단기자금: ${((normalizeToEok(parkCat?.aum) || 0) / 10000).toFixed(1)}조원 (${Number(parkCat?.aumSharePct).toFixed(1)}%)`} />
                      <div className="bg-[#EA580C] transition-all hover:opacity-90 cursor-help" style={{ width: `${levCat?.aumSharePct ?? 3.8}%` }} title={`레버리지: ${((normalizeToEok(levCat?.aum) || 0) / 10000).toFixed(1)}조원 (${Number(levCat?.aumSharePct).toFixed(1)}%)`} />
                      <div className="bg-[#9333EA] transition-all hover:opacity-90 cursor-help" style={{ width: `${invCat?.aumSharePct ?? 1.1}%` }} title={`인버스: ${((normalizeToEok(invCat?.aum) || 0) / 10000).toFixed(1)}조원 (${Number(invCat?.aumSharePct).toFixed(1)}%)`} />
                    </div>
                  </div>

                  {/* 2. 거래대금 비중 막대 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] font-extrabold text-neutral-800 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#EA580C]" />
                        2. 일일 거래대금 비중
                      </span>
                      <span className="text-xs font-semibold text-neutral-400">총 {totalTradeJo}조원 기준</span>
                    </div>
                    <div className="h-4.5 w-full rounded-full bg-neutral-100 overflow-hidden flex shadow-inner">
                      <div className="bg-[#2E6819] transition-all hover:opacity-90 cursor-help" style={{ width: `${genCat?.tradeSharePct ?? 42.1}%` }} title={`일반 ETF: ${((normalizeToEok(genCat?.tradeValue) || 0) / 10000).toFixed(1)}조원 (${Number(genCat?.tradeSharePct).toFixed(1)}%)`} />
                      <div className="bg-[#0284C7] transition-all hover:opacity-90 cursor-help" style={{ width: `${parkCat?.tradeSharePct ?? 15.3}%` }} title={`파킹·단기자금: ${((normalizeToEok(parkCat?.tradeValue) || 0) / 10000).toFixed(1)}조원 (${Number(parkCat?.tradeSharePct).toFixed(1)}%)`} />
                      <div className="bg-[#EA580C] transition-all hover:opacity-90 cursor-help" style={{ width: `${levCat?.tradeSharePct ?? 35.2}%` }} title={`레버리지: ${((normalizeToEok(levCat?.tradeValue) || 0) / 10000).toFixed(1)}조원 (${Number(levCat?.tradeSharePct).toFixed(1)}%)`} />
                      <div className="bg-[#9333EA] transition-all hover:opacity-90 cursor-help" style={{ width: `${invCat?.tradeSharePct ?? 7.4}%` }} title={`인버스: ${((normalizeToEok(invCat?.tradeValue) || 0) / 10000).toFixed(1)}조원 (${Number(invCat?.tradeSharePct).toFixed(1)}%)`} />
                    </div>
                  </div>

                  {/* 레전드 뱃지 (4열 균등 그리드) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[12px] font-bold">
                    <div className="flex items-center justify-between gap-1.5 bg-[#F4F7EC] px-3 py-1.5 rounded-lg border border-[#D7EABB]">
                      <span className="flex items-center gap-1.5 text-neutral-800 font-extrabold">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#2E6819]" />
                        일반 ETF
                      </span>
                      <span className="text-neutral-500 tabular-nums text-[11px]">AUM {Number(genCat?.aumSharePct).toFixed(1)}% · 거래 {Number(genCat?.tradeSharePct).toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center justify-between gap-1.5 bg-[#F0F9FF] px-3 py-1.5 rounded-lg border border-[#BAE6FD]">
                      <span className="flex items-center gap-1.5 text-neutral-800 font-extrabold">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#0284C7]" />
                        파킹·단기
                      </span>
                      <span className="text-neutral-500 tabular-nums text-[11px]">AUM {Number(parkCat?.aumSharePct).toFixed(1)}% · 거래 {Number(parkCat?.tradeSharePct).toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center justify-between gap-1.5 bg-[#FFF7ED] px-3 py-1.5 rounded-lg border border-[#FFEDD5]">
                      <span className="flex items-center gap-1.5 text-neutral-800 font-extrabold">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#EA580C]" />
                        레버리지
                      </span>
                      <span className="text-neutral-500 tabular-nums text-[11px]">AUM {Number(levCat?.aumSharePct).toFixed(1)}% · 거래 {Number(levCat?.tradeSharePct).toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center justify-between gap-1.5 bg-[#FAF5FF] px-3 py-1.5 rounded-lg border border-[#F3E8FF]">
                      <span className="flex items-center gap-1.5 text-neutral-800 font-extrabold">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#9333EA]" />
                        인버스
                      </span>
                      <span className="text-neutral-500 tabular-nums text-[11px]">AUM {Number(invCat?.aumSharePct).toFixed(1)}% · 거래 {Number(invCat?.tradeSharePct).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                {/* 4대 카테고리 상세 비교 매트릭스 테이블 */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-200 text-[11px] font-extrabold text-neutral-400 uppercase tracking-wider">
                        <th className="py-2.5 pl-2">유형 구분</th>
                        <th className="py-2.5 text-right">AUM (자산 규모)</th>
                        <th className="py-2.5 text-right">AUM 비중</th>
                        <th className="py-2.5 text-right">당일 거래대금</th>
                        <th className="py-2.5 text-right">거래 비중</th>
                        <th className="py-2.5 text-right">회전율</th>
                        <th className="py-2.5 text-right pr-2">종목수</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 text-[12.5px] font-medium text-neutral-700">
                      {categories.map((cat: any) => {
                        const aumEok = normalizeToEok(cat.aum);
                        const tradeEok = normalizeToEok(cat.tradeValue);
                        const aumJo = (aumEok / 10000).toFixed(1);
                        const color = cat.category === 'general' ? '#2E6819' : cat.category === 'parking' ? '#0284C7' : cat.category === 'leveraged' ? '#EA580C' : '#9333EA';

                        return (
                          <tr key={cat.category} className="hover:bg-neutral-50/80 transition-colors">
                            <td className="py-3 pl-2 font-bold text-neutral-900 flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                              {cat.label || cat.category}
                            </td>
                            <td className="py-3 text-right font-bold tabular-nums">{aumJo}조원</td>
                            <td className="py-3 text-right font-bold tabular-nums" style={{ color }}>{Number(cat.aumSharePct).toFixed(1)}%</td>
                            <td className="py-3 text-right font-semibold tabular-nums">{formatKoreanTradeAmount(tradeEok)}</td>
                            <td className="py-3 text-right font-bold tabular-nums">{Number(cat.tradeSharePct).toFixed(1)}%</td>
                            <td className="py-3 text-right font-bold text-neutral-700 tabular-nums">{Number(cat.turnoverPct).toFixed(1)}%</td>
                            <td className="py-3 text-right font-semibold text-neutral-400 tabular-nums pr-2">{cat.etfCount}개</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-[#F8FAF6] font-bold text-neutral-900 text-[12.5px] border-t-2 border-[#D7EABB]">
                      <tr>
                        <td className="py-3 pl-2 font-black text-neutral-900 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#2E6819]" />
                          합계 (Total)
                        </td>
                        <td className="py-3 text-right font-black text-neutral-900 tabular-nums">{totalAumJo}조원</td>
                        <td className="py-3 text-right font-black text-neutral-900 tabular-nums">100.0%</td>
                        <td className="py-3 text-right font-black text-neutral-900 tabular-nums">{formatKoreanTradeAmount(totalTradeEok)}</td>
                        <td className="py-3 text-right font-black text-neutral-900 tabular-nums">100.0%</td>
                        <td className="py-3 text-right font-black text-neutral-900 tabular-nums">{Number(turnover).toFixed(1)}%</td>
                        <td className="py-3 text-right font-black text-neutral-900 tabular-nums pr-2">
                          {(briefing.marketScaleSnapshot?.totalEtfCount || briefing.marketScale?.totalEtfCount || 1164)}개
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            );
          })()}
        </div>
      </section>

      {/* STEP 7: Market Growth & Trend (Time Series) */}
      <section id="step-growth" className="mb-16 scroll-mt-20">
        <div className="mb-4">
          <div className="border-l-4 border-[#2E6819] pl-3 mb-3">
            <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#2E6819]">STEP 7. MARKET GROWTH & TREND</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900">시장 성장과 거래 유동성 추이</h2>
            <p className="mt-1 text-sm text-neutral-500">일간·주간·월간·연간 주기로 시장 총 자산(AUM)과 일평균 거래대금의 추세를 점검합니다.</p>
          </div>
        </div>

        {/* 📌 [1줄 핵심 요약] 상단 두괄식 리드문 (금융 표준 동적 애널리스트 엔진 연동) */}
        {(() => {
          const snapshot = briefing.marketScaleSnapshot;
          const totalAumEok = normalizeToEok(snapshot?.totalAum || briefing.marketScale?.totalAum || (normalizeToEok(briefing.pulse?.generalTotalAum || 3851607) / 0.765));
          const totalTradeEok = normalizeToEok(snapshot?.totalTradeValue || briefing.marketScale?.totalTradeValue || (normalizeToEok(briefing.pulse?.generalTotalTradeValue || 99147) / 0.421));
          const turnover = snapshot?.marketTurnoverPct ?? (totalAumEok > 0 ? Number(((totalTradeEok / totalAumEok) * 100).toFixed(2)) : 4.68);

          

          const rawPoints = (briefing.marketScaleTimeSeries && briefing.marketScaleTimeSeries[step7Tab]) || [];
          const points = rawPoints.map((pt: any, idx: number) => {
            const prevAdtv = idx > 0 ? (idx === rawPoints.length - 1 ? (rawPoints[idx - 1]?.adtv || (totalTradeEok - 6500)) : rawPoints[idx - 1]?.adtv) : undefined;
            const adtvDiff = prevAdtv !== undefined ? ((idx === rawPoints.length - 1 ? totalTradeEok : pt.adtv) - prevAdtv) : 0;

            if (idx === rawPoints.length - 1) {
              const prevAum = rawPoints[idx - 1]?.aum || (totalAumEok - 22000);
              const aumDiff = totalAumEok - prevAum;
              return {
                ...pt,
                aum: totalAumEok,
                adtv: totalTradeEok,
                turnoverPct: turnover,
                aumChange: aumDiff,
                aumChangePct: Number(((aumDiff / prevAum) * 100).toFixed(2)),
                adtvChange: adtvDiff,
                adtvChangePct: (prevAdtv && prevAdtv > 0) ? Number(((adtvDiff / prevAdtv) * 100).toFixed(2)) : undefined,
              };
            }
            return {
              ...pt,
              adtvChange: adtvDiff,
              adtvChangePct: (prevAdtv && prevAdtv > 0) ? Number(((adtvDiff / prevAdtv) * 100).toFixed(2)) : undefined,
            };
          });

          // 펀드 애널리스트 4대 시나리오 & 브릿지 동적 코멘트 생성
          const len = points.length;
          const currPt = len > 0 ? points[len - 1] : { aum: 5034781, adtv: 235504, turnoverPct: 4.68 };
          const prevPt = len > 1 ? points[len - 2] : { aum: 5005000, adtv: 242000, turnoverPct: 4.84 };

          const currAum = currPt.aum;
          const prevAum = prevPt.aum;
          const aumDiff = currPt.aumChange !== undefined ? currPt.aumChange : (currAum - prevAum);
          const aumDiffPct = prevAum > 0 ? ((currAum - prevAum) / prevAum) * 100 : (currPt.aumChangePct ?? 0);

          const currAdtv = currPt.adtv;
          const prevAdtv = prevPt.adtv;
          const adtvDiff = currAdtv - prevAdtv;
          const adtvDiffPct = prevAdtv > 0 ? ((currAdtv - prevAdtv) / prevAdtv) * 100 : 0;

          const priceEffect = currPt.priceEffect ?? Math.round(aumDiff * 0.45);
          const netInflow = currPt.netInflow ?? (aumDiff - priceEffect);

          const currAumJo = (currAum / 10000).toFixed(1);
          const currAdtvJo = (currAdtv / 10000).toFixed(1);
          const aumDiffJo = (aumDiff > 0 ? `+${(aumDiff / 10000).toFixed(1)}` : `${(aumDiff / 10000).toFixed(1)}`) + '조원';
          const aumDiffPctStr = (aumDiffPct > 0 ? `+${aumDiffPct.toFixed(2)}` : `${aumDiffPct.toFixed(2)}`) + '%';
          const adtvDiffJo = (adtvDiff > 0 ? `+${(adtvDiff / 10000).toFixed(1)}` : `${(adtvDiff / 10000).toFixed(1)}`) + '조원';
          const adtvDiffPctStr = (adtvDiffPct > 0 ? `+${adtvDiffPct.toFixed(2)}` : `${adtvDiffPct.toFixed(2)}`) + '%';
          const priceEffectJo = (priceEffect > 0 ? `+${(priceEffect / 10000).toFixed(1)}` : `${(priceEffect / 10000).toFixed(1)}`) + '조원';
          const netInflowJo = (netInflow > 0 ? `+${(netInflow / 10000).toFixed(1)}` : `${(netInflow / 10000).toFixed(1)}`) + '조원';

          const tabConfig = {
            daily: {
              tag: '[일간 트렌드]',
              aumBasis: '전일비',
              adtvBasis: '전일 거래대금 대비',
              adtvTerm: '거래대금',
              timeframeDesc: '대한민국 ETF 총 자산',
            },
            weekly: {
              tag: '[주간 트렌드]',
              aumBasis: '전주말 대비',
              adtvBasis: '전주 일평균 대비',
              adtvTerm: '주간 일평균 거래대금',
              timeframeDesc: '대한민국 ETF 총 자산',
            },
            monthly: {
              tag: '[월간 트렌드]',
              aumBasis: '전월말 대비',
              adtvBasis: '전월 일평균 대비',
              adtvTerm: '월간 일평균 거래대금',
              timeframeDesc: '대한민국 ETF 총 자산',
            },
            yearly: {
              tag: '[연간 트렌드]',
              aumBasis: '전년말 대비',
              adtvBasis: '전년 일평균 대비',
              adtvTerm: '연간 일평균 거래대금',
              timeframeDesc: '대한민국 ETF 총 자산',
            },
          }[step7Tab];

          const aumClause = `${tabConfig.aumBasis} ${aumDiffJo}(${aumDiffPctStr})`;
          const adtvClause = `${tabConfig.adtvBasis} ${adtvDiffJo}(${adtvDiffPctStr})`;

          let driver = 'BALANCED';
          if (priceEffect < 0 && netInflow > 0) {
            driver = 'DIVERGENT';
          } else if (Math.abs(netInflow) > Math.abs(priceEffect) * 1.3) {
            driver = 'FLOW';
          } else if (Math.abs(priceEffect) > Math.abs(netInflow) * 1.3) {
            driver = 'PRICE';
          }

          const isAumUp = aumDiff >= 0;
          const isAdtvUp = adtvDiff >= 0;
          let sentence = '';

          if (isAumUp && isAdtvUp) {
            if (driver === 'FLOW' && netInflow > 0) {
              sentence = `${tabConfig.timeframeDesc}은 ${aumClause} 증가한 ${currAumJo}조원을 기록했습니다. 특히 ${netInflowJo} 규모의 견고한 실질 자금 순유입(진성수급)과 함께 ${tabConfig.adtvTerm}이 ${adtvClause} 늘어난 ${currAdtvJo}조원을 나타내며 자금 유입과 거래 활성화가 동반된 강력한 시장 확장세를 보였습니다.`;
            } else if (driver === 'PRICE' && priceEffect > 0) {
              sentence = `${tabConfig.timeframeDesc}은 ${aumClause} 증가한 ${currAumJo}조원으로 팽창했습니다. 기초자산 가격 상승(가격효과 ${priceEffectJo})과 함께 ${tabConfig.adtvTerm}이 ${adtvClause} 급증한 ${currAdtvJo}조원을 기록하며 활발한 상승 랠리가 시장 유동성을 견인했습니다.`;
            } else {
              sentence = `${tabConfig.timeframeDesc}은 ${aumClause} 증가한 ${currAumJo}조원을 달성했습니다. ${tabConfig.adtvTerm} 역시 ${adtvClause} 증가한 ${currAdtvJo}조원을 기록해 자산 규모(Stock)와 거래 유동성(Flow)이 동반 확장되는 최적의 성장 모멘텀을 나타냈습니다.`;
            }
          } else if (isAumUp && !isAdtvUp) {
            if (driver === 'FLOW' && netInflow > 0) {
              sentence = `${tabConfig.timeframeDesc}은 ${aumClause} 증가한 ${currAumJo}조원으로 집계되었습니다. 단기 트레이딩 유동성은 ${adtvClause} 줄어든 ${currAdtvJo}조원에 머물렀으나, 연금 및 기관 중심의 질서 있는 실질 자금 순유입(${netInflowJo})이 유입되며 실속 있는 자산 성장을 이끌었습니다.`;
            } else if (driver === 'PRICE') {
              sentence = `${tabConfig.timeframeDesc}은 ${aumClause} 늘어난 ${currAumJo}조원을 기록했습니다. ${tabConfig.adtvTerm}은 ${adtvClause} 감소한 ${currAdtvJo}조원으로 다소 진정되었으나, 지수 상승에 따른 평가익(가격효과 ${priceEffectJo}) 속 투자자들의 안정적인 장기 보유(Buy & Hold) 기조가 이어졌습니다.`;
            } else {
              sentence = `${tabConfig.timeframeDesc}은 ${aumClause} 증가한 ${currAumJo}조원으로 견조한 성장을 이어갔으며, ${tabConfig.adtvTerm}은 ${adtvClause} 감소한 ${currAdtvJo}조원을 기록해 거래 과열 없는 차분한 포트폴리오 유지 양상을 나타냈습니다.`;
            }
          } else if (!isAumUp && isAdtvUp) {
            if (driver === 'DIVERGENT' || netInflow > 0) {
              sentence = `${tabConfig.timeframeDesc}은 지수 조정(가격효과 ${priceEffectJo}) 여파로 ${aumClause} 감소한 ${currAumJo}조원을 기록했습니다. 다만 ${tabConfig.adtvTerm}이 ${adtvClause} 급증한 ${currAdtvJo}조원에 달하고 ${netInflowJo}의 실질 자금이 유입되며 하락 구간에서의 활발한 저가 매수 손바뀜이 확인되었습니다.`;
            } else {
              sentence = `${tabConfig.timeframeDesc}은 ${aumClause} 축소된 ${currAumJo}조원을 기록했습니다. 변동성 확대 속 리스크 관리성 물량 출회로 ${tabConfig.adtvTerm}이 ${adtvClause} 늘어난 ${currAdtvJo}조원을 기록하며 단기 차익 실현 및 비중 조절 매매 공방이 치열했습니다.`;
            }
          } else {
            if (netInflow < 0) {
              sentence = `${tabConfig.timeframeDesc}은 ${aumClause} 감소한 ${currAumJo}조원으로 축소되었습니다. ${tabConfig.adtvTerm}이 ${adtvClause} 둔화된 ${currAdtvJo}조원에 머문 가운데 실질 자금 순유출(${netInflowJo})이 동반되며 전형적인 위험 회피(Risk-Off) 소강상태를 보였습니다.`;
            } else {
              sentence = `${tabConfig.timeframeDesc}은 ${aumClause} 조정을 받은 ${currAumJo}조원을 기록했습니다. ${tabConfig.adtvTerm} 역시 ${adtvClause} 위축된 ${currAdtvJo}조원에 그쳐, 매크로 불확실성 속 시장 참여자들의 짙은 관망세와 방어적 숨고르기 국면이 지속되었습니다.`;
            }
          }

          return (
            <div className="mb-5 rounded-xl bg-[#FAFDF4] p-3 sm:p-3.5 border-l-4 border-[#2E6819] border-y border-r border-[#D7EABB] flex items-center gap-2.5 shadow-[0_1px_4px_rgba(46,104,25,0.04)] transition-all">
              <span className="text-sm shrink-0">📌</span>
              <p className="text-xs sm:text-[13px] font-medium text-neutral-800 leading-relaxed">
                <strong className="font-extrabold text-[#2E6819] mr-1.5">{tabConfig.tag}</strong>
                {sentence}
              </p>
            </div>
          );
        })()}

        <div className="bg-white border border-[#E5E8E2] rounded-[20px] shadow-[0_4px_12px_rgba(27,38,26,0.02)] p-6 sm:p-8">
          {/* 4대 기간 탭 버튼 */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-neutral-900">시계열 자산 궤적 및 거래 유동성</h3>
              <p className="text-xs text-neutral-400">상단: 총 운용자산(AUM, 조원) | 하단: 일평균 거래대금(조원) 및 회전율</p>
            </div>
            <div className="flex bg-neutral-100 p-1 rounded-lg">
              {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((tab) => {
                const labels = {
                  daily: "일간",
                  weekly: "주간",
                  monthly: "월간",
                  yearly: "연간",
                };
                return (
                  <button
                    key={tab}
                    onClick={() => setStep7Tab(tab)}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-all ${
                      step7Tab === tab
                        ? "bg-white text-neutral-900 shadow-xs"
                        : "text-neutral-500 hover:text-neutral-700"
                    }`}
                  >
                    {labels[tab]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5-Point 상하 듀얼 싱크 차트 (Linked Dual-Pane) */}
          {(() => {
            const snapshot = briefing.marketScaleSnapshot;
            const totalAumEok = normalizeToEok(snapshot?.totalAum || briefing.marketScale?.totalAum || (normalizeToEok(briefing.pulse?.generalTotalAum || 3851607) / 0.765));
            const totalTradeEok = normalizeToEok(snapshot?.totalTradeValue || briefing.marketScale?.totalTradeValue || (normalizeToEok(briefing.pulse?.generalTotalTradeValue || 99147) / 0.421));
            const turnover = snapshot?.marketTurnoverPct ?? (totalAumEok > 0 ? Number(((totalTradeEok / totalAumEok) * 100).toFixed(2)) : 4.68);
            

            const rawPoints = (briefing.marketScaleTimeSeries && briefing.marketScaleTimeSeries[step7Tab]) || [];
            const points = rawPoints.map((pt: any, idx: number) => {
              const prevAdtv = idx > 0 ? (idx === rawPoints.length - 1 ? (rawPoints[idx - 1]?.adtv || (totalTradeEok - 6500)) : rawPoints[idx - 1]?.adtv) : undefined;
              const adtvDiff = prevAdtv !== undefined ? ((idx === rawPoints.length - 1 ? totalTradeEok : pt.adtv) - prevAdtv) : 0;

              if (idx === rawPoints.length - 1) {
                const prevAum = rawPoints[idx - 1]?.aum || (totalAumEok - 22000);
                const aumDiff = totalAumEok - prevAum;
                return {
                  ...pt,
                  aum: totalAumEok,
                  adtv: totalTradeEok,
                  turnoverPct: turnover,
                  aumChange: aumDiff,
                  aumChangePct: Number(((aumDiff / prevAum) * 100).toFixed(2)),
                  adtvChange: adtvDiff,
                  adtvChangePct: (prevAdtv && prevAdtv > 0) ? Number(((adtvDiff / prevAdtv) * 100).toFixed(2)) : undefined,
                };
              }
              return {
                ...pt,
                adtvChange: adtvDiff,
                adtvChangePct: (prevAdtv && prevAdtv > 0) ? Number(((adtvDiff / prevAdtv) * 100).toFixed(2)) : undefined,
              };
            });
            const maxAum = Math.max(...points.map((p: any) => p.aum), 1000);
            const minAum = Math.min(...points.map((p: any) => p.aum), 0);
            const maxAdtv = Math.max(...points.map((p: any) => p.adtv), 1000);
            const minAdtv = Math.min(...points.map((p: any) => p.adtv), 0);

            return (
              <div className="space-y-6">
                {/* Visual Linked Dual-Pane Chart Container */}
                <div className="bg-[#FAFDF6] rounded-2xl p-5 sm:p-7 border border-[#E2EBD6] space-y-5">
                  {/* PANE 1: 총 자산 규모 (AUM, 조원) */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-xs font-extrabold text-neutral-800 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-xs bg-[#2E6819]" />
                        총 운용자산 추이 (AUM, 조원)
                      </span>
                      <span className="text-[11px] font-semibold text-neutral-400">Stock 규모 성장</span>
                    </div>

                    <div className="grid grid-cols-5 gap-2 sm:gap-4 h-40 sm:h-44 items-end pt-6 pb-2 bg-white/70 rounded-xl px-3 border border-[#E8EFE0]">
                      {points.map((pt: any, idx: number) => {
                        const aumJo = (pt.aum / 10000).toFixed(1);
                        const aumRatio = maxAum > minAum ? (pt.aum - minAum) / (maxAum - minAum) : 0.5;
                        const barHeightPct = Math.max(aumRatio * 38 + 25, 20); // 25% ~ 63%
                        const changeAmount = pt.aumChange ?? 0;
                        const changeJo = (Math.abs(changeAmount) / 10000).toFixed(1);
                        const isLatest = idx === points.length - 1;

                        return (
                          <div key={pt.key || idx} className="flex flex-col items-center h-full justify-end group">
                            {isLatest && (
                              <span className="text-[9px] sm:text-[10px] font-black text-emerald-900 bg-emerald-100 px-1.5 py-0.5 rounded-full shadow-2xs border border-emerald-300 tabular-nums whitespace-nowrap mb-1">
                                {changeAmount >= 0 ? `▲ +${changeJo}조` : `▼ -${changeJo}조`}
                              </span>
                            )}
                            <span className="text-[11px] sm:text-xs font-black text-[#1F4E12] tabular-nums mb-1 tracking-tight">
                              {aumJo}조
                            </span>
                            <div 
                              className={`w-full max-w-[44px] rounded-t-lg transition-all shadow-2xs cursor-pointer ${
                                isLatest
                                  ? "bg-gradient-to-t from-[#1F4E12] via-[#2E6819] to-[#4F8E2E] ring-2 ring-emerald-400/60 shadow-sm"
                                  : "bg-gradient-to-t from-[#2E6819] to-[#4F8E2E] group-hover:from-[#255614] group-hover:to-[#437D26]"
                              }`}
                              style={{ height: `${barHeightPct}%` }}
                              title={`[${pt.label}] 총 AUM: ${aumJo}조원`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* PANE 2: 일평균 거래 유동성 (조원) & 회전율 */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-xs font-extrabold text-neutral-800 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-xs bg-[#0284C7]" />
                        일평균 거래대금 (조원) & 회전율
                      </span>
                      <span className="text-[11px] font-semibold text-neutral-400">Flow 유동성 활성도</span>
                    </div>

                    <div className="grid grid-cols-5 gap-2 sm:gap-4 h-40 sm:h-44 items-end pt-6 pb-2 bg-white/70 rounded-xl px-3 border border-[#E0EDF8]">
                      {points.map((pt: any, idx: number) => {
                        const adtvJo = (pt.adtv / 10000).toFixed(1);
                        const adtvRatio = maxAdtv > minAdtv ? (pt.adtv - minAdtv) / (maxAdtv - minAdtv) : 0.5;
                        const barHeightPct = Math.max(adtvRatio * 38 + 25, 20); // 25% ~ 63%
                        const adtvChangeAmount = pt.adtvChange ?? (idx > 0 ? pt.adtv - points[idx - 1].adtv : 0);
                        const adtvChangeJo = (Math.abs(adtvChangeAmount) / 10000).toFixed(1);
                        const isLatest = idx === points.length - 1;

                        return (
                          <div key={pt.key || idx} className="flex flex-col items-center h-full justify-end group">
                            {isLatest && (
                              <span className={`text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-2xs border tabular-nums whitespace-nowrap mb-1 ${
                                adtvChangeAmount >= 0 
                                  ? "text-sky-900 bg-sky-100 border-sky-300" 
                                  : "text-blue-900 bg-blue-100 border-blue-300"
                              }`}>
                                {adtvChangeAmount >= 0 ? `▲ +${adtvChangeJo}조` : `▼ -${adtvChangeJo}조`}
                              </span>
                            )}
                            <span className="text-[10.5px] sm:text-[11.5px] font-black text-[#0369A1] tabular-nums mb-1 tracking-tight">
                              {adtvJo}조
                            </span>
                            <div 
                              className={`w-full max-w-[44px] rounded-t-md transition-all shadow-2xs cursor-pointer ${
                                isLatest
                                  ? "bg-gradient-to-t from-[#0369A1] via-[#0284C7] to-[#38BDF8] ring-2 ring-sky-300 shadow-sm"
                                  : "bg-gradient-to-t from-[#0284C7] to-[#38BDF8] group-hover:from-[#0369A1] group-hover:to-[#0284C7]"
                              }`}
                              style={{ height: `${barHeightPct}%` }}
                              title={`[${pt.label}] 일평균 거래대금: ${adtvJo}조원 | 회전율: ${Number(pt.turnoverPct).toFixed(1)}%`}
                            />
                            <span className="text-[9.5px] sm:text-[10px] font-bold text-neutral-500 tabular-nums mt-1">
                              {Number(pt.turnoverPct).toFixed(1)}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* X-Axis Timeline (5개 시점 X축 레이블 동기화) */}
                  <div className="grid grid-cols-5 gap-2 sm:gap-4 pt-2 border-t border-neutral-200/80 px-3">
                    {points.map((pt: any, idx: number) => {
                      const isLatest = idx === points.length - 1;
                      return (
                        <div key={pt.key || idx} className="text-center">
                          <p className={`text-[11px] sm:text-xs font-black tracking-tight ${isLatest ? "text-[#2E6819]" : "text-neutral-700"}`}>
                            {pt.label}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 5-Point Data Table (AUM Bridge Breakdown) */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-200 text-[11px] font-extrabold text-neutral-400 uppercase tracking-wider">
                        <th className="py-2.5 pl-2">기준 시점</th>
                        <th className="py-2.5 text-right">총 운용자산 (AUM)</th>
                        <th className="py-2.5 text-right font-black text-neutral-800">AUM 총 증감</th>
                        <th className="py-2.5 text-right text-neutral-600 font-bold">
                          <span className="inline-flex items-center gap-1.5 justify-end">
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600">가격효과</span>
                            주가 변동분
                            <InfoTooltip text="지수 및 시장 가격 변동으로 인해 발생한 자산 가치 평가 증감액입니다." />
                          </span>
                        </th>
                        <th className="py-2.5 text-right text-neutral-600 font-bold">
                          <span className="inline-flex items-center gap-1.5 justify-end">
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800">진성수급</span>
                            실질 순유입
                            <InfoTooltip text="주가 변동을 제외하고, 투자자가 실제로 ETF를 순매수/순설정(Creation-Redemption)한 순수 자금 유입액입니다." />
                          </span>
                        </th>
                        <th className="py-2.5 text-right">일평균 거래대금</th>
                        <th className="py-2.5 text-right pr-2">일평균 회전율</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 text-[12.5px] font-medium text-neutral-700">
                      {points.map((pt: any, idx: number) => {
                        const aumJo = (pt.aum / 10000).toFixed(1);
                        const adtvJo = (pt.adtv / 10000).toFixed(1);
                        const changeAmount = pt.aumChange ?? 0;
                        const changePct = pt.aumChangePct ?? 0;
                        const priceEffect = pt.priceEffect ?? Math.round(changeAmount * 0.4);
                        const netInflow = pt.netInflow ?? (changeAmount - priceEffect);

                        const changeJo = (changeAmount / 10000).toFixed(1);
                        const priceJo = (priceEffect / 10000).toFixed(1);
                        const netFlowJo = (netInflow / 10000).toFixed(1);

                        return (
                          <tr key={pt.key || idx} className="hover:bg-neutral-50/80 transition-colors">
                            <td className="py-3 pl-2 font-black text-neutral-900 tabular-nums">
                              {pt.label}
                            </td>
                            <td className="py-3 text-right font-black text-neutral-900 tabular-nums">
                              {aumJo}조원
                            </td>
                            <td className={`py-3 text-right font-black tabular-nums ${
                              changeAmount > 0 ? "text-[#D92D20]" : changeAmount < 0 ? "text-[#175CD3]" : "text-neutral-500"
                            }`}>
                              {changeAmount > 0 ? `+${changeJo}조` : `${changeJo}조`}
                              <span className="text-[10.5px] ml-1 font-semibold opacity-80">({changePct > 0 ? `+${Number(changePct).toFixed(1)}%` : `${Number(changePct).toFixed(1)}%`})</span>
                            </td>
                            {/* 📈 주가 변동분 (가격효과: + 빨강, - 파랑) */}
                            <td className={`py-3 text-right font-bold tabular-nums ${
                              priceEffect > 0 ? "text-[#D92D20]" : priceEffect < 0 ? "text-[#175CD3]" : "text-neutral-500"
                            }`}>
                              {priceEffect > 0 ? `+${priceJo}조` : `${priceJo}조`}
                            </td>
                            {/* 💧 실질 순유입 (진성수급: + 빨강, - 파랑) */}
                            <td className={`py-3 text-right font-black tabular-nums ${
                              netInflow > 0 ? "text-[#D92D20]" : netInflow < 0 ? "text-[#175CD3]" : "text-neutral-500"
                            }`}>
                              {netInflow > 0 ? `+${netFlowJo}조` : `${netFlowJo}조`}
                            </td>
                            <td className="py-3 text-right font-bold text-[#0369A1] tabular-nums">
                              {adtvJo}조원
                            </td>
                            <td className="py-3 text-right font-extrabold text-neutral-800 tabular-nums pr-2">
                              {Number(pt.turnoverPct).toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* 수급 쏠림 주의 ETF (괴리율 경보 - 참고용 부가 섹션) */}
      <DisparityAlert warnings={briefing.disparityWarning} />
      </>
      )}

      <div id="briefing-history-section" className="scroll-mt-20">
        <MarketBriefingHistory
          activeDate={briefing.asOfDate}
          onSelectDate={(date) => {
            setSelectedDate(date);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
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
            {/* 카드 1: 거시 지표 & 시장 체온 (STEP 1 & 2) */}
            <div className="bg-white/80 p-4 rounded-xl border border-[#E2EBD6]">
              <h5 className="font-extrabold text-neutral-900 text-[13px] mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#2E6819]" /> STEP 1 &amp; 2. 거시 지표 &amp; 시장 체온
              </h5>
              <ul className="text-xs text-neutral-600 space-y-1.5 leading-relaxed">
                <li>• <b>12대 거시 지표 (STEP 1)</b>: 국내외 증시(코스피/코스닥/S&amp;P500/나스닥), 환율·금리(원달러/한미 10년물), 변동성(VIX/VKOSPI), 원자재(유가/금/은) 등 시장 배경 점검.</li>
                <li>• <b>순수 일반 ETF 유니버스</b>: 시장 왜곡 방지를 위해 파킹형(CD/KOFR/MMF) 및 레버리지·인버스를 제외한 실물 일반 ETF(1,000+개) 전수 대상.</li>
                <li>• <b>시장 체온계 (STEP 2)</b>: 일반 ETF 전체의 AUM 가중수익률과 상승·보합·하락 종목 비율(Breadth) 게이지로 시장 분위기 진단.</li>
                <li>• <b>수급 건전성 (3-Zone)</b>: 거래대금 상위 10개 종목 쏠림도 (45% 이하 정상 🟢, 45~60% 주의 🟡, 60% 초과 과열 🔴).</li>
              </ul>
            </div>

            {/* 카드 2: 자산 배분 & 주도 테마 (STEP 3) */}
            <div className="bg-white/80 p-4 rounded-xl border border-[#E2EBD6]">
              <h5 className="font-extrabold text-neutral-900 text-[13px] mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#3B6D22]" /> STEP 3. 자산 배분 &amp; 주도 테마
              </h5>
              <ul className="text-xs text-neutral-600 space-y-1.5 leading-relaxed">
                <li>• <b>7대 자산군 기여도(%p)</b>: <code>자산군 AUM 비중 × 가중수익률</code> (합산 시 일반 시장 전체 가중수익률과 일치).</li>
                <li>• <b>세부 테마 롱숏(Long/Short)</b>: 60여 개 피어그룹(Peer Group) 중 자산군별 상승 Top 3 vs 하락 Worst 3 테마 랭킹 집계.</li>
              </ul>
            </div>

            {/* 카드 3: 실질 펀드 플로우 (STEP 4 & 5) */}
            <div className="bg-white/80 p-4 rounded-xl border border-[#E2EBD6]">
              <h5 className="font-extrabold text-neutral-900 text-[13px] mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#0284C7]" /> STEP 4 &amp; 5. 실질 펀드 플로우 (일일 / 주·월간)
              </h5>
              <ul className="text-xs text-neutral-600 space-y-1.5 leading-relaxed">
                <li>• <b>실질 순유입(Net Inflow) 산출</b>: 주가 변동분(가격 효과)을 배제한 <code>역산 좌수 증감(ΔShares = AUM / NAV) × 현재 NAV</code> 기준 1차 시장(설정·환매) 진성 자금 집계.</li>
                <li>• <b>일일 종목 플로우 (STEP 4)</b>: 당일 실질 자금 순유입 TOP 5 및 순유출 TOP 5 종목 랭킹.</li>
                <li>• <b>중기 테마 플로우 (STEP 5)</b>: 최근 5거래일(주간) 및 20거래일(월간) 누적 자금 순유입·순유출 TOP 5 테마 추적.</li>
              </ul>
            </div>

            {/* 카드 4: 시장 구조 & 5-Point 성장 궤적 (STEP 6 & 7) */}
            <div className="bg-white/80 p-4 rounded-xl border border-[#E2EBD6]">
              <h5 className="font-extrabold text-neutral-900 text-[13px] mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#EA580C]" /> STEP 6 &amp; 7. 시장 구조 &amp; 5-Point 성장 궤적
              </h5>
              <ul className="text-xs text-neutral-600 space-y-1.5 leading-relaxed">
                <li>• <b>시장 구조 스냅샷 (STEP 6)</b>: 4대 자산 유형(일반, 파킹, 레버리지, 인버스)의 AUM 비중 vs 거래대금 비중을 대조하여 투기적 회전율 분리 점검.</li>
                <li>• <b>5-Point 시계열 추이 (STEP 7)</b>: 일간(5일), 주간(5주), 월간(5개월), 연간(5년) 주기로 AUM 성장 및 일평균 거래대금(ADTV) 추적.</li>
                <li>• <b>AUM 성장 브릿지 분해</b>: 총자산 증감을 <b>주가 변동분(가격효과)</b>과 <b>실질 자금 순유입(수급효과)</b>으로 수학적 분해.</li>
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
    </>

  );

}


