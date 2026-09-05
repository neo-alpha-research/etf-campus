"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowRight, Sparkles, ShieldCheck } from "lucide-react";
import { STYLE_CHANGE_EVENT, STYLE_PROFILES, type StyleId } from "@/lib/onboarding/style-diagnosis";

export function StylePageClient() {
  useEffect(() => {
    // Automatically trigger style onboarding modal upon landing on /style
    const timer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent(STYLE_CHANGE_EVENT, { detail: { open: true } }));
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const openDiagnosis = () => {
    window.dispatchEvent(new CustomEvent(STYLE_CHANGE_EVENT, { detail: { open: true } }));
  };

  return (
    <main className="page-shell flex-1 py-8 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-1 text-xs font-extrabold text-brand-800 border border-brand-200">
            <Sparkles className="h-3.5 w-3.5 text-brand-600" />
            <span>로그인 없이 3분 무료 진단</span>
          </span>
          <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-strong">
            내 퇴직연금 계좌의 빈칸을 찾는 3분 스타일 진단
          </h1>
          <p className="mt-3 text-base sm:text-lg text-muted max-w-2xl mx-auto leading-relaxed">
            남의 추천을 따라 사기 전에, 내 탐색 성향(1층 10종 동물)과 내 계좌에 빠진 시스템(2층 3대 결손)을 먼저 확인해 보세요.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={openDiagnosis}
              className="inline-flex min-h-[52px] items-center gap-2 rounded-xl bg-brand-700 px-8 py-3.5 text-base font-extrabold text-white shadow-md transition-all hover:bg-brand-800 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
            >
              <span>스타일 진단 시작하기 (약 3분)</span>
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>회원가입/로그인 불필요 · 개인정보 수집 없음 · 100% 브라우저 로컬 저장</span>
          </div>
        </div>

        {/* 10종 동물 탐색 유형 프리뷰 */}
        <section className="mt-14" aria-labelledby="animal-types">
          <h2 id="animal-types" className="text-xl font-extrabold text-strong">
            10종 동물 탐색 정체성 미리보기
          </h2>
          <p className="mt-1 text-sm text-muted">
            5개 축(시야, 범위, 리듬, 비교, 깊이)의 벡터 거리로 나의 탐색 성향을 정밀하게 계산합니다.
          </p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(Object.entries(STYLE_PROFILES) as [StyleId, typeof STYLE_PROFILES[StyleId]][]).map(([id, profile]) => (
              <Link
                key={id}
                href={`/style/${id}`}
                className="group flex flex-col justify-between rounded-2xl border border-line bg-surface p-5 transition-all hover:border-brand-400 hover:shadow-sm"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{profile.emoji}</span>
                    <h3 className="text-base font-extrabold text-strong group-hover:text-brand-700">
                      {profile.name}
                    </h3>
                  </div>
                  <p className="mt-2 text-xs text-muted leading-relaxed line-clamp-2">
                    {profile.summary}
                  </p>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs font-bold text-brand-700 pt-3 border-t border-line/50">
                  <span>전용 가이드 보기</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 3대 결손 소개 */}
        <section className="mt-14 rounded-2xl border border-line bg-neutral-50/70 p-6 sm:p-8" aria-labelledby="deficits">
          <h2 id="deficits" className="text-xl font-extrabold text-strong">
            내 계좌에 비어 있는 3대 결손(Deficit) 처방
          </h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-xl border border-line bg-surface p-5">
              <span className="text-xs font-extrabold text-brand-700">처방 1</span>
              <h3 className="mt-1 text-base font-extrabold text-strong">신호(Signal) 엔진</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                언제 사고 언제 교체할지 객관적 지표로 결정하는 규칙 엔진 (1편 모멘텀 도서 매핑)
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-5">
              <span className="text-xs font-extrabold text-brand-700">처방 2</span>
              <h3 className="mt-1 text-base font-extrabold text-strong">지도(Map) 규정서</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                주식, 채권, 대체자산 목표 비중과 리밸런싱 한 장 규정서 (2편 지수·자산배분 도서 매핑)
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-5">
              <span className="text-xs font-extrabold text-brand-700">처방 3</span>
              <h3 className="mt-1 text-base font-extrabold text-strong">현금흐름(Income) 루틴</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                원금 삭감 없는 지속 가능한 분배금 재원과 인출 원칙 (3편 배당·현금흐름 도서 매핑)
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
