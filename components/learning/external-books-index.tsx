"use client";

import Link from "next/link";
import { Star, ThumbsUp, AlertCircle, BookOpen, CheckCircle2, SlidersHorizontal, ShieldCheck, ZoomIn, X } from "lucide-react";
import { useState } from "react";
import Image from "next/image";

import type { ExternalBook, ExternalBookCategory } from "@/lib/content/learning-content";

const DEFAULT_CATEGORIES: readonly ExternalBookCategory[] = ["초보·입문", "연금·절세", "배당·현금흐름"] as const;

export function ExternalBooksIndex({
  books,
  categories = DEFAULT_CATEGORIES,
  lastUpdated = "업데이트 예정",
}: {
  books: ExternalBook[];
  categories?: readonly ExternalBookCategory[];
  lastUpdated?: string;
}) {
  const [activeCategory, setActiveCategory] = useState<ExternalBookCategory>(categories[0] ?? "초보·입문");
  const [previewBook, setPreviewBook] = useState<ExternalBook | null>(null);

  const filteredBooks = books
    .filter((book) => book.category === activeCategory)
    .slice(0, 3); // 탭별 Top 3 노출

  return (
    <div className="mt-3.5">
      <div className="sticky top-16 z-20 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-white/90 backdrop-blur-md pb-3 pt-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        {/* 탭 네비게이션 (모바일 터치 타깃 44px 이상 + 포커스 링) */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`min-h-[40px] rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-bold transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 ${
                activeCategory === cat
                  ? "bg-brand-800 text-white shadow-xs"
                  : "bg-surface border border-line text-muted hover:bg-neutral-100"
              }`}
            >
              {cat} Top 3
            </button>
          ))}
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <div className="relative group cursor-help">
            <div className="flex items-center gap-1.5 text-xs font-bold text-brand-700 bg-brand-50 px-2.5 py-1.5 rounded-lg border border-brand-200 transition-colors hover:bg-brand-100">
              <SlidersHorizontal className="h-3.5 w-3.5 text-brand-600 shrink-0" />
              <span>데이터 기반 도서 선정 기준 ℹ️</span>
            </div>
            
            <div className="absolute right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 top-full mt-2 w-[calc(100vw-40px)] max-w-[310px] rounded-xl bg-white p-4 shadow-xl border border-line opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 text-left whitespace-normal break-keep">
              <h4 className="font-extrabold text-sm text-strong mb-3 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-brand-600"/> 빅 3 서점 데이터 기반 검증 기준
              </h4>
              <ul className="text-xs text-neutral-700 space-y-2 font-medium leading-relaxed">
                <li className="flex items-start gap-1.5">
                  <span className="text-brand-600 mt-0.5 font-bold">1.</span>
                  <span><strong>시장성 검증:</strong> 국내 빅 3 서점(알라딘·교보문고·YES24) 누적 판매지수 상위권 공인 베스트셀러</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-brand-600 mt-0.5 font-bold">2.</span>
                  <span><strong>대중성 확보:</strong> 특정 서점 왜곡을 방지하기 위한 <strong>빅 3 통합 평점 4.0 이상</strong> 압도적 호평 도서</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-brand-600 mt-0.5 font-bold">3.</span>
                  <span><strong>실전 활용도:</strong> 퇴직연금(DC/IRP) 및 국내 상장 ETF 투자 적합성 중심의 핵심 요약</span>
                </li>
              </ul>
              <div className="mt-3 pt-2.5 border-t border-line text-[10px] text-neutral-400 font-medium">
                특정 출판사의 협찬이나 주관을 배제한 객관적 서점 데이터 기반 선정 결과입니다.
              </div>
            </div>
          </div>
          <span className="text-[11px] font-medium text-neutral-500">업데이트: {lastUpdated} 기준</span>
        </div>
      </div>

      <div className="mt-2 grid gap-5 md:grid-cols-3 min-h-[380px]">
        {filteredBooks.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-line p-10 text-center text-sm text-muted">
            <BookOpen className="h-8 w-8 text-neutral-300 mb-2" />
            <p>해당 카테고리의 추천 도서가 준비 중입니다.</p>
          </div>
        ) : (
          filteredBooks.map((book, bookIdx) => {
            const coverUrl = book.coverImage;
            const rank = bookIdx + 1;
            const isTop1 = rank === 1;

            return (
              <article
                key={book.slug}
                className={`relative flex flex-col justify-between rounded-2xl p-5 transition-all duration-200 ${
                  isTop1
                    ? "border-2 border-amber-300/90 bg-gradient-to-b from-amber-50/25 via-surface to-surface shadow-xs ring-4 ring-amber-400/10 hover:border-amber-400 hover:shadow-md"
                    : "border border-line bg-surface hover:border-brand-300 hover:shadow-sm"
                }`}
              >
                <div>
                  {/* 상단 뱃지 행: 평점 + 플랫폼 + IRP 여부 */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="relative group/rating cursor-help" tabIndex={0} aria-label="3사 통합 평점 상세 보기">
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-extrabold text-amber-950 border border-amber-200 transition-colors hover:bg-amber-100 focus:ring-2 focus:ring-amber-400">
                          <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                          <span className="tabular-nums">
                            {(((book.kyoboRating ?? book.rating) + (book.yes24Rating ?? book.rating) + (book.aladinRating ?? book.rating)) / 3).toFixed(1)}
                          </span>
                          <span className="text-amber-800/80 font-semibold">({book.reviewCount})</span>
                        </span>

                        {/* 빅 3 서점 평점 상세 툴팁 (PC 호버 및 모바일 터치/포커스 대응) */}
                        <div className="absolute left-0 top-full mt-1.5 w-44 rounded-xl bg-white p-3 shadow-xl border border-line opacity-0 invisible group-hover/rating:opacity-100 group-hover/rating:visible group-focus-within/rating:opacity-100 group-focus-within/rating:visible transition-all z-30 text-left pointer-events-none whitespace-normal break-keep">
                          <p className="text-[11px] font-extrabold text-neutral-800 mb-1.5 flex items-center gap-1">
                            <span>📊 3사 통합 평점 상세</span>
                          </p>
                          <div className="space-y-1 text-[11px] text-neutral-600 font-medium">
                            <div className="flex justify-between items-center">
                              <span>교보문고</span>
                              <span className="font-bold text-amber-600">★ {(book.kyoboRating ?? book.rating).toFixed(1)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>YES24</span>
                              <span className="font-bold text-amber-600">★ {(book.yes24Rating ?? book.rating).toFixed(1)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>알라딘</span>
                              <span className="font-bold text-amber-600">★ {(book.aladinRating ?? book.rating).toFixed(1)}</span>
                            </div>
                          </div>
                          <div className="mt-2 pt-1.5 border-t border-neutral-100 flex justify-between items-center text-[10px] text-neutral-500 font-bold">
                            <span>3사 평균</span>
                            <span className="text-amber-700 font-black">
                              {(((book.kyoboRating ?? book.rating) + (book.yes24Rating ?? book.rating) + (book.aladinRating ?? book.rating)) / 3).toFixed(1)} / 5.0
                            </span>
                          </div>
                          <p className="mt-1.5 text-[9px] text-neutral-400 leading-tight">
                            ※ 카드 순위는 서점 누적 판매량(베스트셀러) 기준입니다.
                          </p>
                        </div>
                      </div>

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

                  {/* 책 표지 영역 (클릭 시 고해상도 확대 팝업) */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => { if (coverUrl) setPreviewBook(book); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (coverUrl) setPreviewBook(book);
                      }
                    }}
                    className="group/cover my-3 flex aspect-[3/4] w-28 sm:w-32 mx-auto items-center justify-center rounded-xl bg-white border border-neutral-200/80 overflow-hidden relative shadow-2xs hover:shadow-md transition-all cursor-zoom-in"
                    aria-label={`${book.title} 표지 크게 보기`}
                  >
                    {coverUrl ? (
                      <>
                        <Image
                          src={coverUrl}
                          alt={book.title}
                          width={140}
                          height={190}
                          className="h-full w-full object-contain p-1 transition-transform duration-200 group-hover/cover:scale-105"
                          loading="lazy"
                        />
                        {/* 확대 아이콘 호버 오버레이 */}
                        <div className="absolute inset-0 bg-black/35 opacity-0 group-hover/cover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-[11px] font-extrabold text-white backdrop-blur-[1px]">
                          <ZoomIn className="h-3.5 w-3.5" />
                          <span>크게 보기</span>
                        </div>
                      </>
                    ) : (
                      <BookOpen className="h-9 w-9 text-neutral-300" strokeWidth={1.5} />
                    )}
                  </div>

                  {/* 도서명 및 저자 정보 */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      {isTop1 ? (
                        <span className="rounded-md bg-gradient-to-r from-amber-600 to-amber-700 px-2 py-0.5 text-[10px] font-black text-white shadow-2xs">
                          👑 베스트셀러 1위
                        </span>
                      ) : (
                        <span className="rounded-md bg-brand-800 px-1.5 py-0.5 text-[10px] font-black text-white">
                          베스트셀러 {rank}위
                        </span>
                      )}
                      <span className="rounded-md bg-indigo-50 text-indigo-700 px-1.5 py-0.5 text-[10px] font-extrabold border border-indigo-200/80">
                        {book.shortTargetTag ? `🎯 ${book.shortTargetTag}` : book.category === "초보·입문" ? "🎯 사회초년생 입문" : book.category === "연금·절세" ? "🎯 연금저축·IRP" : "🎯 월배당 파이프라인"}
                      </span>
                      <span className="text-[11px] font-bold text-neutral-500 ml-auto">
                        판매량 {rank}위
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-extrabold tracking-[-0.02em] text-strong line-clamp-2 leading-snug">
                      {book.title}
                    </h3>
                    <p className="mt-1 text-xs text-neutral-500 line-clamp-1">
                      {book.author} 저 · {book.publisher}
                    </p>
                  </div>

                  {/* 가격 및 10% 도서정가제 할인 혜택 앵커 (손실회피 & 가치 인지) */}
                  {book.discountPrice && (
                    <div className="mt-2.5 flex items-baseline justify-between rounded-xl bg-neutral-50/90 px-3 py-2 border border-line/60">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        {book.originalPrice && (
                          <span className="text-[11px] text-neutral-400 line-through tabular-nums">
                            {book.originalPrice.toLocaleString()}원
                          </span>
                        )}
                        <span className="text-sm sm:text-base font-black text-neutral-900 tabular-nums">
                          {book.discountPrice.toLocaleString()}원
                        </span>
                        <span className="text-xs font-black text-red-600">
                          (10% 할인)
                        </span>
                      </div>
                      <span className="text-[10px] font-extrabold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60">
                        🚀 로켓배송
                      </span>
                    </div>
                  )}

                  {/* 태그 칩 (AI선정 제거 필터링) */}
                  {book.tags.filter(t => !t.includes("AI")).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {book.tags.filter(t => !t.includes("AI")).slice(0, 3).map((tag) => (
                        <span key={tag} className="chip text-[10px] px-1.5 py-0.5 font-semibold text-neutral-600 bg-neutral-100">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 한 줄 핵심 포인트 */}
                  {/* AI 핵심 한 줄 평 (가독성 최적화) */}
                  <div className="mt-2.5 rounded-xl bg-brand-50/90 p-2.5 sm:p-3 border border-brand-200/80 shadow-2xs">
                    <p className="text-xs sm:text-[12px] font-extrabold text-brand-950 line-clamp-2 leading-relaxed">
                      💡 {book.oneLineReview}
                    </p>
                  </div>

                  {/* 주요 장점 (Pros) */}
                  {book.pros[0] && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-neutral-800 leading-snug rounded-lg bg-neutral-50 px-2.5 py-2 border border-line/60">
                      <ThumbsUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
                      <span className="line-clamp-1 font-semibold">{book.pros[0]}</span>
                    </div>
                  )}

                  {/* 컴플라이언스 경고문 (배당/커버드콜 등) */}
                  {(book.category === "배당·현금흐름" || book.tags.includes("커버드콜")) && (
                    <div className="mt-2 flex items-start gap-1 text-[10px] text-neutral-500 font-medium">
                      <AlertCircle className="h-3 w-3 shrink-0 text-amber-500/70" />
                      <span className="leading-tight">※ 파생상품이 포함된 ETF는 원금 손실 위험이 있습니다.</span>
                    </div>
                  )}
                </div>

                {/* 2단 CTA 버튼 및 구매 전 유의사항 안내 */}
                <div className="mt-4 pt-1.5 flex flex-col gap-2">
                  {/* 구매 전 유의사항 */}
                  <p className="text-center text-[10px] text-neutral-400 leading-tight">
                    ※ 개별 투자 성향에 따라 적합도가 다를 수 있습니다.
                  </p>

                  {book.affiliateUrl && (
                    <a
                      href={book.affiliateUrl}
                      target="_blank"
                      rel="sponsored nofollow noopener"
                      className="inline-flex w-full min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#0073E9] hover:bg-[#005fb8] px-4 text-xs sm:text-sm font-black text-white transition-all active:scale-[0.98] shadow-sm hover:shadow-md"
                      aria-label={`${book.title} 쿠팡 로켓배송 도서 구매처 바로가기 (새 창 열림)`}
                    >
                      <span>🚀 로켓배송으로 내일 받기</span>
                      <span className="text-[10px] text-white/80">↗</span>
                    </a>
                  )}

                  <Link
                    href={`/books/review/${book.slug}`}
                    className="inline-flex w-full min-h-[38px] items-center justify-center rounded-xl bg-surface px-4 text-xs font-bold text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 active:scale-[0.99] border border-line"
                  >
                    리뷰 상세 보기 →
                  </Link>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* 하단 제휴 마케팅 공정위 고지 */}
      <p className="mt-4 text-right text-[11px] text-muted">
        ※ 본 페이지의 도서 구매 링크는 쿠팡 파트너스 활동의 일환으로, 구매 시 운영자에게 일정액의 수수료가 제공될 수 있습니다.
      </p>

      {/* 고해상도 표지 확대 모달 (Lightbox) */}
      {previewBook && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="도서 표지 고해상도 확대"
          onClick={() => setPreviewBook(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-xs sm:max-w-md w-full rounded-2xl bg-white p-5 shadow-2xl border border-neutral-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-3">
              <h4 className="text-sm font-extrabold text-neutral-800 line-clamp-1 pr-2">
                {previewBook.title}
              </h4>
              <button
                type="button"
                onClick={() => setPreviewBook(null)}
                className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
                aria-label="닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex aspect-[3/4] w-full items-center justify-center rounded-xl bg-neutral-50 overflow-hidden border border-neutral-100 shadow-inner">
              {previewBook.coverImage && (
                <Image
                  src={previewBook.coverImage}
                  alt={previewBook.title}
                  width={500}
                  height={680}
                  className="h-full w-full object-contain p-2"
                  unoptimized
                />
              )}
            </div>

            <p className="mt-3 text-center text-xs text-neutral-500 font-medium">
              {previewBook.author} 저 · {previewBook.publisher}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
