"use client";



import globalIndicesData from "@/data/market_indices.json";

import Link from "next/link";

import { useMemo, useState } from "react";

import { Info, BookOpen, TrendingUp, TrendingDown, Calendar } from "lucide-react";

import { MarketBriefingHistory } from "@/components/market-briefing-history";

import { FundFlowRanking } from "@/components/market-briefing/fund-flow-ranking";

import { DisparityAlert } from "@/components/market-briefing/disparity-alert";



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



function changeTone(value: number) {

  if (value > 0) return "text-[#D92D20]";

  if (value < 0) return "text-[#175CD3]";

  return "text-neutral-500";

}



function changeSurface(value: number) {

  if (value > 0) return "bg-[#FFF0EF] text-[#B42318] ring-[#FFD7D2]";

  if (value < 0) return "bg-[#EFF8FF] text-[#175CD3] ring-[#B9E6FE]";

  return "bg-neutral-100 text-neutral-600 ring-neutral-200";

}





function InfoTooltip({ text }: { text: React.ReactNode }) {


  return (


    <div className="group relative inline-flex items-center justify-center ml-1">

      <Info className="h-4 w-4 text-neutral-400 cursor-help transition-colors group-hover:text-neutral-600" />

      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-xl bg-neutral-900 p-3 text-xs leading-5 text-white opacity-0 shadow-xl transition-all group-hover:pointer-events-auto group-hover:opacity-100">

        {text}

        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-neutral-900" />

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

  const trendIcon = isUp ? <TrendingUp className="w-3 h-3" /> : isDown ? <TrendingDown className="w-3 h-3" /> : null;

  let unit = "";
  if (["KOSPI", "KOSDAQ", "SPX", "NDX"].includes(index.code)) unit = "pt";
  else if (["KR10Y", "DGS10"].includes(index.code)) unit = "%";
  else if (index.code === "T10Y2Y") unit = "%p";
  else if (["CLF", "GC", "SI"].includes(index.code)) unit = "$";

  let yieldCurveBadge = null;
  if (index.code === "T10Y2Y") {
    if (index.close < 0) {
      yieldCurveBadge = <span className="ml-1 inline-flex items-center rounded bg-[#FFF5F5] px-1.5 py-0.5 text-[10px] font-bold text-[#D84957] ring-1 ring-inset ring-[#F3C5C9]">침체 경고 (역전)</span>;
    } else if (index.close <= 0.2) {
      yieldCurveBadge = <span className="ml-1 inline-flex items-center rounded bg-[#FFFBEB] px-1.5 py-0.5 text-[10px] font-bold text-[#D97706] ring-1 ring-inset ring-[#FDE68A]">둔화 경계</span>;
    } else {
      yieldCurveBadge = null;
    }
  }

  

  return (
    <div className="flex items-center justify-between py-3 border-b border-neutral-100 last:border-0 hover:bg-neutral-50/50 transition-colors rounded-lg px-2 -mx-2">
      <div className="flex items-center gap-2.5">
        
        <div className="flex items-center gap-1.5">
          <p className="text-[13px] font-bold text-neutral-800 whitespace-nowrap">{index.label}</p>
          {index.code === "T10Y2Y" && (
            <InfoTooltip text="미국 국채 10년물 금리에서 2년물 금리를 뺀 값입니다. 단기 금리가 장기 금리보다 높아지는 마이너스(-) 상태, 즉 '장단기 금리차 역전' 현상은 역사적으로 경제 침체가 다가온다는 강력한 경고등 역할을 해왔습니다." />
          )}
          {index.code === "VIX" && (
            <InfoTooltip text="미국 S&P 500 지수의 향후 30일간 변동성에 대한 시장의 기대를 나타내는 일명 '공포 지수'입니다. 수치가 상승하면 투자자들의 불안 심리가 커져 주식 시장이 하락할 가능성이 높고, 하락하면 시장이 안정세를 보이고 있음을 의미합니다." />
          )}
          {index.code === "VKOSPI" && (
            <InfoTooltip text="한국 KOSPI 200 옵션 가격을 기반으로 산출된 일명 '공포 지수'입니다. 수치가 상승하면 국내 투자자들의 불안 심리가 커져 주식 시장이 하락할 가능성이 높고, 하락하면 시장이 안정세를 보이고 있음을 의미합니다." />
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="text-right flex items-baseline gap-0.5">
          <span className="text-[15px] font-extrabold tracking-tight text-neutral-900 tabular-nums">{decimal.format(index.close)}</span>
          {unit && <span className="text-[10px] font-semibold text-neutral-500">{unit}</span>}
          {yieldCurveBadge}
        </div>
        <span className={`flex w-16 items-center justify-end gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-bold ring-1 ${surfaceClass}`}>
          {trendIcon}
          {signed(change)}
        </span>
      </div>
    </div>
  );
}

export function MarketBriefingV0() {

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

      const found = globalIndicesData.indices.find(i => i.label === label || i.label === label.replace(" ", ""));

      if (found && !mergedIndices.some(m => m.code === code)) {

        mergedIndices.push({

          code: code,

          label: label,

          close: found.value,

          change_pct: found.change,

          as_of_date: briefing.asOfDate,

        });

      }

    };

    

    addGlobalIndex("S&P 500", "SPX");
    addGlobalIndex("나스닥", "NDX");
    addGlobalIndex("원/달러", "USDKRW");

    const order = ["KOSPI", "KOSDAQ", "SPX", "NDX", "USDKRW"];

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

    <div className="mx-auto max-w-7xl space-y-16 sm:space-y-24 pb-12">

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

        <section aria-labelledby="market-index-title" className="mb-12">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="border-l-4 border-[#9ACD68] pl-3">
              <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#5A7050]">STEP 1. MACRO ECONOMY</p>
              <h2 id="market-index-title" className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900">오늘 시장의 배경은? (거시 지표)</h2>
              <p className="mt-1 text-sm text-neutral-500">ETF 가격 변동의 원인이 되는 주요 지수와 금리 흐름입니다.</p>
            </div>
            {orderedIndices.length > 0 && (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-600 border border-neutral-200">
                <Calendar className="w-3.5 h-3.5" />
                기준일: {dateLabel(orderedIndices[0].as_of_date)}
              </div>
            )}
          </div>

          <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* 국내 증시 */}
            <div>
              <h3 className="mb-3 text-[14px] font-extrabold text-neutral-800 tracking-tight border-b-2 border-neutral-800 pb-2 flex items-center gap-1.5"><img src="https://flagcdn.com/w40/kr.png" className="w-[18px] h-[13px] rounded-sm object-cover shadow-sm" alt="KR" /> 국내 증시</h3>
              <div className="flex flex-col">
                {orderedIndices.filter(i => ["KOSPI", "KOSDAQ", "VKOSPI"].includes(i.code)).map(i => <IndexRow key={i.code} index={i} />)}
              </div>
            </div>
            
            {/* 미국 증시 */}
            <div>
              <h3 className="mb-3 text-[14px] font-extrabold text-neutral-800 tracking-tight border-b-2 border-neutral-800 pb-2 flex items-center gap-1.5"><img src="https://flagcdn.com/w40/us.png" className="w-[18px] h-[13px] rounded-sm object-cover shadow-sm" alt="US" /> 미국 증시</h3>
              <div className="flex flex-col">
                {orderedIndices.filter(i => ["SPX", "NDX", "VIX"].includes(i.code)).map(i => <IndexRow key={i.code} index={i} />)}
              </div>
            </div>

            {/* 채권/금리 */}
            <div>
              <h3 className="mb-3 text-[14px] font-extrabold text-neutral-800 tracking-tight border-b-2 border-neutral-800 pb-2 flex items-center gap-1.5"><span className="text-lg">💵</span> 채권 및 금리</h3>
              <div className="flex flex-col">
                {orderedIndices.filter(i => ["KR10Y", "DGS10", "T10Y2Y"].includes(i.code)).map(i => <IndexRow key={i.code} index={i} />)}
              </div>
            </div>

            {/* 원자재 */}
            <div>
              <h3 className="mb-3 text-[14px] font-extrabold text-neutral-800 tracking-tight border-b-2 border-neutral-800 pb-2 flex items-center gap-1.5"><span className="text-lg">⛏️</span> 원자재</h3>
              <div className="flex flex-col">
                {orderedIndices.filter(i => ["CLF", "GC", "SI"].includes(i.code)).map(i => <IndexRow key={i.code} index={i} />)}
              </div>
            </div>
          </div>
        </section>
      )}



      {/* STEP 2: Market Pulse & My Portfolio */}
      <section aria-labelledby="market-pulse-title" className="mb-16">
        <div className="mb-6">
          <div className="border-l-4 border-[#9ACD68] pl-3 mb-3">
            <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#5A7050]">STEP 2. MARKET PULSE</p>
            <h2 id="market-pulse-title" className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900">오늘 시장의 체감 온도는? (체감 지표)</h2>
            <p className="mt-1 text-sm text-neutral-500">수익률 분포와 시장 거래대금 쏠림 현상을 통해 일반 ETF 시장의 온도를 진단합니다.</p>
          </div>
        </div>          {/* 2-Pillar Dashboard Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* 1. Market Breadth (시장 체온) */}
            <div className="bg-white border border-[#E5E8E2] rounded-[20px] p-6 shadow-[0_4px_12px_rgba(27,38,26,0.02)] flex flex-col">
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <p className="text-[12px] font-extrabold text-neutral-400 tracking-[0.1em]">전체 시장 체온</p>
                      <span className="text-[10px] text-neutral-400 font-medium bg-neutral-100 px-1.5 py-0.5 rounded">일반 ETF 가중수익률</span>
                    </div>
                    <p className="text-[11px] text-neutral-400">전체 일반 ETF {number.format(pulse.generalEtfCount)}개 기준</p>
                  </div>
                  <p className={`text-4xl font-extrabold tabular-nums tracking-tight ${changeTone(pulse.generalAumWeightedReturnPct)}`}>
                    {signed(pulse.generalAumWeightedReturnPct)}
                  </p>
                </div>
                
                <div className="mt-8">
                  <div className="flex text-[11px] font-bold mb-1 w-full">
                    <div style={{ width: `${(pulse.upCount / pulse.generalEtfCount) * 100}%` }} className="text-[#EE4B58] text-left overflow-visible whitespace-nowrap">상승 {pulse.upCount}</div>
                    <div style={{ width: `${(pulse.flatCount / pulse.generalEtfCount) * 100}%` }} className="text-neutral-400 text-center overflow-visible whitespace-nowrap">보합 {pulse.flatCount}</div>
                    <div style={{ width: `${(pulse.downCount / pulse.generalEtfCount) * 100}%` }} className="text-[#4682EC] text-right overflow-visible whitespace-nowrap">하락 {pulse.downCount}</div>
                  </div>
                  {/* Stacked Bar */}
                  <div className="w-full h-3 rounded-full flex overflow-hidden">
                    <div className="bg-[#EE4B58]" style={{ width: `${(pulse.upCount / pulse.generalEtfCount) * 100}%` }}></div>
                    <div className="bg-neutral-200" style={{ width: `${(pulse.flatCount / pulse.generalEtfCount) * 100}%` }}></div>
                    <div className="bg-[#4682EC]" style={{ width: `${(pulse.downCount / pulse.generalEtfCount) * 100}%` }}></div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-neutral-200/60">
                <p className="text-[12px] font-medium text-neutral-600 leading-relaxed">
                  {breadthSentence}
                </p>
              </div>
            </div>

            {/* 2. Concentration (수급 건전성: 일반 vs 전체) */}
            <div className="bg-[#F9FBFC] border border-[#E5E8E2] rounded-[20px] p-6 shadow-[0_4px_12px_rgba(27,38,26,0.02)] flex flex-col">
              <div className="flex-1 flex flex-col justify-start">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-[12px] font-extrabold text-neutral-400 tracking-[0.1em]">수급 건전성</p>
                  <span className="text-[10px] text-neutral-400 font-medium bg-neutral-100 px-1.5 py-0.5 rounded">상위 10개 ETF 거래대금 비중</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {/* 일반 ETF 기준 */}
                  <div className="bg-white rounded-xl p-3 border border-neutral-100 shadow-sm">
                    <p className="text-[11px] font-bold text-neutral-500 mb-1">순수 일반 ETF</p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-2xl font-extrabold tabular-nums tracking-tight text-neutral-800">
                        {decimal.format(pulse.top10TradeSharePct)}<span className="text-sm font-bold text-neutral-400 ml-0.5">%</span>
                      </p>
                      <div className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${pulse.top10TradeSharePct > 60 ? 'bg-red-50 text-red-600' : pulse.top10TradeSharePct > 45 ? 'bg-yellow-50 text-yellow-600' : 'bg-green-50 text-green-600'}`}>
                        {pulse.top10TradeSharePct > 60 ? '🔴 과열' : pulse.top10TradeSharePct > 45 ? '🟡 주의' : '🟢 양호'}
                      </div>
                    </div>
                  </div>

                  {/* 전체 ETF 기준 (파킹/레버리지/인버스 포함) */}
                  <div className="bg-white rounded-xl p-3 border border-neutral-100 shadow-sm">
                    <p className="text-[11px] font-bold text-neutral-400 mb-1">전체 ETF (레버·인버스·파킹 포함)</p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-2xl font-extrabold tabular-nums tracking-tight text-neutral-500">
                        {pulse.allTop10TradeSharePct ? decimal.format(pulse.allTop10TradeSharePct) : '-'}<span className="text-sm font-bold text-neutral-300 ml-0.5">%</span>
                      </p>
                      {pulse.allTop10TradeSharePct && pulse.allTop10TradeSharePct - pulse.top10TradeSharePct > 10 && (
                        <div className="px-1.5 py-0.5 rounded bg-red-50 text-red-500 text-[10px] font-bold">
                          +{(pulse.allTop10TradeSharePct - pulse.top10TradeSharePct).toFixed(1)}%p
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
              
              <div className="mt-6 pt-4 border-t border-neutral-200/60">
                <p className="text-[12px] font-medium text-neutral-600 leading-relaxed">
                  {pulse.top10TradeSharePct > 60 
                    ? "상위 10개 종목 비중이 60%를 초과하는 과열(🔴) 상태로, 소수의 주도 종목(지수 대표주, 인기 테마 등)으로 자금이 극심하게 쏠려있습니다." 
                    : pulse.top10TradeSharePct > 45 
                    ? "상위 10개 종목 비중이 45~60% 구간의 주의(🟡) 상태로, 특정 주도주나 테마를 중심으로 거래가 집중되고 있습니다." 
                    : "상위 10개 종목 비중이 45% 이하인 양호(🟢) 상태로, 시장 전반의 다양한 종목으로 자금이 건강하게 분산되어 있습니다."}
                  {pulse.allTop10TradeSharePct && pulse.allTop10TradeSharePct - pulse.top10TradeSharePct > 15 
                    ? " 레버리지·인버스·파킹형 상품에 거래대금이 집중되어, 실제 체감 변동성은 더 클 수 있습니다." 
                    : ""}
                </p>
              </div>
            </div>
          </div>
        </section>

      {/* STEP 3: Micro Trends */}
      <section>
        <div className="mb-4 border-l-4 border-[#9ACD68] pl-3">
          <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#5A7050]">STEP 3. MICRO TRENDS</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900">어떤 자산과 테마가 주도? (세부 동향)</h2>
          <p className="mt-1 text-sm text-neutral-500">자산군별 뼈대 흐름과 이를 주도한 세부 테마들의 성과입니다.</p>
        </div>

        {/* Part A: Macro Table */}
        <div className="mb-8 rounded-[20px] bg-white border border-[#E5E8E2] shadow-[0_4px_12px_rgba(27,38,26,0.02)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm table-fixed">
              <thead>
                <tr className="bg-[#F9FBFC] border-b border-[#EDF2DE]">
                  <th className="w-[20%] py-3 px-6 text-left text-[12px] font-extrabold text-neutral-400 tracking-wider">자산군</th>
                  <th className="w-[20%] py-3 px-6 text-right text-[12px] font-extrabold text-neutral-400 tracking-wider">운용자산 (조 원)</th>
                  <th className="w-[20%] py-3 px-6 text-right text-[12px] font-extrabold text-neutral-400 tracking-wider">비중 (%)</th>
                  <th className="w-[20%] py-3 px-6 text-right text-[12px] font-extrabold text-neutral-400 tracking-wider">가중수익률 (%)</th>
                  <th className="w-[20%] py-3 px-6 text-right text-[12px] font-extrabold text-neutral-400 tracking-wider">기여도 (%p)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF2DE]">
                {sortedAssetClasses.map(row => (
                  <tr key={row.asset_class} className="hover:bg-[#F9FBFC] transition-colors group">
                    <td className="py-3.5 px-6 font-extrabold text-neutral-800 text-[14px]">{row.asset_class}</td>
                    <td className="py-3.5 px-6 text-right tabular-nums text-neutral-600 font-semibold">{(row.total_aum / 1_000_000_000_000).toFixed(1)}</td>
                    <td className="py-3.5 px-6 text-right tabular-nums text-neutral-600 font-semibold">{row.aum_share_pct.toFixed(1)}<span className="text-neutral-400 font-normal ml-0.5">%</span></td>
                    <td className={`py-3.5 px-6 text-right tabular-nums font-bold ${changeTone(row.aum_weighted_return_pct)}`}>{row.aum_weighted_return_pct === null ? "—" : signed(row.aum_weighted_return_pct)}</td>
                    <td className={`py-3.5 px-6 text-right tabular-nums font-extrabold ${changeTone(row.contribution_pct)}`}>{signed(row.contribution_pct, "%p")}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-[#F4F7EC] font-bold text-neutral-900 text-[13px] border-t border-[#D7EABB]">
                <tr>
                  <td className="py-4 px-6 text-[14px]">합계 (Total)</td>
                  <td className="py-4 px-6 text-right tabular-nums text-[14px]">
                    {(sortedAssetClasses.reduce((sum, row) => sum + row.total_aum, 0) / 1_000_000_000_000).toFixed(1)}
                  </td>
                  <td className="py-4 px-6 text-right tabular-nums text-[14px]">
                    {Math.round(sortedAssetClasses.reduce((sum, row) => sum + row.aum_share_pct, 0))}.0<span className="text-neutral-500 font-normal ml-0.5">%</span>
                  </td>
                  <td className="py-4 px-6 text-right text-neutral-500 font-normal text-[11px]">
                    (동일 자산 가중평균)
                  </td>
                  <td className={`py-4 px-6 text-right tabular-nums text-[14px] font-extrabold ${changeTone(sortedAssetClasses.reduce((sum, row) => sum + row.contribution_pct, 0))}`}>
                    {signed(sortedAssetClasses.reduce((sum, row) => sum + row.contribution_pct, 0), "%p")}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Part B: Micro Themes 4-Col Grid */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {sortedAssetClasses.filter(row => !row.asset_class.includes('리츠') && !row.asset_class.includes('혼합')).map((row) => {
            const pg = briefing.peerGroups?.filter(g => g.assetClass === row.asset_class || g.assetClass?.includes(row.asset_class)) || [];
            const sortedPg = [...pg].sort((a, b) => b.cappedAumWeightedReturnPct - a.cappedAumWeightedReturnPct);
            const top = sortedPg.slice(0, 3);
            const bottom = sortedPg.slice().reverse().slice(0, 3).filter(g => !top.find(t => t.peerGroup === g.peerGroup)).reverse();

            return (
              <div key={row.asset_class} className="overflow-hidden rounded-[20px] border border-[#E5E8E2] bg-white shadow-[0_2px_8px_rgba(27,38,26,0.02)] flex flex-col hover:border-[#D7EABB] transition-colors">
                <div className="bg-[#F9FBFC] border-b border-[#EDF2DE] px-4 py-3.5 text-center">
                   <h3 className="font-extrabold text-[#5A7050] text-[14px] tracking-tight">{row.asset_class} 세부 테마</h3>
                </div>
                <div className="flex-1 flex flex-col bg-white">
                  {(top.length === 0 && bottom.length === 0) ? (
                    <div className="px-5 py-8 text-center text-[13px] text-neutral-400 flex-1 flex items-center justify-center">
                      세부 주도 테마가 없습니다
                    </div>
                  ) : (
                    <div className="divide-y divide-neutral-100">
                      {top.map((t, idx) => (
                        <div key={t.peerGroup} className="flex items-center justify-between gap-2 px-5 py-3.5 hover:bg-neutral-50/70 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-[13px] font-bold text-[#EE4B58] w-5 text-center opacity-90">{idx + 1}</span>
                            <p className="truncate text-[14px] font-bold text-neutral-700">{t.peerGroup}</p>
                          </div>
                          <span className={`text-[14px] font-extrabold tabular-nums tracking-tight ${changeTone(t.cappedAumWeightedReturnPct)}`}>
                            {signed(t.cappedAumWeightedReturnPct)}
                          </span>
                        </div>
                      ))}
                      {bottom.length > 0 && <div className="h-1.5 bg-[#F9FBFC]"></div>}
                      {bottom.map((b, idx) => (
                        <div key={b.peerGroup} className="flex items-center justify-between gap-2 px-5 py-3.5 hover:bg-neutral-50/70 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-[13px] font-bold text-[#4682EC] w-5 text-center opacity-90">({bottom.length - idx})</span>
                            <p className="truncate text-[14px] font-bold text-neutral-700">{b.peerGroup}</p>
                          </div>
                          <span className={`text-[14px] font-extrabold tabular-nums tracking-tight ${changeTone(b.cappedAumWeightedReturnPct)}`}>
                            {signed(b.cappedAumWeightedReturnPct)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* STEP 4: Smart Money & Risk */}
      <section>
        <div className="mb-4 border-l-4 border-[#9ACD68] pl-3">
          <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#5A7050]">STEP 4. SMART MONEY FLOW</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900">오늘 자금은 어디로? (일일 동향)</h2>
          <p className="mt-1 text-sm text-neutral-500">스마트머니의 자금 순유입 및 순유출을 통해 일일 자금 흐름을 점검합니다.</p>
        </div>

        <div className="flex flex-col gap-12 sm:gap-16">
          {briefing.fundFlow && <FundFlowRanking fundFlow={briefing.fundFlow} />}
          <DisparityAlert warnings={briefing.disparityWarning} />
        </div>
      </section>

      {/* STEP 5: Macro Trends (Weekly / Monthly Fund Flow) */}
      <section className="mb-16">
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
      <section className="mb-16">
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
                  {number.format(briefing.marketScale?.totalAum || 0)}
                </span>
                <span className="text-lg font-bold text-neutral-500">억원</span>
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
                    {signed(briefing.marketScale?.daily?.aumChange || 0)} <span className="text-[14px] font-bold opacity-70">억원</span>
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-neutral-500 font-medium mb-1">실질 자금 순유입</p>
                  <p className={`text-[18px] font-extrabold tabular-nums tracking-tight ${changeTone(briefing.marketScale?.daily?.netInflow || 0)}`}>
                    {signed(briefing.marketScale?.daily?.netInflow || 0)} <span className="text-[14px] font-bold opacity-70">억원</span>
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
                    {signed(briefing.marketScale?.weekly?.aumChange || 0)} <span className="text-[14px] font-bold opacity-70">억원</span>
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-neutral-500 font-medium mb-1">실질 자금 순유입</p>
                  <p className={`text-[18px] font-extrabold tabular-nums tracking-tight ${changeTone(briefing.marketScale?.weekly?.netInflow || 0)}`}>
                    {signed(briefing.marketScale?.weekly?.netInflow || 0)} <span className="text-[14px] font-bold opacity-70">억원</span>
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
                    {signed(briefing.marketScale?.monthly?.aumChange || 0)} <span className="text-[14px] font-bold opacity-70">억원</span>
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-neutral-500 font-medium mb-1">실질 자금 순유입</p>
                  <p className={`text-[18px] font-extrabold tabular-nums tracking-tight ${changeTone(briefing.marketScale?.monthly?.netInflow || 0)}`}>
                    {signed(briefing.marketScale?.monthly?.netInflow || 0)} <span className="text-[14px] font-bold opacity-70">억원</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

<MarketBriefingHistory

        activeDate={briefing.asOfDate}

        onSelectDate={(date) => setSelectedDate(date)}

      />



      <details className="rounded-[18px] border border-[#D7EABB] bg-[#FAFDF4] px-5 py-4 text-sm text-neutral-600">

        <summary className="cursor-pointer font-bold text-neutral-800">데이터 기준 및 방식</summary>

        <div className="mt-3 space-y-2 leading-6">

          <p>전체·순자산 Top 50·100·200 수익률은 해당 시장 일반 ETF들의 당일 등락률을 투자금으로 가중해 계산하며, 개별 ETF 비중 상한을 적용하지 않습니다.</p>
          <p>자산군별 수익률 기여도는 해당 자산군의 AUM 비중과 AUM 가중수익률을 곱해 계산합니다. 일반 ETF는 레버리지, 인버스, 파킹형 상품을 제외한 순수 시장/테마형 ETF만을 의미합니다.</p>

          <p>[STEP 5] 주/월간 자금 트렌드(순유입액)는 펀드의 순자산(AUM) 증감이 아닌, 실제 투자자들의 자금이 들어온 &apos;순설정액(설정액-환매액)&apos;만을 기간별(5일/20일)로 합산해 산출합니다.</p>
          <p>[STEP 6] 시장 규모 추적 시 &apos;자산 증감(AUM)&apos;은 주가 변동이 포함된 외형 성장을 의미하며, &apos;실질 자금 순유입&apos;은 주가 변동을 제외하고 시장에 새롭게 유입된 순수 현금(순설정액)만을 집계합니다.</p>
          {briefing.isStale && <p>현재 화면의 데이터는 {number.format(briefing.staleDays)}일 이전 데이터이므로 갱신 지연 상태로 표시됩니다.</p>}

          <p className="mt-4 pt-4 border-t border-[#EDF2DE] text-xs text-neutral-500">데이터 수집·검증이 완료된 기준으로만 공개되며, 특정 ETF의 매수·매도·보유를 권유하지 않습니다.</p>

        </div>

      </details>

    </div>

  );

}


