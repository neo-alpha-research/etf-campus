"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SupabaseAuthFlow } from "@/components/auth/supabase-auth-flow";
import { safeReturnTo } from "@/lib/auth/return-to";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("returnTo"));

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <SupabaseAuthFlow initialStep="login" onAuthenticated={() => { router.replace(returnTo); router.refresh(); }} />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-md px-4 py-16 text-sm text-muted">로그인 화면을 준비하고 있습니다.</div>}>
      <LoginContent />
    </Suspense>
  );
}
