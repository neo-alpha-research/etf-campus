import { describe, expect, it, vi } from "vitest";

import { onRequestPost } from "../results";
import { onRequestGet } from "../stats";

describe("Style Diagnosis Results API (POST /api/style/results)", () => {
  it("유효하지 않은 페이로드(누락된 필드 등)에 대해 400 VALIDATION_ERROR를 반환한다", async () => {
    const invalidRequest = new Request("https://etfcampus.pages.dev/api/style/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultId: "" }),
    });

    const response = await onRequestPost({ request: invalidRequest, env: {} });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error?.code).toBe("VALIDATION_ERROR");
  });

  it("유효하지 않은 styleId에 대해 400 VALIDATION_ERROR를 반환한다", async () => {
    const invalidStyleRequest = new Request("https://etfcampus.pages.dev/api/style/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resultId: "test-uuid-1234",
        styleId: "unknown-dragon",
        bookSlug: "momentum-etf-system",
        axisScores: { view: 0, range: 0, timing: 0, criteria: 0, depth: 0 },
        completedDate: "2026-08-27",
      }),
    });

    const response = await onRequestPost({ request: invalidStyleRequest, env: {} });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error?.message).toContain("styleId");
  });

  it("정상적인 진단 결과 전송 시 201 응답을 반환하고 D1 쿼리를 실행한다", async () => {
    const mockRun = vi.fn().mockResolvedValue({ success: true });
    const mockBind = vi.fn().mockReturnValue({ run: mockRun });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

    const validRequest = new Request("https://etfcampus.pages.dev/api/style/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resultId: "test-uuid-1234",
        styleId: "turtle",
        bookSlug: "index-asset-allocation",
        axisScores: { view: -1, range: -1, timing: -1, criteria: -1, depth: -1 },
        needScores: { signal: 0, map: 7, income: 0 },
        completedDate: "2026-08-27",
      }),
    });

    const response = await onRequestPost({
      request: validRequest,
      env: { ETF_PRICES: { prepare: mockPrepare } },
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.resultId).toBe("test-uuid-1234");
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining("INSERT OR IGNORE"));
  });
});

describe("Style Diagnosis Stats API (GET /api/style/stats)", () => {
  it("KV 캐시가 존재하면 D1 쿼리 없이 캐시된 응답을 반환한다", async () => {
    const cachedStats = {
      total: 1000,
      updatedAt: "2026-08-27T00:00:00.000Z",
      styles: [{ styleId: "turtle", count: 120, share: 0.12 }],
      books: [{ bookSlug: "index-asset-allocation", count: 400, share: 0.4 }],
    };

    const mockGet = vi.fn().mockResolvedValue(cachedStats);

    const response = await onRequestGet({
      env: {
        BRIEFING_KV: { get: mockGet },
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.total).toBe(1000);
    expect(mockGet).toHaveBeenCalledWith("style_diagnosis_stats_v1", "json");
  });

  it("KV 캐시 미스 시 D1에서 집계하고 KV에 캐싱한다", async () => {
    const mockGet = vi.fn().mockResolvedValue(null);
    const mockPut = vi.fn().mockResolvedValue(undefined);

    const mockFirst = vi.fn().mockResolvedValue({ total: 100 });
    const mockAllStyles = vi.fn().mockResolvedValue({
      results: [{ style_id: "turtle", count: 20 }],
    });
    const mockAllBooks = vi.fn().mockResolvedValue({
      results: [{ book_slug: "index-asset-allocation", count: 50 }],
    });

    const mockPrepare = vi.fn((sql: string) => {
      if (sql.includes("COUNT(*) as total")) {
        return { first: mockFirst };
      }
      if (sql.includes("GROUP BY style_id")) {
        return { all: mockAllStyles };
      }
      return { all: mockAllBooks };
    });

    const response = await onRequestGet({
      env: {
        BRIEFING_KV: { get: mockGet, put: mockPut },
        ETF_PRICES: { prepare: mockPrepare },
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.total).toBe(100);
    expect(body.styles).toHaveLength(10);
    expect(body.books).toHaveLength(3);

    const turtle = body.styles.find((s: { styleId: string }) => s.styleId === "turtle");
    expect(turtle.count).toBe(20);
    expect(turtle.share).toBe(0.2);

    expect(mockPut).toHaveBeenCalledWith(
      "style_diagnosis_stats_v1",
      expect.any(String),
      { expirationTtl: 300 },
    );
  });
});
