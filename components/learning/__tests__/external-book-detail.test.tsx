import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExternalBookDetail } from "../external-book-detail";
import { findExternalBook } from "@/lib/content/learning-content";

describe("ExternalBookDetail", () => {
  it("renders detail view with pros/cons, one-line review, and cross-sell banner", () => {
    const book = findExternalBook("practical-etf-for-workers");
    expect(book).toBeDefined();
    if (!book) return;

    render(<ExternalBookDetail book={book} />);

    // Header & Meta
    expect(screen.getByRole("heading", { level: 1, name: book.title })).toBeInTheDocument();
    expect(screen.getByText(book.author)).toBeInTheDocument();
    expect(screen.getByText(book.publisher)).toBeInTheDocument();
    expect(screen.getByText(/4.8/)).toBeInTheDocument();
    expect(screen.getByText(/IRP 편입 가능/)).toBeInTheDocument();

    // One-line review
    expect(screen.getByText(new RegExp(book.oneLineReview))).toBeInTheDocument();

    // Pros & Cons
    expect(screen.getByText("주요 장점 (Pros)")).toBeInTheDocument();
    expect(screen.getByText("아쉬운 점 및 유의사항 (Cons)")).toBeInTheDocument();
    expect(screen.getByText(book.pros[0])).toBeInTheDocument();
    expect(screen.getByText(book.cons[0])).toBeInTheDocument();

    // Cross-sell banner
    expect(screen.getByText("함께 읽는 추천 콘텐츠")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /큐레이션 노트 읽기|가이드 읽기/ })).toHaveAttribute(
      "href",
      "/books/principles-before-products",
    );

    // Backtest Ticker CTA (Customer F requirement)
    expect(screen.getByText(/도서 연계 ETF/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ETF 상세 데이터 분석/ })).toHaveAttribute(
      "href",
      "/etf/069500",
    );
  });
});
