// @ts-nocheck
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
    listingDate: null,
    listingDateSource: null,
    returns: { "1d": 1, "1w": null, "2w": null, "1m": null, "2m": null, "3m": null, "6m": null, "ytd": null, "12m": null, "24m": null, "36m": null, itd: null },
    isNew90d: null,
    isNew3m: false,
    ...overrides,
  } as unknown as Etf;
}

describe("ETF 노출 계층", () => {
  it("기본 목록에는 순자산 1,000억원 이상만 포함한다", () => {
    const items = [etf({ ticker: "A", aum: 99_999_999_999 }), etf({ ticker: "B", aum: 100_000_000_000 })];
    expect(getDefaultEtfs(items).map((item) => item.ticker)).toEqual(["B"]);
  });

  it("순자산 100억원 미만을 소규모 유의로 판정한다", () => {
    expect(isSmallEtf(etf({ aum: 9_999_999_999 }))).toBe(true);
    expect(isSmallEtf(etf({ aum: 10_000_000_000 }))).toBe(false);
  });

  it("신규 메뉴에는 상장 후 90일 이내 종목을 규모와 무관하게 포함한다", () => {
    const items = [
      etf({ ticker: "A", listingDate: "20260416", aum: 1_000_000_000 }),
      etf({ ticker: "B", listingDate: "20260415", aum: 100_000_000_000 }),
      etf({ ticker: "C", isNew3m: true, aum: 2_000_000_000 }),
    ];
    expect(getNewEtfs(items).map((item) => item.ticker)).toEqual(["A", "C"]);
  });
});
