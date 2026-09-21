"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Step, SupabaseAuthFlow } from "@/components/auth/supabase-auth-flow";
import { safeReturnTo } from "@/lib/auth/return-to";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const stepParam = searchParams.get("step");
  const initialStep: Step = stepParam === "profile" ? "profile" : "login";
  const initialError = searchParams.get("error") || undefined;

  return (
    <>
      <link rel="preconnect" href="https://challenges.cloudflare.com" />
      <link rel="dns-prefetch" href="https://challenges.cloudflare.com" />
      <div className="mx-auto w-full max-w-md px-4 py-16">
        <SupabaseAuthFlow
          initialStep={initialStep}
          returnTo={returnTo}
          initialError={initialError}
          onAuthenticated={() => {
            router.replace(returnTo);
          }}
        />
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-md px-4 py-16 text-sm text-muted">로그인 화면을 준비하고 있습니다.</div>}>
      <LoginContent />
    </Suspense>
  );
}
