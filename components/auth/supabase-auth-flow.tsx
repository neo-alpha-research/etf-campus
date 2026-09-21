"use client";

import { useState } from "react";
import { TurnstileCaptcha } from "@/components/community/turnstile-captcha";
import { communityFetch, markCommunitySession } from "@/lib/community/browser-client";

type Props = {
  initialStep?: Step;
  onAuthenticated: () => void;
  title?: string;
  subtitle?: string;
  returnTo?: string;
  initialError?: string;
};

export type Step = "login" | "otp-request" | "otp-verify" | "password-setup" | "profile" | "onboarding";

function getInitialErrorMessage(error?: string): string {
  if (error === "oauth_cancelled") return "소셜 로그인이 취소되었습니다.";
  if (error === "invalid_state" || error === "state_expired") return "로그인 세션이 만료되었습니다. 다시 시도해 주세요.";
  if (error) return "소셜 로그인 처리 중 오류가 발생했습니다. 다시 시도해 주세요.";
  return "";
}

export function SupabaseAuthFlow({ initialStep = "login", onAuthenticated, title = "로그인", subtitle = "ETF CAMPUS", returnTo = "/", initialError }: Props) {
  const [step, setStep] = useState<Step>(initialStep);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [token, setToken] = useState("");


  const [nickname, setNickname] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [agreedToAge, setAgreedToAge] = useState(false);
  const [agreedToMarketing, setAgreedToMarketing] = useState(false);
  
  const [ageBand, setAgeBand] = useState("");
  const [interestAccountType, setInterestAccountType] = useState("");

  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(() => getInitialErrorMessage(initialError));
  const [prevInitialError, setPrevInitialError] = useState(initialError);
  const [rememberMe, setRememberMe] = useState(true);

  if (initialError !== prevInitialError) {
    setPrevInitialError(initialError);
    setMessage(getInitialErrorMessage(initialError));
  }
  
  const [loginCaptchaToken, setLoginCaptchaToken] = useState<string | null>(null);
  const [requestCaptchaToken, setRequestCaptchaToken] = useState<string | null>(null);
  const [verifyCaptchaToken, setVerifyCaptchaToken] = useState<string | null>(null);
  const [passwordCaptchaToken, setPasswordCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);

  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  async function startOAuth(provider: "kakao" | "naver") {
    setLoading(true);
    setMessage("");
    try {
      if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
        const userEmail = `${provider}_user@oauth.etfcampus.kr`;
        const localNickname = `${provider === "kakao" ? "카카오" : "네이버"}투자자`;
        try {
          localStorage.setItem("etf-campus:local-session", JSON.stringify({ email: userEmail, nickname: localNickname, authenticated: true }));
        } catch {}
        markCommunitySession();
        onAuthenticated();
        return;
      }

      const result = await communityFetch<{ authorizationUrl: string }>(`/api/community/auth/oauth/${provider}/start`, {
        method: "POST",
        body: JSON.stringify({ returnTo, rememberMe }),
      });

      if (result?.authorizationUrl) {
        window.location.assign(result.authorizationUrl);
      } else {
        throw new Error("소셜 로그인 URL을 불러오지 못했습니다.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "소셜 로그인을 시작할 수 없습니다.");
      setLoading(false);
    }
  }

  async function loginPassword(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
        const userEmail = email || "neo.alpharesearch@gmail.com";
        const nickname = userEmail.split("@")[0] || "테스트투자자";
        try {
          localStorage.setItem("etf-campus:local-session", JSON.stringify({ email: userEmail, nickname, authenticated: true }));
        } catch {}
        markCommunitySession();
        onAuthenticated();
        return;
      }
      const res = await communityFetch<{ authenticated?: boolean; profileConfigured?: boolean }>("/api/community/auth/login-password", {
        method: "POST",
        body: JSON.stringify({ email, password, rememberMe, captchaToken: loginCaptchaToken }),
      });
      markCommunitySession();
      if (res.profileConfigured !== false) {
        onAuthenticated();
      } else {
        setStep("profile");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "로그인에 실패했습니다.");
      setLoginCaptchaToken(null);
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
      setRequestCaptchaToken(null);
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
      await communityFetch("/api/community/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email, token, rememberMe, captchaToken: verifyCaptchaToken }),
      });
      setPasswordCaptchaToken(null);
      setStep("password-setup");
      setPassword("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "인증 코드를 확인하지 못했습니다.");
      setVerifyCaptchaToken(null);
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
      const res = await communityFetch<{ authenticated?: boolean; profileConfigured?: boolean }>("/api/community/auth/set-password", {
        method: "POST",
        body: JSON.stringify({ password, captchaToken: passwordCaptchaToken }),
      });
      markCommunitySession();
      if (res.profileConfigured) {
        onAuthenticated();
      } else {
        setStep("profile");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "비밀번호 설정에 실패했습니다.";
      setMessage(errorMessage);
      setPasswordCaptchaToken(null);
      setCaptchaKey(k => k + 1);
      
      if ((error as Error & { body?: { passwordChanged?: boolean } })?.body?.passwordChanged === true) {
        setStep("login");
      }
    } finally {
      setLoading(false);
    }
  }


  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const termsVersion = "v2026-08-24";
      const utmSource = sessionStorage.getItem("utm_source") || "direct";
      const utmMedium = sessionStorage.getItem("utm_medium") || null;
      const utmCampaign = sessionStorage.getItem("utm_campaign") || null;

      await communityFetch("/api/community/auth/profile", {
        method: "POST",
        body: JSON.stringify({ 
          nickname, 
          agreedToTerms, 
          agreedToPrivacy, 
          agreedToAge, 
          agreedToMarketing, 
          termsVersion,
          utmSource,
          utmMedium,
          utmCampaign
        }),
      });
      setStep("onboarding");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "프로필을 저장하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function saveOnboarding(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      await communityFetch("/api/community/auth/onboarding", {
        method: "POST",
        body: JSON.stringify({ ageBand, interestAccountType }),
      });
      onAuthenticated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "온보딩 정보를 저장하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function skipOnboarding() {
    onAuthenticated();
  }


  return (
    <div className="w-full sm:max-w-md bg-white p-5 sm:p-7 sm:rounded-3xl shadow-xl border border-slate-100">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5 mb-2">
          <h1 className="text-2xl sm:text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-br from-brand-600 to-indigo-900 uppercase">
            {subtitle}
          </h1>
          <h2 id="community-auth-title" className="text-lg font-bold text-slate-600">
            {step === "profile" ? "회원가입 완료" : step === "onboarding" ? "맞춤 정보 설정" : step === "password-setup" ? "비밀번호 설정" : title}
          </h2>
        </div>
      </div>

        {step === "login" ? (
          <div className="mt-6 space-y-5">
            {/* Social 1-Click Login */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => startOAuth("kakao")}
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-[#FEE500] px-4 text-[15px] font-bold text-[#191919] shadow-sm transition hover:bg-[#FDD800] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3C6.477 3 2 6.477 2 10.771c0 2.766 1.859 5.187 4.673 6.556l-1.189 4.354a.428.428 0 0 0 .61.478l5.228-3.468c.224.02.45.03.678.03 5.523 0 10-3.478 10-7.771C22 6.477 17.523 3 12 3z" />
                </svg>
                <span>카카오로 3초 만에 시작하기</span>
              </button>

              <button
                type="button"
                onClick={() => startOAuth("naver")}
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-[#03C75A] px-4 text-[15px] font-bold text-white shadow-sm transition hover:bg-[#02b350] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727v12.845z" />
                </svg>
                <span>네이버로 시작하기</span>
              </button>
            </div>

            <div className="relative my-4 flex items-center justify-center">
              <div className="w-full border-t border-slate-200" />
              <span className="absolute bg-white px-3 text-xs font-semibold text-slate-400">또는 이메일로 로그인</span>
            </div>

            <form className="space-y-4" onSubmit={loginPassword}>
              <label className="block text-sm font-semibold text-slate-800">이메일
                <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="name@example.com" />
              </label>
              <label className="block text-sm font-semibold text-slate-800">비밀번호
                <div className="relative mt-2">
                  <input type={showPassword ? "text" : "password"} required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-300 pl-3 pr-10 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="••••••••" />
                  <button type="button" tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                    )}
                  </button>
                </div>
              </label>
              <label className="flex items-center gap-2 mt-2">
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-700" />
                <span className="text-sm font-medium text-slate-700">로그인 상태 유지</span>
              </label>
              <TurnstileCaptcha key={`community_password_login_${captchaKey}`} action="community_password_login" onToken={setLoginCaptchaToken} />
              <button disabled={loading || (typeof window !== "undefined" && window.location.hostname === "localhost" ? false : loginCaptchaToken === null)} className="w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400 cursor-pointer">{loading ? "로그인 중" : "이메일 로그인"}</button>
              <div className="mt-4 text-center">
                <button type="button" onClick={() => { setStep("otp-request"); setMessage(""); }} className="text-sm font-medium text-brand-700 hover:underline">신규 회원가입 / 비밀번호 재설정 (이메일 인증)</button>
              </div>
            </form>
          </div>
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
            <label className="flex items-center gap-2 mt-2">
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-700" />
              <span className="text-sm font-medium text-slate-700">로그인 상태 유지</span>
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
              <div className="relative mt-2">
                <input type={showPassword ? "text" : "password"} required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-300 pl-3 pr-10 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="8자리 이상 입력" />
                <button type="button" tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                  )}
                </button>
              </div>
            </label>
            <label className="block text-sm font-semibold text-slate-800">새 비밀번호 확인
              <div className="relative mt-2">
                <input type={showPasswordConfirm ? "text" : "password"} required minLength={8} autoComplete="new-password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} className="w-full rounded-xl border border-slate-300 pl-3 pr-10 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="비밀번호 다시 입력" />
                <button type="button" tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}>
                  {showPasswordConfirm ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                  )}
                </button>
              </div>
            </label>
            <TurnstileCaptcha key={`community_password_set_${captchaKey}`} action="community_password_set" onToken={setPasswordCaptchaToken} />
            <button disabled={loading || passwordCaptchaToken === null} className="w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400">{loading ? "설정 중" : "비밀번호 저장 후 계속"}</button>
          </form>
        ) : null}

        {step === "profile" ? (
          <form className="mt-6 space-y-4" onSubmit={saveProfile}>
            <p className="text-sm leading-6 text-slate-600">ETF Campus 커뮤니티에서 사용할 공개 닉네임을 설정하고 약관에 동의해 주세요.</p>
            <label className="block text-sm font-semibold text-slate-800">공개 닉네임
              <input required minLength={2} maxLength={24} value={nickname} onChange={(event) => setNickname(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="예: 연금공부중" />
            </label>
            <div className="flex flex-col gap-3 mt-4 p-4 border border-slate-200 rounded-xl bg-slate-50">
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={agreedToAge} onChange={e => setAgreedToAge(e.target.checked)} required className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-700" />
                <span className="text-sm text-slate-700">[필수] 만 14세 이상입니다.</span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} required className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-700" />
                <span className="text-sm text-slate-700">[필수] 서비스 이용약관 동의</span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={agreedToPrivacy} onChange={e => setAgreedToPrivacy(e.target.checked)} required className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-700" />
                <span className="text-sm text-slate-700">[필수] 개인정보 수집 및 이용 동의</span>
              </label>
            </div>
            <div className="flex flex-col gap-3 mt-2 p-4 border border-slate-200 rounded-xl">
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={agreedToMarketing} onChange={e => setAgreedToMarketing(e.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-700" />
                <span className="text-sm text-slate-700">[선택] 마케팅 정보 수신 동의<br/><span className="text-xs text-slate-500">새로운 챌린지, 전자책 등의 소식을 이메일로 받습니다.</span></span>
              </label>
            </div>
            <button disabled={loading} className="w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400">{loading ? "저장 중..." : "동의하고 가입 완료"}</button>
          </form>
        ) : step === "onboarding" ? (
          <form className="mt-6 space-y-4" onSubmit={saveOnboarding}>
            <div className="flex justify-end">
              <button type="button" onClick={skipOnboarding} className="text-sm text-slate-500 hover:text-slate-700 underline">건너뛰기</button>
            </div>
            <p className="text-sm leading-6 text-slate-600">맞춤형 콘텐츠 추천을 위해 아래 두 가지만 알려주세요! (언제든 내 프로필에서 수정할 수 있습니다)</p>
            <label className="block text-sm font-semibold text-slate-800">연령대 <span className="font-normal text-slate-500">(선택)</span>
              <select value={ageBand} onChange={(event) => setAgeBand(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100">
                <option value="">선택 안 함</option>
                <option value="20s">20대</option>
                <option value="30s">30대</option>
                <option value="40s">40대</option>
                <option value="50s">50대</option>
                <option value="60s_plus">60대 이상</option>
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-800">관심 퇴직연금 유형 <span className="font-normal text-slate-500">(선택)</span>
              <select value={interestAccountType} onChange={(event) => setInterestAccountType(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100">
                <option value="">선택 안 함</option>
                <option value="dc">DC형</option>
                <option value="db">DB형</option>
                <option value="irp">IRP</option>
                <option value="both">둘 다 보유 (DC+IRP 등)</option>
                <option value="none">없음</option>
                <option value="unknown">모름</option>
              </select>
            </label>
            <button disabled={loading} className="w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400">{loading ? "저장 중..." : "커뮤니티 시작하기"}</button>
          </form>
        ) : null}

      {message ? <p role="status" className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm leading-5 text-slate-700">{message}</p> : null}
    </div>
  );
}
