"use client";

import Link from "next/link";
import { Star, ThumbsUp, AlertCircle, BookOpen, CheckCircle2, Bot } from "lucide-react";
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
      <div className="sticky top-16 z-20 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-white/90 backdrop-blur-md pb-4 pt-2 -mx-4 px-4 sm:mx-0 sm:px-0">
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
        
        <div className="relative group cursor-help">
          <div className="flex items-center gap-1.5 text-xs font-bold text-brand-700 bg-brand-50 px-3 py-2 rounded-lg border border-brand-200 transition-colors hover:bg-brand-100">
            <Bot className="h-4 w-4 text-brand-600 shrink-0" />
            <span>데이터 기반 AI 선정 기준 ℹ️</span>
          </div>
          
          <div className="absolute right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 top-full mt-2 w-[300px] rounded-xl bg-white p-4 shadow-xl border border-line opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 text-left">
            <h4 className="font-extrabold text-sm text-strong mb-3 flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-brand-600"/> 데이터 기반 100% 자동 큐레이션
            </h4>
            <ul className="text-xs text-neutral-700 space-y-2.5 font-medium leading-relaxed">
              <li className="flex items-start gap-1.5">
                <span className="text-brand-500 mt-0.5 font-bold">1.</span>
                <span><strong>시장성 검증:</strong> 국내 주요 서점 누적 판매지수 상위 1% 이내의 공인된 베스트셀러</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-brand-500 mt-0.5 font-bold">2.</span>
                <span><strong>대중성 검증:</strong> 실구매자 평균 평점 4.0 이상 (표본 100건 이상)</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-brand-500 mt-0.5 font-bold">3.</span>
                <span><strong>AI 심층 분석:</strong> 도서 목차, 서평, 독자 피드백 키워드를 AI 알고리즘이 종합 분석하여 실전 투자 적용성이 높은 도서 자동 선별</span>
              </li>
            </ul>
            <div className="mt-3.5 pt-3 border-t border-line/50">
              <p className="text-[10.5px] text-neutral-500 leading-tight">
                ※ 본 큐레이션은 운영자의 주관을 배제하고, 객관적 판매 데이터와 AI 분석 모델을 연동하여 시스템에 의해 정기적으로 자동 업데이트됩니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 grid gap-5 md:grid-cols-3 min-h-[380px]">
        {filteredBooks.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-line p-10 text-center text-sm text-muted">
            <BookOpen className="h-8 w-8 text-neutral-300 mb-2" />
            <p>해당 카테고리의 추천 도서가 준비 중입니다.</p>
          </div>
        ) : (
          filteredBooks.map((book, index) => {
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
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className="rounded-md bg-brand-800 px-1.5 py-0.5 text-[10px] font-black text-white">
                        TOP {filteredBooks.indexOf(book) + 1}
                      </span>
                      <span className="rounded-md bg-indigo-100 text-indigo-700 px-1.5 py-0.5 text-[10px] font-bold border border-indigo-200">
                        {book.category === "초보·입문" ? "👶 사회초년생 추천" : book.category === "연금·절세" ? "💼 직장인 필수" : "🏖️ 은퇴 준비 추천"}
                      </span>
                      <span className="text-[11px] font-bold text-brand-700 ml-auto">
                        {book.category} {filteredBooks.indexOf(book) + 1}위
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

                  {/* 컴플라이언스 경고문 (배당/커버드콜 등) */}
                  {(book.category === "배당·현금흐름" || book.tags.includes("커버드콜")) && (
                    <div className="mt-2 flex items-start gap-1 text-[10px] text-neutral-500 font-medium">
                      <AlertCircle className="h-3 w-3 shrink-0 text-amber-500/70" />
                      <span className="leading-tight">※ 파생상품이 포함된 ETF(커버드콜 등)는 시장 하락 시 원금 손실 위험이 있습니다.</span>
                    </div>
                  )}

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

                {/* 2단 CTA 버튼: 제휴 구매처 바로가기 (강조) + 상세 리뷰 보기 (보조) */}
                <div className="mt-4 pt-2 flex flex-col gap-2">
                  {book.affiliateUrl && (
                    <a
                      href={book.affiliateUrl}
                      target="_blank"
                      rel="sponsored nofollow noopener"
                      className="inline-flex w-full min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-brand-700 px-4 text-xs font-bold text-white transition-colors hover:bg-brand-800 active:scale-[0.99] shadow-sm"
                      aria-label={`${book.title} 도서 구매처 바로가기 (새 창 열림)`}
                    >
                      <span>도서 구매처 바로가기</span>
                      <span className="text-[10px] text-white/80">↗</span>
                    </a>
                  )}

                  <Link
                    href={`/books/review/${book.slug}`}
                    className="inline-flex w-full min-h-[38px] items-center justify-center rounded-xl bg-surface px-4 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 active:scale-[0.99] border border-line"
                  >
                    리뷰 상세 보기 →
                  </Link>
                </div>
              </article>
            );
          }).flatMap((element, idx) => 
            idx === 1 
              ? [
                  element,
                  <article key="inline-promo" className="flex flex-col justify-center items-center rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50 p-6 text-center transition-colors hover:bg-brand-100 h-full">
                    <div className="mb-3 rounded-full bg-brand-100 p-3 text-brand-600">
                      <BookOpen className="h-6 w-6" />
                    </div>
                    <h3 className="mb-2 text-sm font-extrabold text-brand-900">
                      초보자를 위한 실전 가이드
                    </h3>
                    <p className="mb-4 text-xs font-medium text-brand-700/80 leading-relaxed">
                      감정을 끄고 시스템으로 수익을 내는<br/>캠퍼스 오리지널 전자책
                    </p>
                    <a
                      href="https://ctee.kr/item/store/99321"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full min-h-[40px] items-center justify-center rounded-xl bg-brand-800 px-4 text-xs font-bold text-white transition-colors hover:bg-brand-900 shadow-sm"
                    >
                      오리지널 전자책 보기 ↗
                    </a>
                  </article>
                ] 
              : [element]
          )
        )}
      </div>

      {/* 하단 제휴 마케팅 공정위 고지 */}
      <p className="mt-4 text-right text-[11px] text-muted">
        ※ 본 페이지의 도서 구매 링크는 제휴 마케팅 활동의 일환으로, 구매 시 운영자에게 일정액의 수수료가 제공될 수 있습니다.
      </p>
    </div>
  );
}
