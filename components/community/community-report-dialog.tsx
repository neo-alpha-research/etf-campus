"use client";

import { FormEvent, useId, useState } from "react";
import { communityFetch, getCommunitySession, refreshCommunitySession } from "@/lib/community/browser-client";

const REPORT_REASONS = [
  { value: "privacy_exposure", label: "개인정보 또는 인증 정보가 포함되어 있습니다" },
  { value: "scam_or_external_inducement", label: "사기성 링크·외부 유도·리딩방 홍보가 있습니다" },
  { value: "guaranteed_return_or_trade_signal", label: "수익 보장 또는 매수·매도 신호를 강요합니다" },
  { value: "misleading_information", label: "오해를 부를 수 있는 정보가 있습니다" },
  { value: "harassment_or_abuse", label: "괴롭힘·비방·공격적 표현이 있습니다" },
  { value: "advertising_or_copyright", label: "광고·저작권 침해가 의심됩니다" },
  { value: "other", label: "기타 운영 정책 위반이 의심됩니다" },
] as const;

type CommunityReportDialogProps = {
  endpoint: string;
  targetLabel: "게시물" | "댓글";
  onAuthRequired: () => void;
  onSubmitted: (message: string) => void;
};

export function CommunityReportDialog({ endpoint, targetLabel, onAuthRequired, onSubmitted }: CommunityReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [reasonCode, setReasonCode] = useState("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const titleId = useId();

  function close() {
    if (loading) return;
    setOpen(false);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reasonCode) {
      setError("신고 사유를 선택해 주세요.");
      return;
    }
    if (!getCommunitySession() && !(await refreshCommunitySession())) {
      close();
      onAuthRequired();
      return;
    }

    setLoading(true);
    setError("");
    try {
      await communityFetch(endpoint, { method: "POST", body: JSON.stringify({ reasonCode, details }) });
      setOpen(false);
      setReasonCode("");
      setDetails("");
      onSubmitted(`${targetLabel} 신고를 접수했습니다. 운영자가 수동으로 검토합니다.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "신고를 접수하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} className="rounded-lg px-2 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800">신고하기</button>
    {open ? <div role="presentation" className="fixed inset-0 z-50 flex items-end bg-slate-950/40 p-3 sm:items-center sm:justify-center" onMouseDown={close}>
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl sm:p-6" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold tracking-[0.16em] text-brand-700">COMMUNITY SAFETY</p><h2 id={titleId} className="mt-2 text-xl font-extrabold text-slate-950">{targetLabel} 신고하기</h2><p className="mt-2 text-sm leading-6 text-slate-600">신고는 자동 제재로 이어지지 않습니다. 운영자가 사실과 정책을 수동으로 검토합니다.</p></div><button type="button" onClick={close} aria-label="신고 모달 닫기" className="rounded-lg px-2 py-1 text-lg text-slate-500 hover:bg-slate-100">×</button></div>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <fieldset><legend className="text-sm font-bold text-slate-800">신고 사유</legend><div className="mt-2 space-y-2">{REPORT_REASONS.map((reason) => <label key={reason.value} className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3 text-sm leading-5 text-slate-700 hover:border-brand-300"><input type="radio" name="report-reason" value={reason.value} checked={reasonCode === reason.value} onChange={() => setReasonCode(reason.value)} className="mt-0.5" />{reason.label}</label>)}</div></fieldset>
          <label className="block text-sm font-bold text-slate-800">추가 설명 <span className="font-normal text-slate-500">(선택)</span><textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={600} rows={4} placeholder="재현 가능한 사실만 적어 주세요. 실명, 연락처, 인증 코드, 계좌 정보는 입력하지 마세요." className="mt-2 w-full resize-y rounded-xl border border-slate-300 p-3 text-sm leading-6 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" /></label>
          {error ? <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={close} disabled={loading} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 disabled:cursor-not-allowed">취소</button><button disabled={loading} className="rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400">{loading ? "접수 중" : "신고 접수"}</button></div>
        </form>
      </section>
    </div> : null}
  </>;
}
