import { describe, expect, it } from "vitest";

import type { Etf } from "../etf-types";
import { DEFAULT_SCREENER_FILTERS, filterEtfs, parseScreenerQuery, serializeScreenerQuery } from "../etf-screener";

function etf(overrides: Partial<Etf>): Etf {
  return {
    isin: "KR7000000000", ticker: "000000", name: "테스트 ETF", baseIndex: "테스트 지수",
    close: 10_000, changePct: 0, tradeValue: 0, aum: 50_000_000_000,
    riskType: "normal", assetClass: "주식-국내", pension: "가능", pensionSource: "공식확인",
    liquidity: "pass", asOfDate: "20260715", listingDate: null, listingDateSource: null,
    returns: { "1d": 0, "1w": null, "2w": null, "1m": null, "2m": null, "3m": null, "6m": null, "12m": null, "24m": null, "36m": null, itd: null }, isNew90d: null, isNew3m: false,
    ...overrides,
  };
}

describe("ETF 스크리너", () => {
  const items = [
    etf({ ticker: "A", pension: "가능", assetClass: "주식-국내", riskType: "normal", aum: 60_000_000_000 }),
    etf({ ticker: "B", pension: "불가", assetClass: "채권", riskType: "inverse", aum: 20_000_000_000 }),
    etf({ ticker: "C", pension: "가능", assetClass: "채권", riskType: "normal", aum: 5_000_000_000 }),
  ];

  it("연금 가능만 필터는 확인중과 불가를 제외한다", () => {
    expect(filterEtfs(items, { ...DEFAULT_SCREENER_FILTERS, pensionOnly: true, aumScope: "all", riskTypes: [] }).map((item) => item.ticker)).toEqual(["A", "C"]);
  });

  it("자산군·위험유형·순자산 구간을 함께 적용한다", () => {
    const result = filterEtfs(items, { ...DEFAULT_SCREENER_FILTERS, pensionOnly: false, assetClasses: ["채권"], riskTypes: ["inverse"], aumScope: "all" });
    expect(result.map((item) => item.ticker)).toEqual(["B"]);
  });

  it("복수 선택 필터를 URL 쿼리로 왕복한다", () => {
    const filters = { ...DEFAULT_SCREENER_FILTERS, assetClasses: ["주식-해외", "채권"] as const, riskTypes: ["normal", "leverage"] as const };
    const queryString = serializeScreenerQuery(filters);
    const query = new URLSearchParams(queryString);
    expect(query.getAll("asset")).toEqual(["주식-해외", "채권"]);
    expect(parseScreenerQuery(query)).toEqual(filters);
  });

  it("알 수 없는 쿼리 값은 무시한다", () => {
    const query = new URLSearchParams("asset=주식-해외&asset=unknown&risk=unknown");
    const filters = parseScreenerQuery(query);
    expect(filters.assetClasses).toEqual(["주식-해외"]);
    expect(filters.riskTypes).toEqual([]);
  });
  
  it("쿼리가 없으면 기본값을 반환한다", () => {
    const filters = parseScreenerQuery(new URLSearchParams(""));
    expect(filters).toEqual(DEFAULT_SCREENER_FILTERS);
  });
});
