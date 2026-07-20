import Link from "next/link";

import { SampleBadge } from "@/components/learning/sample-badge";
import type { Book } from "@/lib/content/learning-content";

export function BooksIndex({ books }: { books: Book[] }) {
  return <div className="mt-8 grid gap-4 md:grid-cols-3">{books.map((book) => <article className="flex flex-col rounded-2xl border border-line bg-surface p-5 sm:p-6" key={book.slug}>
    <div className="flex flex-wrap items-center gap-2"><span className="chip">{book.topic}</span><SampleBadge /></div>
    <h2 className="mt-5 text-xl font-extrabold tracking-[-0.03em] text-strong">{book.title}</h2>
    <p className="mt-3 text-sm font-bold leading-6 text-neutral-700">이런 독자에게: {book.reader}</p>
    <p className="mt-3 flex-1 text-sm leading-6 text-muted">{book.summary}</p>
    <Link className="mt-6 inline-flex min-h-11 items-center font-extrabold text-brand-700" href={`/books/${book.slug}`}>큐레이션 노트 읽기 →</Link>
  </article>)}</div>;
}
