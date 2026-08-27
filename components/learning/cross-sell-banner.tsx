import Link from "next/link";
import { Sparkles, ArrowRight, BookOpen } from "lucide-react";

import { findBook, findGuide } from "@/lib/content/learning-content";

type CrossSellBannerProps = {
  internalLink: string;
};

export function CrossSellBanner({ internalLink }: CrossSellBannerProps) {
  if (!internalLink || !internalLink.trim()) return null;

  const trimmedLink = internalLink.trim();
  // Extract slug if it matches /books/[slug] or /guides/[slug]
  const bookMatch = trimmedLink.match(/^\/books\/([a-z0-9-]+)$/);
  const guideMatch = trimmedLink.match(/^\/guides\/([a-z0-9-]+)$/);

  let title = "캠퍼스 실전 가이드";
  let summary = "도서의 이론을 실제 투자 판단과 계좌 운용에 적용하는 실전 지침서입니다.";
  let badge = "캠퍼스 오리지널";

  let buttonText = "가이드 읽기";

  if (bookMatch) {
    const internalBook = findBook(bookMatch[1]);
    if (internalBook) {
      title = internalBook.title;
      summary = internalBook.summary;
      badge = `도서 큐레이션 · ${internalBook.topic}`;
      buttonText = "큐레이션 노트 읽기";
    }
  } else if (guideMatch) {
    const internalGuide = findGuide(guideMatch[1]);
    if (internalGuide) {
      title = internalGuide.title;
      summary = internalGuide.summary;
      badge = `실전 가이드 · ${internalGuide.level}`;
      buttonText = "실전 가이드 읽기";
    }
  }

  return (
    <aside className="relative my-8 overflow-hidden rounded-2xl border-2 border-brand-200 bg-linear-to-br from-brand-50/90 via-surface to-brand-50/50 p-5 sm:p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-brand-700 px-2 py-0.5 text-[11px] font-extrabold text-white">
              <Sparkles className="h-3 w-3" />
              {badge}
            </span>
            <span className="text-xs font-bold text-brand-800">함께 읽는 추천 콘텐츠</span>
          </div>

          <h3 className="mt-2.5 text-lg font-extrabold tracking-[-0.03em] text-strong sm:text-xl">
            {title}
          </h3>
          <p className="mt-1.5 text-xs sm:text-sm text-neutral-600 leading-relaxed max-w-xl">
            {summary}
          </p>
        </div>

        <div className="shrink-0">
          <Link
            href={trimmedLink}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-extrabold text-white transition-transform hover:bg-brand-900 active:scale-[0.98] shadow-xs"
          >
            <BookOpen className="h-4 w-4" />
            <span>{buttonText}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
