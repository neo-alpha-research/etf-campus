import Link from "next/link";
import Image from "next/image";
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
} from "lucide-react";

import { CrossSellBanner } from "@/components/learning/cross-sell-banner";
import { SampleBadge, SampleNotice } from "@/components/learning/sample-badge";
import { MarkdownContent } from "@/components/markdown/markdown-content";
import {
  type ExternalBook,
  resolveBookCoverUrl,
} from "@/lib/content/learning-content";

export function ExternalBookDetail({ book }: { book: ExternalBook }) {
  const coverUrl = resolveBookCoverUrl(book.coverImage);

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
          <SampleBadge />
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
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-extrabold text-amber-950 border border-amber-200">
              <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
              <span className="tabular-nums text-sm">{book.rating.toFixed(1)}</span>
              <span className="text-amber-800/80 font-medium">({book.reviewCount}개 리뷰)</span>
            </span>
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
      <section className="mt-6 flex flex-col sm:flex-row gap-5 rounded-2xl border-2 border-brand-100 bg-brand-50/40 p-5 sm:p-6 items-center">
        <div className="flex aspect-[3/4] w-28 sm:w-32 shrink-0 items-center justify-center rounded-xl bg-white border border-line/60 overflow-hidden shadow-xs">
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

      {/* 학습용 예시 고지 */}
      <div className="mt-6">
        <SampleNotice />
      </div>

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
                책에서 배운 투자 기준을 바탕으로 해당 종목의 실시간 괴리율, 총보수, 배당 이력을 확인해 보세요.
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

      {/* 마크다운 본문 영역 */}
      <section className="mt-8 rounded-2xl border border-line bg-surface p-5 sm:p-8">
        <h2 className="text-xl font-extrabold tracking-[-0.03em] text-strong mb-6 pb-3 border-b border-line">
          도서 심층 리뷰 및 상세 분석
        </h2>
        <MarkdownContent source={book.content} />
      </section>

      {/* 제휴 링크 (선택) */}
      {book.affiliateUrl && (
        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/80 p-5">
          <p className="text-xs font-extrabold text-amber-900">광고 · 제휴 링크</p>
          <p className="mt-1 text-xs text-amber-800 leading-relaxed">
            아래 링크를 통해 도서를 구매하시면 ETF 캠퍼스 운영에 소정의 수수료가 지원될 수 있습니다.
          </p>
          <a
            href={book.affiliateUrl}
            rel="sponsored nofollow noopener"
            target="_blank"
            className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-brand-800"
          >
            <span>외부 도서 구매처 바로가기</span>
            <ExternalLink className="h-4 w-4" />
          </a>
        </section>
      )}

      {/* 컴플라이언스 및 면책 고지 */}
      <footer className="mt-8 border-t border-line pt-6 text-xs leading-relaxed text-muted">
        <p>
          본 도서 소개 및 리뷰는 ETF 투자 판단 기준을 익히기 위한 학습 목적의 큐레이션 콘텐츠입니다.
          특정 금융투자상품의 매수·매도 권유나 수익률을 보장하지 않으며, 투자에 대한 모든 결정과 책임은 투자자 본인에게 있습니다.
        </p>
      </footer>
    </div>
  );
}
