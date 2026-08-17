"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  authErrorMessage,
  login,
  register,
  requestPasswordReset,
  resetPassword,
} from "@/lib/auth/client";
import { safeReturnTo, withReturnTo } from "@/lib/auth/return-to";

function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-10 sm:px-6 lg:py-16">
      <section className="w-full rounded-2xl border border-line bg-surface p-6 shadow-[0_16px_48px_rgba(15,23,42,0.08)] sm:p-8">
        <p className="text-sm font-semibold tracking-wide text-brand-700">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
        <div className="mt-7">{children}</div>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-ink">
      <span>{label}</span>
      {children}
    </label>
  );
}

const inputClassName =
  "h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-brand-600 focus:ring-4 focus:ring-brand-100";

function ErrorNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
      {message}
    </p>
  );
}

function PrimaryButton({ children, loading }: { children: React.ReactNode; loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-brand-400"
    >
      {loading ? "처리 중…" : children}
    </button>
  );
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login({ email, password });
      router.replace(returnTo);
      router.refresh();
    } catch (requestError) {
      setError(authErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell eyebrow="ETF CAMPUS ACCOUNT" title="로그인" description="저장한 ETF 비교와 개인화 기능을 이어서 이용하세요.">
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <ErrorNotice message={error} />
        <Field label="이메일">
          <input className={inputClassName} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required />
        </Field>
        <Field label="비밀번호">
          <input className={inputClassName} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </Field>
        <p className="rounded-lg border border-brand-100 bg-brand-50/60 px-3 py-2 text-xs leading-5 text-muted">
          현재는 회원가입과 로그인 기능을 먼저 운영 검증하고 있습니다.
        </p>
        <PrimaryButton loading={loading}>로그인</PrimaryButton>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        아직 회원이 아니신가요?{" "}
        <Link href={withReturnTo("/register/", returnTo)} className="font-semibold text-brand-700 hover:text-brand-800">
          가입하기
        </Link>
      </p>
    </AuthShell>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
    requiredConsent: false,
    marketingConsent: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await register({ ...form, displayName: form.displayName || undefined });
      router.replace(returnTo);
      router.refresh();
    } catch (requestError) {
      setError(authErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell eyebrow="ETF CAMPUS ACCOUNT" title="회원가입" description="ETF 비교 결과와 관심 종목을 저장하고, 상세 분석을 이어서 확인하세요.">
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <ErrorNotice message={error} />
        <Field label="이름 또는 닉네임 (선택)">
          <input className={inputClassName} type="text" autoComplete="name" value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} placeholder="예: ETF 초보" />
        </Field>
        <Field label="이메일">
          <input className={inputClassName} type="email" autoComplete="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="name@example.com" required />
        </Field>
        <Field label="비밀번호">
          <input className={inputClassName} type="password" autoComplete="new-password" minLength={10} value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="10자 이상 입력" required />
        </Field>
        <label className="flex items-start gap-3 rounded-lg border border-line bg-brand-50/50 p-3 text-sm leading-5 text-ink">
          <input className="mt-1 h-4 w-4 accent-brand-700" type="checkbox" checked={form.requiredConsent} onChange={(event) => setForm((current) => ({ ...current, requiredConsent: event.target.checked }))} required />
          <span><strong>[필수]</strong> 서비스 이용약관 및 개인정보 처리방침에 동의합니다.</span>
        </label>
        <label className="flex items-start gap-3 text-sm leading-5 text-muted">
          <input className="mt-1 h-4 w-4 accent-brand-700" type="checkbox" checked={form.marketingConsent} onChange={(event) => setForm((current) => ({ ...current, marketingConsent: event.target.checked }))} />
          <span>[선택] ETF Campus의 신규 기능과 콘텐츠 소식을 이메일로 받겠습니다.</span>
        </label>
        <PrimaryButton loading={loading}>시작하기</PrimaryButton>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        이미 회원이신가요?{" "}
        <Link href={withReturnTo("/login/", returnTo)} className="font-semibold text-brand-700 hover:text-brand-800">
          로그인
        </Link>
      </p>
    </AuthShell>
  );
}

export function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (requestError) {
      setError(authErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell eyebrow="PASSWORD RESET" title="비밀번호 재설정" description="가입한 이메일로 비밀번호 재설정 링크를 보내 드립니다.">
      {sent ? (
        <div className="grid gap-5">
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">입력한 이메일이 등록되어 있다면 재설정 안내를 발송했습니다. 메일함과 스팸함을 확인해 주세요.</p>
          <Link href={withReturnTo("/login/", returnTo)} className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">로그인으로 돌아가기</Link>
        </div>
      ) : (
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <ErrorNotice message={error} />
          <Field label="가입 이메일">
            <input className={inputClassName} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required />
          </Field>
          <PrimaryButton loading={loading}>재설정 링크 보내기</PrimaryButton>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(token ? null : "재설정 링크가 올바르지 않습니다.");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      await resetPassword({ token, newPassword, confirmPassword });
      window.history.replaceState({}, "", "/reset-password/");
      setSuccess(true);
      window.setTimeout(() => router.replace("/login/"), 1800);
    } catch (requestError) {
      setError(authErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell eyebrow="PASSWORD RESET" title="새 비밀번호 설정" description="비밀번호를 변경하면 모든 기기에서 로그아웃되며, 새 비밀번호로 다시 로그인해야 합니다.">
      {success ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">비밀번호가 변경되었습니다. 로그인 화면으로 이동합니다.</p>
      ) : (
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <ErrorNotice message={error} />
          <Field label="새 비밀번호">
            <input className={inputClassName} type="password" autoComplete="new-password" minLength={10} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="10자 이상 입력" required />
          </Field>
          <Field label="새 비밀번호 확인">
            <input className={inputClassName} type="password" autoComplete="new-password" minLength={10} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
          </Field>
          <PrimaryButton loading={loading}>새 비밀번호 저장</PrimaryButton>
        </form>
      )}
    </AuthShell>
  );
}
