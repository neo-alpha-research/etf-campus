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

  it("peer-readonly 모드에서 사유 배지가 렌더링된다", () => {
    const selectionReasons = new Map([
      ["000002", ["같은 반도체 비교그룹", "동일 액티브형 구조"]],
    ]);

    render(
      <EtfCompareView
        mainEtf={mainEtf as Etf}
        basket={[peerEtf as Etf]}
        mode="peer-readonly"
        selectionReasons={selectionReasons}
      />
    );

    expect(screen.getByText("같은 반도체 비교그룹")).toBeDefined();
    expect(screen.getByText("동일 액티브형 구조")).toBeDefined();
  });

  it("주의 라벨이 경고 스타일로 렌더링된다", () => {
    const selectionReasons = new Map([
      ["000002", ["환헤지/환노출 불일치", "만기 구간 다름", "동일 지수 계열"]],
    ]);

    render(
      <EtfCompareView
        mainEtf={mainEtf as Etf}
        basket={[peerEtf as Etf]}
        mode="peer-readonly"
        selectionReasons={selectionReasons}
      />
    );

    const fxBadge = screen.getByText("환헤지/환노출 불일치");
    expect(fxBadge.className).toContain("border-amber-300");
    expect(fxBadge.className).toContain("text-amber-800");

    const maturityBadge = screen.getByText("만기 구간 다름");
    expect(maturityBadge.className).toContain("border-amber-300");
    expect(maturityBadge.className).toContain("text-amber-800");

    const normalBadge = screen.getByText("동일 지수 계열");
    expect(normalBadge.className).toContain("border-neutral-200");
  });
});
