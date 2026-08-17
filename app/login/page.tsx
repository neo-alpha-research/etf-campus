"use client";

import { Suspense } from "react";
import { LoginForm } from "@/components/auth/auth-forms";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-md px-4 py-16 text-sm text-muted">로그인 화면을 준비하고 있습니다.</div>}>
      <LoginForm />
    </Suspense>
  );
}
