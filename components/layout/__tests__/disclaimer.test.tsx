import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LegalDisclaimer, DISCLAIMER_TEXTS } from "../disclaimer";

describe("LegalDisclaimer Component", () => {
  it("renders standard disclaimer by default", () => {
    render(<LegalDisclaimer />);
    expect(screen.getByRole("complementary")).toHaveTextContent(DISCLAIMER_TEXTS.standard.title);
    expect(screen.getByRole("complementary")).toHaveTextContent("모든 투자 결정과 그에 따른 손익의 최종 책임은 투자자 본인에게 있습니다");
  });

  it("renders strict variant correctly", () => {
    render(<LegalDisclaimer variant="strict" />);
    expect(screen.getByRole("complementary")).toHaveTextContent(DISCLAIMER_TEXTS.strict.title);
    expect(screen.getByRole("complementary")).toHaveTextContent("자본시장법상 투자자문업 또는 유사투자자문업을 영위하지 않으며");
  });

  it("renders compact variant correctly", () => {
    render(<LegalDisclaimer variant="compact" />);
    expect(screen.getByRole("complementary")).toHaveTextContent(DISCLAIMER_TEXTS.compact.title);
    expect(screen.getByRole("complementary")).toHaveTextContent("ETF Campus는 투자 권유 및 종목 추천을 하지 않습니다");
  });
});
