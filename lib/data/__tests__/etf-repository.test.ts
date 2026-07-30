import { describe, expect, it } from "vitest";

import { loadEtfs } from "../etf-repository";
import { getDefaultEtfs, getNewEtfs, isSmallEtf } from "../../domain/etf-visibility";

describe("실제 ETF 데이터 회귀", () => {
  const etfs = loadEtfs();

  it("세 CSV를 ticker 기준으로 빠짐없이 통합한다", () => {
    expect(etfs.length).toBeGreaterThan(1_000);
    expect(new Set(etfs.map((etf) => etf.ticker)).size).toBe(etfs.length);
    const asOfDates = new Set(etfs.map((etf) => etf.asOfDate));

    expect(asOfDates.size).toBe(1);
    expect([...asOfDates][0]).toMatch(/^\d{8}$/);
  });

  it("노출 계층의 순자산 기준을 유지한다", () => {
    expect(getDefaultEtfs(etfs).length).toBeGreaterThan(0);
    expect(getDefaultEtfs(etfs).every((etf) => etf.aum >= 100_000_000_000)).toBe(true);
    expect(etfs.filter(isSmallEtf).every((etf) => etf.aum < 10_000_000_000)).toBe(true);
  });

  it("신규 90일 플래그와 신규 메뉴 대상이 일치한다", () => {
    const flagged = etfs.filter((etf) => etf.isNew90d);
    expect(flagged.length).toBeGreaterThan(0);
    expect(getNewEtfs(etfs).map((etf) => etf.ticker).sort()).toEqual(flagged.map((etf) => etf.ticker).sort());
  });

  it("기간 수익률은 유효한 숫자 또는 빈 값으로 유지한다", () => {
    const returnValues = etfs.flatMap((etf) => Object.values(etf.returns));

    expect(returnValues.length).toBeGreaterThan(0);
    expect(returnValues.every((value) => value === null || Number.isFinite(value))).toBe(true);
  });

  it("연금 판정은 허용된 최종 상태만 사용한다", () => {
    expect(etfs.every((etf) => ["가능", "불가", "확인중"].includes(etf.pension))).toBe(true);
    expect(etfs.filter((etf) => etf.pension === "확인중").length).toBeGreaterThan(0);
  });
});
