import { describe, expect, it } from "vitest";
import path from "node:path";
import { readFileSync } from "node:fs";
import {
  calculateSimilarityScore,
  getPeerComparison,
  sortPeerCandidates,
  type ComparisonProfile,
  type PeerCandidate,
} from "@/lib/data/etf-peer-groups";
import { loadEtfs } from "@/lib/data/etf-repository";
import { readCsv } from "@/lib/data/csv";

const etfs = loadEtfs();
const byTicker = new Map(etfs.map((etf) => [etf.ticker, etf]));
const classifications = readCsv(
  path.join(process.cwd(), "data", "comparison", "etf_comparison_classification.csv"),
);
const automaticStatuses = new Set(["verified_official", "auto_high_confidence"]);

function profile(overrides: Partial<ComparisonProfile> = {}): ComparisonProfile {
  return {
    ticker: "TEST",
    primaryPeerGroupId: "PG-TEST",
    alternatePeerGroupIds: [],
    classificationStatus: "auto_high_confidence",
    assetFamily: "주식",
    regionPrimary: "미국",
    comparisonCategory: "테마",
    comparisonTopic: "인공지능",
    comparisonSubtopic: "AI 데이터센터",
    indexFamily: "AI_DATA_CENTER",
    strategyStyle: "plain",
    payoffStructure: "plain",
    direction: "neutral",
    leverageMultiple: "1X",
    fxHedge: "unhedged",
    replicationMethod: "physical_or_unspecified",
    concentrationBucket: "concentrated",
    ...overrides,
  };
}

function candidate(ticker: string, score: number, aum: number, tradeValue: number): PeerCandidate {
  const base = etfs[0]!;
  return {
    etf: { ...base, ticker, name: ticker, aum, tradeValue },
    profile: profile({ ticker }),
    similarityScore: score,
    reasons: [],
  };
}

describe("getPeerComparison", () => {
  it("returns only automatic candidates from the identical primary group", () => {
    const groupCounts = new Map<string, number>();
    for (const row of classifications.filter((row) => automaticStatuses.has(row.classification_status))) {
      groupCounts.set(row.primary_peer_group_id, (groupCounts.get(row.primary_peer_group_id) ?? 0) + 1);
    }
    const source = classifications.find((row) =>
      automaticStatuses.has(row.classification_status) &&
      (groupCounts.get(row.primary_peer_group_id) ?? 0) > 1 &&
      byTicker.has(row.ticker),
    );
    expect(source).toBeDefined();

    const comparison = getPeerComparison(byTicker.get(source!.ticker)!, etfs);
    const primary = comparison.groups.find((group) => group.isPrimary)!;
    expect(primary.candidates.length).toBeGreaterThan(0);
    expect(primary.candidates.length).toBeLessThanOrEqual(4);
  });
});

describe("comparison ranking", () => {
  it("awards points only for matching non-empty fields", () => {
    const target = profile();
    expect(calculateSimilarityScore(target, profile({ classificationStatus: "verified_official" }))).toBe(100);
    expect(calculateSimilarityScore(target, profile({ indexFamily: "", comparisonSubtopic: "", strategyStyle: "", fxHedge: "", concentrationBucket: "", replicationMethod: "" }))).toBe(0);
  });

  it("sorts by score, then AUM, trade value, and ticker deterministically", () => {
    const ranked = sortPeerCandidates([
      candidate("CCCC", 60, 100, 100),
      candidate("BBBB", 60, 100, 200),
      candidate("AAAA", 60, 100, 200),
      candidate("ZZZZ", 60, 200, 1),
      candidate("HIGH", 61, 1, 1),
    ]);
    expect(ranked.map((item) => item.etf.ticker)).toEqual(["HIGH", "ZZZZ", "AAAA", "BBBB", "CCCC"]);
  });
});

describe("detail comparison isolation", () => {
  it("does not import or mutate the persistent comparison basket", () => {
    const detailClient = readFileSync(path.join(process.cwd(), "components", "etf-detail", "etf-detail-client.tsx"), "utf8");
    expect(detailClient).not.toContain("useCompareBasket");
    expect(detailClient).not.toContain("localStorage");
  });

  it("keeps independent compare-page basket controls intact", () => {
    const compareClient = readFileSync(path.join(process.cwd(), "components", "compare", "compare-client.tsx"), "utf8");
    expect(compareClient).toContain("useCompareBasket");
  });
});

