import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SampleBadge } from "@/components/learning/sample-badge";
import { MarkdownContent } from "@/components/markdown/markdown-content";
import { findBook, loadBooks } from "@/lib/content/learning-content";

type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() { return loadBooks().map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> { const book = findBook((await params).slug); return book ? { title: book.title, description: book.summary, alternates: { canonical: `/books/${book.slug}` } } : {}; }

export default async function BookPage({ params }: Props) {
  const book = findBook((await params).slug);
  if (!book) notFound();
  return <main className="page-shell flex-1 py-8 sm:py-12"><div className="mx-auto max-w-3xl">
    <Link className="text-sm font-extrabold text-brand-700" href="/books">← 북 큐레이션</Link>
    <div className="mt-6 flex flex-wrap items-center gap-2"><span className="chip">{book.topic}</span><SampleBadge /></div>
    <h1 className="mt-5 text-3xl font-extrabold tracking-[-0.04em] text-strong sm:text-4xl">{book.title}</h1>
    <p className="mt-4 text-base font-bold leading-7 text-neutral-700">이런 독자에게: {book.reader}</p>
    <div className="mt-8 rounded-2xl border border-line p-5 sm:p-7"><MarkdownContent source={book.content} /></div>
    {book.affiliateUrl ? <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="text-xs font-extrabold text-amber-900">광고 · 제휴 링크</p><a className="mt-3 inline-flex rounded-xl bg-brand-700 px-4 py-3 text-sm font-extrabold text-white" href={book.affiliateUrl} rel="sponsored nofollow noopener" target="_blank">도서 정보 보기</a></div> : null}
    <p className="mt-6 text-xs leading-5 text-muted">도서 소개는 학습 목적의 큐레이션이며 특정 금융상품이나 투자 행동을 추천하지 않습니다.</p>
  </div></main>;
}
