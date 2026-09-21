import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Clock, Sparkles } from "lucide-react";

import {
  AXIS_DEFINITIONS,
  getOppositeStyle,
  PRESCRIPTION_BOOK_METADATA,
  STYLE_PROFILES,
  type StyleId,
} from "@/lib/onboarding/style-diagnosis";
import { StyleShareBar } from "@/components/onboarding/style-share-bar";

type Props = {
  params: Promise<{ animal: string }>;
};

// Fallback OG image path for style pages (OG assets can be customized in subsequent phase)
export const OG_STYLE_IMAGE_PATH = "/images/og/style";

export function generateStaticParams() {
  return (Object.keys(STYLE_PROFILES) as StyleId[]).map((animal) => ({ animal }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { animal } = await params;
  const profile = STYLE_PROFILES[animal as StyleId];
  if (!profile) return {};

  const title = `${profile.name} | ETF 투자 스타일 | ETF Campus`;
  const description = `"${profile.punchline}" ${profile.summary}`;

  return {
    title,
    description,
    alternates: { canonical: `/style/${animal}` },
    openGraph: {
      title,
      description,
      url: `/style/${animal}`,
      type: "website",
      images: [
        {
          url: `${OG_STYLE_IMAGE_PATH}/${animal}.png`,
          width: 1200,
          height: 630,
          alt: profile.name,
        },
      ],
    },
  };
}

function AxisBar({ axis, score }: { axis: (typeof AXIS_DEFINITIONS)[number]; score: number }) {
  const position = Math.round(((score + 1) / 2) * 100);
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-extrabold text-strong">{axis.name}</p>
        <p className="text-[11px] font-bold text-muted">{score <= 0 ? axis.lowLabel : axis.highLabel} 쪽</p>
      </div>
      <div
        aria-label={`${axis.name}: ${axis.lowLabel}에서 ${axis.highLabel} 사이 ${position}%`}
        className="relative mt-2 h-2 rounded-full bg-neutral-200"
        role="img"
      >
        <span className="absolute inset-y-0 left-1/2 w-px bg-neutral-400" />
        <span
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-brand-700 shadow-sm"
          style={{ left: `${position}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] font-semibold text-muted">
        <span>{axis.lowLabel}</span>
        <span>{axis.highLabel}</span>
      </div>
    </div>
  );
}

export default async function StyleAnimalPage({ params }: Props) {
  const { animal } = await params;
  const profile = STYLE_PROFILES[animal as StyleId];
  if (!profile) notFound();

  const oppositeId = getOppositeStyle(animal as StyleId);
  const oppositeProfile = STYLE_PROFILES[oppositeId];
  const books = Object.values(PRESCRIPTION_BOOK_METADATA);

  return (
    <main className="page-shell flex-1 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <nav aria-label="Breadcrumb">
          <Link
            className="inline-flex min-h-[44px] items-center text-sm font-extrabold text-brand-700 transition-colors hover:text-brand-800"
            href="/"
          >
            ← 홈으로 돌아가기
          </Link>
        </nav>

        {/* Hero Card */}
        <div className="mt-4 rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 via-surface to-neutral-50 p-6 text-center shadow-xs sm:p-8">
          <div className="relative mx-auto size-32 overflow-hidden rounded-3xl border-4 border-white bg-white shadow-md sm:size-36">
            <Image
              alt={profile.name}
              className="h-full w-full object-cover"
              height={144}
              priority
              src={profile.imagePath}
              width={144}
            />
            <span
              aria-hidden="true"
              className="absolute bottom-1 right-1 grid size-8 place-items-center rounded-full border-2 border-white bg-white text-lg shadow-xs"
            >
              {profile.emoji}
            </span>
          </div>

          <p className="mt-4 text-xs font-extrabold tracking-[0.08em] text-brand-700">ETF 투자 스타일 프로필</p>
          <h1 className="mt-1.5 text-3xl font-extrabold tracking-[-0.04em] text-strong sm:text-4xl">
            {profile.name}
          </h1>
          <p className="mt-2 text-sm font-bold text-brand-800 sm:text-base">{profile.tagline}</p>

          {/* Punchline */}
          <div className="mx-auto mt-4 max-w-lg rounded-2xl border border-brand-200/80 bg-surface/90 px-5 py-3.5 shadow-xs">
            <p className="text-sm font-bold text-brand-950 sm:text-base leading-relaxed">
              &ldquo;{profile.punchline}&rdquo;
            </p>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {profile.traits.map((trait) => (
              <span
                className="rounded-full border border-brand-200 bg-surface px-3 py-1.5 text-xs font-bold text-brand-800"
                key={trait}
              >
                {trait}
              </span>
            ))}
          </div>
        </div>

        {/* Share Action Bar */}
        <StyleShareBar profile={profile} styleId={animal as StyleId} />

        {/* Summary Description */}
        <div className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-7 shadow-xs">
          <h2 className="text-base font-extrabold text-strong">이 유형의 탐색 특성</h2>
          <p className="mt-3 leading-7 text-neutral-700 sm:text-base">{profile.summary}</p>
        </div>

        {/* 5 Exploration Axes */}
        <div className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-7 shadow-xs">
          <h2 className="text-base font-extrabold text-strong">5가지 탐색 축 기준점</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            {AXIS_DEFINITIONS.map((axis) => (
              <AxisBar axis={axis} key={axis.id} score={profile.vector[axis.id]} />
            ))}
          </div>
        </div>

        {/* Strengths & Habit */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-neutral-50 p-5 border border-line">
            <p className="text-xs font-extrabold text-muted">이 유형이 잘 발견하는 강점</p>
            <ul className="mt-3 space-y-2.5 text-sm font-semibold text-strong">
              {profile.strengths.map((value) => (
                <li className="flex items-start gap-2" key={value}>
                  <span className="text-brand-600 font-bold">✓</span>
                  <span>{value}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5">
            <p className="text-xs font-extrabold text-amber-800">이 유형이 자주 놓치는 점검 포인트</p>
            <p className="mt-3 text-sm leading-6 text-neutral-800">{profile.habit}</p>
          </div>
        </div>

        {/* Opposite Style Card */}
        {oppositeProfile ? (
          <div className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-extrabold text-brand-700">⚡ 나와 가장 다르게 보는 유형</p>
              <span className="text-[11px] font-bold text-muted">탐색 축 최대 대비</span>
            </div>
            <div className="mt-3 flex items-center gap-4">
              <div className="relative size-14 shrink-0 overflow-hidden rounded-2xl border border-line bg-neutral-100">
                <Image
                  alt={oppositeProfile.name}
                  className="h-full w-full object-cover"
                  height={56}
                  src={oppositeProfile.imagePath}
                  width={56}
                />
                <span className="absolute bottom-0 right-0 grid size-5 place-items-center rounded-full bg-white text-xs shadow-xs">
                  {oppositeProfile.emoji}
                </span>
              </div>
              <div>
                <h3 className="text-base font-extrabold text-strong">{oppositeProfile.name}</h3>
                <p className="text-xs sm:text-sm text-muted">&ldquo;{oppositeProfile.punchline}&rdquo;</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-neutral-600 border-t border-line/60 pt-3">
              5개 탐색 축 중 반대 방향에서 시장을 살피는 유형입니다. 내가 익숙한 기준을 지킬 때 상대는 새로운 가능성을 먼저 열어보므로, 팀이나 스터디에서 서로의 사각지대를 가장 확실하게 채워주는 최적의 파트너입니다.
            </p>
          </div>
        ) : null}

        {/* 3-Part Series Books */}
        <section className="mt-8 rounded-3xl border border-brand-200 bg-brand-50/40 p-6 sm:p-8 shadow-xs">
          <div className="text-center sm:text-left">
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-3 py-1 text-xs font-extrabold text-brand-800">
              <Sparkles className="h-3.5 w-3.5" /> 다음 한 걸음: 3편 시리즈
            </span>
            <h2 className="mt-2 text-xl font-extrabold text-brand-950 sm:text-2xl">
              감정을 끄고 시스템으로 완성하는 퇴직연금 ETF
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-brand-900/80 leading-relaxed">
              정보 탐색 습관을 알았다면, 이제 계좌의 비어 있는 축(신호·지도·현금흐름)을 3편 시리즈로 채워보세요.
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {books.map((book) => (
              <div
                className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-4 shadow-2xs"
                key={book.slug}
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-extrabold text-brand-800">
                      {book.shortTitle}
                    </span>
                    {book.status === "published" ? (
                      <span className="text-[10px] font-bold text-emerald-700">출간됨</span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700">
                        <Clock className="h-2.5 w-2.5" /> 준비 중
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 text-sm font-extrabold text-strong leading-snug">
                    {book.title}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-neutral-600 line-clamp-3">
                    {book.summary}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-line/60">
                  <Link
                    className="inline-flex min-h-[36px] items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-800"
                    href={`/books/${book.slug}`}
                  >
                    <span>{book.status === "published" ? "도서 소장 안내" : "30일 목차 보기"}</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 text-center">
            <Link
              className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-brand-700 px-7 py-3 text-sm font-extrabold text-white shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-brand-800"
              href="/"
            >
              <span>나도 내 투자 스타일 점검하기 (약 3분)</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* Footer Disclaimer */}
        <footer className="mt-8 border-t border-line pt-6 text-xs leading-5 text-muted">
          <p>
            이 결과는 ETF 정보 탐색 습관을 돌아보기 위한 교육용 콘텐츠이며, 금융회사의 투자성향 진단·투자 적합성 평가·종목 추천이 아닙니다.
          </p>
        </footer>
      </div>
    </main>
  );
}