describe("classification data contracts", () => {
  it("은행 계열 방어: 이름 또는 기초지수에 은행이 포함된 ETF의 asset_family는 원자재가 아니다", () => {
    const bankEtfs = classifications.filter(
      (row) => (row.name?.includes("은행") || row.base_index?.includes("은행")),
    );
    expect(bankEtfs.length).toBeGreaterThan(0);
    for (const item of bankEtfs) {
      expect(item.asset_family).not.toBe("원자재");
    }
  });

  it("파킹형 방어: 이름에 CD와 금리가 함께 포함된 ETF의 comparison_category는 산업·섹터가 아니다", () => {
    const cdRateEtfs = classifications.filter(
      (row) => row.name?.includes("CD") && row.name?.includes("금리"),
    );
    expect(cdRateEtfs.length).toBeGreaterThan(0);
    for (const item of cdRateEtfs) {
      expect(item.comparison_category).not.toBe("산업·섹터");
    }
  });

  it("선물 상품 보존: TIGER 금은선물(H), KODEX 콩선물(H), RISE 팔라듐선물(H)의 asset_family는 원자재이다", () => {
    const commodityNames = ["TIGER 금은선물(H)", "KODEX 콩선물(H)", "RISE 팔라듐선물(H)"];
    for (const name of commodityNames) {
      const found = classifications.find((row) => row.name === name);
      expect(found).toBeDefined();
      expect(found?.asset_family).toBe("원자재");
    }
  });

  it("채권혼합 방어: 순수 채권군(우량 회사채, 장기국채 등)에 개별주식 혼합형 ETF가 혼입되지 않는다", () => {
    const pureBondTopics = new Set(["우량 회사채·금융채", "국내 장기국채", "미국 장기국채"]);
    const pureBondEtfs = classifications.filter((row) => pureBondTopics.has(row.comparison_topic));
    for (const item of pureBondEtfs) {
      expect(item.name).not.toContain("채권혼합");
      expect(item.asset_family).not.toBe("혼합자산");
    }
  });

  it("커버드콜 격리 방어: 순수 미국 빅테크 (M7) 토픽에는 옵션 매도 커버드콜 상품이 혼입되지 않는다", () => {
    const m7Etfs = classifications.filter((row) => row.comparison_topic === "미국 빅테크 (M7)");
    expect(m7Etfs.length).toBeGreaterThan(0);
    for (const item of m7Etfs) {
      expect(item.name).not.toContain("커버드콜");
      expect(item.payoff_structure).not.toBe("covered_call");
    }
  });

  it("통신 인프라 주식형 방어: RISE 네트워크인프라(367760)의 asset_family는 리츠·인프라가 아닌 주식이다", () => {
    const networkInfra = classifications.find((row) => row.ticker === "367760");
    expect(networkInfra).toBeDefined();
    expect(networkInfra?.asset_family).toBe("주식");
    expect(networkInfra?.comparison_category).toBe("산업·섹터");
  });

  it("필드 소실 감지: strategy_style이 plain인 행의 비율이 전체의 60% 미만이고, fx_hedge가 unknown인 행의 비율이 20% 미만이다", () => {
    const total = classifications.length;
    const plainCount = classifications.filter((row) => row.strategy_style === "plain").length;
    const unknownFxCount = classifications.filter((row) => row.fx_hedge === "unknown").length;

    expect(plainCount / total).toBeLessThan(0.6);
    expect(unknownFxCount / total).toBeLessThan(0.2);
  });

  it("전력기기 테마 매칭: TIGER 코리아AI전력기기TOP3플러스(0117V0)의 피어 후보는 전력/인프라 테마 종목이며 대표지수가 아니다", () => {
    const target = byTicker.get("0117V0");
    expect(target).toBeDefined();
    const comparison = getPeerComparison(target!, etfs);
    const primary = comparison.groups.find((group) => group.isPrimary);
    expect(primary).toBeDefined();
    expect(primary!.candidates.length).toBe(4);

    const candidateTickers = primary!.candidates.map((c) => c.etf.ticker);
    // KODEX 200 등 단순 미확인 지수가 아닌 전력 테마 ETF들이 매칭되어야 함
    expect(candidateTickers).not.toContain("069500");
    expect(candidateTickers).not.toContain("278530");
    expect(candidateTickers).toContain("491820"); // HANARO 전력설비투자
    expect(candidateTickers).toContain("0209Z0"); // ACE 코리아AI전력TOP10
    expect(candidateTickers).toContain("487240"); // KODEX AI전력핵심설비
  });

  it("RISE AI전력인프라(0101N0) 매칭: 부동산 리츠가 아닌 전력/AI 주식형 ETF와 매칭된다", () => {
    const target = byTicker.get("0101N0");
    expect(target).toBeDefined();
    const comparison = getPeerComparison(target!, etfs);
    const primary = comparison.groups.find((group) => group.isPrimary);
    expect(primary).toBeDefined();
    expect(primary!.candidates.length).toBe(4);

    const candidateTickers = primary!.candidates.map((c) => c.etf.ticker);
    // 부동산 리츠(329200 등)가 아닌 전력 테마 종목이어야 함
    expect(candidateTickers).not.toContain("329200"); // TIGER 리츠부동산인프라
    expect(candidateTickers).toContain("487240"); // KODEX AI전력핵심설비
  });

  it("UI 노이즈 방어: 피어 추천 사유에 '공식 확인 분류' 중복 배지가 포함되지 않는다", () => {
    const target = byTicker.get("0101N0");
    const comparison = getPeerComparison(target!, etfs);
    for (const group of comparison.groups) {
      for (const cand of group.candidates) {
        expect(cand.reasons).not.toContain("공식 확인 분류");
      }
    }
  });

  it("SOL 미국AI전력인프라(486450) 매칭: 리츠가 아닌 미국 AI 전력 주식형 ETF들과 매칭된다", () => {
    const target = byTicker.get("486450");
    expect(target).toBeDefined();
    const comparison = getPeerComparison(target!, etfs);
    const primary = comparison.groups.find((group) => group.isPrimary);
    expect(primary).toBeDefined();
    expect(primary!.candidates.length).toBe(4);

    const candidateTickers = primary!.candidates.map((c) => c.etf.ticker);
    expect(candidateTickers).not.toContain("329200"); // TIGER 리츠부동산인프라
    expect(candidateTickers).toContain("487230"); // KODEX 미국AI전력핵심인프라
  });

  it("RISE 미국AI클라우드인프라(0127R0) 매칭: 리츠가 아닌 AI 데이터센터/클라우드 테마와 매칭된다", () => {
    const target = byTicker.get("0127R0");
    expect(target).toBeDefined();
    const comparison = getPeerComparison(target!, etfs);
    const primary = comparison.groups.find((group) => group.isPrimary);
    expect(primary).toBeDefined();
    expect(primary!.candidates.length).toBe(4);

    const candidateTickers = primary!.candidates.map((c) => c.etf.ticker);
    expect(candidateTickers).not.toContain("329200");
    expect(candidateTickers).toContain("0207Z0"); // KIWOOM 미국우주데이터센터인프라
  });

  it("Zero-Hallucination: TR 12m 정렬 시 PR 1년 수익률로 혼용 fallback하지 않는다", () => {
    const base = etfs[0]!;
    const candA: PeerCandidate = {
      etf: { ...base, ticker: "TR_HAS", returnsTr: { ...base.returnsTr, "12m": 10 } as any, returns: { ...base.returns, "12m": 5 } as any, aum: 100, tradeValue: 100 },
      profile: profile({ ticker: "TR_HAS" }),
      similarityScore: 50,
      reasons: [],
    };
    const candB: PeerCandidate = {
      etf: { ...base, ticker: "TR_MISSING", returnsTr: undefined, returns: { ...base.returns, "12m": 20 } as any, aum: 100, tradeValue: 100 },
      profile: profile({ ticker: "TR_MISSING" }),
      similarityScore: 50,
      reasons: [],
    };
    const sorted = sortPeerCandidates([candB, candA]);
    expect(sorted[0].etf.ticker).toBe("TR_HAS");
    expect(sorted[1].etf.ticker).toBe("TR_MISSING");
  });
});


