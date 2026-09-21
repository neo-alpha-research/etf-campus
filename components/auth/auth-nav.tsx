"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import { withReturnTo } from "@/lib/auth/return-to";
import { useAuthSession } from "@/components/auth/use-auth-session";
import { openStyleDiagnosis, useStyleDiagnosis } from "@/components/onboarding/style-chip";

export function AuthNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, authenticated, isLoading, signOut } = useAuthSession();
  const { profile, hasCompleted } = useStyleDiagnosis();
  const [loggingOut, setLoggingOut] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const query = searchParams.toString();
  const currentPath = `${pathname}${query ? `?${query}` : ""}`;

  const closeMenu = useCallback((restoreFocus = true) => {
    setIsOpen(false);
    if (restoreFocus && triggerRef.current) {
      triggerRef.current.focus();
    }
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isOpen, closeMenu]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeMenu(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeMenu]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await signOut();
      closeMenu(false);
      router.replace("/");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  if (isLoading) {
    return (
      <div
        aria-hidden="true"
        className="h-9 w-20 sm:w-24 animate-pulse rounded-xl bg-neutral-100 border border-neutral-200/80 shrink-0"
        aria-label="계정 상태 확인 중"
      />
    );
  }

  // 1. 비로그인 상태 (데스크톱에서는 깔끔한 로그인 버튼, 모바일/태블릿에서는 계정/진단 메뉴 제공)
  if (!authenticated || !user) {
    return (
      <div ref={menuRef} className="relative flex items-center shrink-0">
        {/* 데스크톱(1280px 이상): 직관적인 로그인 단일 버튼 */}
        <Link
          href={withReturnTo("/login/", currentPath)}
          className="hidden xl:inline-flex h-9 items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 text-xs xl:text-sm font-bold text-neutral-800 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-900 transition-all shadow-2xs whitespace-nowrap shrink-0"
        >
          로그인
        </Link>

        {/* 1280px 미만: 로그인 및 적성 진단을 품은 컴팩트 계정 메뉴 드롭다운 */}
        <div className="xl:hidden">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-expanded={isOpen}
            aria-haspopup="menu"
            aria-label="계정 및 로그인 메뉴"
            className="inline-flex h-9 items-center gap-1 sm:gap-1.5 rounded-xl border border-neutral-200 bg-white px-2.5 sm:px-3 text-xs sm:text-sm font-bold text-neutral-800 hover:bg-neutral-50 active:scale-98 transition-all shadow-2xs cursor-pointer shrink-0"
          >
            <svg className="size-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="font-bold">로그인</span>
            <svg
              className={`size-3 text-neutral-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isOpen && (
            <div
              role="menu"
              aria-label="계정 메뉴"
              className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-white border border-neutral-200/90 shadow-xl p-2 z-[150] animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-1 text-sm font-medium"
            >
              <div className="px-3 py-2 border-b border-neutral-100">
                <p className="text-xs font-bold text-neutral-500">환영합니다!</p>
                <p className="text-[11px] text-neutral-400 mt-0.5">로그인하고 나만의 ETF 포트폴리오를 확인하세요</p>
              </div>

              <Link
                role="menuitem"
                href={withReturnTo("/login/", currentPath)}
                onClick={() => closeMenu(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-neutral-800 hover:bg-brand-50 hover:text-brand-900 font-bold transition-colors"
              >
                <span>🔑</span>
                <span>로그인</span>
              </Link>

              <Link
                role="menuitem"
                href={withReturnTo("/register/", currentPath)}
                onClick={() => closeMenu(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
              >
                <span>✨</span>
                <span>무료 회원가입</span>
              </Link>

              <div className="my-1 border-t border-neutral-100" />

              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  closeMenu(false);
                  openStyleDiagnosis();
                }}
                className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-xl text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100/80 font-bold transition-colors cursor-pointer"
              >
                <span>{profile ? "🐿️" : "🧭"}</span>
                <span>{hasCompleted ? "적성 리포트 보기" : "전공 적성 진단 (3분)"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. 로그인 상태: 컴팩트 [👤 내 계정 ▾] 단일 버튼 + 드롭다운 팝업
  const displayName = user.displayName || user.email.split("@")[0];

  return (
    <div ref={menuRef} className="relative flex items-center shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`내 계정 메뉴 (${displayName})`}
        className={`inline-flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-2.5 sm:px-3 text-xs sm:text-sm font-bold text-neutral-800 hover:border-brand-300 hover:bg-neutral-50 active:scale-98 transition-all shadow-2xs cursor-pointer shrink-0 ${
          isOpen ? "border-brand-500 ring-2 ring-brand-200 bg-brand-50/40" : ""
        }`}
      >
        <svg className="size-4 text-brand-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span className="max-w-24 sm:max-w-28 truncate">{displayName}</span>
        <svg
          className={`size-3 text-neutral-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="사용자 계정 메뉴"
          className="absolute right-0 top-full mt-2 w-60 rounded-2xl bg-white border border-neutral-200/90 shadow-xl p-2 z-[150] animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-1 text-sm font-medium"
        >
          {/* 사용자 정보 헤더 */}
          <div className="px-3 py-2.5 border-b border-neutral-100 bg-neutral-50/60 rounded-xl">
            <p className="text-xs font-black text-neutral-900 truncate">{displayName} 님</p>
            <p className="text-[11px] font-medium text-neutral-500 truncate mt-0.5" title={user.email}>
              {user.email}
            </p>
          </div>

          {/* 1280px 미만 화면 전용: 적성 진단 / 리포트 진입점 */}
          <div className="xl:hidden pt-1">
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                closeMenu(false);
                openStyleDiagnosis();
              }}
              className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-xl text-brand-900 bg-brand-50/60 hover:bg-brand-100/70 font-bold transition-colors cursor-pointer text-xs"
            >
              <span>{profile ? "🐿️" : "🧭"}</span>
              <span className="truncate">
                {hasCompleted ? `전공 적성 리포트 (${profile?.name})` : "나의 ETF 전공 적성 진단"}
              </span>
            </button>
            <div className="my-1 border-t border-neutral-100" />
          </div>

          {/* 로그아웃 버튼 */}
          <button
            role="menuitem"
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 hover:text-rose-700 font-bold transition-colors cursor-pointer text-xs sm:text-sm disabled:opacity-50"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>{loggingOut ? "로그아웃 중..." : "로그아웃"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
