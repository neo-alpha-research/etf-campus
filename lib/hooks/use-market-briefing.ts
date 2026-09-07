"use client";

import { useCallback } from "react";
import useSWR from "swr";

export type MarketIndex = {
  code: string;
  label: string;
  close?: number | null;
  change_points?: number | null;
  change_pct?: number;
  as_of_date: string;
  is_closed?: boolean;
};


export type PeerGroup = {
  peerGroup: string;
  assetClass: string;
  etfCount: number;
  equalWeightReturnPct: number;
  cappedAumWeightedReturnPct: number;
  netInflowValue?: number;
};

export type FundFlowRow = {
  ticker: string;
  etfName: string;
  netInflowValue: number;
};

export type DisparityWarning = {
  ticker: string;
  etfName: string;
  assetClass: string;
  disparityPct: number;
};

export type MarketBriefingAssetClass = {
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

export type AumWeightedReturn = {
  scope: "all" | "top_50" | "top_100" | "top_200";
  label: string;
  constituent_count: number;
  total_aum: number;
  aum_coverage_pct: number;
  weighted_return_pct: number;
};

export type FocusEtf = {
  rank_no: number;
  ticker: string;
  etf_name: string;
  asset_class: string | null;
  close_value: number;
  change_pct: number;
  trade_value: number;
  trade_share_pct: number;
};

export type MarketBriefing = {
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
    allTop10TradeSharePct: number;
  };
  assetClasses: MarketBriefingAssetClass[];
  peerGroupVersion?: string | null;
  peerGroups: PeerGroup[];
  fundFlow?: {
    general: { topInflows: FundFlowRow[]; topOutflows: FundFlowRow[] };
    all: { topInflows: FundFlowRow[]; topOutflows: FundFlowRow[] };
  };
  weeklyFundFlows?: { topInflows: FlowTrendRow[]; topOutflows: FlowTrendRow[] } | FlowTrendRow[];
  monthlyFundFlows?: { topInflows: FlowTrendRow[]; topOutflows: FlowTrendRow[] } | FlowTrendRow[];
  marketScale?: any;
  marketScaleSnapshot?: MarketScaleSnapshot;
  marketScaleTimeSeries?: MarketScaleTimeSeries;
  disparityWarning: DisparityWarning[];
  focusEtfs: FocusEtf[];
};

export type MarketScaleCategory = {
  category: "general" | "parking" | "leveraged" | "inverse";
  label: string;
  aum: number; // 억원
  aumSharePct: number; // %
  tradeValue: number; // 억원
  tradeSharePct: number; // %
  turnoverPct: number; // %
  etfCount: number;
};

export type MarketScaleSnapshot = {
  totalAum: number; // 억원
  totalTradeValue: number; // 억원
  marketTurnoverPct: number; // %
  totalEtfCount: number;
  categories: MarketScaleCategory[];
  /** @deprecated 구버전 DB 하위호환용. categories로 마이그레이션 완료 후 제거 예정 */
  composition?: Array<{
    type: string;
    label: string;
    aum: number;
    pct: number;
    count: number;
    tradeValue?: number;
    tradeSharePct?: number;
    turnoverPct?: number;
  }>;
};


export type TimeSeriesPoint = {
  key: string;
  label: string;
  aum: number; // 억원
  adtv: number; // 일평균 거래대금 (억원)
  turnoverPct: number; // %
  aumChange?: number; // 억원
  aumChangePct?: number; // %
  priceEffect?: number; // 주가 변동 효과 (억원)
  netInflow?: number; // 실질 자금 순유입액 (억원)
};

export type MarketScaleTimeSeries = {
  daily: TimeSeriesPoint[];
  weekly: TimeSeriesPoint[];
  monthly: TimeSeriesPoint[];
  yearly: TimeSeriesPoint[];
};

export type FlowTrendRow = {
  rank: number;
  peerGroup: string;
  netInflow: number;
  returnPct: number;
};

type BriefingApiResponse = {
  briefing: MarketBriefing | null;
  message?: string;
};

export type UseMarketBriefingOptions = {
  /** 지정하면 해당 날짜의 ready 브리핑을 조회합니다. 없으면 최신 ready 브리핑을 조회합니다. */
  asOfDate?: string;
  /** 탭 복귀 시 최신 ready 브리핑을 다시 확인합니다. 기본값: true */
  revalidateOnFocus?: boolean;
  /** 열린 대시보드에서만 적용할 재검증 간격(ms). 0이면 비활성화합니다. */
  revalidateIntervalMs?: number;
};

export type MarketBriefingQuery = {
  briefing: MarketBriefing | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  /** 사용자 수동 새로고침 또는 버튼에 연결합니다. */
  refresh: () => Promise<void>;
};

const fetcher = async (url: string) => {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const payload = await res.json();
      return payload as BriefingApiResponse;
    }
    if (res.ok) {
      throw new Error("올바른 JSON 응답이 아닙니다.");
    }
    // 로컬 개발 환경(localhost)에서 Cloudflare D1 API가 없을 경우 라이브 서버 브리핑 자동 연동
    if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
      const liveRes = await fetch(`https://etf-campus.pages.dev${url}`, {
        headers: { Accept: "application/json" },
      }).catch(() => null);
      if (liveRes && liveRes.ok) {
        return (await liveRes.json()) as BriefingApiResponse;
      }
    }
    return {
      briefing: null,
      message: res.status === 404 ? "해당 날짜의 마켓 브리핑을 찾을 수 없습니다." : "브리핑 서버와 통신할 수 없습니다.",
    };
  } catch (err) {
    if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
      const liveRes = await fetch(`https://etf-campus.pages.dev${url}`, {
        headers: { Accept: "application/json" },
      }).catch(() => null);
      if (liveRes && liveRes.ok) {
        return (await liveRes.json()) as BriefingApiResponse;
      }
      const fallbackRes = await fetch("/mock-briefing.json").catch(() => null);
      if (fallbackRes && fallbackRes.ok) {
        return (await fallbackRes.json()) as BriefingApiResponse;
      }
    }
    throw err instanceof Error ? err : new Error("브리핑 데이터를 불러오지 못했습니다.");
  }
};

export function useMarketBriefing({
  asOfDate,
  revalidateOnFocus = true,
  revalidateIntervalMs = 0,
}: UseMarketBriefingOptions = {}): MarketBriefingQuery {
  const endpoint = asOfDate ? `/api/briefings/${encodeURIComponent(asOfDate)}` : "/api/briefings/latest";

  const { data, error, isLoading, isValidating, mutate } = useSWR<BriefingApiResponse>(
    endpoint,
    fetcher,
    {
      revalidateOnFocus,
      refreshInterval: revalidateIntervalMs,
      shouldRetryOnError: false,
      keepPreviousData: true,
    }
  );

  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const customError = error instanceof Error ? error.message : error ? String(error) : null;
  const missingDataError = data && !data.briefing ? (data.message?.trim() || "검증된 브리핑이 아직 없습니다.") : null;

  return { 
    briefing: data?.briefing || null, 
    isLoading, 
    isRefreshing: isValidating && !isLoading, 
    error: customError || missingDataError, 
    refresh 
  };
}