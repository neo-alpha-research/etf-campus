import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { CompareClient } from "../compare-client";
import type { Etf } from "@/lib/domain/etf-types";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("tickers=069500&period=1m&basis=pr"),
  usePathname: () => "/compare",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

describe("CompareClient Dynamic Cache Versioning", () => {
  const mockEtfs: Etf[] = [
    {
      ticker: "069500",
      name: "KODEX 200",
      assetClass: "국내주식",
      category: "시장대표",
      close: 35000,
      changePct: 0.5,
      tradeValue: 100000,
      aum: 500000,
      returns: { "1m": 1.2 },
    } as unknown as Etf,
  ];

  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("manifest의 asOf가 갱신되면 시계열 요청 URL에 해당 버전이 동적으로 부착된다", async () => {
    const fetchedUrls: string[] = [];

    global.fetch = vi.fn().mockImplementation((url: string) => {
      fetchedUrls.push(url);
      if (url.includes("manifest.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ asOf: "20260918", tickers: {} }),
        });
      }
      if (url.includes("/data/series/v2/069500")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ticker: "069500",
              startDate: "2026-08-01",
              dates: ["2026-08-01"],
              close: [35000],
              tr: [35000],
              netTr: [35000],
              hasDistribution: false,
              asOf: "2026-09-18",
            }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    render(<CompareClient etfs={mockEtfs} />);

    await waitFor(() => {
      const seriesCall = fetchedUrls.find((u) => u.includes("/data/series/v2/069500"));
      expect(seriesCall).toBeDefined();
      expect(seriesCall).toContain("?v=20260918");
    });
  });

  it("manifest의 tickers에 개별 종목 버전이 정의되어 있으면 개별 버전이 우선 적용된다", async () => {
    const fetchedUrls: string[] = [];

    global.fetch = vi.fn().mockImplementation((url: string) => {
      fetchedUrls.push(url);
      if (url.includes("manifest.json")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              asOf: "20260918",
              tickers: { "069500": "20260920_custom" },
            }),
        });
      }
      if (url.includes("/data/series/v2/069500")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ticker: "069500",
              startDate: "2026-08-01",
              dates: ["2026-08-01"],
              close: [35000],
              tr: [35000],
              netTr: [35000],
              hasDistribution: false,
              asOf: "2026-09-20",
            }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    render(<CompareClient etfs={mockEtfs} />);

    await waitFor(() => {
      const seriesCall = fetchedUrls.find((u) => u.includes("/data/series/v2/069500"));
      expect(seriesCall).toBeDefined();
      expect(seriesCall).toContain("?v=20260920_custom");
    });
  });
});
