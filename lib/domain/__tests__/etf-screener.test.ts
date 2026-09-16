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

  it("상품구조에서 파킹·단기자금과 일반형을 독립적으로 필터링한다", () => {
    const mixed = [
      etf({ ticker: "STOCK", assetClass: "주식-국내", riskType: "normal" }),
      etf({ ticker: "PARK", assetClass: "금리·파킹", riskType: "normal" }),
      etf({ ticker: "LEV", assetClass: "주식-국내", riskType: "leverage" }),
    ];
    const normalOnly = filterEtfs(mixed, { ...DEFAULT_SCREENER_FILTERS, pensionOnly: false, riskTypes: ["normal"], aumScope: "all" });
    expect(normalOnly.map((i) => i.ticker)).toEqual(["STOCK"]);

    const parkingOnly = filterEtfs(mixed, { ...DEFAULT_SCREENER_FILTERS, pensionOnly: false, riskTypes: ["parking"], aumScope: "all" });
    expect(parkingOnly.map((i) => i.ticker)).toEqual(["PARK"]);
  });

  it("키워드로 종목명, 종목코드(티커), 기초지수를 검색한다", () => {
    const list = [
      etf({ ticker: "069500", name: "KODEX 200", baseIndex: "코스피 200" }),
      etf({ ticker: "379800", name: "TIGER 미국S&P500", baseIndex: "S&P 500" }),
      etf({ ticker: "465580", name: "ACE 미국30년국채액티브", baseIndex: "Bloomberg US Treasury 20+ Year" }),
    ];
    // 1. 티커 6자리 검색
    const byTicker = filterEtfs(list, { ...DEFAULT_SCREENER_FILTERS, pensionOnly: false, aumScope: "all", riskTypes: [], keyword: "069500" });
    expect(byTicker.map((i) => i.ticker)).toEqual(["069500"]);

    // 2. 종목명 검색
    const byName = filterEtfs(list, { ...DEFAULT_SCREENER_FILTERS, pensionOnly: false, aumScope: "all", riskTypes: [], keyword: "TIGER" });
    expect(byName.map((i) => i.ticker)).toEqual(["379800"]);

    // 3. 기초지수 검색
    const byIndex = filterEtfs(list, { ...DEFAULT_SCREENER_FILTERS, pensionOnly: false, aumScope: "all", riskTypes: [], keyword: "Bloomberg" });
    expect(byIndex.map((i) => i.ticker)).toEqual(["465580"]);
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

  it("퇴직연금 안전자산(100%)과 위험자산(70%) 한도를 정밀하게 분리 필터링한다", () => {
    const mixed = [
      etf({ ticker: "SAFE_BOND", pension: "가능", pensionLimit: "100% (안전자산)", riskType: "normal" }),
      etf({ ticker: "SAFE_PARK", pension: "가능", pensionLimit: "100% (안전자산)", riskType: "normal", assetClass: "금리·파킹" }),
      etf({ ticker: "RISK_EQUITY", pension: "가능", pensionLimit: "70% (위험자산)", riskType: "normal", assetClass: "주식-국내" }),
      etf({ ticker: "INELIGIBLE", pension: "불가", pensionLimit: "불가", riskType: "leverage" }),
    ];

    const safeOnly = filterEtfs(mixed, {
      ...DEFAULT_SCREENER_FILTERS,
      aumScope: "all",
      riskTypes: [],
      accountMode: "pension",
      pensionTier: "safe",
    });
    expect(safeOnly.map(i => i.ticker)).toEqual(["SAFE_BOND", "SAFE_PARK"]);

    const riskOnly = filterEtfs(mixed, {
      ...DEFAULT_SCREENER_FILTERS,
      aumScope: "all",
      riskTypes: [],
      accountMode: "pension",
      pensionTier: "risk",
    });
    expect(riskOnly.map(i => i.ticker)).toEqual(["RISK_EQUITY"]);
  });

  it("중개형 ISA 계좌 모드에서는 레버리지/인버스를 제외하고 1배수 전 종목을 허용한다", () => {
    const mixed = [
      etf({ ticker: "EQUITY", isaEligible: "가능", riskType: "normal", isaTaxBenefit: "낮음" }),
      etf({ ticker: "FUTURES_OIL", isaEligible: "가능", riskType: "normal", isaTaxBenefit: "높음" }),
      etf({ ticker: "LEV_2X", isaEligible: "불가", riskType: "leverage" }),
      etf({ ticker: "INV_1X", isaEligible: "불가", riskType: "inverse" }),
    ];

    const isaAllowed = filterEtfs(mixed, {
      ...DEFAULT_SCREENER_FILTERS,
      aumScope: "all",
      riskTypes: [],
      accountMode: "isa",
      isaTier: "all",
    });
    expect(isaAllowed.map(i => i.ticker)).toEqual(["EQUITY", "FUTURES_OIL"]);

    const isaHighBenefitOnly = filterEtfs(mixed, {
      ...DEFAULT_SCREENER_FILTERS,
      aumScope: "all",
      riskTypes: [],
      accountMode: "isa",
      isaTier: "high_benefit",
    });
    expect(isaHighBenefitOnly.map(i => i.ticker)).toEqual(["FUTURES_OIL"]);

    const isaNormalOnly = filterEtfs(mixed, {
      ...DEFAULT_SCREENER_FILTERS,
      aumScope: "all",
      riskTypes: [],
      accountMode: "isa",
      isaTier: "normal",
    });
    expect(isaNormalOnly.map(i => i.ticker)).toEqual(["EQUITY"]);
  });

  it("중개형 ISA 절세 실익 필터를 URL 쿼리로 왕복한다", () => {
    const filters: ScreenerFilters = {
      ...DEFAULT_SCREENER_FILTERS,
      accountMode: "isa",
      pensionOnly: false,
      isaTier: "high_benefit",
    };
    const serialized = serializeScreenerQuery(filters);
    const query = new URLSearchParams(serialized);
    expect(query.get("account")).toBe("isa");
    expect(query.get("isa_tier")).toBe("high_benefit");

    const parsed = parseScreenerQuery(query);
    expect(parsed.accountMode).toBe("isa");
    expect(parsed.isaTier).toBe("high_benefit");
  });

  it("중개형 ISA 모드 진입 시(isa_tier 미지정) 절세 혜택형(high_benefit)이 기본값으로 파싱된다", () => {
    const query = new URLSearchParams("account=isa");
    const parsed = parseScreenerQuery(query);
    expect(parsed.accountMode).toBe("isa");
    expect(parsed.isaTier).toBe("high_benefit");
  });

  it("중개형 ISA 전체 모드(isa_tier=all)를 URL 쿼리로 정상 왕복한다", () => {
    const filters: ScreenerFilters = {
      ...DEFAULT_SCREENER_FILTERS,
      accountMode: "isa",
      pensionOnly: false,
      isaTier: "all",
    };
    const serialized = serializeScreenerQuery(filters);
    const query = new URLSearchParams(serialized);
    expect(query.get("account")).toBe("isa");
    expect(query.get("isa_tier")).toBe("all");

    const parsed = parseScreenerQuery(query);
    expect(parsed.accountMode).toBe("isa");
    expect(parsed.isaTier).toBe("all");
  });

  it("분배 주기(월 분배 등) 필터링과 URL 쿼리 왕복이 정상 작동한다", () => {
    const mixed = [
      etf({ ticker: "MONTHLY", distributionCycle: "월 분배" }),
      etf({ ticker: "QUARTERLY", distributionCycle: "분기 분배" }),
      etf({ ticker: "TR", distributionCycle: "TR (재투자)" }),
    ];

    const monthlyOnly = filterEtfs(mixed, {
      ...DEFAULT_SCREENER_FILTERS,
      aumScope: "all",
      riskTypes: [],
      distributionCycles: ["월 분배"],
    });
    expect(monthlyOnly.map(i => i.ticker)).toEqual(["MONTHLY"]);

    const filters: ScreenerFilters = {
      ...DEFAULT_SCREENER_FILTERS,
      distributionCycles: ["월 분배"],
    };
    const serialized = serializeScreenerQuery(filters);
    const query = new URLSearchParams(serialized);
    expect(query.getAll("cycle")).toContain("월 분배");

    const parsed = parseScreenerQuery(query);
    expect(parsed.distributionCycles).toEqual(["월 분배"]);
  });
});
