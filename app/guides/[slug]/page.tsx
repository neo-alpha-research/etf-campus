import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SampleBadge } from "@/components/learning/sample-badge";
import { MarkdownContent } from "@/components/markdown/markdown-content";
import { findGuide, loadGuides } from "@/lib/content/learning-content";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() { return loadGuides().map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = findGuide((await params).slug);
  return guide ? { title: guide.title, description: guide.summary } : {};
}

export default async function GuidePage({ params }: Props) {
  const guide = findGuide((await params).slug);
  if (!guide) notFound();
  return <main className="page-shell flex-1 py-8 sm:py-12">
    <div className="mx-auto max-w-3xl">
      <Link className="text-sm font-extrabold text-brand-700" href="/guides">← 자산군 가이드</Link>
      <div className="mt-6 flex flex-wrap items-center gap-2"><span className="chip">{guide.level} · {guide.readMinutes}분</span><SampleBadge /></div>
      <h1 className="mt-5 text-3xl font-extrabold tracking-[-0.04em] text-strong sm:text-4xl">{guide.title}</h1>
      <p className="mt-4 text-base leading-7 text-muted">{guide.summary}</p>
      <div className="mt-8 rounded-2xl border border-line p-5 sm:p-7"><MarkdownContent source={guide.content} /></div>
      <section className="mt-8 rounded-2xl bg-neutral-50 p-5 sm:p-6" aria-labelledby="next-assets"><h2 className="text-lg font-extrabold" id="next-assets">자산군 전체 목록으로 확인하기</h2><p className="mt-2 text-sm leading-6 text-muted">아래 연결은 특정 종목 추천이 아니라 선택한 자산군의 전체 ETF 목록입니다.</p><div className="mt-4 flex flex-wrap gap-2">{guide.assetClasses.map((asset) => <Link className="rounded-xl border border-brand-200 bg-surface px-4 py-3 text-sm font-extrabold text-brand-800" href={`/screener?asset=${encodeURIComponent(asset)}`} key={asset}>{asset} 전체 보기</Link>)}</div></section>
    </div>
  </main>;
}
