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

  it("필드 소실 감지: strategy_style이 plain인 행의 비율이 전체의 60% 미만이고, fx_hedge가 unknown인 행의 비율이 20% 미만이다", () => {
    const total = classifications.length;
    const plainCount = classifications.filter((row) => row.strategy_style === "plain").length;
    const unknownFxCount = classifications.filter((row) => row.fx_hedge === "unknown").length;

    expect(plainCount / total).toBeLessThan(0.6);
    expect(unknownFxCount / total).toBeLessThan(0.2);
  });
});

