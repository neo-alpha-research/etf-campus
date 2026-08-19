import { describe, expect, it, vi } from "vitest";

import { onRequestGet } from "../history.js";

function contextWith(results) {
  const all = vi.fn().mockResolvedValue({ results });
  const bind = vi.fn(() => ({ all }));
  const prepare = vi.fn(() => ({ bind }));
  return {
    context: {
      request: new Request(
        "https://example.test/api/prices/history?ticker=396500&start=2025-08-13&end=2026-08-13",
      ),
      env: { ETF_PRICES: { prepare } },
    },
    prepare,
    bind,
  };
}

describe("GET /api/prices/history", () => {
  it("includes the latest trading anchor on or before the requested start", async () => {
    const { context, prepare, bind } = contextWith([
      { date: "2025-08-13", close: 12_280 },
      { date: "2025-08-14", close: 12_355 },
      { date: "2026-08-13", close: 35_250 },
    ]);

    const response = await onRequestGet(context);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(prepare.mock.calls[0][0]).toContain("date <= ?");
    expect(bind).toHaveBeenCalledWith(
      "396500",
      "2025-08-13",
      "396500",
      "2025-08-13",
      "2026-08-13",
    );
    expect(payload.actualStart).toBe("2025-08-13");
    expect(payload.anchorPolicy).toBe("latest_trading_close_on_or_before_requested_start");
    expect(payload.points.at(-1).returnPct).toBe(187.05);
  });

  it("rejects TR until a verified TR history is configured", async () => {
    const { context } = contextWith([]);
    context.request = new Request("https://example.test/api/prices/history?ticker=396500&start=2025-08-13&end=2026-08-13&basis=tr");
    const response = await onRequestGet(context);
    const payload = await response.json();
    expect(response.status).toBe(503);
    expect(payload.error).toBe("tr_history_not_configured");
  });

  it("returns issuer-notice estimated history without falling back to PR", async () => {
    const { context } = contextWith([]);
    context.request = new Request("https://example.test/api/prices/history?ticker=458730&start=2026-05-28&end=2026-06-29&basis=estimated");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      records: [
        { ticker: "458730", date: "2026-05-27", estimated_distribution_index: "100.00000000" },
        { ticker: "458730", date: "2026-05-28", estimated_distribution_index: "100.23300000" },
        { ticker: "458730", date: "2026-06-29", estimated_distribution_index: "102.10000000" },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const response = await onRequestGet(context);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.returnBasis).toBe("estimated");
    expect(payload.distributionIncluded).toBe(true);
    expect(payload.actualEnd).toBe("2026-06-29");
    expect(payload.points.at(-1).returnPct).toBe(1.86);
    fetchSpy.mockRestore();
  });

  it("uses the first available post-listing point when no earlier anchor exists", async () => {
    const { context } = contextWith([
      { date: "2026-01-06", close: 10_000 },
      { date: "2026-08-13", close: 11_000 },
    ]);

    const response = await onRequestGet(context);
    const payload = await response.json();

    expect(payload.actualStart).toBe("2026-01-06");
    expect(payload.points.at(-1).returnPct).toBe(10);
  });
});

