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

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
