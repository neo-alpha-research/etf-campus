/* eslint-disable react-hooks/set-state-in-effect -- Client-only authentication, draft restoration, and public data loading intentionally update state after hydration. */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CommunityAuthDialog } from "@/components/community/community-auth-dialog";
import { clearCommunitySession, communityFetch, getCommunitySession, refreshCommunitySession, signOutCommunity } from "@/lib/community/browser-client";
import { getCommunityBoardNotice } from "@/lib/community/community-notices";

const categories = [
  { slug: "", name: "전체" },
  { slug: "notice", name: "공지" },
  { slug: "pension-etf-qna", name: "연금 ETF Q&A" },
  { slug: "etf-questions", name: "ETF 정보·질문" },
  { slug: "challenge-30", name: "30일 챌린지" },
  { slug: "feedback", name: "오류·기능 제안" },
] as const;

type Post = {
  slug: string;
  title: string;
  excerpt?: string;
  bodyText?: string;
  category: { slug: string; name: string };
  authorNickname: string;
  createdAt: string;
  commentCount: number;
  isPinned?: boolean;
};

function displayDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(new Date(value));
}

export function CommunityFeed() {
  const [selected, setSelected] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [withdrawalMode, setWithdrawalMode] = useState<"anonymize" | "delete">("anonymize");
  const [accountMessage, setAccountMessage] = useState("");
  const boardNotice = getCommunityBoardNotice(selected);

  useEffect(() => {
    refreshCommunitySession().then(setSignedIn);
  }, []);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setNextCursor(null);
    const params = new URLSearchParams({ limit: "12" });
    if (selected) params.set("category", selected);
    fetch(`/api/community/posts?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("게시물을 불러오지 못했습니다.");
        return response.json();
      })
      .then((result) => {
        if (!active) return;
        setPosts(result.posts ?? []);
        setNextCursor(typeof result.nextCursor === "string" ? result.nextCursor : null);
        setStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setStatus("error");
      });
    return () => { active = false; };
  }, [selected]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ limit: "12", cursor: nextCursor });
      if (selected) params.set("category", selected);
      const response = await fetch(`/api/community/posts?${params.toString()}`);
      if (!response.ok) throw new Error("게시물을 불러오지 못했습니다.");
      const result = await response.json();
      setPosts((current) => [...current, ...(result.posts ?? [])]);
      setNextCursor(typeof result.nextCursor === "string" ? result.nextCursor : null);
    } catch {
      setAccountMessage("추가 게시물을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoadingMore(false);
    }
  }

  function goToWrite() {
    if (!getCommunitySession()) {
      setAuthOpen(true);
      return;
    }
    window.location.assign("/community/write/");
  }

  async function logout() {
    await signOutCommunity();
    setSignedIn(false);
    setAccountOpen(false);
    setAccountMessage("로그아웃했습니다.");
  }

  async function withdraw() {
    setAccountMessage("");
    try {
      await communityFetch("/api/community/auth/account", {
        method: "DELETE",
        body: JSON.stringify({ contentDisposition: withdrawalMode }),
      });
      clearCommunitySession();
      setSignedIn(false);
      setAccountOpen(false);
      setAccountMessage("탈퇴 요청을 처리했습니다.");
    } catch (error) {
      setAccountMessage(error instanceof Error ? error.message : "탈퇴 요청을 처리하지 못했습니다.");
    }
  }

  return (
    <div className="page-shell py-7 sm:py-10">
      <section className="rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-white px-5 py-7 shadow-sm sm:px-8 sm:py-10">
        <p className="text-xs font-bold tracking-[0.18em] text-brand-700">ETF CAMPUS COMMUNITY</p>
        <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl"><h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">ETF 판단 기준을 함께 배우고 검증합니다</h1><p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">특정 ETF 추천이나 수익 경쟁이 아닌, 연금·상품 구조·공시·위험·서비스 신뢰도를 확인하는 커뮤니티입니다.</p><div className="mt-4 flex flex-wrap gap-3 text-sm font-bold"><Link href="/community/learning-bundles/" className="text-brand-800 underline decoration-brand-300 underline-offset-4">학습 번들 보기</Link><Link href="/community/challenge/" className="text-brand-800 underline decoration-brand-300 underline-offset-4">30일 챌린지</Link></div></div>
          <div className="flex shrink-0 flex-wrap gap-2"><button onClick={goToWrite} className="rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-brand-800">글 작성</button>{signedIn ? <button onClick={() => setAccountOpen((current) => !current)} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700">계정</button> : <button onClick={() => setAuthOpen(true)} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700">이메일 로그인</button>}</div>
        </div>
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"><p><span className="font-bold">운영 공지</span><span className="mx-2 text-amber-400">|</span>게시물은 공개로 읽을 수 있으며, 작성·댓글은 이메일 인증 회원만 가능합니다. 매수·매도 강요, 목표가, 수익 보장, 리딩방·광고 유도는 허용하지 않습니다.</p><p className="mt-2 text-amber-900">처음 이용한다면 <Link className="font-bold underline decoration-amber-400 underline-offset-2" href="/guides/">학습용 예시 가이드</Link>와 <Link className="font-bold underline decoration-amber-400 underline-offset-2" href="/books/">읽기 경로</Link>를 참고해 주세요. 예시는 판단 기준을 익히기 위한 자료이며 개인별 결정을 대신하지 않습니다.</p></div>
      </section>

      {accountOpen ? <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-slate-950">내 계정</h2><p className="mt-1 text-sm text-slate-600">세션은 이 브라우저 탭에만 보관됩니다.</p></div><button onClick={logout} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700">로그아웃</button></div><div className="mt-5 border-t border-slate-100 pt-5"><p className="text-sm font-bold text-slate-900">회원 탈퇴</p><p className="mt-1 text-sm leading-6 text-slate-600">탈퇴하면 세션이 즉시 폐기되고 이메일 식별자·닉네임·선택 프로필은 최대 7일 안에 삭제됩니다.</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><label className="rounded-xl border border-slate-200 p-3 text-sm text-slate-700"><input checked={withdrawalMode === "anonymize"} onChange={() => setWithdrawalMode("anonymize")} className="mr-2" type="radio" name="withdraw" />글·댓글은 “탈퇴한 사용자”로 익명화 유지</label><label className="rounded-xl border border-slate-200 p-3 text-sm text-slate-700"><input checked={withdrawalMode === "delete"} onChange={() => setWithdrawalMode("delete")} className="mr-2" type="radio" name="withdraw" />글·댓글 공개 노출 중단 후 삭제</label></div><button onClick={withdraw} className="mt-3 rounded-xl border border-rose-300 px-3 py-2 text-sm font-bold text-rose-700">탈퇴 요청</button></div></section> : null}
      {accountMessage ? <p role="status" className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">{accountMessage}</p> : null}

      <nav aria-label="커뮤니티 게시판" className="mt-8 flex gap-2 overflow-x-auto pb-1">{categories.map((category) => <button key={category.slug} onClick={() => setSelected(category.slug)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${selected === category.slug ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{category.name}</button>)}</nav>

      {boardNotice ? <aside aria-live="polite" className="mt-4 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-4 text-sm leading-6 text-brand-950 sm:px-5"><h2 className="font-extrabold">{boardNotice.title}</h2><p className="mt-1 text-brand-900">{boardNotice.body}</p></aside> : null}

      <section className="mt-5" aria-live="polite">
        {status === "loading" ? <div className="space-y-3">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />)}</div> : null}
        {status === "error" ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center"><h2 className="font-bold text-rose-950">게시물을 불러오지 못했습니다.</h2><p className="mt-2 text-sm text-rose-800">잠시 후 다시 시도해 주세요.</p><button onClick={() => setSelected((value) => value)} className="mt-4 rounded-xl bg-rose-700 px-4 py-2 text-sm font-bold text-white">다시 시도</button></div> : null}
        {status === "ready" && posts.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"><h2 className="text-lg font-bold text-slate-900">아직 게시물이 없습니다.</h2><p className="mt-2 text-sm leading-6 text-slate-600">첫 질문이나 학습 기록을 남겨 ETF 판단 기준을 함께 확인해 보세요.</p><button onClick={goToWrite} className="mt-5 rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white">첫 글 작성하기</button></div> : null}
        {status === "ready" && posts.length > 0 ? <div className="space-y-3">{posts.map((post) => <Link key={post.slug} href={`/community/read/?slug=${encodeURIComponent(post.slug)}`} className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"><div className="flex items-center gap-2 text-xs font-bold text-brand-700"><span>{post.category.name}</span>{post.isPinned ? <><span className="text-slate-300">·</span><span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">고정</span></> : null}<span className="text-slate-300">·</span><span className="text-slate-500">{displayDate(post.createdAt)}</span></div><h2 className="mt-2 text-lg font-bold text-slate-950">{post.title}</h2><p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{post.excerpt ?? post.bodyText}</p><div className="mt-4 flex items-center gap-3 text-xs text-slate-500"><span>{post.authorNickname}</span><span>댓글 {post.commentCount}</span></div></Link>)}{nextCursor ? <div className="pt-2 text-center"><button type="button" onClick={loadMore} disabled={loadingMore} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60">{loadingMore ? "불러오는 중…" : "더보기"}</button></div> : null}</div> : null}
      </section>
      <CommunityAuthDialog open={authOpen} onClose={() => setAuthOpen(false)} onAuthenticated={() => { setSignedIn(true); setAuthOpen(false); }} />
    </div>
  );
}
