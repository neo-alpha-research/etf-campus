"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";

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

const fetcher = async (url: string): Promise<HistoryApiResponse> => {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("브리핑 히스토리를 불러오지 못했습니다.");
  }
  return res.json();
};

export function useMarketBriefingHistory({ limit = 10 }: UseMarketBriefingHistoryOptions = {}): MarketBriefingHistoryQuery {
  const endpoint = `/api/briefings/history?limit=${limit}`;
  const { data, error: swrError, isLoading, mutate } = useSWR<HistoryApiResponse>(
    endpoint,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 60000,
    }
  );

  const [extraItems, setExtraItems] = useState<MarketBriefingHistoryItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const baseItems = data?.items ?? [];
  const currentHasMore = cursor ? hasMore : Boolean(data?.page?.hasMore);

  const loadMore = useCallback(async () => {
    const nextCursor = cursor || data?.page?.nextCursor;
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const res = await fetch(`/api/briefings/history?limit=${limit}&cursor=${encodeURIComponent(nextCursor)}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (res.ok) {
        const payload: HistoryApiResponse = await res.json();
        setExtraItems((prev) => [...prev, ...(payload.items ?? [])]);
        setCursor(payload.page?.nextCursor ?? null);
        setHasMore(Boolean(payload.page?.hasMore));
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [cursor, data?.page?.nextCursor, isLoadingMore, limit]);

  const refresh = useCallback(async () => {
    setExtraItems([]);
    setCursor(null);
    await mutate();
  }, [mutate]);

  const items = [...baseItems, ...extraItems];
  const error = swrError instanceof Error ? swrError.message : swrError ? "브리핑 히스토리를 불러오지 못했습니다." : null;

  return {
    items,
    isLoading,
    isLoadingMore,
    hasMore: currentHasMore,
    error,
    loadMore,
    refresh,
  };
}
