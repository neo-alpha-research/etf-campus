import { describe, expect, it } from "vitest";

import type { Etf } from "../etf-types";
import { type ScreenerFilters, DEFAULT_SCREENER_FILTERS, filterEtfs, parseScreenerQuery, serializeScreenerQuery } from "../etf-screener";

function etf(overrides: Partial<Etf>): Etf {
  return {
    isin: "KR7000000000", ticker: "000000", name: "테스트 ETF", baseIndex: "테스트 지수",
    close: 10_000, changePct: 0, tradeValue: 0, aum: 50_000_000_000,
    riskType: "normal", assetClass: "주식-국내", pension: "가능", pensionSource: "공식확인",
    liquidity: "pass", asOfDate: "20260715", listingDate: null, listingDateSource: null,
    fee: null, issuer: { issuerId: "A", issuerName: "A", brand: "A", issuerStatus: "verified_official", issuerSourceUrl: null, issuerVerifiedAt: null }, classification: null,
    returns: { "1d": 0, "1w": null, "2w": null, "1m": null, "2m": null, "3m": null, "6m": null, "12m": null, "24m": null, "36m": null, ytd: null, itd: null }, isNew90d: null, isNew3m: false,
    ...overrides,
  } as unknown as Etf;
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
    const filters: ScreenerFilters = {
      ...DEFAULT_SCREENER_FILTERS,
      marketScopes: ["국내", "미국"],
      assetClasses: ["주식-해외", "채권"],
      riskTypes: ["leverage"],
      strategies: ["액티브", "커버드콜"],
      aumScope: "1000plus",
      fxHedges: ["비헤지"],
    };
    const query = new URLSearchParams(serializeScreenerQuery(filters));
    expect(query.getAll("market")).toEqual(["국내", "미국"]);
    expect(query.getAll("asset")).toEqual(["주식-해외", "채권"]);
    expect(query.getAll("risk")).toEqual(["leverage"]);
    expect(query.getAll("strategy")).toEqual(["액티브", "커버드콜"]);
    expect(query.getAll("fx")).toEqual(["비헤지"]);
    expect(parseScreenerQuery(query)).toEqual(filters);
  });

  it("알 수 없는 쿼리 값은 무시한다", () => {
    const query = new URLSearchParams("asset=주식-해외&asset=unknown&risk=unknown&market=unknown&strategy=unknown&fx=unknown");
    const filters = parseScreenerQuery(query);
    expect(filters.assetClasses).toEqual(["주식-해외"]);
    expect(filters.riskTypes).toEqual([]);
    expect(filters.marketScopes).toEqual([]);
    expect(filters.strategies).toEqual([]);
    expect(filters.fxHedges).toEqual([]);
  });
  
  it("쿼리가 없으면 기본값을 반환한다", () => {
    const filters = parseScreenerQuery(new URLSearchParams(""));
    expect(filters).toEqual(DEFAULT_SCREENER_FILTERS);
  });

  it("연금 필터 해제는 pension=all로 URL에 보존한다", () => {
    const filters = { ...DEFAULT_SCREENER_FILTERS, pensionOnly: false };
    const query = new URLSearchParams(serializeScreenerQuery(filters));
    expect(query.get("pension")).toBe("all");
    expect(parseScreenerQuery(query).pensionOnly).toBe(false);
  });
});

