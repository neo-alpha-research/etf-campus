import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MarketBriefingGuideModal } from "../market-briefing-guide-modal";

describe("MarketBriefingGuideModal (Inline Guide Card)", () => {
  it("renders when isOpen is true", () => {
    const handleClose = vi.fn();
    const handleNavigate = vi.fn();

    render(
      <MarketBriefingGuideModal
        isOpen={true}
        onClose={handleClose}
        onNavigateToStep={handleNavigate}
      />
    );

    expect(screen.getByRole("region")).toBeInTheDocument();
    expect(screen.getByText("마켓 브리핑 100% 활용 가이드")).toBeInTheDocument();
    expect(screen.getByText("STEP 1~2. 거시 판도 & 시장 체온")).toBeInTheDocument();
    expect(screen.getByText("STEP 3. 자산 배분 & 주도 테마")).toBeInTheDocument();
    expect(screen.getByText("STEP 4~5. 실질 자금 흐름 & 수급 트렌드")).toBeInTheDocument();
    expect(screen.getByText("STEP 6~7. 시장 구조 & 성장 궤적")).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    const handleClose = vi.fn();
    render(<MarketBriefingGuideModal isOpen={false} onClose={handleClose} />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("calls onClose when header close button is clicked", () => {
    const handleClose = vi.fn();
    render(<MarketBriefingGuideModal isOpen={true} onClose={handleClose} />);

    const closeBtn = screen.getByLabelText("가이드 닫기");
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when bottom '가이드 접기' button is clicked", () => {
    const handleClose = vi.fn();
    render(<MarketBriefingGuideModal isOpen={true} onClose={handleClose} />);

    const foldBtn = screen.getByRole("button", { name: "▲ 가이드 접기" });
    fireEvent.click(foldBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("calls onNavigateToStep when a step navigation button is clicked", () => {
    const handleClose = vi.fn();
    const handleNavigate = vi.fn();

    render(
      <MarketBriefingGuideModal
        isOpen={true}
        onClose={handleClose}
        onNavigateToStep={handleNavigate}
      />
    );

    const step3Btn = screen.getByRole("button", { name: /STEP 3 이동/ });
    fireEvent.click(step3Btn);

    expect(handleNavigate).toHaveBeenCalledWith("step-micro");
  });
});

