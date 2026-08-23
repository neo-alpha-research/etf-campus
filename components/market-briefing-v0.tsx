"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MarketBriefingHistory } from "@/components/market-briefing-history";
import { FundFlowRanking } from "@/components/market-briefing/fund-flow-ranking";
import { DisparityAlert } from "@/components/market-briefing/disparity-alert";
import { PeerGroupReturns } from "@/components/market-briefing/peer-group-returns";
import { useMarketBriefing } from "@/lib/hooks/use-market-briefing";

type MarketIndex = {
  code: "KOSPI" | "KOSDAQ";
  label: string;
  close: number;
  change_points?: number | null;
  change_pct?: number;
  as_of_date: string;
};

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
};

const number = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function signed(value: number, unit = "%") {
  return `${value >= 0 ? "+" : ""}${decimal.format(value)}${unit}`;
}

function money(value: number) {
  if (value >= 1_000_000_000_000) return `${decimal.format(value / 1_000_000_000_000)}조 원`;
  if (value >= 100_000_000) return `${decimal.format(value / 100_000_000)}억 원`;
  return `${number.format(value)}원`;
}

function dateLabel(value: string) {
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
      <p className="mt-4 text-xs text-amber-700">기준일이 일치하는 검증된 데이터가 준비되면 자동으로 표시됩니다.</p>
    </section>
  );
}

function BreadthBar({ pulse }: { pulse: Briefing["pulse"] }) {
  const total = pulse.generalEtfCount || 1;
  const up = (pulse.upCount / total) * 100;
  const flat = (pulse.flatCount / total) * 100;
  const down = (pulse.downCount / total) * 100;

  return (
    <div className="mt-4">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-white/15" aria-label={`상승 ${pulse.upCount}개, 보합 ${pulse.flatCount}개, 하락 ${pulse.downCount}개`}>
        <span className="bg-[#E5484D]" style={{ width: `${up}%` }} />
        <span className="bg-neutral-300" style={{ width: `${flat}%` }} />
        <span className="bg-[#2879BB]" style={{ width: `${down}%` }} />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-2 gap-y-1 text-[11px] font-medium">
        <span className="text-[#FFB4AE]">상승 {number.format(pulse.upCount)}</span>
        <span className="text-white/65">보합 {number.format(pulse.flatCount)}</span>
        <span className="text-[#B9E6FE]">하락 {number.format(pulse.downCount)}</span>
      </div>
    </div>
  );
}

function IndexCard({ index }: { index: MarketIndex }) {
  const change = index.change_pct ?? 0;
  return (
    <article className="rounded-[18px] border border-[#D7EABB] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-neutral-800">{index.label}</p>
        <span className={`rounded-full px-2 py-1 text-[11px] font-bold ring-1 ${changeSurface(change)}`}>{signed(change)}</span>
      </div>
      <p className="mt-4 text-xl font-bold tracking-tight text-neutral-900 tabular-nums">{decimal.format(index.close)}</p>
      <p className="mt-1.5 text-[11px] text-neutral-500">기준일 {dateLabel(index.as_of_date)}</p>
    </article>
  );
}

