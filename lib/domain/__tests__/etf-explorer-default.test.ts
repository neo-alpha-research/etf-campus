import { describe, expect, it } from "vitest";

import { DEFAULT_EXPLORER_STATE, parseExplorerQuery } from "../etf-explorer";

describe("ETF 탐색 기본값", () => {
  it("최초 접속 시 1일 수익률을 선택한다", () => {
    expect(DEFAULT_EXPLORER_STATE.period).toBe("1d");
    expect(parseExplorerQuery(new URLSearchParams()).period).toBe("1d");
  });
});
