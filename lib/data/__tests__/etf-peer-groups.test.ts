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
    expect(primary.candidates.every((item) => item.profile.primaryPeerGroupId === source!.primary_peer_group_id)).toBe(true);
    expect(primary.candidates.every((item) => automaticStatuses.has(item.profile.classificationStatus))).toBe(true);
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


describe("peer comparison empty-state contract", () => {
  it("does not force-fill a verified group with unrelated peers", () => {
    const source = readFileSync(path.join(process.cwd(), "components", "etf-detail", "peer-comparison-panel.tsx"), "utf8");
    expect(source).toContain("현재 기준으로 직접 비교할 수 있는 동종 ETF가 없습니다.");
    expect(source).toContain("후보 수를 채우기 위해 관련성이 낮은 ETF를 표시하지 않습니다.");
    expect(source).toContain("동종 ETF 분류를 확인하고 있습니다.");
    expect(source).not.toContain('comparison.state === "no_peers" || selected.candidates.length === 0');
  });
});
