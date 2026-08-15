"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CommunityAuthDialog } from "@/components/community/community-auth-dialog";
import { clearCommunityDraft, communityFetch, getCommunitySession, loadCommunityDraft, saveCommunityDraft } from "@/lib/community/browser-client";

const categories = [
  { slug: "pension-etf-qna", name: "연금 ETF Q&A" },
  { slug: "etf-questions", name: "ETF 정보·질문" },
  { slug: "challenge-30", name: "30일 챌린지" },
  { slug: "feedback", name: "오류·기능 제안" },
] as const;

export function CommunityComposer() {
  const [categorySlug, setCategorySlug] = useState("pension-etf-qna");
  const [title, setTitle] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    setSignedIn(Boolean(getCommunitySession()));
    const draft = loadCommunityDraft();
    if (draft) {
      setCategorySlug(draft.categorySlug);
      setTitle(draft.title);
      setBodyText(draft.bodyText);
      setDraftRestored(true);
    }
  }, []);

  useEffect(() => {
    if (!title && !bodyText) return;
    saveCommunityDraft({ categorySlug, title, bodyText });
  }, [categorySlug, title, bodyText]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!getCommunitySession()) {
      setMessage("작성 중인 초안을 보관했습니다. 이메일 인증 후 이어서 작성할 수 있습니다.");
      setAuthOpen(true);
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const result = await communityFetch("/api/community/posts", {
        method: "POST",
        body: JSON.stringify({ categorySlug, title, bodyText }),
      });
      clearCommunityDraft();
      window.location.assign(`/community/${result.post.slug}/`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "게시물을 저장하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="page-shell py-7 sm:py-10"><Link href="/community/" className="text-sm font-bold text-brand-700 hover:underline">← 커뮤니티 목록</Link><section className="mt-5 max-w-3xl rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"><p className="text-xs font-bold tracking-[0.18em] text-brand-700">COMMUNITY WRITE</p><h1 className="mt-2 text-2xl font-extrabold text-slate-950">판단 기준을 나누는 글쓰기</h1><p className="mt-3 text-sm leading-6 text-slate-600">매수·매도 강요, 목표가, 수익 보장, 리딩방·광고 링크, 개인정보, 확인하지 않은 AI 생성 정보를 작성할 수 없습니다. 본문은 일반 텍스트로만 저장됩니다.</p>{draftRestored ? <p role="status" className="mt-4 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900">이전에 작성하던 초안을 복원했습니다.</p> : null}{!signedIn ? <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm leading-6 text-amber-950">글 작성은 이메일 인증 회원만 가능합니다. 초안은 이 브라우저에 보관되며 로그인 후 이어서 작성할 수 있습니다.</p><button onClick={() => setAuthOpen(true)} className="mt-3 rounded-xl bg-amber-800 px-4 py-2 text-sm font-bold text-white">이메일 인증하고 작성하기</button></div> : null}<form onSubmit={submit} className="mt-6 space-y-5"><label className="block text-sm font-bold text-slate-800">게시판<select value={categorySlug} onChange={(event) => setCategorySlug(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100">{categories.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}</select></label><label className="block text-sm font-bold text-slate-800">제목<input value={title} onChange={(event) => setTitle(event.target.value)} minLength={2} maxLength={120} required className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="무엇을 확인하고 싶은지 적어 주세요" /></label><label className="block text-sm font-bold text-slate-800">본문<textarea value={bodyText} onChange={(event) => setBodyText(event.target.value)} minLength={2} maxLength={6000} required rows={14} className="mt-2 w-full resize-y rounded-xl border border-slate-300 p-3 text-base leading-7 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="확인한 자료, 기준 시점, 궁금한 판단 기준을 적어 주세요." /></label><div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Link href="/community/" className="rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-bold text-slate-700">취소</Link><button disabled={loading} className="rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400">{loading ? "저장 중" : signedIn ? "게시물 등록" : "로그인 후 등록"}</button></div></form>{message ? <p role="status" className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">{message}</p> : null}</section><CommunityAuthDialog open={authOpen} onClose={() => setAuthOpen(false)} onAuthenticated={() => { setSignedIn(true); setAuthOpen(false); setMessage("인증을 완료했습니다. 보관된 초안을 이어서 작성해 주세요."); }} /></div>;
}
