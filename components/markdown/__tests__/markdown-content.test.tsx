import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarkdownContent } from "../markdown-content";

describe("MarkdownContent - Common Markdown Renderer", () => {
  it("1. 기본 마크다운 문법(제목, 본문, 목록, 인용문)이 올바르게 렌더링된다", () => {
    const markdown = `
# 제목 1
## 제목 2
### 제목 3

일반 문단입니다.

- 목록 항목 1
- 목록 항목 2

> 블록 인용문입니다.
`;
    render(<MarkdownContent source={markdown} />);

    expect(screen.getByRole("heading", { level: 2, name: "제목 1" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "제목 2" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "제목 3" })).toBeInTheDocument();
    expect(screen.getByText("일반 문단입니다.")).toBeInTheDocument();
    expect(screen.getByText("목록 항목 1")).toBeInTheDocument();
    expect(screen.getByText("블록 인용문입니다.")).toBeInTheDocument();
  });

  it("2. 테이블 렌더링: 모바일 스크롤 힌트(sm:hidden) 및 첫 번째 열 sticky 클래스가 적용된다", () => {
    const tableMarkdown = `
| 헤더 1 | 헤더 2 | 헤더 3 |
|---|---|---|
| 행1-열1 | 행1-열2 | 행1-열3 |
| 행2-열1 | 행2-열2 | 행2-열3 |
`;
    const { container } = render(<MarkdownContent source={tableMarkdown} />);

    // Mobile scroll hint banner
    expect(screen.getByText(/좌우로 밀어서 전체 내용 확인/)).toBeInTheDocument();
    const banner = screen.getByText(/좌우로 밀어서 전체 내용 확인/).closest("div");
    expect(banner?.className).toContain("sm:hidden");

    // Table container and min-w-[640px]
    const table = container.querySelector("table");
    expect(table).toBeInTheDocument();
    expect(table?.className).toContain("min-w-[640px]");

    // Sticky first column classes on th and td
    const ths = container.querySelectorAll("th");
    expect(ths[0].className).toContain("first:sticky");
    expect(ths[0].className).toContain("first:left-0");

    const tds = container.querySelectorAll("td");
    expect(tds[0].className).toContain("first:sticky");
    expect(tds[0].className).toContain("first:left-0");
  });

  it("3. 링크 렌더링: 일반 외부 링크는 noopener target=_blank 속성을 포함한다", () => {
    const linkMarkdown = `[공식 링크](https://example.com)`;
    render(<MarkdownContent source={linkMarkdown} />);

    const link = screen.getByRole("link", { name: "공식 링크" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
