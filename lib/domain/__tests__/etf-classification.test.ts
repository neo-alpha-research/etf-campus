import { describe, expect, it } from "vitest";

import { getClassificationFields } from "../etf-classification";
import type { Etf } from "../etf-types";

function classified(fxHedge: string | null, riskType: Etf["riskType"] = "normal"): Etf {
  return {
    assetClass: "주식-해외",
    riskType,
    classification: {
      published: true,
      marketScope: "미국",
      assetClass: "주식",
      assetDetail: null,
      strategy: null,
      fxHedge,
      reviewStatus: "자동확정",
      reviewPriority: "",
      sourceUrl: null,
      evidenceSummary: null,
    },
  } as Etf;
}

describe("ETF 분류 표시", () => {
  it.each([
    ["환노출", "노출"],
    ["환헤지", "헤지"],
    ["부분 헤지", "부분"],
    ["탄력적 헤지", "탄력"],
  ])("%s를 짧은 환헤지 값 %s로 표시한다", (source, expected) => {
    expect(getClassificationFields(classified(source)).fxHedge).toBe(expected);
  });

  it("확인하지 못한 환헤지는 비우고 파생 구조는 자산과 분리한다", () => {
    const fields = getClassificationFields(classified("미확인", "inverse"));
    expect(fields.fxHedge).toBeNull();
    expect(fields.riskLabel).toBe("인버스");
  });
});
