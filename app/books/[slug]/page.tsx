import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { BookOpen, Clock, Sparkles, ExternalLink } from "lucide-react";

import { SampleBadge, SampleNotice } from "@/components/learning/sample-badge";
import { MarkdownContent } from "@/components/markdown/markdown-content";
import { findBook, loadBooks } from "@/lib/content/learning-content";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return loadBooks().map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const book = findBook(slug);
  return book
    ? {
        title: `${book.title} | ETF Campus`,
        description: book.summary,
        alternates: { canonical: `/books/${book.slug}` },
      }
    : {};
}

export default async function BookPage({ params }: Props) {
  const { slug } = await params;
  const book = findBook(slug);
  if (!book) notFound();

  const isComingSoon = book.status === "coming-soon";

  return (
    <main className="page-shell flex-1 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <nav aria-label="Breadcrumb">
          <Link
            className="inline-flex min-h-[44px] items-center text-sm font-extrabold text-brand-700 hover:text-brand-800 transition-colors"
            href="/books"
          >
            ← 북 큐레이션·도서 목록
          </Link>
        </nav>

        {/* 상단 뱃지 및 메타 */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="chip text-xs font-bold">{book.topic}</span>
          <SampleBadge />
          {isComingSoon ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[0.6875rem] font-extrabold text-amber-800 border border-amber-200">
              <Clock className="h-3 w-3" />
              출간 준비 중
            </span>
          ) : book.seriesIndex ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-1 text-[0.6875rem] font-extrabold text-brand-800">
              <Sparkles className="h-3 w-3" />
              {book.seriesIndex}편 출간
            </span>
          ) : null}
        </div>

        {/* 도서 제목 및 표지 헤더 카드 */}
        <div className="mt-5 flex flex-col sm:flex-row gap-5 rounded-2xl border border-line bg-surface p-5 sm:p-6 items-center sm:items-start shadow-xs">
          <div className="flex aspect-[4/3] w-36 sm:w-48 shrink-0 items-center justify-center rounded-xl bg-neutral-50 border border-line/60 overflow-hidden shadow-xs">
            {book.coverImage ? (
              <Image
                src={book.coverImage}
                alt={book.title}
                width={192}
                height={144}
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

          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-[-0.04em] text-strong leading-tight">
              {book.title}
            </h1>
            <p className="mt-2.5 text-sm font-bold text-neutral-700">
              핵심 독자: {book.reader}
            </p>
            <p className="mt-2 text-xs sm:text-sm text-neutral-600 leading-relaxed">
              {book.summary}
            </p>

            {book.affiliateUrl && (
              <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                <a
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-xs sm:text-sm font-extrabold text-white shadow-xs transition-colors hover:bg-brand-800 focus-visible:ring-2 focus-visible:ring-brand-500"
                  href={book.affiliateUrl}
                  rel="sponsored nofollow noopener"
                  target="_blank"
                  aria-label="크티(CTEE) 공식 스토어에서 전자책 전문 소장하기 (새 창 열림)"
                >
                  <span>크티(CTEE)에서 전자책 소장하기</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
                <span className="text-[11px] font-semibold text-neutral-500">
                  * PDF 159쪽 본문 + 부록 5종 패키지
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 출간 준비 중 알림 배너 */}
        {isComingSoon && (
          <aside className="mt-6 rounded-2xl border-2 border-amber-200 bg-amber-50/70 p-5 text-amber-950 shadow-xs">
            <div className="flex items-center gap-2 font-extrabold text-amber-900">
              <Clock className="h-4 w-4 shrink-0" />
              <span>원고 완성 및 출간 준비 안내</span>
            </div>
            <p className="mt-2 text-xs sm:text-sm leading-relaxed text-amber-900/90">
              원고는 완성되어 검수를 마쳤습니다. 발행 정보와 공개 방식이 정해지는 대로 안내드립니다.
              알림을 신청하시면 공개 시점에 가장 먼저 소식을 보내드립니다.
            </p>
          </aside>
        )}

        <div className="mt-6">
          <SampleNotice />
        </div>

        {/* 마크다운 본문 */}
        <div className="mt-8 rounded-2xl border border-line bg-surface p-5 sm:p-8 shadow-xs">
          <MarkdownContent source={book.content} />
        </div>

        {/* 크티(CTEE) 구매처 배너 */}
        {book.affiliateUrl && (
          <div className="mt-8 rounded-3xl border-2 border-brand-200 bg-brand-50/80 p-6 sm:p-8 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-800 border border-brand-300/60">
                    크티(CTEE) 공식 스토어
                  </span>
                  <span className="text-xs font-semibold text-neutral-600">
                    PDF 159쪽 전권 + 부록 5종
                  </span>
                </div>
                <h3 className="mt-2 text-lg sm:text-xl font-extrabold text-brand-950">
                  지금 나만의 퇴직연금 ETF 운용 시스템을 완성해 보세요
                </h3>
                <p className="mt-1.5 text-xs sm:text-sm text-brand-900/80 leading-relaxed">
                  크티(CTEE)에서 결제 즉시 159쪽 PDF 본문과 부록 5종(30일 체크리스트, 바이브 코딩 프롬프트, 텔레그램 설정 가이드 등)을 다운로드하여 평생 소장하실 수 있습니다.
                </p>
              </div>

              <a
                className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-700 px-6 py-3 text-sm font-extrabold text-white shadow-sm transition-colors hover:bg-brand-800 focus-visible:ring-2 focus-visible:ring-brand-500"
                href={book.affiliateUrl}
                rel="sponsored nofollow noopener"
                target="_blank"
                aria-label="크티(CTEE) 공식 스토어에서 전자책 구매하기 (새 창 열림)"
              >
                <span>전자책 전문 소장하기</span>
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            <p className="mt-4 border-t border-brand-200/60 pt-3 text-[11px] text-brand-800/70">
              * 본 링크는 크티(CTEE) 공식 상품 페이지로 연결되는 제휴 링크입니다. 결제 및 파일 다운로드는 크티 플랫폼에서 안전하게 처리됩니다.
            </p>
          </div>
        )}

        <footer className="mt-8 border-t border-line pt-6 text-xs leading-5 text-muted">
          <p>
            도서 소개는 학습 목적의 큐레이션이며 특정 금융상품이나 투자 행동을 권유·보증하지 않습니다.
          </p>
        </footer>
      </div>
    </main>
  );
}
