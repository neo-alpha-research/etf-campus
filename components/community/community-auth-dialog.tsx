"use client";

import { useEffect, useState } from "react";
import { communityFetch, saveCommunitySession } from "@/lib/community/browser-client";

type Props = {
  open: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
};

type Step = "email" | "otp" | "profile";

export function CommunityAuthDialog({ open, onClose, onAuthenticated }: Props) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [nickname, setNickname] = useState("");
  const [interestAccountType, setInterestAccountType] = useState("none");
  const [investmentExperience, setInvestmentExperience] = useState("beginner");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setStep("email");
    setToken("");
    setMessage("");
  }, [open]);

  if (!open) return null;

  async function requestOtp(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const result = await communityFetch("/api/community/auth/request-otp", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage(result.message);
      setStep("otp");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "인증 메일을 요청하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const result = await communityFetch("/api/community/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email, token }),
      });
      saveCommunitySession(result.session);
      const profile = await communityFetch("/api/community/auth/profile");
      if (profile.profileConfigured) {
        onAuthenticated();
        onClose();
      } else {
        setStep("profile");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "인증 코드를 확인하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      await communityFetch("/api/community/auth/profile", {
        method: "POST",
        body: JSON.stringify({ nickname, interestAccountType, investmentExperience }),
      });
      onAuthenticated();
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "닉네임을 저장하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/45 p-0 sm:items-center sm:justify-center sm:p-6" role="presentation">
      <section aria-modal="true" aria-labelledby="community-auth-title" className="w-full rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-3xl sm:p-7" role="dialog">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-brand-700">ETF CAMPUS COMMUNITY</p>
            <h2 id="community-auth-title" className="mt-1 text-xl font-bold text-slate-950">{step === "profile" ? "공개 닉네임 설정" : "이메일로 안전하게 로그인"}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100" aria-label="로그인 창 닫기">닫기</button>
        </div>

        {step === "email" ? (
          <form className="mt-6 space-y-4" onSubmit={requestOtp}>
            <p className="text-sm leading-6 text-slate-600">글쓰기·댓글·신고는 이메일 인증 회원만 이용할 수 있습니다. 비밀번호는 저장하지 않습니다.</p>
            <label className="block text-sm font-semibold text-slate-800">이메일
              <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="name@example.com" />
            </label>
            <button disabled={loading} className="w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400">{loading ? "인증 코드 요청 중" : "6자리 인증 코드 받기"}</button>
          </form>
        ) : null}

        {step === "otp" ? (
          <form className="mt-6 space-y-4" onSubmit={verifyOtp}>
            <p className="text-sm leading-6 text-slate-600">{email}으로 보낸 6자리 인증 코드를 입력해 주세요. 코드가 오지 않으면 스팸함도 확인해 주세요.</p>
            <label className="block text-sm font-semibold text-slate-800">인증 코드
              <input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" value={token} onChange={(event) => setToken(event.target.value.replace(/\D/g, ""))} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-lg tracking-[0.3em] outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="000000" />
            </label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep("email")} className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700">이메일 변경</button>
              <button disabled={loading} className="flex-1 rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400">{loading ? "확인 중" : "인증 완료"}</button>
            </div>
          </form>
        ) : null}

        {step === "profile" ? (
          <form className="mt-6 space-y-4" onSubmit={saveProfile}>
            <p className="text-sm leading-6 text-slate-600">공개 화면에는 닉네임만 표시됩니다. 관심 계좌 유형과 투자 경험은 선택 정보이며 공개되지 않습니다.</p>
            <label className="block text-sm font-semibold text-slate-800">공개 닉네임
              <input required minLength={2} maxLength={24} value={nickname} onChange={(event) => setNickname(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="예: 연금공부중" />
            </label>
            <label className="block text-sm font-semibold text-slate-800">관심 계좌 유형 <span className="font-normal text-slate-500">(선택)</span>
              <select value={interestAccountType} onChange={(event) => setInterestAccountType(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"><option value="none">선택 안 함</option><option value="dc">DC</option><option value="irp">IRP</option><option value="pension_savings">연금저축</option><option value="general">일반 계좌</option></select>
            </label>
            <label className="block text-sm font-semibold text-slate-800">투자 경험 <span className="font-normal text-slate-500">(선택)</span>
              <select value={investmentExperience} onChange={(event) => setInvestmentExperience(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"><option value="beginner">입문</option><option value="intermediate">경험 있음</option><option value="experienced">충분한 경험</option></select>
            </label>
            <button disabled={loading} className="w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400">{loading ? "저장 중" : "커뮤니티 시작하기"}</button>
          </form>
        ) : null}

        {message ? <p role="status" className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm leading-5 text-slate-700">{message}</p> : null}
      </section>
    </div>
  );
}
