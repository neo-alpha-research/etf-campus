/* eslint-disable react-hooks/set-state-in-effect -- Client-only authentication, draft restoration, and public data loading intentionally update state after hydration. */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CommunityAuthDialog } from "@/components/community/community-auth-dialog";
import { clearCommunityDraft, communityFetch, getCommunitySession, loadCommunityDraft, refreshCommunitySession, saveCommunityDraft } from "@/lib/community/browser-client";
import { convertImageToWebp } from "@/lib/community/image-upload";

const categories = [
  { slug: "free-qna", name: "자유·질문" },
  { slug: "strategy-portfolio", name: "전략·포트폴리오" },
  { slug: "stock-cost-analysis", name: "종목·비용 분석" },
] as const;

type CategorySlug = (typeof categories)[number]["slug"];

type WritingTemplate = {
  titlePlaceholder: string;
  hint: string;
  body: string;
};

const WRITING_TEMPLATES: Record<string, WritingTemplate> = {
  "free-qna": {
    titlePlaceholder: "ETF 투자나 연금 계좌에서 궁금한 점을 자유롭게 적어 주세요",
    hint: "초보적인 질문도 환영합니다. 계좌 종류(연금저축/IRP/일반)나 상황을 함께 적어주시면 더 유익한 답변을 받을 수 있습니다.",
    body: "## 질문 내용\n\n## 현재 계좌 또는 투자 상황\n예: 연금저축펀드 시작 3개월차 / ISA 계좌 운용 중\n\n## 확인해 본 내용\n\n",
  },
  "strategy-portfolio": {
    titlePlaceholder: "나만의 ETF 자산배분 포트폴리오나 적립식 투자 전략을 공유해 주세요",
    hint: "수익률 자랑보다는 목표 비중, 리밸런싱 주기, 월배당 재투자 방식 등 '전략의 기준'을 적어주시면 큰 도움이 됩니다.",
    body: "## 투자 목적 및 기간\n예: 노후 연금 마련 (15년 장기 투자) / 월배당 현금흐름 구축\n\n## 포트폴리오 구성 및 목표 비중\n- ETF 종목 1 ($069500): 40%\n- ETF 종목 2 ($379800): 40%\n- 안전자산/현금: 20%\n\n## 리밸런싱 및 분배금 운용 규칙\n\n## 이 전략을 선택한 이유\n",
  },
  "stock-cost-analysis": {
    titlePlaceholder: "특정 ETF의 실부담비용, 괴리율, 분배금 구조 분석 내용을 적어 주세요",
    hint: "글 본문에 $069500 또는 $SPY 처럼 $티커를 입력하면 ETF 상세 분석 페이지로 자동 연결됩니다.",
    body: "## 분석 대상 ETF\n예: $069500 vs $379800\n\n## 확인한 데이터 (실부담비용 / 괴리율 / 분배금)\n\n## 분석 및 비교 포인트\n\n## 최종 판단 기준 및 유의점\n",
  },
  "pension-etf-qna": {
    titlePlaceholder: "연금 계좌에서 무엇을 확인하고 싶은지 적어 주세요",
    hint: "계좌 유형과 확인한 자료를 함께 적으면 더 구체적인 답변을 받을 수 있습니다.",
    body: "## 계좌 유형\n\n## 확인한 자료\n\n## 현재 질문\n",
  },
  "etf-questions": {
    titlePlaceholder: "ETF 정보에서 무엇이 헷갈리는지 적어 주세요",
    hint: "상품명 대신 공식 자료에서 확인한 구조·비용·공시 정보를 적어 주세요.",
    body: "## 확인한 ETF 또는 페이지\n\n## 질문 내용\n",
  },
  "challenge-30": {
    titlePlaceholder: "오늘 확인한 ETF 판단 기준을 한 줄로 적어 주세요",
    hint: "수익률·보유 금액·매매 계획 대신, 읽은 출처와 다음 학습 기준을 기록해 주세요.",
    body: "## 오늘의 학습 주제\n\n## 오늘 확인한 출처\n",
  },
  feedback: {
    titlePlaceholder: "오류가 보인 화면과 ETF 코드 또는 기능을 적어 주세요",
    hint: "개인정보·로그인 정보·인증 코드는 적지 말고, 재현 가능한 정보만 남겨 주세요.",
    body: "## 확인한 화면\n\n## 재현 방법\n",
  },
};

function isWritingTemplate(bodyText: string) {
  return Object.values(WRITING_TEMPLATES).some((template) => template.body === bodyText);
}

