import type { Metadata } from "next";

import { BooksIndex } from "@/components/learning/books-index";
import { loadBooks } from "@/lib/content/learning-content";

export const metadata: Metadata = { title: "북 큐레이션", description: "투자 상품이 아니라 기준과 원칙을 배우는 읽을거리를 선별합니다.", alternates: { canonical: "/books" } };

export default function BooksPage() {
  return <main className="page-shell flex-1 py-8 sm:py-12">
    <p className="eyebrow">Campus Library</p>
    <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-strong sm:text-4xl">무엇을 살지가 아니라, 어떻게 생각할지</h1>
    <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">기준·원칙 중심으로 읽을거리를 선별하고, 누구에게 필요한지와 읽기 전 질문을 함께 기록합니다.</p>
    <div className="mt-6 rounded-xl border border-line bg-neutral-50 px-4 py-3 text-xs leading-5 text-muted">제휴 링크가 포함되는 콘텐츠에는 해당 링크 가까이에 광고·제휴 사실을 명확히 표시합니다. 현재 샘플에는 구매 링크가 없습니다.</div>
    <BooksIndex books={loadBooks()} />
  </main>;
}
