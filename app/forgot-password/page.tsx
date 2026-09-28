"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SupabaseAuthFlow } from "@/components/auth/supabase-auth-flow";
import { safeReturnTo } from "@/lib/auth/return-to";

function ForgotPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("returnTo"));

  return (
    <>
      <link rel="preconnect" href="https://challenges.cloudflare.com" />
      <link rel="dns-prefetch" href="https://challenges.cloudflare.com" />
      <div className="mx-auto w-full max-w-md px-4 py-16">
        <SupabaseAuthFlow initialStep="otp-request" title="비밀번호 찾기" subtitle="PASSWORD RESET" onAuthenticated={() => { router.replace(returnTo); }} />
      </div>
    </>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-md px-4 py-16 text-sm text-muted">화면을 준비하고 있습니다.</div>}>
      <ForgotPasswordContent />
    </Suspense>
  );
}
