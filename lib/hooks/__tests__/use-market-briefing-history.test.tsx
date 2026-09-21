import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SWRConfig } from "swr";
import React from "react";
import { useMarketBriefingHistory } from "../use-market-briefing-history";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    {children}
  </SWRConfig>
);

describe("useMarketBriefingHistory", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("초기 히스토리 목록을 정상적으로 불러오고 SWR 캐싱한다", async () => {
    const mockItems = [
      {
        asOfDate: "2026-09-03",
        publicationVersion: 1,
        publishedAt: "2026-09-04T00:00:00Z",
        headline: "테스트 헤드라인",
        marketTemperature: "상승",
        generalAumWeightedReturnPct: 0.5,
        top100AumWeightedReturnPct: 0.8,
        breadthRatioPct: 60,
        generalEtfCount: 1000,
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        items: mockItems,
        page: { limit: 10, hasMore: false, nextCursor: null },
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useMarketBriefingHistory({ limit: 10 }), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/briefings/history?limit=10",
      expect.objectContaining({ cache: "no-store" })
    );
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].asOfDate).toBe("2026-09-03");
    expect(result.current.error).toBeNull();
  });

  it("API 실패 시 에러 메시지를 반환한다", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as unknown as Response);

    const { result } = renderHook(() => useMarketBriefingHistory({ limit: 10 }), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("브리핑 히스토리를 불러오지 못했습니다.");
    expect(result.current.items).toHaveLength(0);
  });

  it("refresh 호출 시 데이터를 다시 요청한다", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        items: [],
        page: { limit: 10, hasMore: false, nextCursor: null },
      }),
    } as unknown as Response);
    global.fetch = mockFetch;

    const { result } = renderHook(() => useMarketBriefingHistory({ limit: 10 }), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/briefings/history?limit=10",
      expect.objectContaining({ cache: "no-store" })
    );

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenLastCalledWith(
      "/api/briefings/history?limit=10",
      expect.objectContaining({ cache: "no-store" })
    );
  });

  it("loadMore 호출 시 nextCursor로 추가 페이지를 가져오고 cache: 'no-store'를 전달하며 상태를 병합한다", async () => {
    const mockInitial = {
      items: [
        {
          asOfDate: "2026-09-03",
          publicationVersion: 1,
          publishedAt: "2026-09-04T00:00:00Z",
          headline: "9월 3일 브리핑",
          marketTemperature: "상승",
          generalAumWeightedReturnPct: 0.5,
          top100AumWeightedReturnPct: 0.8,
          breadthRatioPct: 60,
          generalEtfCount: 1000,
        },
      ],
      page: { limit: 10, hasMore: true, nextCursor: "2026-09-02T00:00:00Z" },
    };

    const mockMore = {
      items: [
        {
          asOfDate: "2026-09-02",
          publicationVersion: 1,
          publishedAt: "2026-09-03T00:00:00Z",
          headline: "9월 2일 브리핑",
          marketTemperature: "하락",
          generalAumWeightedReturnPct: -0.3,
          top100AumWeightedReturnPct: -0.5,
          breadthRatioPct: 40,
          generalEtfCount: 1000,
        },
      ],
      page: { limit: 10, hasMore: false, nextCursor: null },
    };

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockInitial),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMore),
      } as unknown as Response);

    global.fetch = fetchMock;

    const { result } = renderHook(() => useMarketBriefingHistory({ limit: 10 }), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/briefings/history?limit=10&cursor=${encodeURIComponent("2026-09-02T00:00:00Z")}`,
      expect.objectContaining({ cache: "no-store" })
    );

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0].asOfDate).toBe("2026-09-03");
    expect(result.current.items[1].asOfDate).toBe("2026-09-02");
    expect(result.current.hasMore).toBe(false);
    expect(result.current.isLoadingMore).toBe(false);
  });

  it("nextCursor가 없을 때는 loadMore를 호출해도 추가 fetch를 수행하지 않는다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        items: [],
        page: { limit: 10, hasMore: false, nextCursor: null },
      }),
    } as unknown as Response);
    global.fetch = fetchMock;

    const { result } = renderHook(() => useMarketBriefingHistory({ limit: 10 }), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("loadMore 후 refresh 호출 시 추가 목록과 페이징 상태가 초기화된다", async () => {
    const mockInitial = {
      items: [
        {
          asOfDate: "2026-09-03",
          publicationVersion: 1,
          publishedAt: "2026-09-04T00:00:00Z",
          headline: "초기 헤드라인",
          marketTemperature: "상승",
          generalAumWeightedReturnPct: 0.5,
          top100AumWeightedReturnPct: 0.8,
          breadthRatioPct: 60,
          generalEtfCount: 1000,
        },
      ],
      page: { limit: 10, hasMore: true, nextCursor: "2026-09-02T00:00:00Z" },
    };

    const mockMore = {
      items: [
        {
          asOfDate: "2026-09-02",
          publicationVersion: 1,
          publishedAt: "2026-09-03T00:00:00Z",
          headline: "추가 헤드라인",
          marketTemperature: "하락",
          generalAumWeightedReturnPct: -0.3,
          top100AumWeightedReturnPct: -0.5,
          breadthRatioPct: 40,
          generalEtfCount: 1000,
        },
      ],
      page: { limit: 10, hasMore: false, nextCursor: null },
    };

    let fetchCount = 0;
    const fetchMock = vi.fn().mockImplementation(() => {
      fetchCount++;
      if (fetchCount === 1) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockInitial),
        });
      } else if (fetchCount === 2) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockMore),
        });
      } else {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockInitial),
        });
      }
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useMarketBriefingHistory({ limit: 10 }), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.items).toHaveLength(1);

    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.items).toHaveLength(2);
    expect(result.current.hasMore).toBe(false);

    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].asOfDate).toBe("2026-09-03");
    expect(result.current.hasMore).toBe(true);
  });
});
