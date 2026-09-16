import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GlobalQuickSearch } from "../global-quick-search";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe("GlobalQuickSearch", () => {
  it("isOpen=false 일 때는 모달이 렌더링되지 않는다", () => {
    const { container } = render(<GlobalQuickSearch isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("isOpen=true 일 때 모달과 기본 벤치마크 ETF 및 검색창이 정상 렌더링된다", () => {
    render(<GlobalQuickSearch isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "ETF 통합 퀵 검색" })).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByText("대표 인기 ETF")).toBeInTheDocument();
    expect(screen.getByText("KODEX 200")).toBeInTheDocument();
    expect(screen.getByText("TIGER 미국S&P500")).toBeInTheDocument();
  });

  it("ESC 키를 누르면 onClose 콜백이 호출된다", () => {
    const handleClose = vi.fn();
    render(<GlobalQuickSearch isOpen={true} onClose={handleClose} />);
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
