import { describe, it, expect } from "vitest";
import { resolveIssuer, BRAND_TO_AMC, LEGACY_BRAND_TO_AMC } from "../etf-amc-mapping";
import { loadEtfs } from "../etf-repository";

describe("ETF AMC Mapping Logic", () => {
  it("resolves current brands correctly", () => {
    expect(resolveIssuer("069500", "KR7069500007", "KODEX 200")).toMatchObject({
      issuerId: "samsung",
      issuerName: "삼성자산운용",
      brand: "KODEX",
      issuerStatus: "mapped_brand"
    });
    expect(resolveIssuer("123456", "ISIN1", "TIGER 미국S&P500")).toMatchObject({
      issuerId: "miraeasset",
      brand: "TIGER"
    });
  });

  it("resolves legacy brands correctly", () => {
    expect(resolveIssuer("123456", "ISIN2", "KBSTAR 200")).toMatchObject({
      issuerId: "kb",
      issuerName: "KB자산운용",
      brand: "KBSTAR",
      issuerStatus: "mapped_legacy_brand"
    });
    expect(resolveIssuer("123456", "ISIN3", "KINDEX 200")).toMatchObject({
      issuerId: "koreainvestment",
      brand: "KINDEX"
    });
  });

  it("extracts brand safely considering NFKC normalization", () => {
    // Some strings might have weird spaces
    expect(resolveIssuer("123456", "ISIN4", " RISE  200")).toMatchObject({
      issuerId: "kb",
      brand: "RISE"
    });
  });

  it("verifies all registered ETFs have a valid AMC mapping (0 unmapped)", () => {
    // This runs against the actual data file
    const etfs = loadEtfs();
    
    // Quick check to ensure we loaded the data
    expect(etfs.length).toBeGreaterThanOrEqual(1171);

    const unmapped = etfs.filter(e => e.issuer.issuerStatus === "needs_review" || e.issuer.issuerId === "unknown");
    
    if (unmapped.length > 0) {
      console.error("Unmapped ETFs found:");
      unmapped.forEach(e => console.error(`- [${e.ticker}] ${e.name} (Brand extracted: ${e.issuer.brand})`));
    }

    expect(unmapped.length).toBe(0);
  });

  it("ensures no brand maps to two different AMCs", () => {
    const brandToIssuer = new Map<string, string>();
    for (const [brand, info] of Object.entries(BRAND_TO_AMC)) {
      expect(brandToIssuer.has(brand)).toBe(false);
      brandToIssuer.set(brand, info.issuerId);
    }
    for (const [brand, info] of Object.entries(LEGACY_BRAND_TO_AMC)) {
      if (brandToIssuer.has(brand)) {
        // legacy brand shouldn't conflict with current brand conceptually unless intentional, but they should map to same?
        // Actually, they are distinct brand names (KBSTAR vs RISE).
        // Let's just ensure no duplicated keys between them.
        throw new Error(`Conflict: ${brand} is defined in both CURRENT and LEGACY registries.`);
      }
      brandToIssuer.set(brand, info.issuerId);
    }
  });
});
