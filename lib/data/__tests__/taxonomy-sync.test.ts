import { describe, expect, it } from "vitest";
import path from "node:path";
import { readCsv } from "@/lib/data/csv";

describe("SSOT ETF Comparison Classification Invariant Contract", () => {
  const csvPath = path.join(process.cwd(), "data", "comparison", "etf_comparison_classification.csv");
  const classifications = readCsv(csvPath);

  it("분류 마스터 CSV가 1,100종목 이상의 충분한 ETF 유니버스를 포괄한다", () => {
    expect(classifications.length).toBeGreaterThan(1100);
  });

  it("모든 등록 종목은 6자리 영숫자 티커 및 유효한 자산군/비교토픽을 보유한다", () => {
    for (const row of classifications) {
      expect(row.ticker).toMatch(/^[0-9A-Z]{6}$/);
      expect(row.asset_family).toBeTruthy();
      expect(row.comparison_topic).toBeTruthy();
    }
  });

  it("중국/홍콩 커버드콜 종목은 '미국'이 아닌 '해외 월배당 & 커버드콜'로 올바르게 분류된다", () => {
    const chinaWeeklyCoveredCall = classifications.find((r) => r.ticker === "0094L0");
    const chinaHangSengCoveredCall = classifications.find((r) => r.ticker === "0128D0");

    expect(chinaWeeklyCoveredCall).toBeDefined();
    expect(chinaWeeklyCoveredCall?.comparison_topic).toBe("해외 월배당 & 커버드콜");

    expect(chinaHangSengCoveredCall).toBeDefined();
    expect(chinaHangSengCoveredCall?.comparison_topic).toBe("해외 월배당 & 커버드콜");
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
