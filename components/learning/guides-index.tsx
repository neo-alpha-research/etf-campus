"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { SampleBadge } from "@/components/learning/sample-badge";
import type { Guide } from "@/lib/content/learning-content";
import { STYLE_PROFILES, type StyleId } from "@/lib/onboarding/style-diagnosis";

export function GuidesIndex({ guides }: { guides: Guide[] }) {
  const requestedStyle = useSearchParams().get("style") as StyleId | null;
  const validStyle = requestedStyle && Object.hasOwn(STYLE_PROFILES, requestedStyle) ? requestedStyle : null;
  const ordered = validStyle ? [...guides].sort((a, b) => Number(b.styles.includes(validStyle)) - Number(a.styles.includes(validStyle))) : guides;

  return (
    <>
      {validStyle ? <div className="mt-7 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm leading-6 text-brand-900"><strong>{STYLE_PROFILES[validStyle].name}</strong>에게 먼저 읽기 편한 가이드를 위에 배치했습니다. 진단 결과는 투자 적합성 평가가 아닙니다.</div> : null}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {ordered.map((guide) => {
          const matched = Boolean(validStyle && guide.styles.includes(validStyle));
          return <article className={`rounded-2xl border p-5 sm:p-6 ${matched ? "border-brand-300 bg-brand-50/60" : "border-line bg-surface"}`} key={guide.slug}>
            <div className="flex flex-wrap items-center gap-2"><span className="chip">{guide.level} · {guide.readMinutes}분</span>{matched ? <span className="text-xs font-extrabold text-brand-700">내 스타일 첫 가이드</span> : null}<SampleBadge /></div>
            <h2 className="mt-5 text-xl font-extrabold tracking-[-0.03em] text-strong">{guide.title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted">{guide.summary}</p>
            <div className="mt-4 flex flex-wrap gap-2">{guide.assetClasses.map((asset) => <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-bold text-neutral-700" key={asset}>{asset}</span>)}</div>
            <Link className="mt-6 inline-flex min-h-11 items-center font-extrabold text-brand-700" href={`/guides/${guide.slug}`}>가이드 읽기 →</Link>
          </article>;
        })}
      </div>
    </>
  );
}