export function MarketBriefingV0() {
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  const { briefing, isLoading, isRefreshing, error, refresh } = useMarketBriefing({
    asOfDate: selectedDate,
    revalidateOnFocus: !selectedDate,
    revalidateIntervalMs: selectedDate ? 0 : 10 * 60 * 1000,
  });
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
    { scope: "top_50" as const, label: "순자산 Top 50", value: pulse.top50AumWeightedReturnPct, detail: "순자산 상위 50개 ETF", tag: "대형 ETF 흐름" },
    { scope: "top_100" as const, label: "순자산 Top 100", value: pulse.top100AumWeightedReturnPct, detail: "순자산 상위 100개 ETF" },
    { scope: "top_200" as const, label: "순자산 Top 200", value: pulse.top200AumWeightedReturnPct, detail: "순자산 상위 200개 ETF" },
  ];
  const maxScale = Math.max(...scaleRows.map((row) => Math.abs(row.value)), 0.01);
  const maxContribution = Math.max(...sortedAssetClasses.map((row) => Math.abs(row.contribution_pct)), 0.01);
  const headline = briefing.headline.text ?? `일반 ETF ${number.format(pulse.generalEtfCount)}개 기준, ${pulse.marketTemperature} 흐름입니다.`;

  return (
    <div className="mx-auto max-w-7xl space-y-9 pb-4">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-[11px] font-extrabold tracking-[0.16em] text-[#5A7050]">ETF CAMPUS</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl">{selectedDate ? "지난 마켓 브리핑" : "오늘의 마켓 브리핑"}</h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-neutral-500">ETF 데이터 기준일 {dateLabel(briefing.asOfDate)}</span>
            {selectedDate && <span className="rounded-full bg-[#EFF8D8] px-2.5 py-1 font-bold text-[#50673F]">과거 브리핑</span>}
            {briefing.isStale && <span className="rounded-full bg-[#FFF1BD] px-2.5 py-1 font-bold text-[#765D17]">갱신 지연</span>}
          </div>
        </div>
        <div className="flex w-fit items-center gap-2">
          {selectedDate && (
            <button type="button" onClick={() => setSelectedDate(undefined)} className="inline-flex rounded-xl border border-[#C9DDB1] bg-[#F7FBEF] px-3.5 py-2.5 text-sm font-bold text-[#476237] transition hover:bg-[#EFF8D8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9ACD68]">
              최신 브리핑
            </button>
          )}
          <button type="button" onClick={() => void refresh()} disabled={isRefreshing} className="inline-flex rounded-xl border border-[#CFD5CB] bg-white px-3.5 py-2.5 text-sm font-bold text-neutral-700 transition hover:bg-[#EFF8D8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9ACD68] disabled:cursor-wait disabled:opacity-60">
            {isRefreshing ? "갱신 중…" : "↻ 새로고침"}
          </button>
        </div>
      </header>

      <section aria-labelledby="market-summary-title" className="rounded-[26px] bg-[#202920] p-5 text-white shadow-[0_8px_24px_rgba(27,38,26,0.10)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#B7E886]">ETF CAMPUS 공개 브리핑</p>
            <h2 id="market-summary-title" className="mt-1 text-xl font-extrabold tracking-tight">오늘의 ETF 시장</h2>
            <p className="mt-2 text-sm leading-6 text-white/70">{headline}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white/80"><i className="h-1.5 w-1.5 rounded-full bg-[#B7E886]" />데이터 집계</span>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-4">
          <article className="rounded-[18px] border border-white/15 bg-white/[0.08] p-4 lg:col-span-2">
            <p className="text-[11px] font-semibold text-white/70">일반 ETF 전체</p>
            <p className={`mt-2 text-4xl font-extrabold tracking-tight tabular-nums ${changeTone(pulse.generalAumWeightedReturnPct)}`}>{signed(pulse.generalAumWeightedReturnPct)}</p>
            <p className="mt-2 text-xs text-white/70">일반 ETF {number.format(pulse.generalEtfCount)}개 · 순자산 가중수익률</p>
          </article>
          <article className="rounded-[18px] border border-white/10 bg-white/[0.06] p-4">
            <p className="text-[11px] font-semibold text-white/70">시장 폭</p>
            <p className="mt-2 text-sm font-bold text-white">상승 비중 <span className="text-lg tabular-nums">{decimal.format(pulse.breadthRatioPct)}%</span></p>
            <BreadthBar pulse={pulse} />
          </article>
          <article className="rounded-[18px] border border-white/10 bg-white/[0.06] p-4">
            <p className="text-[11px] font-semibold text-white/70">거래 관심</p>
            <p className="mt-2 text-sm font-bold leading-5 text-white">상위 10개 거래 집중도</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">{decimal.format(pulse.top10TradeSharePct)}%</p>
            <p className="mt-2 text-[11px] leading-4 text-white/65">전체 거래대금 중 상위 10개 ETF 비중</p>
          </article>
        </div>
      </section>

      <section aria-labelledby="market-scale-title">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#5A7050]">MARKET SCALE</p>
            <h2 id="market-scale-title" className="mt-1 text-xl font-extrabold tracking-tight text-neutral-900">규모별 ETF 흐름</h2>
          </div>
          <span className="text-xs text-neutral-500">0% 기준 비교</span>
        </div>
        <div className="overflow-hidden rounded-[22px] border border-[#D7EABB] bg-white shadow-[0_8px_24px_rgba(27,38,26,0.05)]">
          {scaleRows.map((row, index) => {
            const coverage = scopeReturns.get(row.scope)?.aum_coverage_pct;
            const width = Math.max((Math.abs(row.value) / maxScale) * 100, 4);
            return (
              <div key={row.scope} className={`grid gap-3 px-4 py-4 sm:grid-cols-[minmax(180px,1fr)_minmax(120px,1.1fr)_92px] sm:items-center sm:px-5 ${index > 0 ? "border-t border-[#EDF2DE]" : ""}`}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><p className="font-bold text-neutral-800">{row.label}</p>{row.tag && <span className="rounded-full bg-[#EEF9DF] px-2 py-0.5 text-[10px] font-bold text-[#547048]">{row.tag}</span>}</div>
                  <p className="mt-1 text-[11px] text-neutral-500">{row.detail}{coverage !== undefined && ` · AUM 커버리지 ${decimal.format(coverage)}%`}</p>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#F1F3EF] sm:mt-0">
                  <span className={`block h-full rounded-full ${row.value >= 0 ? "bg-gradient-to-r from-[#D9F4B8] to-[#A9DCE9]" : "bg-[#B9E6FE]"}`} style={{ width: `${width}%` }} />
                </div>
                <p className={`text-right text-lg font-extrabold tabular-nums ${changeTone(row.value)}`}>{signed(row.value)}</p>
              </div>
            );
          })}
        </div>
      </section>

      {briefing.marketIndices.length > 0 && (
        <section aria-labelledby="market-index-title">
          <div className="mb-3">
            <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#5A7050]">MARKET INDEX</p>
            <h2 id="market-index-title" className="mt-1 text-xl font-extrabold tracking-tight text-neutral-900">국내 대표지수</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">{briefing.marketIndices.map((index) => <IndexCard key={index.code} index={index} />)}</div>
        </section>
      )}

      <PeerGroupReturns groups={briefing.peerGroups} />

      <DisparityAlert warnings={briefing.disparityWarning} />
      <FundFlowRanking fundFlow={briefing.fundFlow} />


        <section aria-labelledby="asset-class-title">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#5A7050]">ATTRIBUTION</p>
            <h2 id="asset-class-title" className="mt-1 text-xl font-extrabold tracking-tight text-neutral-900">자산군별 수익률 기여도</h2>
          </div>
          <span className="text-xs text-neutral-500">일반 ETF 기준</span>
        </div>
        <div className="grid overflow-hidden rounded-[22px] border border-[#D7EABB] bg-white shadow-[0_8px_24px_rgba(27,38,26,0.05)] lg:grid-cols-[0.9fr_1.1fr]">
          <div className="border-b border-[#EDF2DE] p-5 lg:border-b-0 lg:border-r sm:p-6">
            <p className="text-sm font-bold text-neutral-800">기여도 크기</p>
            <p className="mt-1 text-xs leading-5 text-neutral-500">자산군의 AUM 비중과 가중수익률을 곱해 전체 일반 ETF 수익률에 대한 기여도를 계산했습니다.</p>
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
                {sortedAssetClasses.map((row) => (
                  <tr key={row.asset_class} className="transition-colors hover:bg-[#F8FCEB]">
                    <td className="px-5 py-4 font-bold text-neutral-800">{row.asset_class}<span className="mt-1 block text-[11px] font-normal text-neutral-500">ETF {number.format(row.etf_count)}개 · 상승 {number.format(row.up_count)} / 하락 {number.format(row.down_count)}</span></td>
                    <td className="px-4 py-4 text-right tabular-nums text-neutral-700">{decimal.format(row.aum_share_pct)}%</td>
                    <td className={`px-4 py-4 text-right font-bold tabular-nums ${changeTone(row.aum_weighted_return_pct ?? 0)}`}>{row.aum_weighted_return_pct === null ? "—" : signed(row.aum_weighted_return_pct)}</td>
                    <td className={`bg-[#F5FBE7] px-5 py-4 text-right font-extrabold tabular-nums ${changeTone(row.contribution_pct)}`}>{signed(row.contribution_pct, "%p")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section aria-labelledby="focus-etf-title">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#5A7050]">ACTIVE TRADING</p>
            <h2 id="focus-etf-title" className="mt-1 text-xl font-extrabold tracking-tight text-neutral-900">거래 관심 ETF</h2>
          </div>
          <span className="text-xs text-neutral-500">거래대금 순</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
        <p className="mt-3 text-xs text-neutral-500">거래대금은 관심 집중도를 보여주는 지표이며, 투자 추천이나 향후 성과를 뜻하지 않습니다.</p>
      </section>

      <section className="rounded-[22px] bg-[#202920] px-6 py-8 text-white sm:px-8 sm:py-10">
        <p className="text-[11px] font-extrabold tracking-[0.16em] text-[#B7E886]">MARKET INSIGHT</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight">숫자 다음의 시장 해석을 받아보세요.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70">마켓 브리핑은 시장의 정량적 움직임을 정리합니다. 마켓 인사이트에서는 흐름의 배경과 다음에 확인할 데이터를 다룹니다.</p>
        <Link href="/market-insights" className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-neutral-900 transition hover:bg-[#EFF8D8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">마켓 인사이트 구독하기</Link>
      </section>

      <MarketBriefingHistory
        activeDate={briefing.asOfDate}
        onSelectDate={(date) => setSelectedDate(date)}
      />

      <details className="rounded-[18px] border border-[#D7EABB] bg-[#FAFDF4] px-5 py-4 text-sm text-neutral-600">
        <summary className="cursor-pointer font-bold text-neutral-800">데이터 기준 및 산식</summary>
        <div className="mt-3 space-y-2 leading-6">
          <p>전체·순자산 Top 50·100·200 수익률은 국내 상장 일반 ETF의 당일 등락률을 순자산으로 가중해 계산하며, 개별 ETF 비중 상한은 적용하지 않습니다.</p>
          <p>자산군 수익률 기여도는 해당 자산군의 AUM 비중과 AUM 가중수익률을 곱해 계산했습니다. 일반 ETF는 레버리지·인버스를 제외한 ETF를 뜻합니다.</p>
          {briefing.isStale && <p>현재 화면은 기준일보다 {number.format(briefing.staleDays)}일 이전 데이터이므로 갱신 지연 상태를 표시합니다.</p>}
        </div>
      </details>
    </div>
  );
}