function isCategorySlug(value: string): value is CategorySlug {
  return categories.some((category) => category.slug === value);
}

export function CommunityComposer() {
  const [categorySlug, setCategorySlug] = useState<CategorySlug>("free-qna");
  const [title, setTitle] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [message, setMessage] = useState("");
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const template = useMemo(() => WRITING_TEMPLATES[categorySlug], [categorySlug]);

  useEffect(() => {
    refreshCommunitySession().then(setSignedIn);
    const draft = loadCommunityDraft();
    if (draft && isCategorySlug(draft.categorySlug)) {
      setCategorySlug(draft.categorySlug);
      setTitle(draft.title);
      setBodyText(draft.bodyText);
      setDraftRestored(true);
    } else {
      const requestedCategory = new URLSearchParams(window.location.search).get("category");
      const initialCategory = requestedCategory && isCategorySlug(requestedCategory) ? requestedCategory : "free-qna";
      setCategorySlug(initialCategory);
      setBodyText(WRITING_TEMPLATES[initialCategory].body);
    }
    setDraftReady(true);
  }, []);

  useEffect(() => {
    if (!draftReady || (!title && isWritingTemplate(bodyText))) return;
    saveCommunityDraft({ categorySlug, title, bodyText });
  }, [bodyText, categorySlug, draftReady, title]);

  function applyTemplate(nextCategory: CategorySlug, force = false) {
    const nextTemplate = WRITING_TEMPLATES[nextCategory];
    const currentBodyIsTemplate = !bodyText.trim() || isWritingTemplate(bodyText);

    if (!force && !currentBodyIsTemplate) {
      setCategorySlug(nextCategory);
      setMessage("작성 중인 본문은 유지했습니다. 필요하면 아래 버튼으로 선택한 게시판 템플릿을 다시 넣을 수 있습니다.");
      return;
    }

    setCategorySlug(nextCategory);
    setBodyText(nextTemplate.body);
    setMessage(`${categories.find((category) => category.slug === nextCategory)?.name ?? "선택한 게시판"} 작성 템플릿을 넣었습니다. 대괄호와 안내 문구를 실제 상황에 맞게 바꿔 주세요.`);
  }

  function handleCategoryChange(nextValue: string) {
    if (!isCategorySlug(nextValue)) return;
    applyTemplate(nextValue);
  }

  function replaceWithCurrentTemplate() {
    const currentBodyIsTemplate = !bodyText.trim() || isWritingTemplate(bodyText);
    if (!currentBodyIsTemplate && !window.confirm("현재 본문을 선택한 게시판의 작성 템플릿으로 바꿀까요? 작성한 내용은 사라집니다.")) return;
    applyTemplate(categorySlug, true);
  }

  async function handleImageFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
      if (!getCommunitySession() && !(await refreshCommunitySession())) {
        setMessage("이미지를 업로드하려면 먼저 이메일 인증이 필요합니다.");
        setAuthOpen(true);
        return;
      }
    }
    setUploadingImage(true);
    setMessage("");
    try {
      const webpBlob = await convertImageToWebp(file);
      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          const imageMarkdown = `\n\n![이미지](${base64data})\n\n`;
          setBodyText((prev) => prev + imageMarkdown);
          setMessage("이미지가 본문에 추가되었습니다 (로컬 미리보기).");
        };
        reader.readAsDataURL(webpBlob);
        setUploadingImage(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      const formData = new FormData();
      formData.append("file", webpBlob, `${crypto.randomUUID()}.webp`);

      const response = await fetch("/api/community/images/upload", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message ?? "이미지 업로드에 실패했습니다.");
      }
      const data = await response.json();
      const imageMarkdown = `\n\n![이미지](${data.url})\n\n`;
      setBodyText((prev) => prev + imageMarkdown);
      setMessage("이미지가 본문에 추가되었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "이미지 업로드 처리에 실패했습니다.");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (isWritingTemplate(bodyText)) {
      setMessage("템플릿의 안내 문구를 실제 확인 내용과 질문으로 바꾼 뒤 등록해 주세요.");
      return;
    }
    if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
      if (!getCommunitySession() && !(await refreshCommunitySession())) {
        setMessage("작성 중인 초안을 보관했습니다. 이메일 인증 후 이어서 작성할 수 있습니다.");
        setAuthOpen(true);
        return;
      }
    }
    setLoading(true);
    setMessage("");
    try {
      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        const newSlug = `local-${Date.now()}`;
        const newPost = {
          slug: newSlug,
          title,
          bodyText,
          category: {
            slug: categorySlug,
            name: categories.find((c) => c.slug === categorySlug)?.name || "게시판",
          },
          authorNickname: "테스트작성자",
          createdAt: new Date().toISOString(),
          commentCount: 0,
          upvoteCount: 1,
        };
        try {
          const stored = localStorage.getItem("etf-campus:local-posts");
          const list = stored ? JSON.parse(stored) : [];
          list.unshift(newPost);
          localStorage.setItem("etf-campus:local-posts", JSON.stringify(list));
        } catch {}
        clearCommunityDraft();
        window.location.assign(`/community/read/?slug=${encodeURIComponent(newSlug)}`);
        return;
      }

      const result = await communityFetch("/api/community/posts", {
        method: "POST",
        body: JSON.stringify({ categorySlug, title, bodyText }),
      });
      clearCommunityDraft();
      window.location.assign(`/community/read/?slug=${encodeURIComponent(result.post.slug)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "게시물을 저장하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-shell py-7 sm:py-10">
      <Link href="/community/" className="text-sm font-bold text-brand-700 hover:underline">← 커뮤니티 목록</Link>
      <section className="mt-5 max-w-3xl rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <p className="text-xs font-bold tracking-[0.18em] text-brand-700">COMMUNITY WRITE</p>
        <h1 className="mt-2 text-2xl font-extrabold text-slate-950">판단 기준을 나누는 글쓰기</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">매수·매도 강요, 목표가, 수익 보장, 리딩방·광고 링크, 개인정보, 확인하지 않은 AI 생성 정보를 작성할 수 없습니다. 본문은 일반 텍스트로만 저장됩니다.</p>
        {draftRestored ? <p role="status" className="mt-4 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900">이전에 작성하던 초안을 복원했습니다.</p> : null}
        {!signedIn ? <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm leading-6 text-amber-950">글 작성은 이메일 인증 회원만 가능합니다. 초안은 이 브라우저에 보관되며 로그인 후 이어서 작성할 수 있습니다.</p><button type="button" onClick={() => setAuthOpen(true)} className="mt-3 rounded-xl bg-amber-800 px-4 py-2 text-sm font-bold text-white">이메일 인증하고 작성하기</button></div> : null}
        <form onSubmit={submit} className="mt-6 space-y-5">
          <label className="block text-sm font-bold text-slate-800">게시판
            <select value={categorySlug} onChange={(event) => handleCategoryChange(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100">
              {categories.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}
            </select>
          </label>
          <aside aria-label="카테고리별 작성 보조" className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
            <p className="text-sm font-bold text-brand-950">{categories.find((category) => category.slug === categorySlug)?.name} 작성 도우미</p>
            <p className="mt-1 text-sm leading-6 text-brand-900">{template.hint}</p>
            <button type="button" onClick={replaceWithCurrentTemplate} className="mt-3 rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm font-bold text-brand-800 hover:bg-brand-100">이 게시판 템플릿 다시 넣기</button>
          </aside>
          <label className="block text-sm font-bold text-slate-800">제목
            <input value={title} onChange={(event) => setTitle(event.target.value)} minLength={2} maxLength={120} required className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder={template.titlePlaceholder} />
          </label>
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="community-body-textarea" className="block text-sm font-bold text-slate-800">본문</label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleImageFileSelect}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-brand-300 hover:text-brand-800 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  <span>{uploadingImage ? "이미지 변환 및 업로드 중..." : "📷 이미지 첨부 (최대 20MB)"}</span>
                </button>
              </div>
            </div>
            <textarea id="community-body-textarea" value={bodyText} onChange={(event) => setBodyText(event.target.value)} minLength={2} maxLength={6000} required rows={14} className="mt-2 w-full resize-y rounded-xl border border-slate-300 p-3 text-base leading-7 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder={template.hint} />
          </div>
          <p className="text-xs leading-5 text-slate-500">템플릿은 작성 순서를 돕기 위한 안내입니다. 실제 확인한 자료와 질문을 작성한 뒤 등록해 주세요.</p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Link href="/community/" className="rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-bold text-slate-700">취소</Link><button disabled={loading} className="rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400">{loading ? "저장 중" : signedIn ? "게시물 등록" : "로그인 후 등록"}</button></div>
        </form>
        {message ? <p role="status" className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">{message}</p> : null}
      </section>
      <CommunityAuthDialog open={authOpen} onClose={() => setAuthOpen(false)} onAuthenticated={() => { setSignedIn(true); setAuthOpen(false); setMessage("인증을 완료했습니다. 보관된 초안을 이어서 작성해 주세요."); }} />
    </div>
  );
}
