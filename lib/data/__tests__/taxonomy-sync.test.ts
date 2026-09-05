import { describe, expect, it } from "vitest";
import path from "node:path";
import { readCsv } from "@/lib/data/csv";
import { ETF_TAXONOMY_MAP } from "../../../workers/market-briefing-publisher/src/taxonomy-map";

describe("SSOT Taxonomy Synchronization Contract", () => {
  const csvPath = path.join(process.cwd(), "data", "comparison", "etf_comparison_classification.csv");
  const classifications = readCsv(csvPath);

  it("Master CSV and Market Briefing Worker have identical ETF ticker coverage", () => {
    expect(classifications.length).toBeGreaterThan(1100);
    const mapTickers = Object.keys(ETF_TAXONOMY_MAP);
    expect(mapTickers.length).toBe(classifications.length);

    for (const row of classifications) {
      expect(ETF_TAXONOMY_MAP[row.ticker]).toBeDefined();
    }
  });

  it("1:1 alignment between asset_family and Worker assetClass across all ETFs", () => {
    for (const row of classifications) {
      const mapped = ETF_TAXONOMY_MAP[row.ticker];
      expect(mapped?.assetClass).toBe(row.asset_family);
    }
  });

  it("1:1 alignment between comparison_topic and Worker peerGroup across all ETFs", () => {
    for (const row of classifications) {
      const mapped = ETF_TAXONOMY_MAP[row.ticker];
      expect(mapped?.peerGroup).toBe(row.comparison_topic);
    }
  });

  it("중국/홍콩 커버드콜 종목은 '미국'이 아닌 '해외 월배당 & 커버드콜'로 올바르게 분류된다", () => {
    const chinaWeeklyCoveredCall = classifications.find((r) => r.ticker === "0094L0");
    const chinaHangSengCoveredCall = classifications.find((r) => r.ticker === "0128D0");

    expect(chinaWeeklyCoveredCall).toBeDefined();
    expect(chinaWeeklyCoveredCall?.comparison_topic).toBe("해외 월배당 & 커버드콜");
    expect(ETF_TAXONOMY_MAP["0094L0"]?.peerGroup).toBe("해외 월배당 & 커버드콜");

    expect(chinaHangSengCoveredCall).toBeDefined();
    expect(chinaHangSengCoveredCall?.comparison_topic).toBe("해외 월배당 & 커버드콜");
    expect(ETF_TAXONOMY_MAP["0128D0"]?.peerGroup).toBe("해외 월배당 & 커버드콜");
  });

  it("자산배분 & 채권혼합의 subtopic은 단일종목, 시장대표, TDF 등으로 정밀 세분화된다", () => {
    const mixedBonds = classifications.filter((r) => r.comparison_topic === "자산배분 & 채권혼합");
    expect(mixedBonds.length).toBeGreaterThanOrEqual(70);

    const subtopics = new Set(mixedBonds.map((r) => r.comparison_subtopic));
    expect(subtopics.has("단일종목 채권혼합")).toBe(true);
    expect(subtopics.has("시장대표 채권혼합")).toBe(true);
    expect(subtopics.has("TDF 생애주기")).toBe(true);
  });
});
