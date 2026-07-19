import { describe, expect, it } from "vitest";

import { loadBriefings } from "../briefings";

describe("브리핑 저장소", () => {
  it("샘플 브리핑의 날짜와 제목을 파일에서 읽는다", () => {
    const briefings = loadBriefings();
    expect(briefings).toHaveLength(1);
    expect(briefings[0]).toMatchObject({ date: "2026-07-15", isSample: true });
    expect(briefings[0].title.length).toBeGreaterThan(0);
    expect(briefings[0].content.startsWith("[SAMPLE]")).toBe(true);
  });
});
