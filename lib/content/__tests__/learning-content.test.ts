import { describe, expect, it } from "vitest";

import { findBook, findGuide, loadBooks, loadGuides } from "../learning-content";

describe("learning content", () => {
  it("loads validated learning-example guides with style, asset-class, and safety metadata", () => {
    const guides = loadGuides();
    expect(guides).toHaveLength(4);
    expect(guides.every((guide) => guide.isLearningExample && guide.styles.length > 0 && guide.assetClasses.length > 0)).toBe(true);
    expect(guides.every((guide) => guide.contentRole === "learning-example" && guide.scenarioBasis === "fictional" && guide.asOf === "not-applicable")).toBe(true);
    expect(findGuide(guides[0].slug)?.title).toBe(guides[0].title);
  });

  it("loads curated learning-example books with reader context and source metadata", () => {
    const books = loadBooks();
    expect(books).toHaveLength(3);
    expect(books.every((book) => book.isLearningExample && book.reader && book.topic && !book.affiliateUrl)).toBe(true);
    expect(books.every((book) => book.contentRole === "learning-example" && book.exampleType === "reading-path" && book.scenarioBasis === "fictional" && book.sources === "not-applicable")).toBe(true);
    expect(findBook(books[0].slug)?.summary).toBe(books[0].summary);
  });
});
