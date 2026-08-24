import Link from "next/link";
import { BookOpen } from "lucide-react";

import { SampleBadge } from "@/components/learning/sample-badge";
import type { Book } from "@/lib/content/learning-content";

export function BooksIndex({ books }: { books: Book[] }) {
  return (
    <div className="mt-5 grid gap-4 md:grid-cols-3">
      {books.map((book) => (
        <article key={book.slug} className="flex flex-col rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-brand-200">
          
          {/* 컴팩트해진 책 표지 영역 */}
          <div className="mb-4 flex aspect-[3/4] w-28 sm:w-32 mx-auto items-center justify-center rounded-xl bg-neutral-100 border border-line/50">
            <BookOpen className="h-8 w-8 text-brand-300" strokeWidth={1.5} />
          </div>

          <div className="flex flex-col gap-2 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="chip text-[11px] px-2 py-0.5">{book.topic}</span>
              <SampleBadge />
            </div>
            
            <div>
              <h2 className="mt-1 text-base font-extrabold tracking-[-0.03em] text-strong line-clamp-2 leading-tight">{book.title}</h2>
            </div>
            
            <div className="mt-3 flex flex-col gap-1.5 rounded-xl bg-neutral-50 p-3 border border-line/50 flex-1">
              <div className="text-[11px] font-bold text-brand-800 mb-0.5">핵심 대상</div>
              <p className="text-[11px] text-neutral-700 leading-snug line-clamp-2">{book.reader}</p>
              
              <div className="mt-1 text-[11px] font-bold text-brand-800 mb-0.5">요약</div>
              <p className="text-[11px] text-neutral-700 leading-snug line-clamp-3">{book.summary}</p>
            </div>
          </div>
          
          <Link href={`/books/${book.slug}`} className="mt-4 inline-flex w-full min-h-10 items-center justify-center rounded-lg bg-brand-50 px-3 text-xs font-bold text-brand-700 transition-colors hover:bg-brand-100">
            큐레이션 노트 읽기
          </Link>
        </article>
      ))}
    </div>
  );
}
