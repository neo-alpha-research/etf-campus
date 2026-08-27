import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExternalBooksIndex } from "../external-books-index";
import { loadExternalBooks } from "@/lib/content/learning-content";

describe("ExternalBooksIndex", () => {
  it("renders external books and filters by category tabs", () => {
    const books = loadExternalBooks();
    render(<ExternalBooksIndex books={books} />);

    // Default category '초보·입문' books should be visible
    expect(screen.getByText("직장인을 위한 실전 ETF 투자법")).toBeInTheDocument();
    expect(screen.getByText("ETF 무작정 따라하기")).toBeInTheDocument();

    // Check oneLineReview is visible
    expect(
      screen.getByText(/월급날 자동 매수와 계좌 분리로 멘탈을 지키는 현실적인 입문서/),
    ).toBeInTheDocument();

    // Check detail link href is /books/review/[slug]
    const reviewLinks = screen.getAllByRole("link", { name: /리뷰 상세 보기/ });
    const hrefs = reviewLinks.map((link) => link.getAttribute("href"));
    expect(hrefs).toContain("/books/review/practical-etf-for-workers");
    expect(hrefs).toContain("/books/review/etf-blindly-follow");

    // Switch tab to '연금·절세'
    const pensionTab = screen.getByRole("button", { name: /연금·절세/ });
    fireEvent.click(pensionTab);

    // Pension book should now be shown
    expect(screen.getByText("연금저축 & IRP 세금 완벽 가이드")).toBeInTheDocument();
    expect(screen.getByText(/IRP 가능/)).toBeInTheDocument();
  });
});
