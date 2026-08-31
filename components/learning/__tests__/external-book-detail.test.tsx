import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExternalBookDetail } from "../external-book-detail";
import { loadExternalBooks } from "@/lib/content/learning-content";

describe("ExternalBookDetail", () => {
  it("renders detail view with pros/cons, one-line review, and cross-sell banner", () => {
    const book = loadExternalBooks()[0];
    expect(book).toBeDefined();
    if (!book) return;

    render(<ExternalBookDetail book={book} />);

    // Header & Meta
    expect(screen.getByRole("heading", { level: 1, name: book.title })).toBeInTheDocument();
    expect(screen.getByText(book.author)).toBeInTheDocument();
    expect(screen.getAllByText(new RegExp(book.rating.toFixed(1))).length).toBeGreaterThanOrEqual(1);

    // One-line review
    expect(screen.getAllByText((_, element) => element?.tagName.toLowerCase() === 'p' && (element.textContent?.includes(book.oneLineReview) ?? false)).length).toBeGreaterThanOrEqual(1);

    // Pros & Cons
    expect(screen.getByText("주요 장점 (Pros)")).toBeInTheDocument();
    expect(screen.getByText("아쉬운 점 및 유의사항 (Cons)")).toBeInTheDocument();
    expect(screen.getAllByText(book.pros[0]).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(book.cons[0]).length).toBeGreaterThanOrEqual(1);

    // Affiliate purchase link
    if (book.affiliateUrl) {
      expect(screen.getByRole("link", { name: /도서 구매처 바로가기/ })).toHaveAttribute(
        "href",
        book.affiliateUrl,
      );
    }
  });
});
