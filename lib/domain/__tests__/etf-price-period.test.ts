import { describe, expect, it } from "vitest";

import { getPricePeriodRange } from "../etf-price-period";

describe("getPricePeriodRange", () => {
  it("uses the same one-year calendar target as the return table", () => {
    expect(getPricePeriodRange("12m", "20260813")).toEqual({
      start: "2025-08-13",
      end: "2026-08-13",
    });
  });

  it("clamps month-end dates instead of overflowing into the following month", () => {
    expect(getPricePeriodRange("1m", "20260331")).toEqual({
      start: "2026-02-28",
      end: "2026-03-31",
    });
  });

  it("clamps leap day for a one-year period", () => {
    expect(getPricePeriodRange("12m", "20240229")).toEqual({
      start: "2023-02-28",
      end: "2024-02-29",
    });
  });

  it("requests January 1 so the API can select the prior year-end trading anchor", () => {
    expect(getPricePeriodRange("ytd", "20260813")).toEqual({
      start: "2026-01-01",
      end: "2026-08-13",
    });
  });
});

