import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ExternalBookDetail } from "@/components/learning/external-book-detail";
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
  };
}

export default async function ExternalBookReviewPage({ params }: Props) {
  const { slug } = await params;
  const book = findExternalBook(slug);

  if (!book) {
    notFound();
  }

  return (
    <main className="page-shell flex-1 py-8 sm:py-12">
      <ExternalBookDetail book={book} />
    </main>
  );
}
