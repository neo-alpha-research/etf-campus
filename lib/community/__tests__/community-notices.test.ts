import { describe, expect, it } from "vitest";

import { COMMUNITY_BOARD_NOTICES, getCommunityBoardNotice } from "../community-notices";

describe("community board notices", () => {
  it("defines a learning notice for each approved community board", () => {
    expect(Object.keys(COMMUNITY_BOARD_NOTICES)).toEqual([
      "pension-etf-qna",
      "etf-questions",
      "challenge-30",
      "feedback",
    ]);
    expect(Object.values(COMMUNITY_BOARD_NOTICES).every((notice) => notice.title.length > 0 && notice.body.length > 0)).toBe(true);
  });

  it("returns a board-specific notice and keeps the all-board view neutral", () => {
    expect(getCommunityBoardNotice("pension-etf-qna")?.title).toContain("연금 ETF Q&A");
    expect(getCommunityBoardNotice("")).toBeNull();
  });

  it("explains prohibited behavior without giving an investment action instruction", () => {
    const copy = Object.values(COMMUNITY_BOARD_NOTICES).map((notice) => `${notice.title} ${notice.body}`).join(" ");
    expect(copy).toContain("허용하지 않습니다");
    expect(copy).not.toMatch(/지금 사세요|반드시 사세요|반드시 팔아야|수익을 보장합니다/);
  });
});
