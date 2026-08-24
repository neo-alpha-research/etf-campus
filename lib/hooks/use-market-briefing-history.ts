"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MarketBriefingHistoryItem = {
  asOfDate: string;
  publicationVersion: number;
  publishedAt: string;
  headline: string | null;
  marketTemperature: string;
  generalAumWeightedReturnPct: number;
  top100AumWeightedReturnPct: number;
  breadthRatioPct: number;
  generalEtfCount: number;
};

type HistoryApiResponse = {
  items?: MarketBriefingHistoryItem[];
  page?: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
  message?: string;
};

export type UseMarketBriefingHistoryOptions = {
  limit?: number;
};

export type MarketBriefingHistoryQuery = {
  items: MarketBriefingHistoryItem[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
};

function apiMessage(payload: HistoryApiResponse | null, fallback: string) {
  return payload?.message?.trim() || fallback;
}

export function useMarketBriefingHistory({ limit = 10 }: UseMarketBriefingHistoryOptions = {}): MarketBriefingHistoryQuery {
  const [items, setItems] = useState<MarketBriefingHistoryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const requestPage = useCallback(async (cursor: string | null) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    const search = new URLSearchParams({ limit: String(limit) });
    if (cursor) search.set("cursor", cursor);
    const endpoint = `https://etf-campus.pages.dev/api/briefings/history?${search.toString()}`;
    const proxyEndpoint = `https://api.allorigins.win/raw?url=${encodeURIComponent(endpoint)}`;
    const response = await fetch(proxyEndpoint, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = (await response.json()) as HistoryApiResponse;
    if (!response.ok) throw new Error(apiMessage(payload, "브리핑 히스토리를 불러오지 못했습니다."));
    return { payload, controller };
  }, [limit]);

  const loadInitial = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { payload, controller } = await requestPage(null);
      if (!mountedRef.current || controller.signal.aborted) return;
      setItems(payload.items ?? []);
      setHasMore(Boolean(payload.page?.hasMore));
      setNextCursor(payload.page?.nextCursor ?? null);
    } catch (reason: unknown) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      if (!mountedRef.current) return;
      setError(reason instanceof Error ? reason.message : "브리핑 히스토리를 불러오지 못했습니다.");
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [requestPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);

    try {
      const { payload, controller } = await requestPage(nextCursor);
      if (!mountedRef.current || controller.signal.aborted) return;
      setItems((current) => [...current, ...(payload.items ?? [])]);
      setHasMore(Boolean(payload.page?.hasMore));
      setNextCursor(payload.page?.nextCursor ?? null);
    } catch (reason: unknown) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      if (!mountedRef.current) return;
      setError(reason instanceof Error ? reason.message : "추가 브리핑을 불러오지 못했습니다.");
    } finally {
      if (mountedRef.current) setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, nextCursor, requestPage]);

  useEffect(() => {
    mountedRef.current = true;
    const timer = window.setTimeout(() => {
      void loadInitial();
    }, 0);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(timer);
      requestRef.current?.abort();
    };
  }, [loadInitial]);

  return { items, isLoading, isLoadingMore, hasMore, error, loadMore, refresh: loadInitial };
}
