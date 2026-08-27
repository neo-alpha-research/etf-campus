import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExternalBooksIndex } from "../external-books-index";
import { loadExternalBooks } from "@/lib/content/learning-content";

describe("ExternalBooksIndex", () => {
  it("renders external books with TOP rank badges, affiliate links, and filters by category tabs", () => {
    const books = loadExternalBooks();
    render(<ExternalBooksIndex books={books} />);

    // Default category '초보·입문' books should be visible
    expect(screen.getByText("존 보글의 모든 주식을 소유하라")).toBeInTheDocument();
    expect(screen.getByText("ETF 투자 무작정 따라하기")).toBeInTheDocument();
    expect(screen.getByText("투자의 네 기둥")).toBeInTheDocument();

    // Check rank badges
    expect(screen.getAllByText(/TOP 1/).length).toBeGreaterThanOrEqual(1);

    // Check oneLineReview is visible
    expect(
      screen.getByText(/인덱스 펀드와 ETF의 창시자가 밝히는 가장 단순하고 확실한 장기 승리 공식/),
    ).toBeInTheDocument();

    // Check detail link href is /books/review/[slug]
    const reviewLinks = screen.getAllByRole("link", { name: /리뷰 상세 보기/ });
    const hrefs = reviewLinks.map((link) => link.getAttribute("href"));
    expect(hrefs).toContain("/books/review/the-little-book-of-common-sense-investing");
    expect(hrefs).toContain("/books/review/etf-blindly-follow");

    // Check affiliate purchase button
    const purchaseLinks = screen.getAllByRole("link", { name: /도서 구매처 바로가기/ });
    expect(purchaseLinks.length).toBeGreaterThanOrEqual(3);

    // Switch tab to '연금·절세'
    const pensionTab = screen.getByRole("button", { name: /연금·절세/ });
    fireEvent.click(pensionTab);

    // Pension books should now be shown
    expect(screen.getByText("마법의 연금 굴리기")).toBeInTheDocument();
    expect(screen.getByText("박곰희 연금 부자 수업")).toBeInTheDocument();
    expect(screen.getByText("단 3개의 미국 ETF로 은퇴하라")).toBeInTheDocument();

    // Check FTC compliance notice is rendered
    expect(screen.getByText(/제휴 마케팅 활동의 일환으로/)).toBeInTheDocument();
  });
});