describe("ETF 스크리너 - 상세 분류 필터 (지역, 운용 전략, 환헤지)", () => {
  const fxUnhedged = etf({ ticker: "FX1", name: "비헤지", assetClass: "주식-해외", classification: { published: true, marketScope: "미국", assetClass: "주식-해외", assetDetail: null, strategy: "액티브", fxHedge: "환노출", reviewStatus: "수기확정", reviewPriority: "High", sourceUrl: null, evidenceSummary: null } });
  const fxHedged = etf({ ticker: "FX2", name: "헤지", assetClass: "주식-해외", classification: { published: true, marketScope: "글로벌", assetClass: "주식-해외", assetDetail: null, strategy: "패시브", fxHedge: "환헤지", reviewStatus: "수기확정", reviewPriority: "High", sourceUrl: null, evidenceSummary: null } });
  const fxPartial = etf({ ticker: "FX3", name: "부분 헤지", assetClass: "주식-해외", classification: { published: true, marketScope: "일본", assetClass: "주식-해외", assetDetail: null, strategy: "액티브·합성", fxHedge: "부분 헤지", reviewStatus: "수기확정", reviewPriority: "High", sourceUrl: null, evidenceSummary: null } });
  const fxElastic = etf({ ticker: "FX4", name: "탄력 헤지", assetClass: "주식-해외", classification: { published: true, marketScope: "유럽", assetClass: "주식-해외", assetDetail: null, strategy: "커버드콜", fxHedge: "탄력적 환헤지", reviewStatus: "수기확정", reviewPriority: "High", sourceUrl: null, evidenceSummary: null } });
  const fxNone = etf({ ticker: "FX5", name: "국내", assetClass: "주식-국내", classification: { published: true, marketScope: "국내", assetClass: "주식-국내", assetDetail: null, strategy: "커버드콜·배당", fxHedge: "해당없음", reviewStatus: "수기확정", reviewPriority: "High", sourceUrl: null, evidenceSummary: null } });
  const unclassified = etf({ ticker: "UN1", name: "미확인", classification: null });

  const items = [fxUnhedged, fxHedged, fxPartial, fxElastic, fxNone, unclassified];

  it("미국 지역 + 해외주식 필터를 조합하면 교집합으로 필터링한다", () => {
    const result = filterEtfs(items, { ...DEFAULT_SCREENER_FILTERS, aumScope: "all", riskTypes: [], marketScopes: ["미국"], assetClasses: ["주식-해외"] });
    expect(result.map(i => i.ticker)).toEqual(["FX1"]);
  });

  it("국내 지역 + 국내주식 필터를 조합하면 교집합으로 필터링한다", () => {
    const result = filterEtfs(items, { ...DEFAULT_SCREENER_FILTERS, aumScope: "all", riskTypes: [], marketScopes: ["국내"], assetClasses: ["주식-국내"] });
    expect(result.map(i => i.ticker)).toEqual(["FX5"]);
  });

  it("액티브 판정 (단일값 및 액티브·합성 복합값 모두 매칭)", () => {
    const result = filterEtfs(items, { ...DEFAULT_SCREENER_FILTERS, aumScope: "all", riskTypes: [], strategies: ["액티브"] });
    expect(result.map(i => i.ticker)).toEqual(["FX1", "FX3"]);
  });

  it("커버드콜 판정 (단일값 및 커버드콜·배당 복합값 모두 매칭)", () => {
    const result = filterEtfs(items, { ...DEFAULT_SCREENER_FILTERS, aumScope: "all", riskTypes: [], strategies: ["커버드콜"] });
    expect(result.map(i => i.ticker)).toEqual(["FX4", "FX5"]);
  });

  it("환노출 값은 비헤지로 매핑된다", () => {
    const result = filterEtfs(items, { ...DEFAULT_SCREENER_FILTERS, aumScope: "all", riskTypes: [], fxHedges: ["비헤지"] });
    expect(result.map(i => i.ticker)).toEqual(["FX1"]); // FX5(해당없음)은 포함되지 않아야 함
  });

  it("환헤지 값은 헤지로 매핑된다", () => {
    const result = filterEtfs(items, { ...DEFAULT_SCREENER_FILTERS, aumScope: "all", riskTypes: [], fxHedges: ["헤지"] });
    expect(result.map(i => i.ticker)).toEqual(["FX2"]);
  });
  
  it("부분 헤지와 탄력적 헤지도 정확히 매핑된다", () => {
    const r1 = filterEtfs(items, { ...DEFAULT_SCREENER_FILTERS, aumScope: "all", riskTypes: [], fxHedges: ["부분 헤지"] });
    expect(r1.map(i => i.ticker)).toEqual(["FX3"]);
    const r2 = filterEtfs(items, { ...DEFAULT_SCREENER_FILTERS, aumScope: "all", riskTypes: [], fxHedges: ["탄력 헤지"] });
    expect(r2.map(i => i.ticker)).toEqual(["FX4"]);
  });

  it("분류 미확인 종목은 필터 미선택 시 포함되지만, 특정 분류 선택 시 제외된다", () => {
    // 아무 지역 선택 안함
    const noFilter = filterEtfs(items, { ...DEFAULT_SCREENER_FILTERS, aumScope: "all", riskTypes: [] });
    expect(noFilter.some(i => i.ticker === "UN1")).toBe(true);

    // 지역 선택 시 제외됨
    const withFilter = filterEtfs(items, { ...DEFAULT_SCREENER_FILTERS, aumScope: "all", riskTypes: [], marketScopes: ["미국"] });
    expect(withFilter.some(i => i.ticker === "UN1")).toBe(false);
  });
});
