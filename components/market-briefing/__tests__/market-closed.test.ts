import { describe, it, expect } from "vitest";
import { checkIsMarketClosed } from "../market-briefing";

describe("Market Holiday and [휴장] Detection", () => {
  it("detects US market closed on Monday when baseDate is Labor Day", () => {
    // 2026-09-07 (월): 미국 노동절(Labor Day) 공식 공휴일 -> 휴장 판정
    expect(checkIsMarketClosed("SPX", "2026-09-07", "2026-09-04")).toBe(true);
    expect(checkIsMarketClosed("NDX", "2026-09-07", "2026-09-04")).toBe(true);
    expect(checkIsMarketClosed("DGS10", "2026-09-07", "2026-09-04")).toBe(true);
    expect(checkIsMarketClosed("CLF", "2026-09-07", "2026-09-04")).toBe(true);

    // 국내 지표는 미국 휴일과 무관하게 개장
    expect(checkIsMarketClosed("KOSPI", "2026-09-07", "2026-09-07")).toBe(false);
  });

  it("identifies Tuesday 9/8 as active trading day (NOT closed)", () => {
    // 2026-09-08 (화): 미국 시장 정상 거래일 -> 휴장 아님 (정상 등락률 표시)
    expect(checkIsMarketClosed("SPX", "2026-09-08", "2026-09-08")).toBe(false);
    expect(checkIsMarketClosed("NDX", "2026-09-08", "2026-09-08")).toBe(false);
    expect(checkIsMarketClosed("DGS10", "2026-09-08", "2026-09-08")).toBe(false);
    expect(checkIsMarketClosed("CLF", "2026-09-08", "2026-09-08")).toBe(false);
    expect(checkIsMarketClosed("GC", "2026-09-08", "2026-09-08")).toBe(false);
    expect(checkIsMarketClosed("SI", "2026-09-08", "2026-09-08")).toBe(false);
    expect(checkIsMarketClosed("VIX", "2026-09-08", "2026-09-08")).toBe(false);
  });

  it("respects explicit is_closed flag from backend", () => {
    expect(checkIsMarketClosed("SPX", "2026-09-08", "2026-09-08", true)).toBe(true);
    expect(checkIsMarketClosed("SPX", "2026-09-08", "2026-09-08", false)).toBe(false);
    expect(checkIsMarketClosed("KOSPI", "2026-09-08", "2026-09-08", true)).toBe(true);
    expect(checkIsMarketClosed("KOSPI", "2026-09-08", "2026-09-08", false)).toBe(false);
  });

  it("detects non-trading gap if indexDate is older than baseDate", () => {
    // 기준일 대비 실제 데이터 수신일이 과거일 경우 휴장으로 판정
    expect(checkIsMarketClosed("SPX", "2026-09-10", "2026-09-09")).toBe(true);
  });
});
