import { describe, expect, it } from "vitest";

import type { Etf } from "../etf-types";
import {
  GENERAL_RETURN_PERIODS,
  NEW_RETURN_PERIODS,
  filterEtfsByMode,
  getEtfSearchSuggestions,
  getEtfsByAumScope,
  isWithinListingWindow,
  sortExplorerEtfs,
} from "../etf-explorer";

function etf(overrides: Partial<Etf> = {}): Etf {
  return {
    isin: "KR7000000000",
    ticker: "000000",
    name: "테스트 ETF",
    baseIndex: "테스트 지수",
    close: 10_000,
    changePct: 0,
    tradeValue: 0,
    aum: 100_000_000_000,
    riskType: "normal",
    assetClass: "주식-국내",
    pension: "가능",
    pensionSource: "공식확인",
    liquidity: "pass",
    asOfDate: "20260715",
    listingDate: null,
    listingDateSource: null,
    returns: {
      "1d": 0,
      "1w": null,
      "2w": null,
      "1m": null,
      "2m": null,
      "3m": null,
      "6m": null,
      "ytd": null,
      "12m": null,
      "24m": null,
      "36m": null,
      itd: null,
    },
    isNew90d: null,
    isNew3m: false,
    ...overrides,
  } as unknown as Etf;
}

describe("ETF 찾기 도메인", () => {
  it("일반·연금·신규 메뉴에 필요한 기간을 구분한다", () => {
    expect(GENERAL_RETURN_PERIODS).toEqual(["1d", "1w", "2w", "1m", "2m", "3m", "6m", "12m", "24m", "36m", "ytd"]);
    expect(NEW_RETURN_PERIODS).toEqual(["1d", "1w", "2w", "1m", "2m", "itd"]);
  });

  it("상장일과 기준일 차이가 0~90일이면 신규로 판정한다", () => {
    expect(isWithinListingWindow("20260715", "20260715")).toBe(true);
    expect(isWithinListingWindow("20260416", "20260715")).toBe(true);
    expect(isWithinListingWindow("2026-04-16", "20260715")).toBe(true);
    expect(isWithinListingWindow("20260415", "20260715")).toBe(false);
  });

  it("네 가지 탐색 모드의 고정 조건을 적용한다", () => {
    const items = [
      etf({ ticker: "A", riskType: "normal", pension: "불가" }),
      etf({ ticker: "B", riskType: "normal", pension: "가능" }),
      etf({ ticker: "C", riskType: "leverage", pension: "불가" }),
      etf({ ticker: "D", riskType: "inverse", pension: "불가" }),
      etf({ ticker: "E", listingDate: "20260416", aum: 1_000_000_000 }),
    ];

    expect(filterEtfsByMode(items, "general").map((item) => item.ticker)).toEqual(["A", "B", "E"]);
    expect(filterEtfsByMode(items, "pension").map((item) => item.ticker)).toEqual(["B", "E"]);
    expect(filterEtfsByMode(items, "derivatives").map((item) => item.ticker)).toEqual(["C", "D"]);
    expect(filterEtfsByMode(items, "new").map((item) => item.ticker)).toEqual(["E"]);
  });

  it("신규 메뉴는 상장일 백필 전까지 기존 플래그를 사용하고 규모로 제외하지 않는다", () => {
    const item = etf({ ticker: "A", isNew3m: true, aum: 1_000_000_000 });
    expect(filterEtfsByMode([item], "new")).toEqual([item]);
  });

  it("1,000억·500억·전체 범위를 투명하게 적용한다", () => {
    const items = [
      etf({ ticker: "A", aum: 49_999_999_999 }),
      etf({ ticker: "B", aum: 50_000_000_000 }),
      etf({ ticker: "C", aum: 100_000_000_000 }),
    ];
    expect(getEtfsByAumScope(items, "1000plus").map((item) => item.ticker)).toEqual(["C"]);
    expect(getEtfsByAumScope(items, "500plus").map((item) => item.ticker)).toEqual(["B", "C"]);
    expect(getEtfsByAumScope(items, "all").map((item) => item.ticker)).toEqual(["A", "B", "C"]);
  });

  it("오름차순에서도 수익률이 없는 종목은 마지막에 둔다", () => {
    const items = [
      etf({ ticker: "A", returns: { ...etf().returns, "1m": null } }),
      etf({ ticker: "B", returns: { ...etf().returns, "1m": 3 } }),
      etf({ ticker: "C", returns: { ...etf().returns, "1m": -2 } }),
    ];
    expect(sortExplorerEtfs(items, "return", "asc", "1m").map((item) => item.ticker)).toEqual(["C", "B", "A"]);
  });

  it("검색 자동완성은 티커와 이름 일치를 우선순위에 따라 제한한다", () => {
    const items = [
      etf({ ticker: "123456", name: "알파 ETF", tradeValue: 1 }),
      etf({ ticker: "123400", name: "베타 ETF", tradeValue: 2 }),
      etf({ ticker: "999999", name: "123 테마 ETF", tradeValue: 3 }),
    ];

    expect(getEtfSearchSuggestions(items, "123", 2).map((item) => item.ticker)).toEqual(["123400", "123456"]);
    expect(getEtfSearchSuggestions(items, "123456").map((item) => item.ticker)).toEqual(["123456"]);
    expect(getEtfSearchSuggestions(items, " ")).toEqual([]);
  });
});
