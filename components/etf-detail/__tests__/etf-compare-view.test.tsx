import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EtfCompareView } from "../etf-compare-view";
import type { Etf } from "@/lib/domain/etf-types";

describe("EtfCompareView selectionReasons", () => {
  const mainEtf: Partial<Etf> = {
    ticker: "000001",
    name: "메인 ETF",
    asOfDate: "20260715",
    returns: { "1d": 0, "1w": 0, "2w": 0, "1m": 0, "2m": 0, "3m": 0, "6m": 0, "12m": 0, "24m": 0, "36m": 0, ytd: 0, itd: 0 },
  };
  const peerEtf: Partial<Etf> = {
    ticker: "000002",
    name: "비교 피어 ETF",
    asOfDate: "20260715",
    returns: { "1d": 0, "1w": 0, "2w": 0, "1m": 0, "2m": 0, "3m": 0, "6m": 0, "12m": 0, "24m": 0, "36m": 0, ytd: 0, itd: 0 },
  };

  it("peer-readonly 모드에서 주의(Caution) 배지만 렌더링되고 중복 태그는 생략되어 헤더가 깔끔하게 유지된다", () => {
    const selectionReasons = new Map([
      ["000002", ["같은 반도체 비교그룹", "동일 액티브형 구조", "환헤지/환노출 불일치"]],
    ]);

    render(
      <EtfCompareView
        mainEtf={mainEtf as Etf}
        basket={[peerEtf as Etf]}
        mode="peer-readonly"
        selectionReasons={selectionReasons}
      />
    );

    // Caution badge should render with warning style
    const fxBadge = screen.getByText(/환헤지\/환노출 불일치/);
    expect(fxBadge).toBeDefined();
    expect(fxBadge.className).toContain("border-amber-300");
    expect(fxBadge.className).toContain("text-amber-900");

    // Redundant non-caution tags should be hidden to keep header clean
    expect(screen.queryByText("같은 반도체 비교그룹")).toBeNull();
    expect(screen.queryByText("동일 액티브형 구조")).toBeNull();
  });

  it("비교 종목 간 스마트 장점 칩(최저 보수, 거래대금 1위 등)이 정상 렌더링된다", () => {
    const etfA: Partial<Etf> = {
      ticker: "000001",
      name: "보수 저렴 ETF",
      fee: {
        totalFeePct: 0.05,
        terPct: 0.05,
        otherCostPct: null,
        tradingCostPct: null,
        effectiveDate: null,
        verifiedAt: null,
        verificationStatus: "verified_official",
        primarySourceType: null,
        primarySourceUrl: null,
        dartReceiptNo: null,
        secondarySourceUrl: null,
        sourceNote: null,
      },
      tradeValue: 10000000,
      aum: 50000000,
      asOfDate: "20260715",
      returns: { "1d": 0, "1w": 0, "2w": 0, "1m": 0, "2m": 0, "3m": 0, "6m": 0, "12m": 15.2, "24m": 0, "36m": 0, ytd: 0, itd: 0 },
    };
    const etfB: Partial<Etf> = {
      ticker: "000002",
      name: "유동성 풍부 ETF",
      fee: {
        totalFeePct: 0.35,
        terPct: 0.35,
        otherCostPct: null,
        tradingCostPct: null,
        effectiveDate: null,
        verifiedAt: null,
        verificationStatus: "verified_official",
        primarySourceType: null,
        primarySourceUrl: null,
        dartReceiptNo: null,
        secondarySourceUrl: null,
        sourceNote: null,
      },
      tradeValue: 90000000,
      aum: 200000000,
      asOfDate: "20260715",
      returns: { "1d": 0, "1w": 0, "2w": 0, "1m": 0, "2m": 0, "3m": 0, "6m": 0, "12m": 5.0, "24m": 0, "36m": 0, ytd: 0, itd: 0 },
    };

    render(
      <EtfCompareView
        mainEtf={etfA as Etf}
        basket={[etfB as Etf]}
        mode="peer-readonly"
      />
    );

    const badges = screen.getAllByTestId("smart-advantage-badge");
    expect(badges.length).toBeGreaterThan(0);
    expect(screen.getByText("최저 비용 🥇")).toBeDefined();
    expect(screen.getByText("거래대금 1위 💧")).toBeDefined();
    expect(screen.getByText("순자산 1위 🏛️")).toBeDefined();
    expect(screen.getByText("1년 성과 1위 📈")).toBeDefined();
  });
});
