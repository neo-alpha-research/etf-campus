"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SupabaseAuthFlow } from "@/components/auth/supabase-auth-flow";
import { safeReturnTo } from "@/lib/auth/return-to";

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("returnTo"));

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <SupabaseAuthFlow initialStep="otp-request" title="회원가입" subtitle="ETF CAMPUS ACCOUNT" onAuthenticated={() => { router.replace(returnTo); router.refresh(); }} />
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-md px-4 py-16 text-sm text-muted">회원가입 화면을 준비하고 있습니다.</div>}>
      <RegisterContent />
    </Suspense>
  );
}
