"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import {
  Star,
  ThumbsUp,
  AlertCircle,
  BookOpen,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  ExternalLink,
  Info,
  Target,
  ZoomIn,
  X,
} from "lucide-react";

import type { ExternalBook } from "@/lib/content/learning-content";

export function ExternalBookDetail({ book, crossSellBanner }: { book: ExternalBook, crossSellBanner?: React.ReactNode }) {
  const [showCoverModal, setShowCoverModal] = useState(false);
  const coverUrl = book.coverImage;

  return (
    <div className="mx-auto max-w-3xl">
      {/* 상단 뒤로가기 링크 (최소 터치 타깃 44px) */}
      <nav aria-label="Breadcrumb">
        <Link
          href="/books"
          className="inline-flex min-h-[44px] items-center text-sm font-extrabold text-brand-700 hover:text-brand-800 transition-colors"
        >
          ← 도서·리뷰 목록으로 돌아가기
        </Link>
      </nav>

      {/* 헤더 메타 뱃지 행 */}
      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip text-xs font-bold">{book.category}</span>
          {book.irpEligible && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[0.6875rem] font-extrabold text-emerald-800">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              IRP 편입 가능
            </span>
          )}
        </div>

        {/* 도서 제목 */}
        <h1 className="mt-4 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-[-0.04em] text-strong leading-tight">
          {book.title}
        </h1>

        {/* 저자 및 평점 행 */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-y border-line py-3.5">
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <span className="font-bold text-neutral-800">{book.author}</span> 저 ·
            <span>{book.publisher}</span> 발행
          </div>

          <div className="flex items-center gap-2">
            <div className="relative group/rating cursor-help">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-extrabold text-amber-950 border border-amber-200 transition-colors hover:bg-amber-100">
                <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                <span className="tabular-nums text-sm">
                  {(((book.kyoboRating ?? book.rating) + (book.yes24Rating ?? book.rating) + (book.aladinRating ?? book.rating)) / 3).toFixed(1)}
                </span>
                <span className="text-amber-800/80 font-medium">({book.reviewCount}개 리뷰)</span>
              </span>

              {/* 빅 3 서점 평점 상세 툴팁 */}
              <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl bg-white p-3.5 shadow-xl border border-line opacity-0 invisible group-hover/rating:opacity-100 group-hover/rating:visible transition-all z-30 text-left pointer-events-none">
                <p className="text-xs font-extrabold text-neutral-800 mb-2 flex items-center gap-1">
                  <span>📊 3사 통합 평점 상세</span>
                </p>
                <div className="space-y-1.5 text-xs text-neutral-600 font-medium">
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
                <div className="mt-2.5 pt-2 border-t border-neutral-100 flex justify-between items-center text-[11px] text-neutral-500 font-bold">
                  <span>3사 평균 평점</span>
                  <span className="text-amber-700 font-black">
                    {(((book.kyoboRating ?? book.rating) + (book.yes24Rating ?? book.rating) + (book.aladinRating ?? book.rating)) / 3).toFixed(1)} / 5.0
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 평점 출처 및 샘플 안내 표기 */}
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
          <Info className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
          <span>평점 출처: {book.ratingSource}</span>
        </div>

        {/* 태그 칩 */}
        {book.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {book.tags.map((tag) => (
              <span key={tag} className="chip text-xs px-2 py-0.5 font-medium text-neutral-600 bg-neutral-100">
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* 한 줄 총평 (D 고객 요구: 1분 안에 결론 도달) + 표지 카드 */}
      <section className="mt-6 flex flex-col sm:flex-row gap-6 rounded-3xl border-2 border-brand-100 bg-brand-50/40 p-5 sm:p-7 items-center">
        <div
          role="button"
          tabIndex={0}
          onClick={() => coverUrl && setShowCoverModal(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              coverUrl && setShowCoverModal(true);
            }
          }}
          className="group/cover flex aspect-[3/4] w-36 sm:w-44 shrink-0 items-center justify-center rounded-2xl bg-white border border-neutral-200/90 overflow-hidden relative shadow-sm hover:shadow-md transition-all cursor-zoom-in"
          aria-label={`${book.title} 표지 크게 보기`}
        >
          {coverUrl ? (
            <>
              <Image
                src={coverUrl}
                alt={book.title}
                width={176}
                height={235}
                className="h-full w-full object-contain p-1.5 transition-transform duration-200 group-hover/cover:scale-105"
                unoptimized
              />
              <div className="absolute inset-0 bg-black/35 opacity-0 group-hover/cover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-xs font-extrabold text-white backdrop-blur-[1px]">
                <ZoomIn className="h-4 w-4" />
                <span>표지 크게 보기</span>
              </div>
            </>
          ) : (
            <BookOpen className="h-10 w-10 text-neutral-300" strokeWidth={1.5} />
          )}
        </div>

        <div className="flex flex-col gap-2 flex-1 text-center sm:text-left">
          <span className="text-xs font-extrabold text-brand-700 tracking-wider uppercase">
            Campus One-Line Review
          </span>
          <p className="text-base sm:text-lg font-extrabold tracking-[-0.02em] text-brand-950 leading-snug">
            &ldquo;{book.oneLineReview}&rdquo;
          </p>
          <p className="text-xs text-neutral-600 leading-relaxed mt-1">
            {book.summary}
          </p>
        </div>
      </section>

      {/* 🎯 이런 분께 강력 추천합니다 (추천 대상 및 선정 근거 카드) */}
      {(book.targetPersona || book.targetRationale) && (
        <section className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 sm:p-6 shadow-2xs">
          <div className="flex items-center gap-2 text-sm font-extrabold text-indigo-950 mb-3 border-b border-indigo-200/70 pb-2.5">
            <Target className="h-4 w-4 text-indigo-600 shrink-0" />
            <span>🎯 이런 투자자분께 강력 추천합니다</span>
          </div>
          <div className="space-y-2 text-xs sm:text-sm text-neutral-800 leading-relaxed">
            {book.targetPersona && (
              <p>
                <strong className="font-bold text-indigo-950">[추천 대상]</strong> {book.targetPersona}
              </p>
            )}
            {book.targetRationale && (
              <p className="text-neutral-700">
                <strong className="font-bold text-indigo-950">[선정 근거]</strong> {book.targetRationale}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Pros & Cons 2열 대칭 패널 (E 고객: 동등한 무게감, 색상 단독 의존 금지) */}
      <section className="mt-8">
        <h2 className="text-xl font-extrabold tracking-[-0.03em] text-strong mb-4">
          독자 리뷰 핵심 요약 (Pros &amp; Cons)
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* 장점 (Pros) */}
          <div className="flex flex-col rounded-2xl border border-blue-200 bg-blue-50/40 p-5">
            <div className="flex items-center gap-2 text-sm font-extrabold text-blue-900 border-b border-blue-200/80 pb-3">
              <ThumbsUp className="h-4 w-4 text-blue-600 shrink-0" />
              <span>주요 장점 (Pros)</span>
            </div>
            <ul className="mt-3.5 space-y-2.5 flex-1 text-xs sm:text-sm text-neutral-800 leading-relaxed">
              {book.pros.map((pro, index) => (
                <li key={`pro-${index}`} className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold shrink-0">•</span>
                  <span>{pro}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 아쉬운 점 (Cons) */}
          <div className="flex flex-col rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
            <div className="flex items-center gap-2 text-sm font-extrabold text-amber-950 border-b border-amber-200/80 pb-3">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>아쉬운 점 및 유의사항 (Cons)</span>
            </div>
            <ul className="mt-3.5 space-y-2.5 flex-1 text-xs sm:text-sm text-neutral-800 leading-relaxed">
              {book.cons.map((con, index) => (
                <li key={`con-${index}`} className="flex items-start gap-2">
                  <span className="text-amber-700 font-bold shrink-0">•</span>
                  <span>{con}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 크로스셀 배너 (Pros/Cons 요약 직후 상향 배치) */}
      {book.relatedInternalLink && (
        <CrossSellBanner internalLink={book.relatedInternalLink} />
      )}

      {/* 고객 F 요구: Backtest Ticker 연계 실행 CTA */}
      {book.backtestTicker && (
        <section className="my-8 rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-800">
                  도서 연계 ETF
                </span>
                <span className="text-xs font-semibold text-neutral-500 tabular-nums">
                  Ticker: {book.backtestTicker}
                </span>
              </div>
              <h3 className="mt-2 text-base sm:text-lg font-extrabold text-strong">
                도서에서 언급된 ETF의 실제 구성종목 및 보수 확인하기
              </h3>
              <p className="mt-1 text-xs text-neutral-600">
                책에서 배운 투자 기준을 바탕으로 해당 종목의 괴리율, 총보수, 배당 이력을 확인해 보세요.
              </p>
            </div>

            <Link
              href={`/etf/${book.backtestTicker}`}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-xs font-extrabold text-white transition-colors hover:bg-brand-800 shadow-xs"
            >
              <TrendingUp className="h-4 w-4" />
              <span>ETF 상세 데이터 분석</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}

      {/* 제휴 구매처 배너 */}
      {book.affiliateUrl && (
        <section className="mt-8 rounded-3xl border-2 border-brand-200 bg-brand-50/80 p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-800 border border-brand-300/60">
                  온라인 서점 구매처
                </span>
                <span className="text-xs font-semibold text-neutral-600">
                  {book.publisher} 정식 출간 도서
                </span>
              </div>
              <h3 className="mt-2 text-lg sm:text-xl font-extrabold text-brand-950">
                『{book.title}』 도서 소장 및 실전 독서하기
              </h3>
              <p className="mt-1.5 text-xs sm:text-sm text-brand-900/80 leading-relaxed">
                온라인 서점에서 할인 혜택과 빠른 로켓/당일 배송으로 도서를 바로 만나보실 수 있습니다.
              </p>
            </div>

            <a
              href={book.affiliateUrl}
              rel="sponsored nofollow noopener"
              target="_blank"
              aria-label={`${book.title} 도서 구매처 바로가기 (새 창 열림)`}
              className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-700 px-6 py-3 text-sm font-extrabold text-white shadow-sm transition-colors hover:bg-brand-800 focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <span>도서 구매처 바로가기</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          <p className="mt-4 border-t border-brand-200/60 pt-3 text-[11px] text-brand-800/70">
            * 본 링크는 제휴 마케팅(쿠팡 파트너스 등) 활동의 일환으로, 구매 시 운영자에게 일정액의 수수료가 제공될 수 있습니다.
          </p>
        </section>
      )}

      {/* 고해상도 표지 확대 모달 (Lightbox) */}
      {showCoverModal && coverUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="도서 표지 고해상도 확대"
          onClick={() => setShowCoverModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-xs sm:max-w-md w-full rounded-2xl bg-white p-5 shadow-2xl border border-neutral-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-3">
              <h4 className="text-sm font-extrabold text-neutral-800 line-clamp-1 pr-2">
                {book.title}
              </h4>
              <button
                type="button"
                onClick={() => setShowCoverModal(false)}
                className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
                aria-label="닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex aspect-[3/4] w-full items-center justify-center rounded-xl bg-neutral-50 overflow-hidden border border-neutral-100 shadow-inner">
              <Image
                src={coverUrl}
                alt={book.title}
                width={500}
                height={680}
                className="h-full w-full object-contain p-2"
                unoptimized
              />
            </div>

            <p className="mt-3 text-center text-xs text-neutral-500 font-medium">
              {book.author} 저 · {book.publisher}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
