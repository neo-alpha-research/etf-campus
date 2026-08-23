"use client";

import { useState } from "react";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [agreeRequired, setAgreeRequired] = useState(false);
  const [agreeOptional, setAgreeOptional] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreeRequired) {
      setErrorMessage("필수 항목(이용약관 및 개인정보 처리방침)에 동의해 주세요.");
      return;
    }
    if (!email || !email.includes("@")) {
      setErrorMessage("유효한 이메일 주소를 입력해 주세요.");
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, agreeRequired, agreeOptional }),
      });

      if (!res.ok) {
        throw new Error("구독 처리 중 오류가 발생했습니다.");
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "구독 요청에 실패했습니다.");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-3xl border border-brand-200 bg-brand-50 p-8 text-center sm:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="mt-5 text-2xl font-bold text-brand-950">이메일 확인을 부탁드립니다!</h2>
        <p className="mt-3 text-brand-800">
          입력하신 <strong>{email}</strong> 주소로 확인 메일을 발송했습니다.<br />
          이메일 본문의 링크를 클릭하여 구독을 완료하시면, 학습 번들 다운로드 링크가 활성화됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-950">뉴스레터 구독 & 학습 번들 받기</h2>
        <p className="mt-2 text-sm text-slate-600">이메일 주소를 남겨주시면 ETF Campus의 최신 소식과 학습 자료를 보내드립니다.</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label htmlFor="email" className="sr-only">이메일 주소</label>
          <input
            type="email"
            id="email"
            required
            placeholder="이메일 주소를 입력해 주세요"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === "loading"}
            className="w-full rounded-xl border border-slate-300 px-4 py-4 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-500"
          />
        </div>

        <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreeRequired}
              onChange={(e) => setAgreeRequired(e.target.checked)}
              disabled={status === "loading"}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
            />
            <span className="leading-6">
              <strong className="font-bold text-slate-900">[필수]</strong> 이용약관 및 개인정보 수집·이용에 동의합니다.
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreeOptional}
              onChange={(e) => setAgreeOptional(e.target.checked)}
              disabled={status === "loading"}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
            />
            <span className="leading-6">
              <strong className="text-slate-900">[선택]</strong> ETF Campus의 뉴스레터 및 광고성 정보 수신에 동의합니다.
            </span>
          </label>
        </div>

        {errorMessage && (
          <p className="text-sm font-bold text-rose-600 text-center">{errorMessage}</p>
        )}

        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full rounded-xl bg-brand-700 px-4 py-4 text-base font-bold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-brand-400"
        >
          {status === "loading" ? "처리 중..." : "구독하고 자료 받기"}
        </button>
      </form>
    </div>
  );
}
