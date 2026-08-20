import { describe, it, expect, vi } from "vitest";
import { onRequestGet as latestGet } from "../latest.js";
import { onRequestGet as dateGet } from "../[date].js";

// Mock date so toKstDate diff works predictably
vi.setSystemTime(new Date("2026-08-22T00:00:00Z"));

describe("Public Briefings API Contract Tests", () => {
  const mockEnv = {
    BRIEFING_KV: {
      get: vi.fn().mockResolvedValue(null) // force D1 fallback
    },
    ETF_PRICES: {
      prepare: vi.fn((query) => {
        return {
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockImplementation(async () => {
            if (query.includes("market_briefing_editorial_documents")) {
              return { public_state: "published", published_revision_no: 1, briefing_id: 1, published_at: "2026-08-20T10:00:00Z" };
            }
            if (query.includes("market_briefing_editorial_revisions")) {
              return { title: "Test", one_line_text: "Line", market_temperature_commentary: "Good", summary_markdown: "Mark", revision_no: 1 };
            }
            if (query.includes("market_briefings")) {
              return {
                as_of_date: "2026-08-20",
                publication_version: 1,
                headline_text: "Headline",
                headline_generation_status: "done",
                kospi_close: 2600,
                kospi_change_pct: 1.0,
                kosdaq_close: 800,
                kosdaq_change_pct: 1.5,
                general_aum_weighted_return_pct: 1.2,
                top50_aum_weighted_return_pct: 1.3,
                top100_aum_weighted_return_pct: 1.4,
                top200_aum_weighted_return_pct: 1.5,
                general_etf_count: 500,
                up_count: 300,
                flat_count: 50,
                down_count: 150,
                breadth_ratio_pct: 60,
                market_temperature: "Hot",
                general_total_aum: 100000000,
                general_total_trade_value: 500000,
                top10_trade_share_pct: 20,
                metrics_json: "{}",
                source_dates_json: "{}",
                validation_json: "{}",
                published_at: "2026-08-20T09:00:00Z",
                updated_at: "2026-08-20T09:00:00Z"
              };
            }
            return null;
          }),
          all: vi.fn().mockResolvedValue({ results: [] })
        };
      })
    }
  };

  const context = {
    env: mockEnv,
    params: { date: "2026-08-20" }
  };

  it("latest.js returns the required camelCase fields including editorial", async () => {
    const res = await latestGet(context);
    const body = await res.json();
    
    expect(body).toHaveProperty("briefing");
    expect(body.briefing).toHaveProperty("asOfDate", "2026-08-20");
    expect(typeof body.briefing.isStale).toBe("boolean");
    expect(typeof body.briefing.staleDays).toBe("number");
    expect(body.briefing).toHaveProperty("headline");
    expect(body.briefing).toHaveProperty("pulse");
    expect(body.briefing).toHaveProperty("assetClasses");
    expect(body.briefing).toHaveProperty("focusEtfs");
    expect(body.briefing).toHaveProperty("editorial");
    
    expect(body.briefing.editorial).toHaveProperty("state", "published");
    expect(body.briefing.editorial).toHaveProperty("title", "Test");
  });

  it("[date].js returns the required camelCase fields including editorial", async () => {
    const res = await dateGet(context);
    const body = await res.json();
    
    expect(body).toHaveProperty("briefing");
    expect(body.briefing).toHaveProperty("asOfDate", "2026-08-20");
    expect(typeof body.briefing.isStale).toBe("boolean");
    expect(typeof body.briefing.staleDays).toBe("number");
    expect(body.briefing).toHaveProperty("headline");
    expect(body.briefing).toHaveProperty("pulse");
    expect(body.briefing).toHaveProperty("assetClasses");
    expect(body.briefing).toHaveProperty("focusEtfs");
    expect(body.briefing).toHaveProperty("editorial");
    
    expect(body.briefing.editorial).toHaveProperty("state", "published");
  });
});
