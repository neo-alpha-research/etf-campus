import type { Metadata } from "next";
import fs from "fs";
import path from "path";

import { Tickery } from "@/components/brand/tickery";
import { BooksIndex } from "@/components/learning/books-index";
import { ExternalBooksIndex } from "@/components/learning/external-books-index";
import { loadBooks, loadExternalBooks } from "@/lib/content/learning-content";

export const metadata: Metadata = { title: "도서·리뷰", description: "운영자가 직접 제작한 ETF 전자책과 인터넷에서 구매할 수 있는 다양한 ETF 도서의 평점과 리뷰를 확인하세요.", alternates: { canonical: "/books" } };

export default function BooksPage() {
  const externalBooks = loadExternalBooks();
  
  let lastUpdated = "업데이트 예정";
  try {
    const metaPath = path.join(process.cwd(), "content/external-books/_metadata.json");
    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      if (meta.lastUpdated) lastUpdated = meta.lastUpdated;
    }
  } catch (e) {}

  return <main className="page-shell flex-1 pt-4 pb-5 sm:pt-6 sm:pb-7">
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-brand-50/70 px-4 py-3.5 sm:px-6 sm:py-4">
      <div>
        <p className="eyebrow text-xs">Campus Library</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.04em] text-strong sm:text-3xl">도서·리뷰</h1>
        <p className="mt-1 max-w-2xl text-xs sm:text-sm leading-relaxed text-muted">운영자가 직접 제작한 실전 가이드부터, 검증된 외부 ETF 전자책의 솔직한 평점과 리뷰를 모아 소개합니다.</p>
      </div>
      <Tickery className="h-16 w-16 shrink-0 sm:h-20 sm:w-20" pose="learning" priority sizes="(max-width: 640px) 64px, 80px" />
    </div>
    
    <div className="mt-5 flex flex-col gap-1">
      <h2 className="text-lg sm:text-xl font-extrabold tracking-[-0.03em] text-strong">독자 리뷰 종합 리포트</h2>
      <p className="text-xs sm:text-sm text-muted">국내 빅 3 서점 독자들의 실제 리뷰와 평점을 교차 검증하여, 핵심만 객관적으로 요약했습니다.</p>
    </div>
    <ExternalBooksIndex books={externalBooks} lastUpdated={lastUpdated} />

    <div className="mt-8 border-t border-line pt-6 flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-[-0.03em] text-strong">캠퍼스 오리지널 가이드</h2>
        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700">운영자 직접 제작</span>
      </div>
      <p className="text-xs sm:text-sm text-muted">넘쳐나는 정보 속에서 길을 잃지 않도록, ETF 캠퍼스가 직접 체계적으로 정리한 실전 가이드입니다.</p>
    </div>
    <BooksIndex books={loadBooks()} />
  </main>;
}
