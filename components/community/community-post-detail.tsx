"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CommunityAuthDialog } from "@/components/community/community-auth-dialog";
import { communityFetch, getCommunitySession } from "@/lib/community/browser-client";

type Post = { slug: string; title: string; bodyText: string; category: { name: string }; authorNickname: string; createdAt: string; updatedAt: string; commentCount: number };
type Comment = { publicId: string; bodyText: string; authorNickname: string; createdAt: string; updatedAt: string; canEdit: boolean };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function CommunityPostDetail() {
  const slug = useMemo(() => typeof window === "undefined" ? "" : window.location.pathname.split("/").filter(Boolean).at(-1) ?? "", []);
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [commentBody, setCommentBody] = useState("");
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [message, setMessage] = useState("");
  const [authOpen, setAuthOpen] = useState(false);

  async function load() {
    if (!slug) return;
    setStatus("loading");
    try {
      const [postResult, commentsResult] = await Promise.all([
        fetch(`/api/community/posts/${slug}`).then(async (response) => { if (!response.ok) throw new Error(); return response.json(); }),
        communityFetch(`/api/community/posts/${slug}/comments`),
      ]);
      setPost(postResult.post);
      setComments(commentsResult.comments ?? []);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => { load(); }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitComment(event: React.FormEvent) {
    event.preventDefault();
    if (!getCommunitySession()) { setAuthOpen(true); return; }
    try {
      await communityFetch(`/api/community/posts/${slug}/comments`, { method: "POST", body: JSON.stringify({ bodyText: commentBody }) });
      setCommentBody("");
      setMessage("댓글을 등록했습니다.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "댓글을 등록하지 못했습니다."); }
  }

  async function saveComment(commentId: string) {
    try {
      await communityFetch(`/api/community/posts/${slug}/comments/${commentId}`, { method: "PATCH", body: JSON.stringify({ bodyText: editingBody }) });
      setEditingComment(null);
      setMessage("댓글을 수정했습니다.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "댓글을 수정하지 못했습니다."); }
  }

  async function deleteComment(commentId: string) {
    if (!window.confirm("댓글을 삭제할까요?")) return;
    try {
      await communityFetch(`/api/community/posts/${slug}/comments/${commentId}`, { method: "DELETE" });
      setMessage("댓글을 삭제했습니다.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "댓글을 삭제하지 못했습니다."); }
  }

  return <div className="page-shell py-7 sm:py-10"><Link href="/community/" className="text-sm font-bold text-brand-700 hover:underline">← 커뮤니티 목록</Link>{status === "loading" ? <div className="mt-5 space-y-4"><div className="h-10 w-2/3 animate-pulse rounded bg-slate-100" /><div className="h-64 animate-pulse rounded-2xl bg-slate-100" /></div> : null}{status === "error" ? <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center"><h1 className="font-bold text-rose-950">게시물을 불러오지 못했습니다.</h1><button onClick={load} className="mt-4 rounded-xl bg-rose-700 px-4 py-2 text-sm font-bold text-white">다시 시도</button></div> : null}{status === "ready" && post ? <><article className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"><p className="text-sm font-bold text-brand-700">{post.category.name}</p><h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">{post.title}</h1><div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500"><span>{post.authorNickname}</span><span>{formatDate(post.createdAt)}</span>{post.updatedAt !== post.createdAt ? <span>수정됨</span> : null}</div><div className="mt-7 whitespace-pre-wrap break-words text-[15px] leading-8 text-slate-800">{post.bodyText}</div></article><section className="mt-7"><h2 className="text-xl font-extrabold text-slate-950">댓글 {comments.length}</h2><form onSubmit={submitComment} className="mt-4 rounded-2xl border border-slate-200 bg-white p-4"><label className="sr-only" htmlFor="comment-body">댓글</label><textarea id="comment-body" value={commentBody} onChange={(event) => setCommentBody(event.target.value)} maxLength={2000} rows={4} placeholder="판단 기준과 출처를 중심으로 의견을 남겨 주세요. 개인정보와 매수·매도 권유는 작성할 수 없습니다." className="w-full resize-y rounded-xl border border-slate-200 p-3 text-sm leading-6 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" /><div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-slate-500">작성·댓글은 이메일 인증 회원만 가능합니다.</p><button className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white">댓글 등록</button></div></form>{message ? <p role="status" className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">{message}</p> : null}<div className="mt-4 space-y-3">{comments.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">아직 댓글이 없습니다. 질문의 판단 기준을 함께 확인해 보세요.</div> : comments.map((comment) => <article key={comment.publicId} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-slate-900">{comment.authorNickname}</p><p className="mt-1 text-xs text-slate-500">{formatDate(comment.createdAt)}</p></div>{comment.canEdit ? <div className="flex gap-2"><button onClick={() => { setEditingComment(comment.publicId); setEditingBody(comment.bodyText); }} className="text-xs font-bold text-slate-600">수정</button><button onClick={() => deleteComment(comment.publicId)} className="text-xs font-bold text-rose-700">삭제</button></div> : null}</div>{editingComment === comment.publicId ? <div className="mt-3"><textarea value={editingBody} onChange={(event) => setEditingBody(event.target.value)} rows={3} className="w-full rounded-xl border border-slate-200 p-3 text-sm" /><div className="mt-2 flex gap-2"><button onClick={() => saveComment(comment.publicId)} className="rounded-lg bg-brand-700 px-3 py-2 text-xs font-bold text-white">저장</button><button onClick={() => setEditingComment(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">취소</button></div></div> : <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{comment.bodyText}</p>}</article>)}</div></section></> : null}<CommunityAuthDialog open={authOpen} onClose={() => setAuthOpen(false)} onAuthenticated={() => { setAuthOpen(false); load(); }} /></div>;
}
