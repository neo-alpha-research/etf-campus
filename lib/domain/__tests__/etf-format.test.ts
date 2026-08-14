import { describe, expect, it } from "vitest";

import {
  formatAumNumber,
  formatAsOfDate,
  formatMoney,
  formatMoneyNumber,
  formatReturn,
  formatReturnNumber,
  formatTradeValueNumber,
  formatWonNumber,
} from "../etf-format";

describe("ETF 표시 포맷", () => {
  it("빈 수익률은 추정하지 않고 대시로 표시한다", () => {
    expect(formatReturn(null)).toBe("-");
  });

  it("수익률에 부호와 퍼센트를 표시한다", () => {
    expect(formatReturn(2.34)).toBe("+2.34%");
    expect(formatReturn(-0.5)).toBe("-0.50%");
    expect(formatReturn(0)).toBe("0.00%");
    expect(formatReturnNumber(2.34)).toBe("+2.34");
  });

  it("원 단위 금액을 읽기 쉬운 한국식 단위로 표시한다", () => {
    expect(formatMoney(123_456_000_000)).toBe("1,235억 원");
    expect(formatMoney(987_654_321)).toBe("10억 원");
    expect(formatMoneyNumber(987_654_321)).toBe("10");
    expect(formatTradeValueNumber(23_456_789_000)).toBe("234.6");
    expect(formatTradeValueNumber(3_000_000_000)).toBe("30.0");
    expect(formatAumNumber(9_876_543_210)).toBe("99");
    expect(formatAumNumber(9_840_000_000)).toBe("98");
    expect(formatWonNumber(12_345)).toBe("12,345");
  });

  it("기준일을 YYYY.MM.DD 형식으로 표시한다", () => {
    expect(formatAsOfDate("20260715")).toBe("2026.07.15");
  });
});
