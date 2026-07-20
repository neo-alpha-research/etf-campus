import { describe, expect, it } from "vitest";

import robots from "../robots";

describe("robots", () => {
  it("allows crawling and advertises the canonical sitemap", () => {
    const value = robots();
    expect(value.rules).toEqual({ userAgent: "*", allow: "/" });
    expect(value.sitemap).toBe("https://etfcampus.kr/sitemap.xml");
    expect(value.host).toBe("https://etfcampus.kr");
  });
});
