import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AsOfDate } from "../as-of-date";
import { AssetClassTag } from "../asset-class-tag";
import { PensionBadge } from "../pension-badge";
import { ReturnCell } from "../return-cell";
import { RiskBadge } from "../risk-badge";

describe("ETF 공용 표시 컴포넌트", () => {
  it("빈 수익률을 대시로 표시하고 수익률 기준을 접근성 라벨에 포함한다", () => {
    render(<ReturnCell value={null} />);
    expect(screen.getByLabelText("-, 가격 기준·분배금 미포함")).toBeInTheDocument();
  });

  it("상승 수익률에 상승 색상 토큰을 적용한다", () => {
    render(<ReturnCell value={1.25} />);
    expect(screen.getByText("+1.25%")).toHaveClass("text-rise");
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
});

