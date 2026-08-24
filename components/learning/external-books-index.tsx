"use client";

import Link from "next/link";
import { Star, ThumbsUp, AlertCircle, BookOpen } from "lucide-react";
import { useState } from "react";

type ExternalBook = {
  id: string;
  title: string;
  author: string;
  platform: string;
  rating: number;
  reviewCount: number;
  tags: string[];
  category: string;
  publishInfo: string;
  pros: string[];
  cons: string[];
  url?: string;
};

const MOCK_EXTERNAL_BOOKS: ExternalBook[] = [
  // 초보·입문
  {
    id: "1", title: "직장인을 위한 실전 ETF 투자법", author: "김투자", platform: "크몽", rating: 4.8, reviewCount: 124,
    tags: ["#초보자", "#포트폴리오"], category: "초보·입문", publishInfo: "2025 개정",
    pros: ["체계적인 설명", "직장인 포트폴리오 사례"], cons: ["ETF 경험자에겐 뻔한 내용"], url: "#"
  },
  {
    id: "2", title: "ETF 무작정 따라하기", author: "박초보", platform: "예스24", rating: 4.6, reviewCount: 312,
    tags: ["#기초개념", "#용어정리"], category: "초보·입문", publishInfo: "2024 출간",
    pros: ["그림과 도표가 많아 이해가 쉬움"], cons: ["실전 투자 전략은 다소 부족"], url: "#"
  },
  // 연금·절세
  {
    id: "3", title: "연금저축 & IRP 세금 완벽 가이드", author: "절세왕", platform: "탈잉", rating: 4.5, reviewCount: 89,
    tags: ["#세금집중", "#연금"], category: "연금·절세", publishInfo: "2026 최신판",
    pros: ["정확한 연금 세금 정리", "시기별 절세 전략"], cons: ["내용이 방대함"], url: "#"
  },
  // 배당·현금흐름
  {
    id: "4", title: "월배당 ETF로 매월 100만원 만들기", author: "배당수익", platform: "독립출판", rating: 4.2, reviewCount: 45,
    tags: ["#월배당", "#현금흐름"], category: "배당·현금흐름", publishInfo: "2024 출간",
    pros: ["월배당 시뮬레이션", "은퇴자 팁"], cons: ["하락장 백테스트 부족"], url: "#"
  }
];

const CATEGORIES = ["초보·입문", "연금·절세", "배당·현금흐름"];

export function ExternalBooksIndex() {
  const [activeCategory, setActiveCategory] = useState("초보·입문");

  const filteredBooks = MOCK_EXTERNAL_BOOKS.filter(
    (book) => book.category === activeCategory
  ).slice(0, 3); // 탭별 Top 3만 노출

  return (
    <div className="mt-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* 탭 네비게이션 */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                activeCategory === cat
                  ? "bg-brand-800 text-white"
                  : "bg-surface border border-line text-muted hover:bg-neutral-100"
              }`}
            >
              {cat} Top 3
            </button>
          ))}
        </div>
        
        <p className="text-xs font-bold text-brand-600 bg-brand-50 px-3 py-1.5 rounded-lg border border-brand-200">
          ✓ 평점 4.0 이상 &amp; 논리적 근거 검증 완료
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {filteredBooks.map((book) => (
          <article key={book.id} className="flex flex-col rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-brand-200">
            
            {/* 컴팩트해진 책 표지 영역 */}
            <div className="mb-4 flex aspect-[3/4] w-28 sm:w-32 mx-auto items-center justify-center rounded-xl bg-neutral-100 border border-line/50">
              <BookOpen className="h-8 w-8 text-neutral-300" strokeWidth={1.5} />
            </div>

            <div className="flex flex-col gap-2 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[11px] font-bold text-amber-700">
                  <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                  {book.rating.toFixed(1)} <span className="text-amber-600/70">({book.reviewCount})</span>
                </span>
                <span className="text-[11px] font-bold text-muted">{book.platform}</span>
              </div>
              
              <div>
                <h3 className="mt-1 text-base font-extrabold tracking-[-0.03em] text-strong line-clamp-2 leading-tight">{book.title}</h3>
                <p className="mt-1 text-[11px] text-neutral-500">{book.author} 저 · {book.publishInfo}</p>
              </div>
              
              <div className="mt-3 flex flex-col gap-1.5 rounded-xl bg-neutral-50 p-3 border border-line/50 flex-1">
                <div className="flex flex-col gap-1">
                  {book.pros.map((pro, idx) => (
                    <div key={`pro-${idx}`} className="flex items-start gap-1.5 text-[11px] text-neutral-700 leading-snug">
                      <ThumbsUp className="mt-0.5 h-3 w-3 shrink-0 text-blue-500" />
                      <span className="line-clamp-2">{pro}</span>
                    </div>
                  ))}
                  {book.cons.map((con, idx) => (
                    <div key={`con-${idx}`} className="flex items-start gap-1.5 text-[11px] text-neutral-700 leading-snug">
                      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                      <span className="line-clamp-1">{con}</span>
                    </div>
                  ))}
                </div>
              </div>
              
            </div>
            
            <Link href={book.url || "#"} className="mt-4 inline-flex w-full min-h-10 items-center justify-center rounded-lg bg-brand-50 px-3 text-xs font-bold text-brand-700 transition-colors hover:bg-brand-100">
              리뷰 상세 보기
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
