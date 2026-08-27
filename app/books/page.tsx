import type { Metadata } from "next";

import { Tickery } from "@/components/brand/tickery";
import { BooksIndex } from "@/components/learning/books-index";
import { ExternalBooksIndex } from "@/components/learning/external-books-index";
import { loadBooks, loadExternalBooks } from "@/lib/content/learning-content";

export const metadata: Metadata = { title: "도서·리뷰", description: "운영자가 직접 제작한 ETF 전자책과 인터넷에서 구매할 수 있는 다양한 ETF 도서의 평점과 리뷰를 확인하세요.", alternates: { canonical: "/books" } };

export default function BooksPage() {
  const externalBooks = loadExternalBooks();
  return <main className="page-shell flex-1 py-8 sm:py-12">
    <div className="flex items-center justify-between gap-5 rounded-3xl bg-brand-50/70 px-5 py-5 sm:px-7">
      <div><p className="eyebrow">Campus Library</p><h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-strong sm:text-4xl">도서·리뷰</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-muted">운영자가 직접 제작한 실전 가이드부터, 검증된 외부 ETF 전자책의 솔직한 평점과 리뷰를 모아 소개합니다.</p></div>
      <Tickery className="h-24 w-24 shrink-0 sm:h-32 sm:w-32" pose="learning" priority sizes="(max-width: 640px) 96px, 128px" />
    </div>
    
    {/* TODO: 외부 도서 리뷰 연동이 모두 완료되면 아래 안내 문구 삭제 */}
    <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 font-bold">
      🚧 현재 새로운 &apos;도서·리뷰&apos; 서비스 준비 중입니다. 화면에 보이는 리뷰는 임시 샘플 데이터이므로 이용에 참고 부탁드립니다.
    </div>

    <div className="mt-4 rounded-xl border border-line bg-neutral-50 px-4 py-3 text-xs leading-5 text-muted">제휴 링크가 포함되는 콘텐츠에는 해당 링크 가까이에 광고·제휴 사실을 명확히 표시합니다. 현재 샘플에는 구매 링크가 없습니다.</div>
    
    <div className="mt-8 flex flex-col gap-2">
      <h2 className="text-xl font-extrabold tracking-[-0.03em] text-strong">독자 리뷰 종합 리포트</h2>
      <p className="text-sm text-muted">인터넷 곳곳에 흩어진 독자들의 실제 리뷰와 평점을 종합하여, ETF 캠퍼스의 기준으로 핵심만 요약했습니다.</p>
    </div>
    <ExternalBooksIndex books={externalBooks} />

    <div className="mt-16 border-t border-line pt-12 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-extrabold tracking-[-0.03em] text-strong">캠퍼스 오리지널 가이드</h2>
        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700">운영자 직접 제작</span>
      </div>
      <p className="text-sm text-muted">넘쳐나는 정보 속에서 길을 잃지 않도록, ETF 캠퍼스가 직접 체계적으로 정리한 실전 가이드입니다.</p>
    </div>
    <BooksIndex books={loadBooks()} />
  </main>;
}
