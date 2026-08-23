"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MarketIndex = {
  code: string;
  label: string;
  close: number;
  change_points?: number | null;
  change_pct?: number;
  as_of_date: string;
};


export type PeerGroup = {
  peerGroup: string;
  etfCount: number;
  equalWeightReturnPct: number;
  cappedAumWeightedReturnPct: number;
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

export type AssetClass = {
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
  peerGroups: PeerGroup[];
  fundFlow: { topInflows: FundFlowRow[]; topOutflows: FundFlowRow[] };
  disparityWarning: DisparityWarning[];
  focusEtfs: FocusEtf[];
};

type BriefingApiResponse = {
  briefing: MarketBriefing | null;
  message?: string;
};

type LoadMode = "initial" | "background" | "manual";

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

function messageFromResponse(payload: BriefingApiResponse | null, fallback: string) {
  return payload?.message?.trim() || fallback;
}

/**
 * Pages API가 KV 최신 pointer를 먼저 읽고 D1 ready row로 fallback한 결과를 조회합니다.
 * API가 마지막 ready 브리핑을 반환하면 stale 상태는 briefing.isStale로 UI에 전달됩니다.
 */
export function useMarketBriefing({
  asOfDate,
  revalidateOnFocus = true,
  revalidateIntervalMs = 0,
}: UseMarketBriefingOptions = {}): MarketBriefingQuery {
  const [briefing, setBriefing] = useState<MarketBriefing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async (mode: LoadMode) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (mode === "initial") setIsLoading(true);
    if (mode === "manual") setIsRefreshing(true);

    try {
      const endpoint = asOfDate
        ? `/api/briefings/${encodeURIComponent(asOfDate)}`
        : "/api/briefings/latest";
      const response = await fetch(endpoint, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = (await response.json()) as BriefingApiResponse;

      if (!response.ok) {
        throw new Error(messageFromResponse(payload, "브리핑 데이터를 불러오지 못했습니다."));
      }

      if (!mountedRef.current) return;
      setBriefing(payload.briefing);
      setError(payload.briefing ? null : messageFromResponse(payload, "검증된 브리핑이 아직 없습니다."));
    } catch (reason: unknown) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      if (!mountedRef.current) return;
      setError(reason instanceof Error ? reason.message : "브리핑 데이터를 불러오지 못했습니다.");
    } finally {
      if (!mountedRef.current || controller.signal.aborted) return;
      if (mode === "initial") setIsLoading(false);
      if (mode === "manual") setIsRefreshing(false);
    }
  }, [asOfDate]);

  const refresh = useCallback(async () => {
    await load("manual");
  }, [load]);

  useEffect(() => {
    mountedRef.current = true;
    const initialTimer = window.setTimeout(() => {
      void load("initial");
    }, 0);

    const revalidate = () => {
      if (document.visibilityState === "visible") void load("background");
    };

    if (revalidateOnFocus) {
      window.addEventListener("focus", revalidate);
      document.addEventListener("visibilitychange", revalidate);
    }

    const interval = revalidateIntervalMs > 0
      ? window.setInterval(() => {
          if (document.visibilityState === "visible") void load("background");
        }, revalidateIntervalMs)
      : null;

    return () => {
      mountedRef.current = false;
      window.clearTimeout(initialTimer);
      if (interval) window.clearInterval(interval);
      if (revalidateOnFocus) {
        window.removeEventListener("focus", revalidate);
        document.removeEventListener("visibilitychange", revalidate);
      }
      abortRef.current?.abort();
    };
  }, [load, revalidateIntervalMs, revalidateOnFocus]);

  return { briefing, isLoading, isRefreshing, error, refresh };
}
