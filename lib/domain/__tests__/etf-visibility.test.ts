import { describe, expect, it } from "vitest";

import type { Etf } from "../etf-types";
import { getDefaultEtfs, getNewEtfs, isSmallEtf } from "../etf-visibility";

function etf(overrides: Partial<Etf> = {}): Etf {
  return {
    isin: "KR7000000000",
    ticker: "000000",
    name: "테스트 ETF",
    baseIndex: "테스트 지수",
    close: 10_000,
    changePct: 0,
    tradeValue: 0,
    aum: 50_000_000_000,
    riskType: "normal",
    assetClass: "주식-국내",
    pension: "가능",
    pensionSource: "공식확인",
    liquidity: "pass",
    asOfDate: "20260715",
    returns: { "1m": null, "2m": null, "3m": null, "6m": null, "12m": null },
    isNew3m: false,
    ...overrides,
  };
}

describe("ETF 노출 계층", () => {
  it("기본 목록에는 순자산 500억원 이상만 포함한다", () => {
    const items = [etf({ ticker: "A", aum: 49_999_999_999 }), etf({ ticker: "B", aum: 50_000_000_000 })];
    expect(getDefaultEtfs(items).map((item) => item.ticker)).toEqual(["B"]);
  });

  it("순자산 100억원 미만을 소규모 유의로 판정한다", () => {
    expect(isSmallEtf(etf({ aum: 9_999_999_999 }))).toBe(true);
    expect(isSmallEtf(etf({ aum: 10_000_000_000 }))).toBe(false);
  });

  it("신규 메뉴에는 3개월 미만이면서 순자산 100억원 이상인 종목만 포함한다", () => {
    const items = [
      etf({ ticker: "A", isNew3m: true, aum: 10_000_000_000 }),
      etf({ ticker: "B", isNew3m: true, aum: 9_999_999_999 }),
      etf({ ticker: "C", isNew3m: false, aum: 60_000_000_000 }),
    ];
    expect(getNewEtfs(items).map((item) => item.ticker)).toEqual(["A"]);
  });
});

