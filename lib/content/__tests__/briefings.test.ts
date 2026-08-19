import { describe, expect, it } from "vitest";

import { loadBriefings } from "../briefings";

describe("브리핑 저장소", () => {
  it("학습용 예시 브리핑의 날짜, 안전 메타데이터, 제목을 파일에서 읽는다", () => {
    const briefings = loadBriefings();
    expect(briefings).toHaveLength(1);
    expect(briefings[0]).toMatchObject({
      date: "2026-07-15",
      isLearningExample: true,
      contentRole: "learning-example",
      exampleType: "briefing-reading-guide",
      scenarioBasis: "fictional",
      asOf: "not-applicable",
      sources: "not-applicable",
    });
    expect(briefings[0].title.length).toBeGreaterThan(0);
    expect(briefings[0].content.startsWith("# 시황 브리핑을 읽는 기준 예시")).toBe(true);
  });
});
