/* eslint-disable react-hooks/set-state-in-effect -- URL searchParams sync intentionally updates activeTab state after hydration. */
"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { CommunityChallenge } from "@/components/community/community-challenge";
import { FeedbackBoard } from "@/components/notice/feedback-board";

const NOTICE_LIST = [
  {
    id: "notice-2",
    tag: "기능업데이트",
    title: "도서·리뷰 탭 고도화 및 3부작 시리즈 정식 등재 안내",
    date: "2026-08-27",
    content: `ETF Campus 도서·리뷰 탭이 개편되었습니다.
- 운영자의 『감정을 끄고 시스템으로 3부작』 중 1편(모멘텀)이 정식 등재되었습니다.
- 초보·입문, 연금·절세, 배당·현금흐름 3개 핵심 분야의 검증된 Top 3 추천 도서 큐레이션이 추가되었습니다.
- 각 도서의 객관적 장단점(Pros/Cons) 및 IRP 편입 적합성 분석을 확인하실 수 있습니다.`,
  },
  {
    id: "notice-1",
    tag: "운영원칙",
    title: "ETF Campus 운영 원칙 및 객관적 검증 가이드라인",
    date: "2026-08-25",
    content: `ETF Campus는 특정 종목의 매수·매도를 권유하거나 리딩하는 공간이 아닙니다.
- 매수/매도 강요, 목표가 제시, 리딩방 광고 홍보는 사전 통보 없이 즉시 차단 및 영구 조치됩니다.
- 모든 데이터는 한국거래소(KRX) 및 운용사 공시 데이터를 기반으로 가공 없이 투명하게 제공됩니다.
- 투자의 모든 판단과 책임은 투자자 본인에게 있습니다.`,
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
    <div className="mx-auto max-w-4xl py-8 px-4 sm:px-6">
      <div className="mb-6 flex flex-wrap gap-2 border-b border-line pb-4">
        <button
          type="button"
          onClick={() => setActiveTab("notice")}
          className={`rounded-xl px-4 py-2.5 text-sm font-extrabold transition-colors ${
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
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-extrabold transition-colors ${
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
          className={`rounded-xl px-4 py-2.5 text-sm font-extrabold transition-colors ${
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
        <div>
          <CommunityChallenge />
        </div>
      )}

      {activeTab === "feedback" && (
        <div>
          <FeedbackBoard />
        </div>
      )}
    </div>
  );
}

