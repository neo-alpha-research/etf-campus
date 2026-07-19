import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MarkdownContent } from "@/components/markdown/markdown-content";
import { findBriefing, loadBriefings } from "@/lib/content/briefings";

type Props = { params: Promise<{ date: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return loadBriefings().map((briefing) => ({ date: briefing.date })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> { const briefing = findBriefing((await params).date); return briefing ? { title: briefing.title, description: briefing.summary, alternates: { canonical: `/briefing/${briefing.date}` } } : {}; }

export default async function BriefingDetailPage({ params }: Props) {
  const briefing = findBriefing((await params).date);
  if (!briefing) notFound();
  return <main className="page-shell flex-1 py-8 sm:py-12"><Link className="text-sm font-bold text-brand-700" href="/briefing">← 브리핑 목록</Link><article className="mx-auto mt-7 max-w-3xl"><div className="sticky top-0 z-10 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-bold leading-6 text-brand-900">본 브리핑은 AI가 공시 데이터를 기반으로 생성하고 운영자가 검수한 콘텐츠입니다</div><div className="mt-7 flex items-center gap-2"><time className="tabular-nums text-sm font-bold text-muted" dateTime={briefing.date}>{briefing.date.replaceAll("-", ".")}</time>{briefing.isSample ? <span className="rounded bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">SAMPLE</span> : null}</div><div className="mt-6"><MarkdownContent source={briefing.content} /></div></article></main>;
}
