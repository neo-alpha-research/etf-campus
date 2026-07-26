import { describe, expect, it } from "vitest";

import { siteConfig } from "./site";

describe("siteConfig", () => {
  it("keeps the service name in one shared config", () => {
    expect(siteConfig.name).toBe("ETF 캠퍼스");
  });
});
