import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadOfficialEtfFeeIndex } from "../etf-fee-registry";

describe("official ETF fee registry", () => {
  it("returns only officially verified records and preserves the verified cost components", () => {
    const fees = loadOfficialEtfFeeIndex(path.join(process.cwd(), "data"));
    const kiwoom = fees.get("0137V0");

    expect(fees.size).toBeGreaterThan(0);
    expect(kiwoom).toMatchObject({
      verificationStatus: "verified_official",
      totalFeePct: 0.12,
      otherCostPct: 1.4057,
      tradingCostPct: 1.6141,
      dartReceiptNo: "20260305000919",
    });
  });
});
