import { describe, expect, it } from "vitest";

import sitemap from "../sitemap";

describe("sitemap", () => {
  it("전체 ETF 상세 URL을 포함한다", () => {
    const entries = sitemap();
    const etfEntries = entries.filter((entry) => entry.url.includes("/etf/"));
    expect(etfEntries).toHaveLength(1_147);
    expect(entries.every((entry) => entry.url.startsWith("https://"))).toBe(true);
  });
});

