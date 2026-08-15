import { describe, expect, it } from "vitest";
import { getPricePeriodRange } from "../etf-price-period";

describe("getPricePeriodRange MAX/ITD", () => {
  it("uses the actual first trading date before a calendar listing date", () => {
    expect(
      getPricePeriodRange("itd", "20260814", {
        listingDate: "2020-09-25",
        actualFirstTradingDate: "2020-09-28",
      }),
    ).toEqual({ start: "2020-09-28", end: "2026-08-14" });
  });

  it("uses a listing date when no first-trading date is stored", () => {
    expect(getPricePeriodRange("itd", "20260814", { listingDate: "2020-09-25" })).toEqual({
      start: "2020-09-25",
      end: "2026-08-14",
    });
  });

  it("never falls back to 1970 when listing metadata is unavailable", () => {
    expect(getPricePeriodRange("itd", "20260814")).toEqual({
      start: null,
      end: "2026-08-14",
      dataStatus: "listing_date_unavailable",
    });
  });
});
