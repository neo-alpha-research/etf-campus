/* eslint-disable react-hooks/set-state-in-effect -- URL searchParams sync intentionally updates activeTab state after hydration. */
"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { CommunityChallenge } from "@/components/community/community-challenge";
import { FeedbackBoard } from "@/components/notice/feedback-board";

const NOTICE_LIST = [
  {
    id: "notice-1",
    tag: "운영원칙",
    title: "ETF Campus 운영 원칙 및 객관적 데이터 분석 가이드라인",
    date: "2026-08-25",
    content: `ETF Campus는 특정 종목의 매수·매도를 권유하거나 수익률을 보장하는 리딩 공간이 아닙니다. 투자자 스스로 합리적이고 객관적인 판단 기준을 세울 수 있도록 돕는 금융 학습 및 데이터 분석 플랫폼입니다.

• [데이터 출처 및 투명한 가공 분석]
모든 지표와 분석 정보는 한국거래소(KRX), 금융투자협회, 각 자산운용사 공시 등 공신력 있는 금융 시장 데이터를 기반으로, 객관적인 산식과 알고리즘에 따라 가공·시각화되어 투명하게 제공됩니다.

• [상업적 리딩 및 불법 홍보 차단]
특정 종목의 매수/매도 강요, 목표가 제시, 불법 리딩방 유도 및 상업적 광고 홍보 행위는 사전 통보 없이 즉시 게시물 삭제 및 계정 영구 차단 조치됩니다.

• [투자 판단과 위험 고지]
본 서비스에서 제공하는 모든 분석과 학습 콘텐츠는 투자 참고용이며, 과거의 운용 실적이나 통계가 미래의 수익을 보장하지 않습니다. 금융투자상품은 원금 손실 위험이 따르며, 모든 투자 판단과 최종 책임은 투자자 본인에게 있습니다.`,
  },
];

export function NoticeHub() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab =
    tabParam === "challenge"
      ? "challenge"
      : tabParam === "feedback"
      ? "feedback"
      : "notice";
  const [activeTab, setActiveTab] = useState<"notice" | "challenge" | "feedback">(initialTab);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "challenge" && activeTab !== "challenge") {
      setActiveTab("challenge");
    } else if (tab === "feedback" && activeTab !== "feedback") {
      setActiveTab("feedback");
    } else if (tab === "notice" && activeTab !== "notice") {
      setActiveTab("notice");
    }
  }, [searchParams, activeTab]);

  // 최신순(작성일자 내림차순) 정렬 보장
  const sortedNotices = useMemo(() => {
    return [...NOTICE_LIST].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, []);

  return (
    <main className="page-shell pt-4 pb-8 sm:pt-6 sm:pb-12">
      <div className="mb-6 flex flex-wrap gap-2 border-b border-line pb-4">
        <button
          type="button"
          onClick={() => setActiveTab("notice")}
          className={`inline-flex min-h-[42px] items-center justify-center rounded-xl px-4 py-2 text-sm font-extrabold transition-colors ${
            activeTab === "notice"
              ? "bg-brand-700 text-white"
              : "bg-surface text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          공지사항
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("challenge")}
          className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-extrabold transition-colors ${
            activeTab === "challenge"
              ? "bg-brand-700 text-white"
              : "bg-surface text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          <span>30일 챌린지</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
              activeTab === "challenge"
                ? "bg-white/20 text-white"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            준비 중
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("feedback")}
          className={`inline-flex min-h-[42px] items-center justify-center rounded-xl px-4 py-2 text-sm font-extrabold transition-colors ${
            activeTab === "feedback"
              ? "bg-brand-700 text-white"
              : "bg-surface text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          의견·오류 제보
        </button>
      </div>

      {activeTab === "notice" && (
        <div className="space-y-4">
          {sortedNotices.map((notice) => (
            <article key={notice.id} className="rounded-2xl border border-line bg-surface p-5 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="chip text-[11px] font-bold">{notice.tag}</span>
                <span className="text-xs text-neutral-400">{notice.date}</span>
              </div>
              <h3 className="mt-2 text-base font-extrabold text-strong">{notice.title}</h3>
              <p className="mt-3 whitespace-pre-line text-xs sm:text-sm text-neutral-700 leading-relaxed">
                {notice.content}
              </p>
            </article>
          ))}
        </div>
      )}

      {activeTab === "challenge" && (
        <CommunityChallenge embedded />
      )}

      {activeTab === "feedback" && (
        <FeedbackBoard />
      )}
    </main>
  );
}

