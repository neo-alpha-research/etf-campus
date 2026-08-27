import Link from "next/link";
import Image from "next/image";
import { BookOpen, Compass, Sparkles, Clock } from "lucide-react";

import type { Book } from "@/lib/content/learning-content";

export function BooksIndex({ books }: { books: Book[] }) {
  return (
    <div className="mt-6 flex flex-col gap-6">
      {/* 3부작 시리즈 읽는 순서 안내 배너 */}
      <div className="rounded-2xl border border-brand-200 bg-brand-50/70 p-4 sm:p-5 text-sm text-brand-950">
        <div className="flex items-center gap-2 font-extrabold text-brand-900">
          <Compass className="h-4 w-4 text-brand-700 shrink-0" />
          <span>시리즈 읽는 순서 안내 (추천 가이드)</span>
        </div>
        <p className="mt-1.5 text-xs sm:text-sm text-brand-800 leading-relaxed">
          전체 시스템을 처음부터 구축하시려면 **2편(지수·자산배분, 상위 규칙)**부터 시작하는 것을 권장합니다. 개별 엔진에 집중하고 싶다면 **1편(모멘텀)** 또는 **3편(배당·현금흐름)**을 먼저 읽으셔도 좋습니다.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {books.map((book) => {
          const isComingSoon = book.status === "coming-soon";

          return (
            <article
              key={book.slug}
              className={`flex flex-col justify-between rounded-2xl border bg-surface p-5 transition-all duration-200 hover:shadow-sm ${
                isComingSoon
                  ? "border-amber-200/80 hover:border-amber-300"
                  : "border-line hover:border-brand-300"
              }`}
            >
              <div>
                {/* 상단 뱃지 행 */}
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="chip text-[11px] px-2 py-0.5 font-bold">{book.topic}</span>
                  </div>

                  {isComingSoon ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-extrabold text-amber-800 border border-amber-200">
                      <Clock className="h-3 w-3" />
                      출간 준비 중
                    </span>
                  ) : book.seriesIndex ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-extrabold text-brand-800">
                      <Sparkles className="h-3 w-3" />
                      {book.seriesIndex}편 출간
                    </span>
                  ) : null}
                </div>

                {/* 책 표지 영역 */}
                <div className="my-4 flex aspect-[4/3] w-full max-w-[240px] mx-auto items-center justify-center rounded-xl bg-neutral-50 border border-line/60 overflow-hidden relative shadow-xs">
                  {book.coverImage ? (
                    <Image
                      src={book.coverImage}
                      alt={book.title}
                      width={240}
                      height={180}
                      className="h-full w-full object-contain"
                      unoptimized
                    />
                  ) : (
                    <BookOpen
                      className={`h-10 w-10 ${isComingSoon ? "text-amber-300" : "text-brand-300"}`}
                      strokeWidth={1.5}
                    />
                  )}
                </div>

                <div>
                  <h2 className="text-base font-extrabold tracking-[-0.03em] text-strong line-clamp-2 leading-snug">
                    {book.title}
                  </h2>
                </div>

                <div className="mt-3 flex flex-col gap-2 rounded-xl bg-neutral-50 p-3.5 border border-line/50">
                  <div>
                    <div className="text-[11px] font-extrabold text-brand-800 mb-0.5">핵심 독자</div>
                    <p className="text-xs text-neutral-700 leading-snug line-clamp-2">{book.reader}</p>
                  </div>

                  <div>
                    <div className="text-[11px] font-extrabold text-brand-800 mb-0.5">도서 요약</div>
                    <p className="text-xs text-neutral-700 leading-snug line-clamp-3">{book.summary}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-2">
                {isComingSoon ? (
                  <Link
                    href={`/books/${book.slug}`}
                    className="inline-flex w-full min-h-[44px] items-center justify-center rounded-xl bg-amber-50 px-3 text-xs font-extrabold text-amber-900 transition-colors hover:bg-amber-100 border border-amber-200"
                  >
                    출간 알림 및 개요 보기 →
                  </Link>
                ) : (
                  <Link
                    href={`/books/${book.slug}`}
                    className="inline-flex w-full min-h-[44px] items-center justify-center rounded-xl bg-brand-50 px-3 text-xs font-extrabold text-brand-800 transition-colors hover:bg-brand-100 border border-brand-200/60"
                  >
                    가이드 및 큐레이션 읽기 →
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
