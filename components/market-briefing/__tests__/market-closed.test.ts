import { describe, it, expect } from "vitest";
import { checkIsMarketClosed, getPrecedingUsTradingDate } from "../market-briefing";

describe("Market Holiday and [휴장] Detection", () => {
  it("computes the correct preceding US trading date", () => {
    // Tuesday -> preceding US session was Monday
    expect(getPrecedingUsTradingDate("2026-09-08")).toBe("2026-09-07");
    // Wednesday -> preceding US session was Tuesday
    expect(getPrecedingUsTradingDate("2026-09-09")).toBe("2026-09-08");
    // Monday -> preceding US session was Friday
    expect(getPrecedingUsTradingDate("2026-09-07")).toBe("2026-09-04");
    // Friday -> preceding US session was Thursday
    expect(getPrecedingUsTradingDate("2026-11-27")).toBe("2026-11-26");
  });

  it("does NOT mark 9/7 as closed because preceding session (9/4 Fri) was open", () => {
    // 9/7 (월) 국내 브리핑 기준 직전 미국 정규장은 9/4 (금) 정상 거래일이므로 휴장 아님
    expect(checkIsMarketClosed("SPX", "2026-09-07", "2026-09-04")).toBe(false);
    expect(checkIsMarketClosed("NDX", "2026-09-07", "2026-09-04")).toBe(false);
    expect(checkIsMarketClosed("DGS10", "2026-09-07", "2026-09-04")).toBe(false);
    expect(checkIsMarketClosed("KOSPI", "2026-09-07", "2026-09-07")).toBe(false);
  });

  it("detects US market closed on Tuesday when preceding Monday was Labor Day", () => {
    // 2026-09-08 (Tuesday) briefing: preceding US session (2026-09-07 Monday) was Labor Day
    expect(checkIsMarketClosed("SPX", "2026-09-08", "2026-09-04")).toBe(true);
    expect(checkIsMarketClosed("NDX", "2026-09-08", "2026-09-04")).toBe(true);
    expect(checkIsMarketClosed("DGS10", "2026-09-08", "2026-09-04")).toBe(true);
    expect(checkIsMarketClosed("CLF", "2026-09-08", "2026-09-04")).toBe(true);
  });

  it("identifies regular trading days as NOT closed", () => {
    // 2026-09-09 (Wednesday): preceding US session (2026-09-08 Tuesday) was open
    expect(checkIsMarketClosed("SPX", "2026-09-09", "2026-09-08")).toBe(false);
    expect(checkIsMarketClosed("NDX", "2026-09-09", "2026-09-08")).toBe(false);
  });

  it("respects explicit is_closed flag", () => {
    expect(checkIsMarketClosed("SPX", "2026-09-09", "2026-09-08", true)).toBe(true);
    expect(checkIsMarketClosed("KOSPI", "2026-09-09", "2026-09-09", true)).toBe(true);
  });

  it("detects non-trading gap if indexDate is older than preceding session", () => {
    // On Thursday 2026-09-10, preceding date is 2026-09-09. If indexDate is 2026-09-08, it indicates closure/missing session
    expect(checkIsMarketClosed("SPX", "2026-09-10", "2026-09-08")).toBe(true);
  });
});
