"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
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
  // 동의 기본 미선택 (Default unchecked)
  const [agreeRequired, setAgreeRequired] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousFocusedElementRef = useRef<HTMLElement | null>(null);

  const handleClose = () => {
    setIsSuccess(false);
    setErrorMessage(null);
    onClose();
  };

  // Escape 키 닫기 및 포커스 복원(Focus Restoration), 배경 스크롤 잠금(Scroll Lock)
  useEffect(() => {
    if (!isOpen) return;

    previousFocusedElementRef.current = (document.activeElement as HTMLElement) || null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);

    const timer = setTimeout(() => {
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
        "input:not([disabled]), button:not([disabled])"
      );
      firstFocusable?.focus();
    }, 50);

    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      document.body.style.overflow = originalOverflow;
      clearTimeout(timer);
      if (previousFocusedElementRef.current) {
        const el = previousFocusedElementRef.current;
        previousFocusedElementRef.current = null;
        setTimeout(() => {
          if (el && typeof el.focus === "function") {
            el.focus();
          }
        }, 10);
      }
    };
  }, [isOpen, onClose]);

  // 성공 화면 전환 시 스크린 리더 및 키보드 사용자를 위한 헤딩 포커스 이동
  useEffect(() => {
    if (!isSuccess) return;
    const timer = setTimeout(() => {
      successHeadingRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [isSuccess]);

  // 포커스 트랩(Tab / Shift+Tab) 키보드 이벤트 핸들러
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Tab" && dialogRef.current) {
      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusables.length > 0) {
        const firstEl = focusables[0];
        const lastEl = focusables[focusables.length - 1];
        const currentActive = document.activeElement as HTMLElement | null;

        if (e.shiftKey) {
          if (!currentActive || currentActive === firstEl || !focusables.includes(currentActive)) {
            e.preventDefault();
            lastEl.focus();
          }
        } else {
          if (!currentActive || currentActive === lastEl || !focusables.includes(currentActive)) {
            e.preventDefault();
            firstEl.focus();
          }
        }
      }
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setErrorMessage("유효한 이메일 주소를 입력해 주세요.");
      return;
    }
    if (!agreeRequired) {
      setErrorMessage("개인정보 수집 및 출시 알림 수신에 동의해 주세요.");
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
          campaign: "challenge_guide_2026",
          termsVersion: "v1.0",
          agreeRequired,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;

      if (!res.ok || !data?.success) {
        // 실패 시에도 사용자가 입력한 email 및 interest는 유지
        setErrorMessage(
          data?.error?.message ||
            "신청 처리 중 일시적인 오류가 발생했습니다. 입력값은 유지되니 다시 시도해 주세요."
        );
        setIsSubmitting(false);
        return;
      }

      setIsSuccess(true);
    } catch {
      setErrorMessage("네트워크 오류가 발생했습니다. 입력값은 유지되니 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="waitlist-modal-title"
      style={{ overscrollBehavior: "contain" }}
      onTouchMove={(e) => {
        if (e.target === e.currentTarget) e.preventDefault();
      }}
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-brand-200 bg-surface shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 닫기 버튼 (최소 44px 터치 영역 확보) */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="닫기"
          className="absolute right-3.5 top-3.5 z-10 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {isSuccess ? (
          /* 신청 완료 화면 */
          <div className="p-6 sm:p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-xs">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <span className="mt-4 inline-block rounded-full bg-emerald-100/80 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
              알림 신청 접수 완료
            </span>

            <h3
              id="waitlist-modal-title"
              ref={successHeadingRef}
              tabIndex={-1}
              className="mt-2.5 text-xl sm:text-2xl font-extrabold tracking-tight text-strong focus:outline-hidden"
            >
              출시 알림 신청이 완료되었습니다
            </h3>

            <p className="mt-3 text-xs sm:text-sm text-neutral-600 leading-relaxed">
              등록하신 이메일(<span className="font-semibold text-strong">{email}</span>)로 실무 기반 ETF 자가 점검 교육 가이드 및 체크리스트가 준비되는 대로 가장 먼저 안내해 드리겠습니다.
            </p>

            <div className="mt-6 rounded-xl bg-neutral-50 p-4 border border-line text-left text-xs text-neutral-600 space-y-1.5">
              <p className="font-bold text-neutral-800 flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                안내 사항
              </p>
              <p>• 본 가이드는 브라우저 기반 자가 점검 체크리스트로 구성되며 특정 종목을 추천하지 않습니다.</p>
              <p>• 수신 동의 철회를 원하시면 언제든지 <span className="font-semibold text-neutral-800">etfcampus@gmail.com</span>으로 요청하실 수 있습니다.</p>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="mt-6 w-full min-h-[44px] rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-900 transition-colors shadow-xs cursor-pointer"
            >
              확인
            </button>
          </div>
        ) : (
          /* 신청 입력 폼 화면 */
          <div className="p-5 sm:p-7">
            {/* 뱃지 & 헤더 */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-extrabold text-brand-800 border border-brand-200">
                <Sparkles className="h-3 w-3" />
                교육 가이드 사전 알림
              </span>
              <span className="text-xs font-medium text-muted">무료 출시 안내</span>
            </div>

            <h3
              id="waitlist-modal-title"
              className="mt-2 text-xl sm:text-2xl font-extrabold tracking-tight text-strong"
            >
              ETF 비용과 계좌별 규칙 자가 점검 가이드
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-neutral-600 leading-relaxed">
              실무 기반 자가 점검 교육 가이드 및 브라우저 체크리스트 출시 알림을 가장 먼저 받아보세요.
            </p>

            {/* 교육 구성 투명 안내 박스 */}
            <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/50 p-3.5 text-xs leading-relaxed space-y-2">
              <div className="font-bold text-brand-900 flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-brand-700 shrink-0" />
                <span>준비 중인 교육 가이드 구성</span>
              </div>
              <ul className="space-y-1.5 text-neutral-700">
                <li className="flex items-start gap-1.5">
                  <span className="text-brand-700 font-bold shrink-0">[실부담비용 항목]</span>
                  <span>단순 표기 보수 외 기타비용과 매매중개수수료율 확인법</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-brand-700 font-bold shrink-0">[계좌별 편입 규칙]</span>
                  <span>DC/IRP 70% 위험자산 한도 및 ISA 절세 요건 점검</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-brand-700 font-bold shrink-0">[자가 점검 루틴]</span>
                  <span>서버 전송 없이 브라우저 로컬에서 작성하는 자가 체크리스트</span>
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
                  출시 알림 수신 이메일 <span className="text-rose-500">*</span>
                </label>
                <input
                  id="waitlist-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  disabled={isSubmitting}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-line bg-surface text-sm text-strong focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
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
                    { id: "fee", label: "실부담비용" },
                    { id: "routine", label: "자가 점검 루틴" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setInterest(item.id)}
                      className={`min-h-[44px] px-2 rounded-lg font-bold border transition-all text-center cursor-pointer ${
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

              {/* 필수 개인정보 수집 및 동의 박스 (최소 운영 요건 완비) */}
              <div className="rounded-xl border border-line bg-neutral-50/70 p-3 text-[11px] leading-relaxed text-neutral-600 space-y-2">
                <div className="space-y-1">
                  <p><strong className="text-neutral-800">• 수집 목적:</strong> ETF 자가 점검 가이드 및 루틴 출시 알림</p>
                  <p><strong className="text-neutral-800">• 수집 항목:</strong> 이메일 주소, 관심 영역</p>
                  <p><strong className="text-neutral-800">• 보유 기간:</strong> 서비스 출시 알림 완료 시 또는 신청자의 동의 철회 시까지</p>
                  <p><strong className="text-neutral-800">• 거부 권리:</strong> 개인정보 수집 동의를 거부할 수 있으며, 거부 시 출시 알림이 발송되지 않습니다.</p>
                  <p><strong className="text-neutral-800">• 동의 철회 안내:</strong> 언제든지 etfcampus@gmail.com으로 수신 동의 철회를 요청하실 수 있습니다.</p>
                </div>

                <div className="flex items-start gap-2 pt-1 border-t border-line">
                  <input
                    id="agree-waitlist"
                    type="checkbox"
                    checked={agreeRequired}
                    onChange={(e) => setAgreeRequired(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                  />
                  <label htmlFor="agree-waitlist" className="text-xs font-bold text-neutral-700 leading-snug cursor-pointer select-none">
                    [필수] 위 개인정보 수집·이용 및 출시 알림 수신에 동의합니다.
                  </label>
                </div>
              </div>

              {errorMessage && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs font-semibold text-rose-700">
                  {errorMessage}
                </div>
              )}

              {/* 제출 버튼 (최소 44px 터치 영역) */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-brand-900 active:scale-[0.99] transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>신청 접수 중...</span>
                  </>
                ) : (
                  <>
                    <span>출시 알림 신청하기</span>
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
