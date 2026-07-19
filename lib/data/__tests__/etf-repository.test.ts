import { describe, expect, it } from "vitest";

import { loadEtfs } from "../etf-repository";
import { getDefaultEtfs, getNewEtfs, isSmallEtf } from "../../domain/etf-visibility";

describe("실제 ETF 데이터 회귀", () => {
  const etfs = loadEtfs();

  it("세 CSV를 ticker 기준으로 빠짐없이 통합한다", () => {
    expect(etfs).toHaveLength(1_147);
    expect(new Set(etfs.map((etf) => etf.ticker)).size).toBe(1_147);
  });

  it("확정된 노출 계층 수량을 유지한다", () => {
    expect(getDefaultEtfs(etfs)).toHaveLength(604);
    expect(etfs.filter(isSmallEtf)).toHaveLength(158);
  });

  it("신규 플래그와 신규 메뉴 대상 수량을 유지한다", () => {
    expect(etfs.filter((etf) => etf.isNew3m)).toHaveLength(66);
    expect(getNewEtfs(etfs)).toHaveLength(60);
  });

  it("연금 최종 판정을 사용하며 확인중은 한 종목이다", () => {
    expect(etfs.filter((etf) => etf.pension === "확인중")).toHaveLength(1);
  });
});

