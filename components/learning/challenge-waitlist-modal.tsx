"use client";

import { useState, useEffect, type FormEvent } from "react";
import { X, Sparkles, CheckCircle2, Shield, ArrowRight, Loader2, BookOpen } from "lucide-react";

interface ChallengeWaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  source?: string;
}

export function ChallengeWaitlistModal({
  isOpen,
  onClose,
  source = "compare_bridge",
}: ChallengeWaitlistModalProps) {
  const [email, setEmail] = useState("");
  const [interest, setInterest] = useState<string>("dc_irp");
  const [agreeRequired, setAgreeRequired] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleClose = () => {
    setIsSuccess(false);
    setErrorMessage(null);
    onClose();
  };

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSuccess(false);
        setErrorMessage(null);
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setErrorMessage("유효한 이메일 주소를 입력해 주세요.");
      return;
    }
    if (!agreeRequired) {
      setErrorMessage("출시 알림 및 개인정보 수집에 동의해 주세요.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/lead/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          interest,
          source,
          agreeRequired,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;

      if (!res.ok || !data?.success) {
        setErrorMessage(data?.error?.message || "신청 처리 중 일시적인 오류가 발생했습니다.");
        setIsSubmitting(false);
        return;
      }

      setIsSuccess(true);
    } catch {
      setErrorMessage("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="waitlist-modal-title"
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-brand-200 bg-surface shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 닫기 버튼 */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="닫기"
          className="absolute right-4 top-4 z-10 rounded-xl p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {isSuccess ? (
          /* 성공 피드백 화면 */
          <div className="p-6 sm:p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-xs">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <span className="mt-4 inline-block rounded-full bg-emerald-100/80 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
              사전 예약 완료
            </span>

            <h3
              id="waitlist-modal-title"
              className="mt-2.5 text-xl sm:text-2xl font-extrabold tracking-tight text-strong"
            >
              얼리버드 대기자 등록이 완료되었습니다!
            </h3>

            <p className="mt-3 text-xs sm:text-sm text-neutral-600 leading-relaxed">
              등록하신 이메일(<span className="font-semibold text-strong">{email}</span>)로 패키지 출시 시점과 함께 <span className="font-bold text-emerald-700">50% 얼리버드 특별 할인 코드</span> 및 <span className="font-bold text-emerald-700">[1주차 연금 점검 체크리스트]</span>를 가장 먼저 발송해 드리겠습니다.
            </p>

            <div className="mt-6 rounded-xl bg-neutral-50 p-4 border border-line text-left text-xs text-neutral-600 space-y-1.5">
              <p className="font-bold text-neutral-800 flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-emerald-600" />
                안내 사항
              </p>
              <p>• 도서 2·3권 집필 완료 즉시 정식 오픈 일정을 메일로 안내합니다.</p>
              <p>• 챌린지는 브라우저 로컬 체크리스트로 진행되며 특정 종목을 추천하지 않습니다.</p>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="mt-6 w-full min-h-[46px] rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-900 transition-colors shadow-xs"
            >
              확인
            </button>
          </div>
        ) : (
          /* 신청 입력 폼 화면 */
          <div className="p-6 sm:p-7">
            {/* 뱃지 & 헤더 */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-extrabold text-brand-800 border border-brand-200">
                <Sparkles className="h-3 w-3" />
                얼리버드 50% 사전 혜택
              </span>
              <span className="text-xs font-medium text-muted">출시 전 한정</span>
            </div>

            <h3
              id="waitlist-modal-title"
              className="mt-2 text-xl sm:text-2xl font-extrabold tracking-tight text-strong"
            >
              30일 자기주도 챌린지 &amp; 가이드 패키지
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-neutral-600 leading-relaxed">
              연 3.1%에 묶인 내 퇴직연금, 추천에 휘둘리지 않고 스스로 점검하는 실전 루틴을 익힙니다.
            </p>

            {/* 패키지 투명 안내 박스 (Astra 원칙: 미완성 도서 사전 고지) */}
            <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/50 p-3.5 text-xs leading-relaxed space-y-2">
              <div className="font-bold text-brand-900 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <BookOpen className="h-3.5 w-3.5" />
                  패키지 구성 및 사전 예약 혜택
                </span>
                <span className="text-emerald-700 font-extrabold">
                  정가 9.9만 ➔ <span className="text-sm">4.9만 원</span>
                </span>
              </div>
              <ul className="space-y-1 text-neutral-700">
                <li className="flex items-start gap-1.5">
                  <span className="text-brand-700 font-bold shrink-0">[1권 즉시열람]</span>
                  <span>실부담비용 38배 격차의 진실 (사후 역산 공시치 분석)</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-brand-700 font-bold shrink-0">[2·3권 얼리버드]</span>
                  <span>30년 자산배분 &amp; 모멘텀 시스템 (출시 즉시 발송)</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-brand-700 font-bold shrink-0">[30일 챌린지]</span>
                  <span>브라우저 로컬 체크리스트 기반 자가 진단 및 리밸런싱</span>
                </li>
              </ul>
            </div>

            <form
              onSubmit={handleSubmit}
              data-testid="waitlist-form"
              className="mt-5 space-y-4"
            >
              {/* 이메일 입력 */}
              <div>
                <label htmlFor="waitlist-email" className="block text-xs font-bold text-neutral-700 mb-1">
                  출시 알림 및 쿠폰 수신 이메일 <span className="text-rose-500">*</span>
                </label>
                <input
                  id="waitlist-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  disabled={isSubmitting}
                  className="w-full h-11 px-3.5 rounded-xl border border-line bg-surface text-sm text-strong focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                />
              </div>

              {/* 관심 영역 선택 */}
              <div>
                <span className="block text-xs font-bold text-neutral-700 mb-1.5">
                  가장 관심 있는 점검 영역
                </span>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[
                    { id: "dc_irp", label: "DC/IRP 연금" },
                    { id: "fee", label: "실부담비용 절감" },
                    { id: "routine", label: "30일 자기주도" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setInterest(item.id)}
                      className={`h-9 px-2 rounded-lg font-bold border transition-all text-center ${
                        interest === item.id
                          ? "bg-brand-50 border-brand-500 text-brand-800 ring-1 ring-brand-500"
                          : "bg-surface border-line text-neutral-600 hover:bg-neutral-50"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 필수 동의 체크박스 */}
              <div className="flex items-start gap-2 pt-1">
                <input
                  id="agree-waitlist"
                  type="checkbox"
                  checked={agreeRequired}
                  onChange={(e) => setAgreeRequired(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="agree-waitlist" className="text-xs text-neutral-600 leading-snug cursor-pointer select-none">
                  [필수] 얼리버드 출시 알림 및 50% 할인 혜택 수신에 동의합니다. (출시 안내 외의 목적으로 사용되지 않습니다)
                </label>
              </div>

              {errorMessage && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs font-semibold text-rose-700">
                  {errorMessage}
                </div>
              )}

              {/* 제출 버튼 */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full min-h-[46px] flex items-center justify-center gap-2 rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-brand-900 active:scale-[0.99] transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>신청 접수 중...</span>
                  </>
                ) : (
                  <>
                    <span>얼리버드 50% 혜택 알림 받기</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* 자본시장법 제101조 컴플라이언스 각주 */}
            <p className="mt-4 text-[11px] text-neutral-400 text-center leading-relaxed">
              * 본 프로그램은 특정 종목 추천이나 매수 권유가 아닌, 공시된 비용과 계좌 규칙을 스스로 점검하는 100% 자기주도 교육 루틴입니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
