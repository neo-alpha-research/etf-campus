"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { withReturnTo } from "@/lib/auth/return-to";
import { useAuthSession } from "@/components/auth/use-auth-session";

export function AuthNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, authenticated, isLoading, signOut } = useAuthSession();
  const [loggingOut, setLoggingOut] = useState(false);
  const query = searchParams.toString();
  const currentPath = `${pathname}${query ? `?${query}` : ""}`;

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await signOut();
      router.replace("/");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  if (isLoading) {
    return <span className="hidden h-9 w-20 animate-pulse rounded-lg bg-brand-100 sm:inline-block" aria-label="로그인 상태 확인 중" />;
  }

  if (!authenticated || !user) {
    return (
      <div className="flex items-center gap-2">
        <Link href={withReturnTo("/login/", currentPath)} className="inline-flex h-9 items-center justify-center rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-brand-50 sm:hidden">
          로그인
        </Link>
        <div className="hidden items-center gap-2 sm:flex">
          <Link href={withReturnTo("/login/", currentPath)} className="inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold text-ink hover:bg-brand-50">
            로그인
          </Link>
          <Link href={withReturnTo("/register/", currentPath)} className="inline-flex h-9 items-center justify-center rounded-lg bg-brand-700 px-3 text-sm font-semibold text-white hover:bg-brand-800">
            무료 가입
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={handleLogout} disabled={loggingOut} className="inline-flex h-9 items-center justify-center rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-brand-50 disabled:cursor-not-allowed disabled:text-muted sm:hidden">
        {loggingOut ? "…" : "로그아웃"}
      </button>
      <div className="hidden items-center gap-3 sm:flex">
        <span className="max-w-28 truncate text-sm font-medium text-ink" title={user.email}>
          {user.displayName || user.email.split("@")[0]}님
        </span>
        <button type="button" onClick={handleLogout} disabled={loggingOut} className="inline-flex h-9 items-center justify-center rounded-lg border border-line px-3 text-sm font-semibold text-ink hover:bg-brand-50 disabled:cursor-not-allowed disabled:text-muted">
          {loggingOut ? "로그아웃 중" : "로그아웃"}
        </button>
      </div>
    </div>
  );
}
