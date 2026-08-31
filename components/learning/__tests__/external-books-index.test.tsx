import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExternalBooksIndex } from "../external-books-index";
import { loadExternalBooks } from "@/lib/content/learning-content";

describe("ExternalBooksIndex", () => {
  it("renders external books with TOP rank badges, affiliate links, and filters by category tabs", () => {
    const books = loadExternalBooks();
    render(<ExternalBooksIndex books={books} />);

    // Check rank badges
    expect(screen.getAllByText(/TOP 1/).length).toBeGreaterThanOrEqual(1);

    // Check detail link href is /books/review/[slug]
    const reviewLinks = screen.getAllByRole("link", { name: /리뷰 상세 보기/ });
    expect(reviewLinks.length).toBeGreaterThanOrEqual(3);

    // Check affiliate purchase button
    const purchaseLinks = screen.getAllByRole("link", { name: /도서 구매처 바로가기/ });
    expect(purchaseLinks.length).toBeGreaterThanOrEqual(3);

    // Switch tab to '연금·절세'
    const pensionTab = screen.getByRole("button", { name: /연금·절세/ });
    fireEvent.click(pensionTab);

    // Check pension tab active
    expect(screen.getAllByText(/연금·절세/).length).toBeGreaterThanOrEqual(1);

    // Check FTC compliance notice is rendered
    expect(screen.getByText(/제휴 마케팅 활동의 일환으로/)).toBeInTheDocument();
  });
});
