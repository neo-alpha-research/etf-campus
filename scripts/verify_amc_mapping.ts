import { loadEtfs } from "../lib/data/etf-repository";
import { resolveIssuer, BRAND_TO_AMC, LEGACY_BRAND_TO_AMC } from "../lib/data/etf-amc-mapping";

const etfs = loadEtfs();
const issuerCounts = new Map();
const unmapped = [];
const conflicts = [];

// verify conflicts
const brandToIssuer = new Map();
for (const [brand, info] of Object.entries(BRAND_TO_AMC)) {
  brandToIssuer.set(brand, info.issuerId);
}
for (const [brand, info] of Object.entries(LEGACY_BRAND_TO_AMC)) {
  if (brandToIssuer.has(brand) && brandToIssuer.get(brand) !== info.issuerId) {
    conflicts.push(`Conflict: ${brand} maps to both ${brandToIssuer.get(brand)} and ${info.issuerId}`);
  }
}

for (const etf of etfs) {
  if (etf.issuer.issuerStatus === "needs_review" || etf.issuer.issuerId === "unknown") {
    unmapped.push(etf);
  }
  const count = issuerCounts.get(etf.issuer.issuerName) || 0;
  issuerCounts.set(etf.issuer.issuerName, count + 1);
}

console.log("=== ETF 운용사별 종목 수 ===");
const sorted = Array.from(issuerCounts.entries()).sort((a, b) => b[1] - a[1]);
sorted.forEach(([name, count]) => {
  console.log(`${name}: ${count}종목`);
});

console.log(`\n=== 미매핑 종목 수: ${unmapped.length} ===`);
unmapped.forEach(e => console.log(`[${e.ticker}] ${e.name} (추출된 브랜드: ${e.issuer.brand})`));

console.log(`\n=== Conflict 오류: ${conflicts.length} ===`);
conflicts.forEach(c => console.log(c));
