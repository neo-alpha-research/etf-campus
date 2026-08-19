"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ReactNode, useState, useEffect } from "react";
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

  const [bypass, setBypass] = useState(false);
  const [isLocalhost, setIsLocalhost] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLocalhost(window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  }, []);

  if (isLoading) {
    return <div className="h-36 animate-pulse rounded-2xl border border-line bg-brand-50/60" aria-label="접근 권한 확인 중" />;
  }
  if (authenticated || bypass) return <>{children}</>;

  return (
    <section className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-5 sm:p-6">
      <p className="text-xs font-bold tracking-[0.16em] text-brand-700">{featureLabel}</p>
      <h2 className="mt-2 text-xl font-bold tracking-tight text-ink">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p>
      <div className="mt-5 flex flex-wrap gap-2 items-center">
        <Link href={withReturnTo("/login/", returnTo)} className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">
          로그인
        </Link>
        {isLocalhost && (
          <button onClick={() => setBypass(true)} className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            [개발용] 로그인 없이 보기
          </button>
        )}
      </div>
    </section>
  );
}
