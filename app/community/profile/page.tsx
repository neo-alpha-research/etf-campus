"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/components/auth/use-auth-session";
import { communityFetch } from "@/lib/community/browser-client";

export default function ProfilePage() {
  const { authenticated, isLoading } = useAuthSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  
  const [nickname, setNickname] = useState("");
  const [ageBand, setAgeBand] = useState("");
  const [interestAccountType, setInterestAccountType] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!authenticated) {
      router.replace("/login");
      return;
    }

    communityFetch("/api/community/auth/profile")
      .then((res) => {
        if (res.profile) {
          setNickname(res.profile.nickname ?? "");
          setAgeBand(res.profile.ageBand ?? "");
          setInterestAccountType(res.profile.interestAccountType ?? "");
          setMarketingConsent(Boolean(res.profile.marketingConsent));
        }
      })
      .catch((err) => setMessage(err.message))
      .finally(() => setLoading(false));
  }, [authenticated, isLoading, router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      await communityFetch("/api/community/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({
          ageBand,
          interestAccountType,
          marketingConsent,
        }),
      });
      setMessage("프로필이 성공적으로 업데이트되었습니다.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "업데이트 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || isLoading) {
    return <div className="p-8 text-center text-slate-500">불러오는 중...</div>;
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">내 프로필 설정</h1>
      
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSave} className="space-y-6">
          
          <div>
            <label className="block text-sm font-semibold text-slate-800">공개 닉네임</label>
            <input 
              type="text" 
              value={nickname} 
              disabled 
              className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-base text-slate-500" 
            />
            <p className="mt-1 text-xs text-slate-500">닉네임은 현재 변경할 수 없습니다.</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800">연령대 <span className="font-normal text-slate-500">(선택)</span></label>
            <select 
              value={ageBand} 
              onChange={(e) => setAgeBand(e.target.value)} 
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            >
              <option value="">선택 안 함</option>
              <option value="20s">20대</option>
              <option value="30s">30대</option>
              <option value="40s">40대</option>
              <option value="50s">50대</option>
              <option value="60s_plus">60대 이상</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800">관심 퇴직연금 유형 <span className="font-normal text-slate-500">(선택)</span></label>
            <select 
              value={interestAccountType} 
              onChange={(e) => setInterestAccountType(e.target.value)} 
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            >
              <option value="">선택 안 함</option>
              <option value="dc">DC형</option>
              <option value="db">DB형</option>
              <option value="irp">IRP</option>
              <option value="both">둘 다 보유 (DC+IRP 등)</option>
              <option value="none">없음</option>
              <option value="unknown">모름</option>
            </select>
          </div>

          <div className="flex flex-col gap-3 mt-4 p-4 border border-slate-200 rounded-xl bg-slate-50">
            <label className="flex items-start gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={marketingConsent} 
                onChange={(e) => setMarketingConsent(e.target.checked)} 
                className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-700" 
              />
              <span className="text-sm text-slate-700">마케팅 정보 수신 동의<br/><span className="text-xs text-slate-500">새로운 챌린지, 전자책 등의 소식을 이메일로 받습니다.</span></span>
            </label>
          </div>

          <button 
            type="submit" 
            disabled={saving} 
            className="w-full rounded-xl bg-brand-700 px-4 py-3 text-base font-bold text-white hover:bg-brand-800 disabled:bg-slate-400"
          >
            {saving ? "저장 중..." : "변경사항 저장"}
          </button>

          {message && (
            <p className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm leading-5 text-slate-700 text-center">
              {message}
            </p>
          )}

        </form>
      </div>
    </main>
  );
}
