import { describe, expect, it } from "vitest";

import { isBetaSiteUrl, siteConfig } from "./site";

describe("siteConfig", () => {
  it("keeps the service name in one shared config", () => {
    expect(siteConfig.name).toBe("ETF 캠퍼스");
  });

  it("treats the temporary pages.dev host as a beta site", () => {
    expect(isBetaSiteUrl("https://etf-campus.pages.dev")).toBe(true);
    expect(isBetaSiteUrl("https://etfcampus.kr")).toBe(false);
  });
});
