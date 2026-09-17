import type { Metadata } from "next";

import booksMetadata from "@/content/external-books/_metadata.json";
import { Tickery } from "@/components/brand/tickery";
import { BooksIndex } from "@/components/learning/books-index";
import { ExternalBooksIndex } from "@/components/learning/external-books-index";
import { loadBooks, loadExternalBooks } from "@/lib/content/learning-content";

export const metadata: Metadata = { title: "도서·리뷰", description: "운영자가 직접 제작한 ETF 전자책과 인터넷에서 구매할 수 있는 다양한 ETF 도서의 평점과 리뷰를 확인하세요.", alternates: { canonical: "/books" } };

export default function BooksPage() {
  const externalBooks = loadExternalBooks();
  const lastUpdated = booksMetadata.lastUpdated || "2026. 8. 31.";

  return <main className="page-shell flex-1 pt-3 pb-5 sm:pt-4 sm:pb-7">
    {/* 대안 A: 슬림 일체형 헤더 (Compact Hero) */}
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-brand-50/70 px-4 py-2.5 sm:px-5 sm:py-3 border border-brand-100/60">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-[-0.03em] text-strong">도서·리뷰</h1>
          <span className="rounded-full bg-brand-100/80 px-2 py-0.5 text-[11px] font-bold text-brand-800 border border-brand-200">
            빅 3 서점 교차 검증
          </span>
          <span className="rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-[11px] font-bold border border-blue-200">
            온라인 서점 랭킹 순
          </span>
        </div>
        <p className="mt-0.5 text-xs sm:text-sm text-neutral-600 truncate sm:whitespace-normal">
          국내 대형 서점 베스트셀러 순위를 교차 검증해 정리한 목록입니다.
        </p>
      </div>
      <Tickery className="h-10 w-10 shrink-0 sm:h-12 sm:w-12" pose="learning" priority sizes="(max-width: 640px) 40px, 48px" />
    </div>

    {/* 제휴 링크 대가 수령 고지 (표시광고법 추천·보증 심사지침 준수) */}
    <div className="mt-3 rounded-xl border border-line bg-neutral-50 px-4 py-2.5 text-xs text-neutral-600 leading-relaxed">
      이 페이지의 도서 링크에는 쿠팡 파트너스 활동이 포함되어 있으며, 이에 따라 일정액의 수수료를 제공받습니다.
    </div>

    {/* 도서 큐레이션 인덱스 (카테고리 탭 및 도서 카드) */}
    <ExternalBooksIndex books={externalBooks} lastUpdated={lastUpdated} />

    <div className="mt-10 border-t border-line pt-7 flex flex-col gap-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-[-0.03em] text-strong">캠퍼스 오리지널 가이드</h2>
        <span className="rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-xs font-bold">
          무료 열람 가이드
        </span>
        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700">
          운영자 직접 제작
        </span>
      </div>
      <p className="text-xs sm:text-sm text-muted">넘쳐나는 정보 속에서 길을 잃지 않도록, ETF 캠퍼스가 직접 체계적으로 정리한 실전 가이드입니다.</p>
    </div>
    <BooksIndex books={loadBooks()} />
  </main>;
}
