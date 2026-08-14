import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IssuerMultiSelect } from "../issuer-multi-select";

const allIssuers = [
  { id: "samsung", name: "삼성자산운용", count: 240 },
  { id: "miraeasset", name: "미래에셋자산운용", count: 200 },
  { id: "kb", name: "KB자산운용", count: 150 },
  { id: "koreainvestment", name: "한국투자신탁운용", count: 120 },
  { id: "timefolio", name: "타임폴리오자산운용", count: 50 },
  { id: "kiwoom", name: "키움투자자산운용", count: 100 },
];

describe("IssuerMultiSelect", () => {
  it("기본 상태에서 전체 목록이 펼쳐져 있지 않음", () => {
    render(<IssuerMultiSelect allIssuers={allIssuers} selectedIds={[]} onChange={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /전체 운용사/ });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("버튼 클릭 시 목록 열림", () => {
    render(<IssuerMultiSelect allIssuers={allIssuers} selectedIds={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /전체 운용사/ }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(6);
  });

  it("운용사명 검색", () => {
    render(<IssuerMultiSelect allIssuers={allIssuers} selectedIds={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /전체 운용사/ }));
    const input = screen.getByPlaceholderText(/운용사 또는 ETF 브랜드 검색/);
    fireEvent.change(input, { target: { value: "삼성" } });
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("삼성자산운용");
  });

  it("현재 브랜드 검색", () => {
    render(<IssuerMultiSelect allIssuers={allIssuers} selectedIds={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /전체 운용사/ }));
    const input = screen.getByPlaceholderText(/운용사 또는 ETF 브랜드 검색/);
    fireEvent.change(input, { target: { value: "KODEX" } }); // KODEX is samsung
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("삼성자산운용");
  });

  it("과거 브랜드 검색", () => {
    render(<IssuerMultiSelect allIssuers={allIssuers} selectedIds={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /전체 운용사/ }));
    const input = screen.getByPlaceholderText(/운용사 또는 ETF 브랜드 검색/);
    fireEvent.change(input, { target: { value: "KBSTAR" } }); // KBSTAR is kb legacy
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("KB자산운용");
  });

  it("다중 선택", () => {
    const onChange = vi.fn();
    render(<IssuerMultiSelect allIssuers={allIssuers} selectedIds={["samsung"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /삼성자산운용/ }));
    const miraeCheckbox = screen.getByRole("checkbox", { name: /미래에셋자산운용/ });
    fireEvent.click(miraeCheckbox);
    expect(onChange).toHaveBeenCalledWith(["samsung", "miraeasset"]);
  });

  it("모두 해제", () => {
    const onChange = vi.fn();
    render(<IssuerMultiSelect allIssuers={allIssuers} selectedIds={["samsung", "miraeasset"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /삼성자산운용 외 1곳/ }));
    fireEvent.click(screen.getByRole("button", { name: "모두 해제" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("선택된 운용사 상단 정렬 및 종목 수 내림차순 정렬", () => {
    render(<IssuerMultiSelect allIssuers={allIssuers} selectedIds={["timefolio"]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /타임폴리오자산운용/ }));
    const options = screen.getAllByRole("option");
    
    // timefolio is selected, so it should be first despite having only 50 count
    expect(options[0]).toHaveTextContent("타임폴리오자산운용");
    
    // The rest should be sorted by count (240, 200, 150, 120, 100)
    expect(options[1]).toHaveTextContent("삼성자산운용");
    expect(options[2]).toHaveTextContent("미래에셋자산운용");
    expect(options[3]).toHaveTextContent("KB자산운용");
    expect(options[4]).toHaveTextContent("한국투자신탁운용");
    expect(options[5]).toHaveTextContent("키움투자자산운용");
  });

  it("Escape와 외부 클릭으로 닫기", () => {
    render(<IssuerMultiSelect allIssuers={allIssuers} selectedIds={[]} onChange={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /전체 운용사/ });
    
    // Open
    fireEvent.click(btn);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    
    // Escape
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    // Open again
    fireEvent.click(btn);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("모바일 패널 동작 (배경 렌더링)", () => {
    render(<IssuerMultiSelect allIssuers={allIssuers} selectedIds={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /전체 운용사/ }));
    // Mobile backdrop exists
    const backdrops = document.querySelectorAll(".fixed.inset-0.z-40");
    expect(backdrops.length).toBe(1);
    
    // Click backdrop
    fireEvent.click(backdrops[0]);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
