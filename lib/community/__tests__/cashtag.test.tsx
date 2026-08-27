import { describe, expect, it } from "vitest";
import { parseCashtags } from "../cashtag";

describe("Cashtag parsing and segment splitting", () => {
  it("parses Korean 6-digit ETF tickers accurately", () => {
    const text = "이 포트폴리오는 $069500 및 $458730 중심으로 구성되었습니다.";
    const segments = parseCashtags(text);

    expect(segments).toEqual([
      { type: "text", value: "이 포트폴리오는 " },
      { type: "cashtag", ticker: "069500", raw: "$069500" },
      { type: "text", value: " 및 " },
      { type: "cashtag", ticker: "458730", raw: "$458730" },
      { type: "text", value: " 중심으로 구성되었습니다." },
    ]);
  });

  it("parses US and global tickers ($SPY, $QQQ)", () => {
    const text = "글로벌 자산배분 $SPY 그리고 $QQQ 비교";
    const segments = parseCashtags(text);

    expect(segments).toEqual([
      { type: "text", value: "글로벌 자산배분 " },
      { type: "cashtag", ticker: "SPY", raw: "$SPY" },
      { type: "text", value: " 그리고 " },
      { type: "cashtag", ticker: "QQQ", raw: "$QQQ" },
      { type: "text", value: " 비교" },
    ]);
  });

  it("does not treat dollar currency amounts as cashtags", () => {
    const text = "현재 수수료는 $100 정도이며 최저는 $50 입니다.";
    const segments = parseCashtags(text);

    expect(segments).toEqual([
      { type: "text", value: "현재 수수료는 $100 정도이며 최저는 $50 입니다." },
    ]);
  });

  it("extracts ticker with trailing punctuation", () => {
    const text = "추천 종목: $069500, $SPY.";
    const segments = parseCashtags(text);

    expect(segments).toEqual([
      { type: "text", value: "추천 종목: " },
      { type: "cashtag", ticker: "069500", raw: "$069500" },
      { type: "text", value: ", " },
      { type: "cashtag", ticker: "SPY", raw: "$SPY" },
      { type: "text", value: "." },
    ]);
  });

  it("handles empty or non-cashtag strings", () => {
    expect(parseCashtags("")).toEqual([]);
    expect(parseCashtags("일반 텍스트 문장")).toEqual([
      { type: "text", value: "일반 텍스트 문장" },
    ]);
  });
});
