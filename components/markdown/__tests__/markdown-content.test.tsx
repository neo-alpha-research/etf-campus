import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarkdownContent } from "../markdown-content";

describe("MarkdownContent", () => {
  it("제목·목록·표를 렌더링한다", () => {
    render(<MarkdownContent source={"## 제목\n\n- 항목\n\n| 구분 | 내용 |\n|---|---|\n| A | B |"} />);
    expect(screen.getByRole("heading", { name: "제목" })).toBeInTheDocument();
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("raw HTML과 script를 DOM으로 해석하지 않는다", () => {
    const { container } = render(<MarkdownContent source={'<script>alert("x")</script><div>raw html</div>'} />);
    expect(container.querySelector("script")).toBeNull();
    expect(screen.queryByText("raw html")).not.toBeInTheDocument();
  });
});
