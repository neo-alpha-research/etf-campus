import { describe, expect, it } from "vitest";

import {
  BOOK_COVER_BASE_PATH,
  EXTERNAL_BOOK_CATEGORIES,
  findBook,
  findExternalBook,
  findGuide,
  loadBooks,
  loadExternalBooks,
  loadGuides,
  resolveBookCoverUrl,
} from "../learning-content";

describe("learning content", () => {
  it("loads validated learning-example guides with style, asset-class, and safety metadata", () => {
    const guides = loadGuides();
    expect(guides.length).toBeGreaterThanOrEqual(4);
    expect(guides.every((guide) => guide.isLearningExample && guide.styles.length > 0 && guide.assetClasses.length > 0)).toBe(true);
    expect(guides.every((guide) => guide.contentRole === "learning-example" && guide.scenarioBasis === "fictional" && guide.asOf === "not-applicable")).toBe(true);
    expect(findGuide(guides[0].slug)?.title).toBe(guides[0].title);
  });

  it("loads curated learning-example books with reader context and source metadata", () => {
    const books = loadBooks();
    expect(books.length).toBeGreaterThanOrEqual(6);
    expect(books.every((book) => book.isLearningExample && book.reader && book.topic)).toBe(true);

    const momentumBook = findBook("momentum-etf-system");
    expect(momentumBook).toBeDefined();
    expect(momentumBook?.seriesIndex).toBe(1);
    expect(momentumBook?.status).toBe("published");
    expect(momentumBook?.coverImage).toBe("/images/books/momentum-cover.jpg");

    const assetAllocationBook = findBook("index-asset-allocation");
    expect(assetAllocationBook).toBeDefined();
    expect(assetAllocationBook?.seriesIndex).toBe(2);
    expect(assetAllocationBook?.status).toBe("coming-soon");

    const dividendBook = findBook("dividend-cashflow");
    expect(dividendBook).toBeDefined();
    expect(dividendBook?.seriesIndex).toBe(3);
    expect(dividendBook?.status).toBe("coming-soon");
  });

  it("loads validated external book reviews with rating, pros/cons, and compliance metadata", () => {
    const externalBooks = loadExternalBooks();
    expect(externalBooks.length).toBe(4);
    expect(BOOK_COVER_BASE_PATH).toBe("/images/books");

    for (const book of externalBooks) {
      expect(book.kind).toBe("external-book");
      expect(book.isLearningExample).toBe(true);
      expect(book.contentRole).toBe("learning-example");
      expect(EXTERNAL_BOOK_CATEGORIES).toContain(book.category);
      expect(book.rating).toBeGreaterThanOrEqual(0);
      expect(book.rating).toBeLessThanOrEqual(5);
      expect(book.reviewCount).toBeGreaterThanOrEqual(0);
      expect(typeof book.irpEligible).toBe("boolean");
      expect(book.oneLineReview.length).toBeGreaterThan(0);
      expect(book.pros.length).toBeGreaterThanOrEqual(1);
      expect(book.cons.length).toBeGreaterThanOrEqual(1);
      expect(book.ratingSource.length).toBeGreaterThan(0);
      expect(book.content.length).toBeGreaterThan(0);
      if (book.backtestTicker) {
        expect(book.backtestTicker).toMatch(/^\d{6}$/);
      }
    }

    const firstBook = externalBooks[0];
    const found = findExternalBook(firstBook.slug);
    expect(found).toBeDefined();
    expect(found?.title).toBe(firstBook.title);
    expect(found?.oneLineReview).toBe(firstBook.oneLineReview);
    expect(findExternalBook("non-existent-slug")).toBeUndefined();
  });

  it("handles non-existent or empty directories gracefully and enforces validation rules", () => {
    // Verify find functions handle empty/not found properly
    expect(findBook("no-such-book")).toBeUndefined();
    expect(findGuide("no-such-guide")).toBeUndefined();
    expect(findExternalBook("no-such-review")).toBeUndefined();
  });

  it("resolves book cover paths correctly via resolveBookCoverUrl", () => {
    expect(resolveBookCoverUrl(undefined)).toBeNull();
    expect(resolveBookCoverUrl("")).toBeNull();
    expect(resolveBookCoverUrl("practical-etf.png")).toBe("/images/books/practical-etf.png");
    expect(resolveBookCoverUrl("/images/custom/book.png")).toBe("/images/custom/book.png");
    expect(resolveBookCoverUrl("https://r2.etfcampus.com/book.png")).toBe("https://r2.etfcampus.com/book.png");
  });
});
