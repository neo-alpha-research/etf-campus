"use client";

import Link from "next/link";
import { Star, ThumbsUp, AlertCircle, BookOpen, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import Image from "next/image";

import type { ExternalBook, ExternalBookCategory } from "@/lib/content/learning-content";

const DEFAULT_CATEGORIES: readonly ExternalBookCategory[] = ["초보·입문", "연금·절세", "배당·현금흐름"] as const;

export function ExternalBooksIndex({
  books,
  categories = DEFAULT_CATEGORIES,
}: {
  books: ExternalBook[];
  categories?: readonly ExternalBookCategory[];
}) {
  const [activeCategory, setActiveCategory] = useState<ExternalBookCategory>(categories[0] ?? "초보·입문");

  const filteredBooks = books
    .filter((book) => book.category === activeCategory)
    .slice(0, 3); // 탭별 Top 3 노출

  return (
    <div className="mt-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* 탭 네비게이션 (모바일 터치 타깃 44px 이상 + 포커스 링) */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`min-h-[44px] rounded-full px-4 py-2 text-sm font-bold transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 ${
                activeCategory === cat
                  ? "bg-brand-800 text-white shadow-xs"
                  : "bg-surface border border-line text-muted hover:bg-neutral-100"
              }`}
            >
              {cat} Top 3
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-1.5 text-xs font-bold text-brand-700 bg-brand-50 px-3 py-2 rounded-lg border border-brand-200">
          <CheckCircle2 className="h-4 w-4 text-brand-600 shrink-0" />
          <span>평점 4.0 이상 &amp; 핵심 근거 검증 완료</span>
        </div>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-3 min-h-[380px]">
        {filteredBooks.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-line p-10 text-center text-sm text-muted">
            <BookOpen className="h-8 w-8 text-neutral-300 mb-2" />
            <p>해당 카테고리의 추천 도서가 준비 중입니다.</p>
          </div>
        ) : (
          filteredBooks.map((book) => {
            const coverUrl = book.coverImage;
            return (
              <article
                key={book.slug}
                className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-5 transition-all duration-200 hover:border-brand-300 hover:shadow-sm"
              >
                <div>
                  {/* 상단 뱃지 행: 평점 + 플랫폼 + IRP 여부 */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-extrabold text-amber-950 border border-amber-200">
                        <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                        <span className="tabular-nums">{book.rating.toFixed(1)}</span>
                        <span className="text-amber-800/80 font-semibold">({book.reviewCount})</span>
                      </span>
                      <span className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700">
                        {book.publisher}
                      </span>
                    </div>

                    {book.irpEligible && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        IRP 가능
                      </span>
                    )}
                  </div>

                  {/* 책 표지 영역 */}
                  <div className="my-4 flex aspect-[3/4] w-28 sm:w-32 mx-auto items-center justify-center rounded-xl bg-neutral-100 border border-line/60 overflow-hidden relative shadow-xs">
                    {coverUrl ? (
                      <Image
                        src={coverUrl}
                        alt={book.title}
                        width={128}
                        height={170}
                        className="h-full w-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <BookOpen className="h-10 w-10 text-neutral-300" strokeWidth={1.5} />
                    )}
                  </div>

                  {/* 도서명 및 저자 정보 */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="rounded-md bg-brand-800 px-1.5 py-0.5 text-[10px] font-black text-white">
                        TOP {filteredBooks.indexOf(book) + 1}
                      </span>
                      <span className="text-[11px] font-bold text-brand-700">
                        {book.category} 추천 {filteredBooks.indexOf(book) + 1}위
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold tracking-[-0.02em] text-strong line-clamp-2 leading-snug">
                      {book.title}
                    </h3>
                    <p className="mt-1 text-xs text-neutral-500">
                      {book.author} 저 · {book.publisher}
                    </p>
                  </div>

                  {/* 태그 칩 */}
                  {book.tags.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {book.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="chip text-[10px] px-1.5 py-0.5 font-semibold text-neutral-600 bg-neutral-100">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 한 줄 총평 박스 (D 고객 요구: 빠른 판단) */}
                  <div className="mt-3 rounded-xl bg-brand-50/60 p-2.5 border border-brand-100">
                    <p className="text-[11px] font-extrabold text-brand-950 line-clamp-2 leading-relaxed">
                      💡 {book.oneLineReview}
                    </p>
                  </div>

                  {/* Pros & Cons (동일 가중치 및 아이콘 병기) */}
                  <div className="mt-3 flex flex-col gap-1.5 rounded-xl bg-neutral-50 p-3 border border-line/50">
                    <div className="flex items-start gap-1.5 text-xs text-neutral-800 leading-snug">
                      <ThumbsUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
                      <span className="line-clamp-1 font-medium">{book.pros[0]}</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-xs text-neutral-700 leading-snug">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                      <span className="line-clamp-1">{book.cons[0]}</span>
                    </div>
                  </div>
                </div>

                {/* 2단 CTA 버튼: 상세 리뷰 보기 + 제휴 구매처 바로가기 */}
                <div className="mt-4 pt-2 flex flex-col gap-2">
                  <Link
                    href={`/books/review/${book.slug}`}
                    className="inline-flex w-full min-h-[40px] items-center justify-center rounded-xl bg-brand-50 px-4 text-xs font-extrabold text-brand-800 transition-colors hover:bg-brand-100 active:scale-[0.99] border border-brand-200/60"
                  >
                    리뷰 상세 보기 →
                  </Link>

                  {book.affiliateUrl && (
                    <a
                      href={book.affiliateUrl}
                      target="_blank"
                      rel="sponsored nofollow noopener"
                      className="inline-flex w-full min-h-[38px] items-center justify-center gap-1.5 rounded-xl bg-surface px-4 text-xs font-bold text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-brand-700 active:scale-[0.99] border border-line"
                      aria-label={`${book.title} 도서 구매처 바로가기 (새 창 열림)`}
                    >
                      <span>도서 구매처 바로가기</span>
                      <span className="text-[10px] text-muted">↗</span>
                    </a>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* 하단 제휴 마케팅 공정위 고지 */}
      <p className="mt-4 text-right text-[11px] text-muted">
        ※ 본 페이지의 도서 구매 링크는 제휴 마케팅 활동의 일환으로, 구매 시 운영자에게 일정액의 수수료가 제공될 수 있습니다.
      </p>
    </div>
  );
}
