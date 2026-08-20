import { describe, expect, it } from "vitest";

import { loadEtfs } from "../etf-repository";
import { getDefaultEtfs, getNewEtfs, isSmallEtf } from "../../domain/etf-visibility";
import { isNewListing } from "../../domain/etf-explorer";

describe("?ㅼ젣 ETF ?곗씠???뚭?", () => {
  const etfs = loadEtfs();

  it("??CSV瑜?ticker 湲곗??쇰줈 鍮좎쭚?놁씠 ?듯빀?쒕떎", () => {
    expect(etfs.length).toBeGreaterThan(1_000);
    expect(new Set(etfs.map((etf) => etf.ticker)).size).toBe(etfs.length);
    const asOfDates = new Set(etfs.map((etf) => etf.asOfDate));

    expect(asOfDates.size).toBe(1);
    expect([...asOfDates][0]).toMatch(/^\d{8}$/);
  });

  it("?몄텧 怨꾩링???쒖옄??湲곗????좎??쒕떎", () => {
    expect(getDefaultEtfs(etfs).length).toBeGreaterThan(0);
    expect(getDefaultEtfs(etfs).every((etf) => etf.aum >= 100_000_000_000)).toBe(true);
    expect(etfs.filter(isSmallEtf).every((etf) => etf.aum < 10_000_000_000)).toBe(true);
  });

  it("?좉퇋 90???뚮옒洹몄? ?좉퇋 硫붾돱 ??곸씠 ?쇱튂?쒕떎", () => {
    const flagged = etfs.filter((etf) => isNewListing(etf));
    expect(getNewEtfs(etfs).map((etf) => etf.ticker).sort()).toEqual(flagged.map((etf) => etf.ticker).sort());
  });

  it("湲곌컙 ?섏씡瑜좎? ?좏슚???レ옄 ?먮뒗 鍮?媛믪쑝濡??좎??쒕떎", () => {
    const returnValues = etfs.flatMap((etf) => Object.values(etf.returns));

    expect(returnValues.length).toBeGreaterThan(0);
    expect(returnValues.every((value) => value === null || Number.isFinite(value))).toBe(true);
  });

  it("?곌툑 ?먯젙? ?덉슜??理쒖쥌 ?곹깭留??ъ슜?쒕떎", () => {
    expect(etfs.every((etf) => ["媛??, "遺덇?", "?뺤씤以?].includes(etf.pension))).toBe(true);
    expect(etfs.filter((etf) => etf.pension === "媛??).length).toBeGreaterThan(0);
    expect(etfs.filter((etf) => etf.pension === "遺덇?").length).toBeGreaterThan(0);
  });

  it("怨듭떇 洹쇨굅 湲곕컲 遺꾨쪟瑜??곌껐?섍퀬 誘명솗???섑뿤吏???④릿??, () => {
    expect(etfs.every((etf) => etf.classification)).toBe(true);
    expect(etfs.every((etf) => etf.classification?.fxHedge !== "誘명솗??)).toBe(true);
    expect(etfs.filter((etf) => etf.classification?.published).length).toBe(etfs.length);
  });
});

