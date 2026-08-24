"use client";



import globalIndicesData from "@/data/market_indices.json";

import Link from "next/link";

import { useMemo, useState } from "react";

import { Info, BookOpen, TrendingUp, TrendingDown, Calendar } from "lucide-react";

import { MarketBriefingHistory } from "@/components/market-briefing-history";

import { FundFlowRanking } from "@/components/market-briefing/fund-flow-ranking";

import { DisparityAlert } from "@/components/market-briefing/disparity-alert";

import { PeerGroupReturns } from "@/components/market-briefing/peer-group-returns";

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

  };

  assetClasses: AssetClass[];

  focusEtfs: FocusEtf[];

  peerGroups?: any;

  fundFlow?: any;

  disparityWarning?: any;

};



const number = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

const decimal = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });



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
      yieldCurveBadge = <span className="ml-1 inline-flex items-center rounded bg-[#F0FDF4] px-1.5 py-0.5 text-[10px] font-bold text-[#166534] ring-1 ring-inset ring-[#BBF7D0]">성장 기대</span>;
    }
  }

  let emoji = "";
  if (["VIX", "VKOSPI"].includes(index.code)) emoji = "🎢";
  
  else if (index.code === "CLF") emoji = "🛢️";
  else if (index.code === "GC") emoji = "🥇";
  else if (index.code === "SI") emoji = "🥈";

  return (
    <div className="flex items-center justify-between py-3 border-b border-neutral-100 last:border-0 hover:bg-neutral-50/50 transition-colors rounded-lg px-2 -mx-2">
      <div className="flex items-center gap-2.5">
        {emoji && <span className="text-[17px] w-5 text-center">{emoji}</span>}
        <div className="flex items-center gap-1.5">
          <p className="text-[13px] font-bold text-neutral-800">{index.label}</p>
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
    addGlobalIndex("VKOSPI", "VKOSPI");
    addGlobalIndex("금 선물", "GC");
    addGlobalIndex("은 선물", "SI");



    const order = ["KOSPI", "KOSDAQ", "SPX", "NDX", "VIX", "KR10Y", "DGS10", "T10Y2Y", "CLF"];

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

      .sort((a, b) => b.contribution_pct - a.contribution_pct);

  }, [briefing]);



  if (isLoading) return <Skeleton />;

  if (!briefing) return <ErrorState message={error ?? "검증된 브리핑이 아직 없습니다."} />;



  const { pulse } = briefing;

  const scopeReturns = new Map(pulse.aumWeightedReturns.map((item) => [item.scope, item]));

  const scaleRows = [

    { scope: "all" as const, label: "전체 ETF", value: pulse.generalAumWeightedReturnPct, detail: `일반 ETF ${number.format(pulse.generalEtfCount)}개` },

    { scope: "top_50" as const, label: "투자금 Top 50", value: pulse.top50AumWeightedReturnPct, detail: "투자금 상위 50개 ETF", tag: "대형 ETF 흐름" },

    { scope: "top_100" as const, label: "투자금 Top 100", value: pulse.top100AumWeightedReturnPct, detail: "투자금 상위 100개 ETF" },

    { scope: "top_200" as const, label: "투자금 Top 200", value: pulse.top200AumWeightedReturnPct, detail: "투자금 상위 200개 ETF" },

  ];

  const maxScale = Math.max(...scaleRows.map((row) => Math.abs(row.value)), 0.01);

  const maxContribution = Math.max(...sortedAssetClasses.map((row) => Math.abs(row.contribution_pct)), 0.01);

    const isPositive = pulse.generalAumWeightedReturnPct >= 0;
  
  const validClasses = briefing.assetClasses.filter(c => c.etf_count >= 10);
  const bestClass = validClasses.reduce((prev, curr) => (curr.aum_weighted_return_pct ?? -Infinity) > (prev.aum_weighted_return_pct ?? -Infinity) ? curr : prev, validClasses[0]);
  const worstClass = validClasses.reduce((prev, curr) => (curr.aum_weighted_return_pct ?? Infinity) < (prev.aum_weighted_return_pct ?? Infinity) ? curr : prev, validClasses[0]);
  
  let assetClassSentence = "";
  if (worstClass?.aum_weighted_return_pct != null && bestClass?.aum_weighted_return_pct != null) {
    assetClassSentence = `섹터별로는 '${worstClass.asset_class}' 부문이 ${signed(worstClass.aum_weighted_return_pct)}로 가장 부진했던 반면, '${bestClass.asset_class}' 부문은 ${signed(bestClass.aum_weighted_return_pct)}로 두각을 나타냈습니다. `;
  }
  
  let concentrationSentence = "";
  if (pulse.top10TradeSharePct > 40) {
    concentrationSentence = `또한 상위 10개 종목이 전체 거래대금의 ${decimal.format(pulse.top10TradeSharePct)}%를 차지할 만큼 쏠림 현상이 뚜렷했습니다.`;
  }

  let sizeSentence = "";
  const diff = pulse.top50AumWeightedReturnPct - pulse.generalAumWeightedReturnPct;
  if (!isPositive && diff > 0.05) {
    sizeSentence = `다만, 시가총액 상위 50개 대표 ETF는 평균 ${signed(pulse.top50AumWeightedReturnPct)} 하락에 그쳐 중소형 테마 ETF 대비 높은 방어력을 보였습니다. `;
  } else if (isPositive && diff > 0.05) {
    sizeSentence = `특히, 시가총액 상위 50개 대표 ETF가 평균 ${signed(pulse.top50AumWeightedReturnPct)} 상승하며 전체 시장의 상승을 강하게 주도했습니다. `;
  }

  const headline = `일반 ETF ${number.format(pulse.generalEtfCount)}개 중 상승 ${pulse.upCount}개, 하락 ${pulse.downCount}개로 평균 ${signed(pulse.generalAumWeightedReturnPct)} ${isPositive ? '상승' : '하락'}하며 전반적인 ${isPositive ? '강세' : '약세'}를 보였습니다. ${sizeSentence}${assetClassSentence}${concentrationSentence}`.trim();



  const ret = pulse.generalAumWeightedReturnPct;

  const br = pulse.breadthRatioPct;

  let dynamicTitle = "상승과 하락이 팽팽하게 맞서며 혼조세를 보인 하루였습니다 ⚖️";

  

  if (ret <= -1.0 && br <= 30) {

    dynamicTitle = "파란불이 시장 전체를 덮은 강한 하락장이었습니다 📉";

  } else if (ret <= -0.3 && br < 50) {

    dynamicTitle = "하락 종목이 우세한 가운데 전반적인 약세를 보였습니다 📉";

  } else if (ret >= 1.0 && br >= 70) {

    dynamicTitle = "빨간불이 시장 전체를 덮은 강한 상승장이었습니다 📈";

  } else if (ret >= 0.3 && br > 50) {

    dynamicTitle = "상승 종목이 우세한 가운데 전반적인 강세를 보였습니다 📈";

  } else if (br < 50) {

    dynamicTitle = "하락 종목이 조금 더 많아 주의가 필요한 하루였습니다 🌧️";

  } else if (br > 50) {

    dynamicTitle = "상승 종목이 조금 더 많은 훈훈한 하루였습니다 ☀️";

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

                  <li><span className="text-[#5A7050]">STEP 3.</span> 세부 동향 (테마 및 자금 흐름)</li>

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
            {/* Card 1: Market Pulse (Combined Breadth & Return) */}
            <div className="rounded-[20px] border border-[#E5E8E2] bg-white p-5 shadow-[0_4px_12px_rgba(27,38,26,0.02)] flex flex-col justify-between hover:-translate-y-0.5 transition-transform">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[15px]">🌡️</span>
                  <p className="text-[11px] font-extrabold tracking-wide text-neutral-500">시장 온도</p>
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <span className={`text-[32px] font-extrabold tabular-nums tracking-tight leading-none ${changeTone(pulse.generalAumWeightedReturnPct)}`}>
                      {signed(pulse.generalAumWeightedReturnPct)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={`text-lg font-extrabold ${pulse.breadthRatioPct >= 50 ? "text-[#D84957]" : "text-[#247DAA]"}`}>{pulse.marketTemperature}</span>
                  </div>
                </div>
              </div>
              <div className="mt-6">
                <BreadthBar pulse={pulse} />
              </div>
            </div>

            {/* Card 2: Feature (Summary) */}
            <div className="rounded-[20px] border border-[#E5E8E2] bg-white p-5 shadow-[0_4px_12px_rgba(27,38,26,0.02)] flex flex-col hover:-translate-y-0.5 transition-transform">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[15px]">📊</span>
                  <p className="text-[11px] font-extrabold tracking-wide text-neutral-500">ETF 요약</p>
                </div>
                {briefing.disparityWarning && briefing.disparityWarning.length > 0 && (
                  <span className="inline-flex items-center rounded-full bg-[#FFF5F5] px-2 py-0.5 text-[10px] font-bold text-[#D84957] ring-1 ring-inset ring-[#F3C5C9]">
                    ⚠️ 괴리율 주의
                  </span>
                )}
              </div>
              <p className="mt-4 text-[14px] font-medium leading-relaxed text-neutral-800">
                {headline}
              </p>
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
              <h3 className="mb-3 text-[14px] font-extrabold text-neutral-800 tracking-tight border-b-2 border-neutral-800 pb-2 flex items-center gap-1.5"><span className="text-lg">🇰🇷</span> 국내 증시</h3>
              <div className="flex flex-col">
                {orderedIndices.filter(i => ["KOSPI", "KOSDAQ", "VKOSPI"].includes(i.code)).map(i => <IndexRow key={i.code} index={i} />)}
              </div>
            </div>
            
            {/* 미국 증시 */}
            <div>
              <h3 className="mb-3 text-[14px] font-extrabold text-neutral-800 tracking-tight border-b-2 border-neutral-800 pb-2 flex items-center gap-1.5"><span className="text-lg">🇺🇸</span> 미국 증시</h3>
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

      <section aria-labelledby="market-pulse-title" className="space-y-8">

        <div className="mb-4 border-l-4 border-[#9ACD68] pl-3">

          <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#5A7050]">STEP 2. MARKET PULSE</p>

          <h2 id="market-pulse-title" className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900">그래서 ETF 시장은 어땠을까요? (시장 온도)</h2>

          <p className="mt-1 text-sm text-neutral-500">거시 경제의 변화가 전체 일반 ETF 시장에 미친 영향입니다.</p>

        </div>

        

        <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">

          <div className="flex flex-col gap-4">

            <article className="flex-1 rounded-[22px] border border-[#D7EABB] bg-[#F9FBFC] p-6 shadow-sm">

              <div className="flex items-center gap-2">

                <p className="text-sm font-bold text-neutral-800">일반 ETF 전체 수익률</p>

                <InfoTooltip text="AUM(Asset Under Management)은 ETF에 모인 총 투자금 규모를 의미합니다. 투자금이 클수록 안정적인 운용이 가능합니다." />

              </div>

              <p className={`mt-4 text-4xl font-extrabold tracking-tight tabular-nums ${changeTone(pulse.generalAumWeightedReturnPct)}`}>{signed(pulse.generalAumWeightedReturnPct)}</p>

              <p className="mt-3 text-xs text-neutral-500">일반 ETF {number.format(pulse.generalEtfCount)}개 · 투자금(AUM) 가중수익률</p>

            </article>

            <div className="grid grid-cols-1 gap-4">

              <article className="rounded-[18px] border border-[#E5E8E2] bg-white p-5 shadow-sm">

                <p className="text-[11px] font-semibold text-neutral-500">거래 쏠림 현상</p>

                <p className="mt-1 text-sm font-bold text-neutral-900">상위 10개 ETF 집중도</p>

                <p className="mt-1 text-xl font-extrabold tabular-nums text-neutral-800">{decimal.format(pulse.top10TradeSharePct)}%</p>

                <p className="mt-2 text-[11px] leading-4 text-neutral-500">전체 거래대금 중 상위 10개 비중</p>

              </article>

            </div>

          </div>



          <div className="overflow-hidden rounded-[22px] border border-[#D7EABB] bg-white shadow-sm flex flex-col justify-center">

            <div className="border-b border-[#EDF2DE] px-5 py-4">

              <p className="font-bold text-neutral-900">내 계좌 체감 수익률 비교</p>

              <p className="mt-1 text-xs text-neutral-500">투자금 규모별 상위 ETF의 수익률과 나의 계좌를 비교해보세요.</p>

            </div>

            <div className="divide-y divide-[#EDF2DE]">

              {scaleRows.map((row) => {

                const coverage = scopeReturns.get(row.scope)?.aum_coverage_pct;

                const width = Math.max((Math.abs(row.value) / maxScale) * 100, 4);

                return (

                  <div key={row.scope} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(140px,1fr)_minmax(100px,1fr)_92px] sm:items-center">

                    <div className="min-w-0">

                      <div className="flex flex-wrap items-center gap-2">

                        <p className="font-bold text-neutral-800">{row.label}</p>

                        {row.tag && <span className="rounded-full bg-[#EEF9DF] px-2 py-0.5 text-[10px] font-bold text-[#547048]">{row.tag}</span>}

                      </div>

                      <p className="mt-1 text-[11px] text-neutral-500">{row.detail}{coverage !== undefined && ` · AUM 커버리지 ${decimal.format(coverage)}%`}</p>

                    </div>

                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#F1F3EF] sm:mt-0">

                      <span className={`block h-full rounded-full ${row.value >= 0 ? "bg-[#D9F4B8]" : "bg-[#B9E6FE]"}`} style={{ width: `${width}%` }} />

                    </div>

                    <p className={`text-right text-base font-extrabold tabular-nums ${changeTone(row.value)}`}>{signed(row.value)}</p>

                  </div>

                );

              })}

            </div>

          </div>

        </div>

      </section>



      {/* STEP 3: Micro (Asset class, Peer groups, Flow) */}

      <section>

        <div className="mb-4 border-l-4 border-[#9ACD68] pl-3">

          <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#5A7050]">STEP 3. MICRO TRENDS</p>

          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900">어떤 ETF가 주도했을까요? (세부 동향)</h2>

          <p className="mt-1 text-sm text-neutral-500">자산군, 테마별 수익률과 투자자들의 실제 자금 이동 내역입니다.</p>

        </div>

        

        <div className="flex flex-col gap-12 sm:gap-16">

          {/* Asset Class Attribution */}

          <div>

            <div className="mb-3 flex items-end justify-between gap-3">

              <h3 className="font-bold text-neutral-900">어떤 자산이 오늘 시장을 이끌었을까요?</h3>

              <span className="text-xs text-neutral-500 flex items-center gap-1"><Info className="h-3 w-3" />일반 ETF 수익률 기여도</span>

            </div>

            <div className="grid overflow-hidden rounded-[22px] border border-[#D7EABB] bg-white shadow-sm lg:grid-cols-[0.9fr_1.1fr]">

              <div className="border-b border-[#EDF2DE] p-5 lg:border-b-0 lg:border-r sm:p-6">

                <p className="text-sm font-bold text-neutral-800">기여도 읽기</p>

                <p className="mt-1 text-xs leading-5 text-neutral-500">자산군의 AUM 비중과 가중수익률을 곱해 전체 일반 ETF 수익률에 미친 기여도를 계산합니다.</p>

                <div className="mt-6 space-y-4">

                  {sortedAssetClasses.map((row) => {

                    const percent = (Math.abs(row.contribution_pct) / maxContribution) * 50;

                    const positive = row.contribution_pct >= 0;

                    return (

                      <div key={row.asset_class} className="grid grid-cols-[86px_1fr_62px] items-center gap-3">

                        <span className="truncate text-xs font-semibold text-neutral-700">{row.asset_class}</span>

                        <div className="relative h-2.5 rounded-full bg-[#F1F3EF]" aria-label={`${row.asset_class} 수익률 기여도 ${signed(row.contribution_pct, "%p")}`}>

                          <span className="absolute left-1/2 top-[-3px] h-4 w-px bg-neutral-300" />

                          <span className={`absolute top-0 h-full rounded-full ${positive ? "bg-[#C6ECA0]" : "bg-[#A9DCE9]"}`} style={positive ? { left: "50%", width: `${percent}%` } : { right: "50%", width: `${percent}%` }} />

                        </div>

                        <span className={`text-right text-xs font-extrabold tabular-nums ${changeTone(row.contribution_pct)}`}>{signed(row.contribution_pct, "%p")}</span>

                      </div>

                    );

                  })}

                </div>

              </div>

              <div className="overflow-x-auto">

                <table className="min-w-[620px] w-full text-sm">

                  <thead className="bg-[#EFF8D8] text-[11px] font-extrabold text-[#365314]">

                    <tr>

                      <th className="px-5 py-3 text-left">자산군</th>

                      <th className="px-4 py-3 text-right">AUM 비중</th>

                      <th className="px-4 py-3 text-right">가중수익률</th>

                      <th className="bg-[#E7F6C8] px-5 py-3 text-right">수익률 기여도</th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-[#EDF2DE]">

                    {sortedAssetClasses.map((row) => {

                      const contributionPercent = (Math.abs(row.contribution_pct) / maxContribution) * 100;

                      const isPositive = row.contribution_pct >= 0;

                      return (

                        <tr key={row.asset_class} className="group relative transition-colors hover:bg-[#F8FCEB]">

                          <td className="relative z-10 px-5 py-4 font-bold text-neutral-800">

                            {row.asset_class}

                            <span className="mt-1 block text-[11px] font-normal text-neutral-500">

                              ETF {number.format(row.etf_count)}개 · 상승 {number.format(row.up_count)} / 하락 {number.format(row.down_count)}

                            </span>

                          </td>

                          <td className="relative z-10 px-4 py-4 text-right tabular-nums text-neutral-700">

                            {decimal.format(row.aum_share_pct)}%

                          </td>

                          <td className={`relative z-10 px-4 py-4 text-right font-bold tabular-nums ${changeTone(row.aum_weighted_return_pct ?? 0)}`}>

                            {row.aum_weighted_return_pct === null ? "—" : signed(row.aum_weighted_return_pct)}

                          </td>

                          <td className={`relative z-10 px-5 py-4 text-right font-extrabold tabular-nums ${changeTone(row.contribution_pct)}`}>

                            <div className="absolute inset-y-0 right-0 -z-10 bg-[#F5FBE7] opacity-0 transition-opacity group-hover:opacity-100 w-full" />

                            <div

                              className={`absolute inset-y-1.5 right-2 -z-10 rounded-md opacity-40 ${isPositive ? "bg-[#C6ECA0]" : "bg-[#A9DCE9]"}`}

                              style={{ width: `calc(${Math.max(contributionPercent, 2)}% - 1rem)` }}

                            />

                            {signed(row.contribution_pct, "%p")}

                          </td>

                        </tr>

                      );

                    })}

                  </tbody>

                </table>

              </div>

            </div>

          </div>



          <PeerGroupReturns groups={briefing.peerGroups} />



          <FundFlowRanking fundFlow={briefing.fundFlow} />



          <DisparityAlert warnings={briefing.disparityWarning} />



          <section aria-labelledby="active-etfs-title" className="rounded-[24px] border border-[#D7EABB] bg-[#F9FBFC] p-6 sm:p-8 shadow-sm">

            <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">

              <div>

                <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#5A7050]">ACTIVE TRADING</p>

                <h3 id="active-etfs-title" className="mt-1 text-xl font-extrabold tracking-tight text-neutral-900">오늘 가장 활발하게 거래된 ETF</h3>

              </div>

              <span className="text-xs text-neutral-500 flex items-center gap-1"><Info className="h-3 w-3" />거래대금순 (최상위 3종목)</span>

            </div>

            <div className="grid gap-4 sm:grid-cols-3">

              {briefing.focusEtfs.map((etf) => (

                <Link key={etf.ticker} href={`/etf/${etf.ticker}`} className="group rounded-[18px] border border-[#E5E8E2] bg-white p-4 shadow-[0_4px_12px_rgba(27,38,26,0.04)] transition hover:-translate-y-0.5 hover:border-[#B8D598] hover:bg-[#F8FCEB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9ACD68]">

                  <div className="flex items-start justify-between gap-3">

                    <span className="text-[11px] font-medium text-neutral-500">{etf.ticker}</span>

                    <span className={`text-sm font-extrabold tabular-nums ${changeTone(etf.change_pct)}`}>{signed(etf.change_pct)}</span>

                  </div>

                  <p className="mt-3 truncate font-extrabold text-neutral-800">{etf.etf_name}</p>

                  <p className="mt-1 truncate text-xs text-neutral-500">{etf.asset_class ?? "미분류"}</p>

                  <p className="mt-4 text-xs text-neutral-500">거래대금 <span className="font-bold text-neutral-700 tabular-nums">{money(etf.trade_value)}</span></p>

                </Link>

              ))}

            </div>

            <p className="mt-4 text-xs text-neutral-500">거래대금은 관심 집중도를 보여주는 지표이며 투자 추천이나 향후 성과를 의미하지 않습니다.</p>

          </section>

        </div>

      </section>



      



      <MarketBriefingHistory

        activeDate={briefing.asOfDate}

        onSelectDate={(date) => setSelectedDate(date)}

      />



      <details className="rounded-[18px] border border-[#D7EABB] bg-[#FAFDF4] px-5 py-4 text-sm text-neutral-600">

        <summary className="cursor-pointer font-bold text-neutral-800">데이터 기준 및 방식</summary>

        <div className="mt-3 space-y-2 leading-6">

          <p>전체·투자금 Top 50·100·200 수익률은 해당 시장 일반 ETF들의 당일 등락률을 투자금으로 가중해 계산하며, 개별 ETF 비중 상한을 적용하지 않습니다.</p>

          <p>자산군별 수익률 기여도는 해당 자산군의 AUM 비중과 AUM 가중수익률을 곱해 계산합니다. 일반 ETF에는 레버리지·인버스 및 제외된 ETF가 포함됩니다.</p>

          {briefing.isStale && <p>현재 화면의 데이터는 {number.format(briefing.staleDays)}일 이전 데이터이므로 갱신 지연 상태로 표시됩니다.</p>}

          <p className="mt-4 pt-4 border-t border-[#EDF2DE] text-xs text-neutral-500">데이터 수집·검증이 완료된 기준으로만 공개되며, 특정 ETF의 매수·매도·보유를 권유하지 않습니다.</p>

        </div>

      </details>

    </div>

  );

}


