/* eslint-disable react-hooks/set-state-in-effect -- Client-only authentication, draft restoration, and public data loading intentionally update state after hydration. */
"use client";

import { useEffect, useState } from "react";
import { TurnstileCaptcha } from "@/components/community/turnstile-captcha";
import { communityFetch, markCommunitySession, refreshCommunitySession } from "@/lib/community/browser-client";

type Props = {
  initialStep?: Step;
  onAuthenticated: () => void;
  title?: string;
  subtitle?: string;
};

export type Step = "login" | "otp-request" | "otp-verify" | "password-setup" | "profile";

export function SupabaseAuthFlow({ initialStep = "login", onAuthenticated, title = "로그인", subtitle = "ETF CAMPUS" }: Props) {
  const [step, setStep] = useState<Step>(initialStep);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [token, setToken] = useState("");
  
  const [tempAccessToken, setTempAccessToken] = useState("");
  const [tempRefreshToken, setTempRefreshToken] = useState("");

  const [nickname, setNickname] = useState("");
  const [interestAccountType, setInterestAccountType] = useState("none");
  const [investmentExperience, setInvestmentExperience] = useState("beginner");
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  
  const [loginCaptchaToken, setLoginCaptchaToken] = useState<string | null>(null);
  const [requestCaptchaToken, setRequestCaptchaToken] = useState<string | null>(null);
  const [verifyCaptchaToken, setVerifyCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);

  useEffect(() => {
    // Reset state on unmount if needed
  }, []);

  async function loginPassword(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      await communityFetch("/api/community/auth/login-password", {
        method: "POST",
        body: JSON.stringify({ email, password, captchaToken: loginCaptchaToken }),
      });
      markCommunitySession();
      await refreshCommunitySession();
      const profile = await communityFetch("/api/community/auth/profile");
      if (profile.profileConfigured) {
        onAuthenticated();

      } else {
        setStep("profile");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "로그인에 실패했습니다.");
      setCaptchaKey(k => k + 1);
    } finally {
      setLoading(false);
    }
  }

  async function requestOtp(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const result = await communityFetch("/api/community/auth/request-otp", {
        method: "POST",
        body: JSON.stringify({ email, captchaToken: requestCaptchaToken }),
      });
      setMessage(result.message);
      setRequestCaptchaToken(null);
      setVerifyCaptchaToken(null);
      setStep("otp-verify");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "인증 메일을 요청하지 못했습니다.");
      setCaptchaKey(k => k + 1);
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
        body: JSON.stringify({ email, token, captchaToken: verifyCaptchaToken }),
      });
      setTempAccessToken(result.tempAccessToken);
      setTempRefreshToken(result.tempRefreshToken);
      setStep("password-setup");
      setPassword("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "인증 코드를 확인하지 못했습니다.");
      setCaptchaKey(k => k + 1);
    } finally {
      setLoading(false);
    }
  }

  async function setupPassword(event: React.FormEvent) {
    event.preventDefault();
    if (password !== passwordConfirm) {
      setMessage("입력한 두 비밀번호가 일치하지 않습니다.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      await communityFetch("/api/community/auth/set-password", {
        method: "POST",
        body: JSON.stringify({ password, tempAccessToken, tempRefreshToken }),
      });
      markCommunitySession();
      await refreshCommunitySession();
      const profile = await communityFetch("/api/community/auth/profile");
      if (profile.profileConfigured) {
        onAuthenticated();

      } else {
        setStep("profile");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "비밀번호 설정에 실패했습니다.");
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "닉네임을 저장하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full sm:max-w-md bg-white p-5 sm:p-7 sm:rounded-3xl shadow-xl border border-slate-100">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-brand-700">{subtitle}</p>
          <h2 id="community-auth-title" className="mt-1 text-xl font-bold text-slate-950">{step === "profile" ? "공개 닉네임 설정" : step === "password-setup" ? "비밀번호 설정" : title}</h2>
        </div>
      </div>

        {step === "login" ? (
          <form className="mt-6 space-y-4" onSubmit={loginPassword}>
            <label className="block text-sm font-semibold text-slate-800">이메일
              <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="name@example.com" />
            </label>
            <label className="block text-sm font-semibold text-slate-800">비밀번호
              <input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="••••••••" />
            </label>
            <TurnstileCaptcha key={`community_password_login_${captchaKey}`} action="community_password_login" onToken={setLoginCaptchaToken} />
            <button disabled={loading || loginCaptchaToken === null} className="w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400">{loading ? "로그인 중" : "이메일 로그인"}</button>
            <div className="mt-4 text-center">
              <button type="button" onClick={() => { setStep("otp-request"); setMessage(""); }} className="text-sm font-medium text-brand-700 hover:underline">비밀번호가 없거나 처음이신가요? 인증 코드로 시작하기</button>
            </div>
          </form>
        ) : null}

        {step === "otp-request" ? (
          <form className="mt-6 space-y-4" onSubmit={requestOtp}>
            <p className="text-sm leading-6 text-slate-600">이메일 인증을 통해 가입 및 비밀번호 재설정을 진행할 수 있습니다.</p>
            <label className="block text-sm font-semibold text-slate-800">이메일
              <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="name@example.com" />
            </label>
            <TurnstileCaptcha key={`community_otp_request_${captchaKey}`} action="community_otp_request" onToken={setRequestCaptchaToken} />
            <button disabled={loading || requestCaptchaToken === null} className="w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400">{loading ? "인증 코드 요청 중" : "8자리 인증 코드 받기"}</button>
            <div className="mt-4 text-center">
              <button type="button" onClick={() => { setStep("login"); setMessage(""); }} className="text-sm font-medium text-slate-500 hover:underline">비밀번호로 로그인하기</button>
            </div>
          </form>
        ) : null}

        {step === "otp-verify" ? (
          <form className="mt-6 space-y-4" onSubmit={verifyOtp}>
            <p className="text-sm leading-6 text-slate-600">{email}으로 보낸 8자리 인증 코드를 입력해 주세요. 코드가 오지 않으면 스팸함도 확인해 주세요.</p>
            <label className="block text-sm font-semibold text-slate-800">인증 코드
              <input inputMode="numeric" pattern="[0-9]{8}" maxLength={8} required autoComplete="one-time-code" value={token} onChange={(event) => setToken(event.target.value.replace(/\D/g, ""))} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-lg tracking-[0.3em] outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="00000000" />
            </label>
            <TurnstileCaptcha key={`community_otp_verify_${captchaKey}`} action="community_otp_verify" onToken={setVerifyCaptchaToken} />
            <div className="flex gap-3">
              <button type="button" onClick={() => { setToken(""); setMessage(""); setRequestCaptchaToken(null); setVerifyCaptchaToken(null); setStep("otp-request"); }} className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700">이메일 변경</button>
              <button disabled={loading || verifyCaptchaToken === null} className="flex-1 rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400">{loading ? "확인 중" : "인증 완료"}</button>
            </div>
          </form>
        ) : null}

        {step === "password-setup" ? (
          <form className="mt-6 space-y-4" onSubmit={setupPassword}>
            <p className="text-sm leading-6 text-slate-600">앞으로 사용할 비밀번호를 설정해 주세요. 인증 코드 대신 이메일과 비밀번호로 간편하게 로그인할 수 있습니다.</p>
            <label className="block text-sm font-semibold text-slate-800">새 비밀번호
              <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="8자리 이상 입력" />
            </label>
            <label className="block text-sm font-semibold text-slate-800">새 비밀번호 확인
              <input type="password" required minLength={8} autoComplete="new-password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="비밀번호 다시 입력" />
            </label>
            <button disabled={loading} className="w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400">{loading ? "설정 중" : "비밀번호 저장 후 계속"}</button>
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
    </div>
  );
}
