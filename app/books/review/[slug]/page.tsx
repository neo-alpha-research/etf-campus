import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ExternalBookDetail } from "@/components/learning/external-book-detail";
import { CrossSellBanner } from "@/components/learning/cross-sell-banner";
import { findExternalBook, loadExternalBooks } from "@/lib/content/learning-content";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return loadExternalBooks().map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const book = findExternalBook(slug);
  if (!book) return {};

  const rawDescription = `${book.oneLineReview} - ${book.summary}`;
  const description = rawDescription.length > 155 ? `${rawDescription.slice(0, 152)}...` : rawDescription;

  return {
    title: `${book.title} 리뷰 | ETF Campus`,
    description,
    alternates: {
      canonical: `/books/review/${book.slug}`,
    },
    openGraph: {
      title: `${book.title} 리뷰 | ETF Campus`,
      description,
      type: "article",
      images: book.coverImage ? [{ url: book.coverImage, alt: book.title }] : undefined,
    },
  };
}

export default async function ExternalBookReviewPage({ params }: Props) {
  const { slug } = await params;
  const allBooks = loadExternalBooks();
  const book = allBooks.find((b) => b.slug === slug);

  if (!book) {
    notFound();
  }

  const relatedBooks = allBooks.filter((b) => b.category === book.category && b.slug !== book.slug);

  return (
    <main className="page-shell flex-1 py-8 sm:py-12">
      <ExternalBookDetail
        book={book}
        relatedBooks={relatedBooks}
        crossSellBanner={book.relatedInternalLink ? <CrossSellBanner internalLink={book.relatedInternalLink} /> : undefined}
      />
    </main>
  );
}
