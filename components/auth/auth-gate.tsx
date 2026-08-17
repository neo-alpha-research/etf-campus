"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ReactNode } from "react";
import { withReturnTo } from "@/lib/auth/return-to";
import { useAuthSession } from "@/components/auth/use-auth-session";

export function AuthGate({
  title,
  description,
  children,
  featureLabel = "회원 전용 분석",
}: {
  title: string;
  description: string;
  children: ReactNode;
  featureLabel?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { authenticated, isLoading } = useAuthSession();
  const query = searchParams.toString();
  const returnTo = `${pathname}${query ? `?${query}` : ""}`;

  if (isLoading) {
    return <div className="h-36 animate-pulse rounded-2xl border border-line bg-brand-50/60" aria-label="접근 권한 확인 중" />;
  }
  if (authenticated) return <>{children}</>;

  return (
    <section className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-5 sm:p-6">
      <p className="text-xs font-bold tracking-[0.16em] text-brand-700">{featureLabel}</p>
      <h2 className="mt-2 text-xl font-bold tracking-tight text-ink">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={withReturnTo("/register/", returnTo)} className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">
          분석 열기
        </Link>
        <Link href={withReturnTo("/login/", returnTo)} className="inline-flex h-10 items-center justify-center rounded-lg border border-brand-200 bg-white px-4 text-sm font-semibold text-brand-800 hover:bg-brand-50">
          로그인
        </Link>
      </div>
    </section>
  );
}
