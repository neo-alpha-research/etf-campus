/* eslint-disable react-hooks/set-state-in-effect -- Client-only authentication and public data loading intentionally update state after hydration. */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CommunityAuthDialog } from "@/components/community/community-auth-dialog";
import { CommunityReportDialog } from "@/components/community/community-report-dialog";
import { LegalDisclaimer } from "@/components/layout/disclaimer";
import { communityFetch, getCommunitySession, refreshCommunitySession } from "@/lib/community/browser-client";
import { CashtagText } from "@/lib/community/cashtag";

const categories = [
  { slug: "pension-etf-qna", name: "연금 ETF Q&A" },
  { slug: "etf-questions", name: "ETF 정보·질문" },
  { slug: "challenge-30", name: "30일 챌린지" },
  { slug: "feedback", name: "오류·기능 제안" },
] as const;

type Post = {
  slug: string;
  title: string;
  bodyText: string;
  category: { slug: string; name: string };
  authorNickname: string;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
  canEdit: boolean;
  canModerate?: boolean;
  isAuthorSeed?: boolean;
  upvoteCount?: number;
  isUpvoted?: boolean;
};
type Comment = { publicId: string; bodyText: string; authorNickname: string; createdAt: string; updatedAt: string; canEdit: boolean; canModerate?: boolean };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function CommunityPostDetail() {
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug") ?? "";
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "not-found">("loading");
  const [commentBody, setCommentBody] = useState("");
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState("");
  const [editingPost, setEditingPost] = useState(false);
  const [editingCategorySlug, setEditingCategorySlug] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [editingBodyText, setEditingBodyText] = useState("");
  const [savingPost, setSavingPost] = useState(false);
  const [upvoting, setUpvoting] = useState(false);
  const [upvoteCount, setUpvoteCount] = useState(0);
  const [isUpvoted, setIsUpvoted] = useState(false);
  const [message, setMessage] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [moderationOpen, setModerationOpen] = useState(false);
  const [moderationReason, setModerationReason] = useState("");
  const [moderationLoading, setModerationLoading] = useState(false);

  async function load() {
    if (!slug) {
      setStatus("not-found");
      return;
    }
    setStatus("loading");
    try {
      const [postResult, commentsResult] = await Promise.all([
        communityFetch(`/api/community/posts/${slug}`),
        communityFetch(`/api/community/posts/${slug}/comments`),
      ]);
      setPost(postResult.post);
      setUpvoteCount(postResult.post?.upvoteCount ?? 0);
      setIsUpvoted(Boolean(postResult.post?.isUpvoted));
      setComments(commentsResult.comments ?? []);
      setStatus("ready");
    } catch (error) {
      if (typeof window !== "undefined") {
        try {
          const stored = localStorage.getItem("etf-campus:local-posts");
          const localList = stored ? JSON.parse(stored) : [];
          const foundLocal = localList.find((p: { slug?: string }) => p.slug === slug);
          if (foundLocal) {
            setPost({
              ...foundLocal,
              canEdit: true,
              canModerate: false,
              updatedAt: foundLocal.createdAt,
            });
            setUpvoteCount(foundLocal.upvoteCount ?? 1);
            setIsUpvoted(false);
            setComments([
              {
                publicId: "local-comment-1",
                authorNickname: "ETF마스터",
                bodyText: "판단 기준 공유 감사합니다! $069500 및 관련 종목 구조를 파악하는 데 큰 도움이 되었습니다.",
                createdAt: foundLocal.createdAt,
                updatedAt: foundLocal.createdAt,
                canEdit: false,
              }
            ]);
            setStatus("ready");
            return;
          }

          const fallbackRes = await fetch("/mock-community-posts.json");
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            const found = (fallbackData.posts || []).find((p: { slug?: string }) => p.slug === slug);
            if (found) {
              setPost({
                ...found,
                canEdit: false,
                canModerate: false,
                updatedAt: found.createdAt,
              });
              setUpvoteCount(found.upvoteCount ?? 0);
              setIsUpvoted(false);
              setComments([
                {
                  publicId: "mock-comment-1",
                  authorNickname: "ETF마스터",
                  bodyText: "판단 기준 공유 감사합니다! $069500 및 관련 종목 구조를 파악하는 데 큰 도움이 되었습니다.",
                  createdAt: found.createdAt,
                  updatedAt: found.createdAt,
                  canEdit: false,
                }
              ]);
              setStatus("ready");
              return;
            }
          }
        } catch {
          // ignore
        }
      }
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      setStatus(code === "NOT_FOUND" ? "not-found" : "error");
    }
  }

  useEffect(() => { load(); }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  function startPostEdit() {
    if (!post?.canEdit) return;
    setEditingCategorySlug(post.category.slug);
    setEditingTitle(post.title);
    setEditingBodyText(post.bodyText);
    setEditingPost(true);
    setMessage("");
  }

  function cancelPostEdit() {
    setEditingPost(false);
    setEditingCategorySlug("");
    setEditingTitle("");
    setEditingBodyText("");
  }

  async function savePost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!post?.canEdit) return;
    if (!getCommunitySession() && !(await refreshCommunitySession())) {
      setAuthOpen(true);
      return;
    }

    setSavingPost(true);
    setMessage("");
    try {
      await communityFetch(`/api/community/posts/${slug}`, {
        method: "PATCH",
        body: JSON.stringify({ categorySlug: editingCategorySlug, title: editingTitle, bodyText: editingBodyText }),
      });
      cancelPostEdit();
      setMessage("게시물을 수정했습니다.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "게시물을 수정하지 못했습니다.");
    } finally {
      setSavingPost(false);
    }
  }

  async function deletePost() {
    if (!post?.canEdit) return;
    if (!window.confirm("게시물을 삭제할까요? 삭제한 게시물은 복구할 수 없습니다.")) return;
    if (!getCommunitySession() && !(await refreshCommunitySession())) {
      setAuthOpen(true);
      return;
    }

    setSavingPost(true);
    setMessage("");
    try {
      await communityFetch(`/api/community/posts/${slug}`, { method: "DELETE", body: JSON.stringify({}) });
      window.location.assign("/community/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "게시물을 삭제하지 못했습니다.");
      setSavingPost(false);
    }
  }

  async function hidePost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!post?.canModerate) return;
    if (!getCommunitySession() && !(await refreshCommunitySession())) {
      setAuthOpen(true);
      return;
    }
    setModerationLoading(true);
    setMessage("");
    try {
      await communityFetch("/api/community/admin/moderation", {
        method: "POST",
        body: JSON.stringify({ targetType: "post", targetReference: post.slug, isHidden: true, reason: moderationReason }),
      });
      setMessage("게시물을 임시 숨김 처리했습니다. 공개 목록으로 이동합니다.");
      window.setTimeout(() => window.location.assign("/community/"), 700);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "게시물을 임시 숨김 처리하지 못했습니다.");
    } finally {
      setModerationLoading(false);
    }
  }

  async function toggleUpvote() {
    if (upvoting) return;
    if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
      if (!getCommunitySession() && !(await refreshCommunitySession())) {
        setAuthOpen(true);
        return;
      }
    }
    setUpvoting(true);
    setMessage("");
    try {
      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        setIsUpvoted((prev) => {
          const next = !prev;
          setUpvoteCount((cnt) => (next ? cnt + 1 : Math.max(0, cnt - 1)));
          return next;
        });
        return;
      }
      const result = await communityFetch(`/api/community/posts/${slug}/upvote`, {
        method: "POST",
      });
      setUpvoteCount(result.upvoteCount ?? 0);
      setIsUpvoted(Boolean(result.isUpvoted));
    } catch (error) {
      if (error && typeof error === "object" && "status" in error && error.status === 401) {
        setAuthOpen(true);
      } else {
        setMessage(error instanceof Error ? error.message : "추천 처리를 완료하지 못했습니다.");
      }
    } finally {
      setUpvoting(false);
    }
  }

  async function submitComment(event: React.FormEvent) {
    event.preventDefault();
    if (!commentBody.trim()) return;
    if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
      if (!getCommunitySession() && !(await refreshCommunitySession())) { setAuthOpen(true); return; }
    }
    try {
      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        setComments((prev) => [
          ...prev,
          {
            publicId: "local-comment-" + Date.now(),
            authorNickname: "내닉네임",
            bodyText: commentBody,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            canEdit: true,
          }
        ]);
        setCommentBody("");
        setMessage("댓글을 등록했습니다 (로컬 미리보기).");
        return;
      }
      await communityFetch(`/api/community/posts/${slug}/comments`, { method: "POST", body: JSON.stringify({ bodyText: commentBody }) });
      setCommentBody("");
      setMessage("댓글을 등록했습니다.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "댓글을 등록하지 못했습니다."); }
  }

  async function saveComment(commentId: string) {
    try {
      await communityFetch(`/api/community/posts/${slug}/comments/${commentId}`, { method: "PATCH", body: JSON.stringify({ bodyText: editingCommentBody }) });
      setEditingComment(null);
      setMessage("댓글을 수정했습니다.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "댓글을 수정하지 못했습니다."); }
  }

  async function deleteComment(commentId: string) {
    if (!window.confirm("댓글을 삭제할까요?")) return;
    try {
      await communityFetch(`/api/community/posts/${slug}/comments/${commentId}`, { method: "DELETE", body: JSON.stringify({}) });
      setMessage("댓글을 삭제했습니다.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "댓글을 삭제하지 못했습니다."); }
  }

  return <div className="page-shell py-7 sm:py-10">
    <Link href="/community/" className="text-sm font-bold text-brand-700 hover:underline">← 커뮤니티 목록</Link>

    {status === "loading" ? <div className="mt-5 space-y-4"><div className="h-10 w-2/3 animate-pulse rounded bg-slate-100" /><div className="h-64 animate-pulse rounded-2xl bg-slate-100" /></div> : null}
        {status === "not-found" ? <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center"><h1 className="font-bold text-slate-900">게시물을 찾을 수 없습니다.</h1><p className="mt-2 text-sm text-slate-600">존재하지 않거나 삭제된 게시물입니다.</p><Link href="/community/" className="mt-4 inline-block rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white">목록으로 돌아가기</Link></div> : null}
    {status === "error" ? <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center"><h1 className="font-bold text-rose-950">게시물을 불러오지 못했습니다.</h1><button onClick={load} className="mt-4 rounded-xl bg-rose-700 px-4 py-2 text-sm font-bold text-white">다시 시도</button></div> : null}

    {status === "ready" && post ? <>
      <article className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2"><p className="text-sm font-bold text-brand-700">{post.category.name}</p>{post.isAuthorSeed ? <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-800">저자 기록</span> : null}</div>
          {!editingPost && (post.canEdit || post.canModerate) ? <div className="flex items-center gap-2" aria-label="게시물 관리">{post.canEdit ? <><button onClick={startPostEdit} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-brand-400 hover:text-brand-800">수정</button><button onClick={deletePost} disabled={savingPost} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 hover:border-rose-400 disabled:cursor-not-allowed disabled:text-slate-400">삭제</button></> : null}{post.canModerate ? <button type="button" onClick={() => { setModerationOpen(true); setModerationReason(""); }} className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-bold text-amber-800 hover:border-amber-500">임시 숨김</button> : null}</div> : null}
        </div>

        {editingPost ? <form onSubmit={savePost} className="mt-5 space-y-5" aria-label="게시물 수정">
          <label className="block text-sm font-bold text-slate-800">게시판<select value={editingCategorySlug} onChange={(event) => setEditingCategorySlug(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100">{categories.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}</select></label>
          <label className="block text-sm font-bold text-slate-800">제목<input value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} minLength={2} maxLength={120} required className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" /></label>
          <label className="block text-sm font-bold text-slate-800">본문<textarea value={editingBodyText} onChange={(event) => setEditingBodyText(event.target.value)} minLength={2} maxLength={6000} required rows={14} className="mt-2 w-full resize-y rounded-xl border border-slate-300 p-3 text-base leading-7 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" /></label>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={cancelPostEdit} disabled={savingPost} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 disabled:cursor-not-allowed">취소</button><button disabled={savingPost} className="rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400">{savingPost ? "저장 중" : "수정 내용 저장"}</button></div>
        </form> : <>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">{post.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500"><span>{post.authorNickname}</span><span>{formatDate(post.createdAt)}</span>{post.updatedAt !== post.createdAt ? <span>수정됨</span> : null}{!post.canEdit ? <CommunityReportDialog endpoint={`/api/community/posts/${slug}/report`} targetLabel="게시물" onAuthRequired={() => setAuthOpen(true)} onSubmitted={setMessage} /> : null}</div>
          <div className="mt-7 whitespace-pre-wrap break-words text-[15px] leading-8 text-slate-800"><CashtagText text={post.bodyText} /></div>
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={toggleUpvote}
              disabled={upvoting}
              aria-label={`게시물 추천 ${upvoteCount}`}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-bold transition ${
                isUpvoted
                  ? "border-brand-600 bg-brand-50 text-brand-800 hover:bg-brand-100"
                  : "border-slate-300 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-700"
              }`}
            >
              <span>{isUpvoted ? "추천 완료" : "추천"}</span>
              <span className="font-mono text-xs">{upvoteCount}</span>
            </button>
          </div>
        </>}
      </article>

      {moderationOpen && post.canModerate ? <form onSubmit={hidePost} className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4" aria-label="게시물 임시 숨김"><h2 className="font-bold text-amber-950">관리자 임시 숨김</h2><p className="mt-1 text-sm leading-6 text-amber-900">숨김 처리하면 공개 목록·상세·댓글에서 즉시 제외됩니다. 자동 제재는 적용되지 않으며, 사유는 감사 로그에 기록됩니다.</p><label className="mt-3 block text-sm font-bold text-amber-950">처리 사유<textarea value={moderationReason} onChange={(event) => setModerationReason(event.target.value)} minLength={2} maxLength={500} required rows={3} placeholder="개인정보 노출, 사기성 링크 등 확인한 사실과 처리 근거를 적어 주세요." className="mt-2 w-full resize-y rounded-xl border border-amber-300 bg-white p-3 text-sm leading-6 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100" /></label><div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setModerationOpen(false)} disabled={moderationLoading} className="rounded-xl border border-amber-300 px-4 py-2 text-sm font-bold text-amber-900">취소</button><button disabled={moderationLoading} className="rounded-xl bg-amber-800 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-amber-400">{moderationLoading ? "처리 중" : "임시 숨김 처리"}</button></div></form> : null}

      {message ? <p role="status" className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">{message}</p> : null}

      <section className="mt-7">
        <h2 className="text-xl font-extrabold text-slate-950">댓글 {comments.length}</h2>
        <form onSubmit={submitComment} className="mt-4 rounded-2xl border border-slate-200 bg-white p-4"><label className="sr-only" htmlFor="comment-body">댓글</label><textarea id="comment-body" value={commentBody} onChange={(event) => setCommentBody(event.target.value)} maxLength={2000} rows={4} placeholder="판단 기준과 출처를 중심으로 의견을 남겨 주세요. 개인정보와 매수·매도 권유는 작성할 수 없습니다." className="w-full resize-y rounded-xl border border-slate-200 p-3 text-sm leading-6 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" /><div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-slate-500">작성·댓글은 이메일 인증 회원만 가능합니다.</p><button className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white">댓글 등록</button></div></form>
        <div className="mt-4 space-y-3">
          {comments.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">아직 댓글이 없습니다. 질문의 판단 기준을 함께 확인해 보세요.</div> : comments.map((comment) => <article key={comment.publicId} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-slate-900">{comment.authorNickname}</p><p className="mt-1 text-xs text-slate-500">{formatDate(comment.createdAt)}</p></div><div className="flex items-center gap-1">{comment.canEdit ? <div className="flex gap-2"><button onClick={() => { setEditingComment(comment.publicId); setEditingCommentBody(comment.bodyText); }} className="text-xs font-bold text-slate-600">수정</button><button onClick={() => deleteComment(comment.publicId)} className="text-xs font-bold text-rose-700">삭제</button></div> : <CommunityReportDialog endpoint={`/api/community/posts/${slug}/comments/${comment.publicId}/report`} targetLabel="댓글" onAuthRequired={() => setAuthOpen(true)} onSubmitted={setMessage} />}</div></div>{editingComment === comment.publicId ? <div className="mt-3"><textarea value={editingCommentBody} onChange={(event) => setEditingCommentBody(event.target.value)} rows={3} className="w-full rounded-xl border border-slate-200 p-3 text-sm" /><div className="mt-2 flex gap-2"><button onClick={() => saveComment(comment.publicId)} className="rounded-lg bg-brand-700 px-3 py-2 text-xs font-bold text-white">저장</button><button onClick={() => setEditingComment(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">취소</button></div></div> : <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700"><CashtagText text={comment.bodyText} /></p>}</article>)}
        </div>
      </section>
      <LegalDisclaimer className="mt-8" />
    </> : null}

    <CommunityAuthDialog open={authOpen} onClose={() => setAuthOpen(false)} onAuthenticated={() => { setAuthOpen(false); load(); }} />
  </div>;
}
