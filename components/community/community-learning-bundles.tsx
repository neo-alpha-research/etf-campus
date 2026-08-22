import Link from "next/link";

const bundles = [
  { title: "ETF 비용 비교 체크리스트", description: "총보수와 실부담비용을 비교할 때 확인할 항목을 정리합니다.", href: "/guides/" },
  { title: "분배금·공시 읽기 노트", description: "분배금 공시를 수익 보장으로 오해하지 않고 읽는 기준을 안내합니다.", href: "/guides/" },
  { title: "연금 계좌 ETF 판단 기준", description: "DC·IRP·연금저축에서 제도와 상품 구조를 함께 확인합니다.", href: "/guides/" },
  { title: "ETF 위험 확인 카드", description: "추적 지수, 자산 구성, 유동성, 환헤지 등 점검 항목을 제공합니다.", href: "/guides/" },
  { title: "30일 학습 기록 템플릿", description: "수익률이 아닌 판단 기준 학습을 기록하는 방법을 안내합니다.", href: "/community/challenge/" },
] as const;

export function CommunityLearningBundles() {
  return (
    <main className="page-shell py-7 sm:py-10">
      <section className="rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-white px-5 py-8 shadow-sm sm:px-8 sm:py-10">
        <p className="text-xs font-bold tracking-[0.18em] text-brand-700">ETF CAMPUS LEARNING BUNDLES</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">ETF 판단 기준 학습 번들</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">아래 자료는 특정 ETF 추천이나 수익 보장을 위한 자료가 아니라, 비용·공시·위험·연금 계좌의 판단 기준을 스스로 점검하기 위한 학습 자료입니다.</p>
      </section>
      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {bundles.map((bundle) => <article key={bundle.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold text-slate-950">{bundle.title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{bundle.description}</p><Link href={bundle.href} className="mt-5 inline-flex rounded-xl border border-brand-200 px-3 py-2 text-sm font-bold text-brand-800 hover:bg-brand-50">학습 자료 보기</Link></article>)}
      </section>
      <aside className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-700"><strong className="text-slate-950">이메일 안내</strong><p className="mt-1">현재는 이메일을 수집하거나 뉴스레터를 발송하지 않습니다. 이메일 안내는 동의·보존·수신거부·발송 벤더 정책이 별도로 확정된 뒤에만 도입합니다.</p></aside>
    </main>
  );
}
