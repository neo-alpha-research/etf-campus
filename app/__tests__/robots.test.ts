import { describe, expect, it } from "vitest";

import { createRobots } from "../robots";

describe("robots", () => {
  it("allows crawling and advertises the canonical sitemap", () => {
    const value = createRobots("https://etfcampus.kr", false);
    expect(value.rules).toEqual({ userAgent: "*", allow: "/" });
    expect(value.sitemap).toBe("https://etfcampus.kr/sitemap.xml");
    expect(value.host).toBe("https://etfcampus.kr");
  });

  it("blocks every crawler during the pages.dev beta", () => {
    expect(createRobots("https://etf-campus.pages.dev", true)).toEqual({
      rules: { userAgent: "*", disallow: "/" },
    });
  });
});
