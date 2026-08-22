"use client";

import { SupabaseAuthFlow } from "@/components/auth/supabase-auth-flow";

type Props = {
  open: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
};

export function CommunityAuthDialog({ open, onClose, onAuthenticated }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/45 p-0 sm:items-center sm:justify-center sm:p-6" role="presentation">
      <section aria-modal="true" aria-labelledby="community-auth-title" className="relative w-full max-w-md" role="dialog">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 z-10 rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100" aria-label="로그인 창 닫기">닫기</button>
        <SupabaseAuthFlow onAuthenticated={onAuthenticated} />
      </section>
    </div>
  );
}
