import { NewsletterForm } from "./newsletter-form";
import { LatestCommunityPosts } from "./latest-community-posts";

const bundles = [
  { title: "1편 맛보기 PDF", description: "ETF Campus 학습 가이드 1편의 맛보기 버전을 제공합니다.", type: "PDF" },
  { title: "30일 맛보기 PDF", description: "30일 챌린지를 미리 경험해 볼 수 있는 샘플 자료입니다.", type: "PDF" },
  { title: "바이브코딩 프롬프트팩", description: "AI와 함께 ETF 데이터를 분석할 때 유용한 프롬프트 모음입니다.", type: "문서" },
  { title: "DC Alpha Scanner", description: "퇴직연금 DC형 계좌의 ETF를 필터링하는 스캐너 도구입니다.", type: "도구" },
  { title: "원칙 카드 7종", description: "투자를 결정할 때 지켜야 할 핵심 원칙 7가지를 담은 카드입니다.", type: "이미지" },
] as const;

export function CommunityLearningBundles() {
  return (
    <main className="page-shell py-7 sm:py-10">
      <section className="rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-white px-5 py-8 shadow-sm sm:px-8 sm:py-10">
        <p className="text-xs font-bold tracking-[0.18em] text-brand-700">ETF CAMPUS LEARNING BUNDLES</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">ETF 판단 기준 학습 번들</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
          ETF Campus가 준비한 핵심 학습 자료들을 만나보세요. 뉴스레터를 구독하시면 준비된 모든 자료의 다운로드 링크를 보내드립니다.
        </p>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {bundles.map((bundle) => (
          <article key={bundle.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-950">{bundle.title}</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">{bundle.type}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{bundle.description}</p>
          </article>
        ))}
      </section>

      <section className="mt-10 sm:mt-14">
        <NewsletterForm />
      </section>

      <section className="mt-10 border-t border-slate-200 pt-10 sm:mt-14 sm:pt-14">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-950">커뮤니티 최신 글</h2>
          <a href="/community" className="text-sm font-bold text-brand-700 hover:underline">
            커뮤니티로 이동 &rarr;
          </a>
        </div>
        <LatestCommunityPosts limit={3} />
      </section>
    </main>
  );
}
