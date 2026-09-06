import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AsOfDate } from "../as-of-date";
import { AssetClassTag } from "../asset-class-tag";
import { PensionBadge } from "../pension-badge";
import { ReturnCell } from "../return-cell";
import { RiskBadge } from "../risk-badge";
import { ClassificationSummary } from "../classification-summary";
import { FeeDoubleStack } from "../fee-double-stack";
import type { Etf } from "@/lib/domain/etf-types";

const classifiedEtf = {
  assetClass: "주식-해외",
  riskType: "normal",
  classification: {
    published: true,
    marketScope: "미국",
    assetClass: "주식",
    assetDetail: "반도체",
    strategy: "일반",
    fxHedge: "환노출",
    reviewStatus: "미검수",
    reviewPriority: "",
    sourceUrl: null,
    evidenceSummary: null,
  },
} as Etf;

describe("ETF 공용 표시 컴포넌트", () => {
  it("빈 수익률을 대시로 표시하고 수익률 기준을 접근성 라벨에 포함한다", () => {
    render(<ReturnCell value={null} />);
    expect(screen.getByLabelText("데이터 없음")).toBeInTheDocument();
  });

  it("상승 수익률에 상승 색상 토큰을 적용한다", () => {
    render(<ReturnCell value={1.25} />);
    expect(screen.getByText("+1.25%")).toHaveClass("text-rise");
  });

  it("표에서는 퍼센트 기호를 숨기되 접근성 라벨에는 유지한다", () => {
    render(<ReturnCell showUnit={false} value={1.25} />);
    expect(screen.getByText("+1.25")).toHaveAccessibleName("+1.25%, 가격 기준·분배금 미포함");
  });

  it("연금 상태와 분류 배지를 그대로 표시한다", () => {
    render(<><PensionBadge status="확인중" /><AssetClassTag assetClass="채권" /><RiskBadge riskType="inverse" /></>);
    expect(screen.getByText("연금 확인중")).toBeInTheDocument();
    expect(screen.getByText("채권")).toBeInTheDocument();
    expect(screen.getByText("인버스")).toBeInTheDocument();
  });

  it("기준일을 명시한다", () => {
    render(<AsOfDate value="20260715" />);
    expect(screen.getByText("기준일 2026.07.15")).toBeInTheDocument();
  });

  it("목록 분류는 지역·자산·환헤지만 한 줄로 요약한다", () => {
    render(<ClassificationSummary etf={classifiedEtf} />);
    expect(screen.getByLabelText("분류: 미국, 주식, 노출")).toBeInTheDocument();
    expect(screen.queryByText("반도체")).not.toBeInTheDocument();
  });

  it("목록 연금 표시는 O·X로 줄이고 확인 중은 시각적으로 비워 둔다", () => {
    render(<><PensionBadge compact status="가능" /><PensionBadge compact status="불가" /><PensionBadge compact status="확인중" /></>);
    expect(screen.getByLabelText("연금 가능")).toHaveTextContent("O");
    expect(screen.getByLabelText("연금 불가")).toHaveTextContent("X");
    expect(screen.getByLabelText("연금 확인 필요")).toBeEmptyDOMElement();
  });

  describe("FeeDoubleStack 컴포넌트", () => {
    it("결산 전 ETF는 결산전 뱃지와 명목 보수를 표시하고 클릭 시 고가독성 툴팁을 토글한다", () => {
      const newEtf = {
        asOfDate: "20260905",
        listingDate: "20260501",
        fee: { totalFeePct: 0.5 },
      };

      render(<FeeDoubleStack etf={newEtf} />);
      const badgeBtn = screen.getByRole("button", { name: /결산전 실부담비용 안내 툴팁 보기/ });
      expect(badgeBtn).toBeInTheDocument();
      expect(badgeBtn).toHaveTextContent("결산전");
      expect(screen.getByText("명목 0.50%")).toBeInTheDocument();

      // Tooltip contains structured header and clear explanation
      expect(screen.getByText("결산 전 ETF 실부담비용 안내")).toBeInTheDocument();
      expect(screen.getByText(/첫 회계연도 결산 전/)).toBeInTheDocument();
      expect(screen.getByText(/금융투자협회 공시 원칙/)).toBeInTheDocument();

      // Click to toggle
      expect(badgeBtn).toHaveAttribute("aria-expanded", "false");
      fireEvent.click(badgeBtn);
      expect(badgeBtn).toHaveAttribute("aria-expanded", "true");
      fireEvent.click(badgeBtn);
      expect(badgeBtn).toHaveAttribute("aria-expanded", "false");
    });

    it("숨은 비용 경고가 있는 합성 ETF는 경고 아이콘과 실부담비용을 표시한다", () => {
      const syntheticEtf = {
        asOfDate: "20260905",
        listingDate: "20240101",
        fee: {
          totalFeePct: 0.2,
          otherCostPct: 0.3,
          tradingCostPct: 0.5, // synthetic: 0.2 + 0.3 + 0.5 = 1.0% (diff 0.8% >= 0.5%)
        },
      };

      render(<FeeDoubleStack etf={syntheticEtf} />);
      expect(screen.getByText("1.00%")).toBeInTheDocument();
      expect(screen.getByText("명목 0.20%")).toBeInTheDocument();
      const warningBtn = screen.getByRole("button", { name: /숨은 비용 주의 안내 툴팁 보기/ });
      expect(warningBtn).toBeInTheDocument();
      expect(screen.getByText("숨은 비용(기타비용·매매수수료) 주의")).toBeInTheDocument();
    });
  });
});
