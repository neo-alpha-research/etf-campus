import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InfoTooltip } from "../info-tooltip";

describe("InfoTooltip", () => {
  it("기본 ⓘ 버튼 트리거와 툴팁 팝업을 렌더링하며 whitespace-normal과 break-keep 클래스를 포함한다", () => {
    render(
      <InfoTooltip
        title="실부담비용이란?"
        badge="실제 차감"
        content="광고에 표기되는 기본 보수 외의 모든 숨은 비용을 합산한 수치입니다."
        tip="💡 팁: 동일 지수 추종 시 실부담비용이 낮은 ETF가 유리합니다."
      />
    );

    const button = screen.getByRole("button", { name: /도움말 보기/i });
    expect(button).toBeInTheDocument();

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip.className).toContain("whitespace-normal");
    expect(tooltip.className).toContain("break-keep");
    expect(tooltip.className).toContain("max-w-[calc(100vw-32px)]");

    expect(screen.getByText("실부담비용이란?")).toBeInTheDocument();
    expect(screen.getByText("실제 차감")).toBeInTheDocument();
    expect(screen.getByText(/모든 숨은 비용을 합산한 수치/)).toBeInTheDocument();
  });

  it("트리거 클릭 시 isOpen 상태가 토글되며 aria-expanded 속성이 업데이트된다", () => {
    render(
      <InfoTooltip
        title="괴리율"
        content="시장 가격과 순자산가치 간의 차이입니다."
      >
        <span>괴리율 안내</span>
      </InfoTooltip>
    );

    const button = screen.getByRole("button", { name: /괴리율 안내/i });
    expect(button).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("Escape 키 입력 시 열려있는 툴팁이 닫힌다", () => {
    render(
      <InfoTooltip
        title="추적오차율"
        content="지수 추종 정밀도 지표입니다."
      />
    );

    const button = screen.getByRole("button", { name: /도움말 보기/i });
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(button).toHaveAttribute("aria-expanded", "false");
  });
});
