import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadOfficialEtfFeeIndex } from "../etf-fee-registry";

describe("loadOfficialEtfFeeIndex - Unit Logic", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "etf-fee-test-"));
    fs.mkdirSync(path.join(tempDir, "fees"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("preferred 파일의 레코드가 fallback 레코드를 정상적으로 덮어쓴다", () => {
    const fallbackData = [
      {
        ticker: "000010",
        total_fee_pct: 0.15,
        other_cost_pct: 0.05,
        trading_cost_pct: 0.02,
        verification_status: "official_single_source",
      },
      {
        ticker: "000020",
        total_fee_pct: 0.30,
        verification_status: "official_single_source",
      },
    ];

    const preferredData = [
      {
        ticker: "000010",
        total_fee_pct: 0.12, // override
        other_cost_pct: 0.04,
        trading_cost_pct: 0.01,
        verification_status: "verified_official",
        dart_receipt_no: "20260901000123",
      },
    ];

    fs.writeFileSync(
      path.join(tempDir, "fees", "etf_fee_registry_official_single_source.json"),
      JSON.stringify(fallbackData),
      "utf8",
    );
    fs.writeFileSync(
      path.join(tempDir, "fees", "etf_fee_registry.json"),
      JSON.stringify(preferredData),
      "utf8",
    );

    const index = loadOfficialEtfFeeIndex(tempDir);
    expect(index.size).toBe(2);

    // 000010는 preferred 값으로 덮어씌워짐
    const fee10 = index.get("000010");
    expect(fee10).toEqual({
      totalFeePct: 0.12,
      terPct: null,
      otherCostPct: 0.04,
      tradingCostPct: 0.01,
      effectiveDate: null,
      verifiedAt: null,
      verificationStatus: "verified_official",
      primarySourceType: null,
      primarySourceUrl: null,
      dartReceiptNo: "20260901000123",
      secondarySourceUrl: null,
      sourceNote: null,
    });

    // 000020는 fallback 값이 유지됨
    const fee20 = index.get("000020");
    expect(fee20?.totalFeePct).toBe(0.3);
    expect(fee20?.verificationStatus).toBe("official_single_source");
  });

  it("비정상 수치 및 결측치를 null로 안전하게 변환한다", () => {
    const data = [
      {
        ticker: "000030",
        total_fee_pct: "invalid_number",
        other_cost_pct: null,
        trading_cost_pct: NaN,
        verification_status: "unknown_status",
      },
    ];

    fs.writeFileSync(
      path.join(tempDir, "fees", "etf_fee_registry.json"),
      JSON.stringify(data),
      "utf8",
    );

    const index = loadOfficialEtfFeeIndex(tempDir);
    const fee = index.get("000030");
    expect(fee?.totalFeePct).toBeNull();
    expect(fee?.otherCostPct).toBeNull();
    expect(fee?.tradingCostPct).toBeNull();
    expect(fee?.verificationStatus).toBe("seed_unverified");
  });

  it("파일이 없거나 디렉터리가 비어 있어도 크래시 없이 빈 Map을 반환한다", () => {
    const emptyDir = path.join(tempDir, "non_existent");
    const index = loadOfficialEtfFeeIndex(emptyDir);
    expect(index.size).toBe(0);
  });
});

describe("official ETF fee registry - Production Data Invariant Contract", () => {
  const fees = loadOfficialEtfFeeIndex(path.join(process.cwd(), "data"));

  it("공식 수수료 레지스트리가 800종목 이상의 충분한 유니버스를 포괄한다", () => {
    expect(fees.size).toBeGreaterThan(800);
  });

  it("모든 등록 종목 코드는 6자리 영숫자 규격을 준수한다", () => {
    for (const ticker of fees.keys()) {
      expect(ticker).toMatch(/^[0-9A-Z]{6}$/);
    }
  });

  it("수수료율 수치는 null이거나 합리적인 비음수 유한수 범위를 만족한다", () => {
    for (const [, fee] of fees) {
      if (fee.totalFeePct !== null) {
        expect(Number.isFinite(fee.totalFeePct)).toBe(true);
        expect(fee.totalFeePct).toBeGreaterThanOrEqual(0);
        expect(fee.totalFeePct).toBeLessThan(10); // 10% 초과 보수는 데이터 오류 의심
      }
      if (fee.otherCostPct !== null) {
        expect(Number.isFinite(fee.otherCostPct)).toBe(true);
        expect(fee.otherCostPct).toBeGreaterThanOrEqual(0);
        expect(fee.otherCostPct).toBeLessThan(10);
      }
      if (fee.tradingCostPct !== null) {
        expect(Number.isFinite(fee.tradingCostPct)).toBe(true);
        expect(fee.tradingCostPct).toBeGreaterThanOrEqual(0);
        expect(fee.tradingCostPct).toBeLessThan(10);
      }
    }
  });

  it("모든 검증 상태값(verificationStatus)은 정의된 허용 도메인에 속한다", () => {
    const allowedStatuses = new Set([
      "official_single_source",
      "verified_official",
      "pending_review",
      "conflict",
      "stale",
      "seed_unverified",
    ]);

    for (const [, fee] of fees) {
      expect(allowedStatuses.has(fee.verificationStatus)).toBe(true);
    }
  });

  it("실부담비용 3계층(명목+기타+매매)이 완전 공시된 종목 비율이 서킷브레이커(50%) 이상이다", () => {
    let completeCount = 0;
    for (const [, fee] of fees) {
      const hasNominal = fee.totalFeePct !== null;
      const hasOther = fee.otherCostPct !== null || fee.terPct !== null;
      const hasTrade = fee.tradingCostPct !== null;
      if (hasNominal && hasOther && hasTrade) {
        completeCount++;
      }
    }

    const completeRatio = completeCount / fees.size;
    expect(completeRatio).toBeGreaterThan(0.5);
  });
});
