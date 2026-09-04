import { describe, expect, it, vi } from "vitest";
import { onRequestGet } from "../[ticker].js";

function createContext({ ticker, row = null, dbError = null, hasDb = true } = {}) {
  const first = dbError
    ? vi.fn().mockRejectedValue(dbError)
    : vi.fn().mockResolvedValue(row);
  const bind = vi.fn(() => ({ first }));
  const prepare = vi.fn(() => ({ bind }));

  return {
    context: {
      params: { ticker },
      env: hasDb ? { ETF_PRICES: { prepare } } : {},
    },
    prepare,
    bind,
    first,
  };
}

describe("GET /api/holdings/:ticker", () => {
  it("rejects invalid ticker formats with 400", async () => {
    const invalidTickers = ["12345", "1234567", "06950@", ""];
    for (const ticker of invalidTickers) {
      const { context } = createContext({ ticker });
      const response = await onRequestGet(context);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Invalid ticker format");
    }
  });

  it("returns 503 when D1 binding is not configured", async () => {
    const { context } = createContext({ ticker: "069500", hasDb: false });
    const response = await onRequestGet(context);
    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data.error).toContain("D1 database ETF_PRICES is not configured");
  });

  it("returns 404 when ticker is not found in D1", async () => {
    const { context, prepare, bind } = createContext({ ticker: "999999", row: null });
    const response = await onRequestGet(context);
    expect(response.status).toBe(404);
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining("FROM etf_holdings WHERE ticker = ?"));
    expect(bind).toHaveBeenCalledWith("999999");
    const data = await response.json();
    expect(data.error).toBe("Holdings not found");
  });

  it("returns 200 with parsed holdings and 24h CDN cache headers when found", async () => {
    const mockHoldings = [
      { name: "삼성전자", weight_pct: 25.4, shares: 1000, item_code: "005930" },
      { name: "SK하이닉스", weight_pct: 12.1, shares: 500, item_code: "000660" },
    ];
    const mockRow = {
      ticker: "069500",
      as_of_date: "2026-09-04",
      holding_count: 2,
      top1_weight: 25.4,
      holdings_json: JSON.stringify(mockHoldings),
    };

    const { context } = createContext({ ticker: "069500", row: mockRow });
    const response = await onRequestGet(context);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=86400, s-maxage=86400");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");

    const data = await response.json();
    expect(data.ticker).toBe("069500");
    expect(data.as_of_date).toBe("2026-09-04");
    expect(data.holding_count).toBe(2);
    expect(data.top1_weight).toBe(25.4);
    expect(data.holdings).toEqual(mockHoldings);
  });

  it("returns 500 if database query throws", async () => {
    const { context } = createContext({
      ticker: "069500",
      dbError: new Error("D1 connection lost"),
    });
    const response = await onRequestGet(context);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain("Failed to retrieve holdings data");
  });
});
