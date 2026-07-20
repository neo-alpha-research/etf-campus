import { describe, expect, it } from "vitest";

import { findBook, findGuide, loadBooks, loadGuides } from "../learning-content";

describe("learning content", () => {
  it("loads validated sample guides with style and asset-class links", () => {
    const guides = loadGuides();
    expect(guides).toHaveLength(4);
    expect(guides.every((guide) => guide.isSample && guide.styles.length > 0 && guide.assetClasses.length > 0)).toBe(true);
    expect(findGuide(guides[0].slug)?.title).toBe(guides[0].title);
  });

  it("loads curated sample books with reader context", () => {
    const books = loadBooks();
    expect(books).toHaveLength(3);
    expect(books.every((book) => book.reader && book.topic && !book.affiliateUrl)).toBe(true);
    expect(findBook(books[0].slug)?.summary).toBe(books[0].summary);
  });
});
