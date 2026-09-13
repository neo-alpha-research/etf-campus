import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EtfCompareChart } from "../etf-compare-chart";
import type { Etf } from "@/lib/domain/etf-types";

describe("EtfCompareChart Readability & Rendering", () => {
  const mockBasket: Partial<Etf>[] = [
    {
      ticker: "000001",
      name: "반도체 알파 ETF",
      asOfDate: "2026-07-15",
      returns: {
        "1d": 1.25,
        "1w": 3.48,
        "2w": 5.12,
        "1m": 12.38,
        "2m": 18.9,
        "3m": 25.41,
        "6m": 45.67,
        "12m": 88.92,
        "24m": 110.5,
        "36m": 144.38,
        ytd: 35.1,
        itd: 200.5,
      },
    },
    {
      ticker: "000002",
      name: "반도체 베타 ETF",
      asOfDate: "2026-07-15",
      returns: {
        "1d": 0.82,
        "1w": 2.11,
        "2w": 4.05,
        "1m": 9.82,
        "2m": 15.2,
        "3m": 20.15,
        "6m": 38.45,
        "12m": 72.31,
        "24m": 95.2,
        "36m": 120.15,
        ytd: 28.4,
        itd: 160.0,
      },
    },
  ];

  describe("모바일 우선 랭킹 뷰 (기본 뷰)", () => {
    it("기본으로 랭킹 뷰가 활성화되며 1위~2위 순위 배지와 종목명이 렌더링된다", () => {
      render(<EtfCompareChart basket={mockBasket as Etf[]} isTrMode={false} />);
      
      expect(screen.getByText("⚡ 랭킹 뷰")).toBeDefined();
      expect(screen.getByText("🥇 1위")).toBeDefined();
      expect(screen.getByText("🥈 2위")).toBeDefined();
      expect(screen.getByText("반도체 알파 ETF")).toBeDefined();
      expect(screen.getByText("반도체 베타 ETF")).toBeDefined();
      expect(screen.getByText("+12.38%")).toBeDefined();
      expect(screen.getByText("+9.82%")).toBeDefined();
    });

    it("기간 탭(3개월) 클릭 시 해당 기간의 수익률로 갱신된다", () => {
      render(<EtfCompareChart basket={mockBasket as Etf[]} isTrMode={false} />);
      
      const tab3m = screen.getByText("3개월");
      fireEvent.click(tab3m);

      // 3m returns: 25.41%, 20.15%
      expect(screen.getByText("+25.41%")).toBeDefined();
      expect(screen.getByText("+20.15%")).toBeDefined();
    });
  });

  describe("전체 기간 그룹 뷰 (시계열 비교 뷰)", () => {
    it("SVG viewBox가 1000 380으로 렌더링되어 세로 가용 공간이 대폭 확장된다", () => {
      const { container } = render(
        <EtfCompareChart basket={mockBasket as Etf[]} isTrMode={false} defaultChartType="grouped" />
      );
      const chartSvg = container.querySelector("svg[viewBox='0 0 1000 380']");
      expect(chartSvg).toBeDefined();
      expect(chartSvg?.getAttribute("viewBox")).toBe("0 0 1000 380");
    });

    it("수익률 텍스트가 소수점 1자리(+12.4, +9.8 등)로 포맷팅되어 렌더링된다", () => {
      render(
        <EtfCompareChart basket={mockBasket as Etf[]} isTrMode={false} defaultChartType="grouped" />
      );
      
      // 1m return of mockBasket[0] is 12.38 -> +12.4
      const labelA = screen.getByText("+12.4");
      expect(labelA).toBeDefined();
      expect(labelA.getAttribute("stroke")).toBe("#ffffff");
      expect(labelA.getAttribute("stroke-width")).toBe("2.5");
      expect(labelA.getAttribute("paint-order")).toBe("stroke fill");

      // 1m return of mockBasket[1] is 9.82 -> +9.8
      const labelB = screen.getByText("+9.8");
      expect(labelB).toBeDefined();
    });

    it("성과 우수 종목에 트로피(🏆) 아이콘이 렌더링된다", () => {
      const { container } = render(
        <EtfCompareChart basket={mockBasket as Etf[]} isTrMode={false} defaultChartType="grouped" />
      );
      const trophies = container.querySelectorAll("text");
      const trophyTexts = Array.from(trophies).filter((t) => t.textContent?.includes("🏆"));
      expect(trophyTexts.length).toBeGreaterThan(0);
    });
  });

  it("TR 모드 활성화 시 헤더에 TR 단위 설명이 반영된다", () => {
    render(<EtfCompareChart basket={mockBasket as Etf[]} isTrMode={true} />);
    expect(screen.getByText(/배당재투자 TR 기준/)).toBeDefined();
  });
});
