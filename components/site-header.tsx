"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useRef, useSyncExternalStore } from "react";

import { siteConfig } from "@/config/site";
import { Tickery } from "@/components/brand/tickery";
import { StyleChip } from "@/components/onboarding/style-chip";
import { AuthNav } from "@/components/auth/auth-nav";
import { GlobalQuickSearch } from "@/components/search/global-quick-search";

const navigation = [
  { href: "/", label: "마켓 브리핑" },
  { href: "/tutorial/", label: "캠퍼스 투어" },
  { href: "/explore/", label: "ETF 탐색" },
  { href: "/compare", label: "ETF 비교" },
  { href: "/community/", label: "ETF 이야기" },
  { href: "/books/", label: "도서·리뷰" },
  { href: "/notice/", label: "알림·참여" },
] as const;

const accountNavigation = [
  { href: "/explore/?account=all", label: "전체계좌", key: "all" },
  { href: "/explore/?account=pension", label: "퇴직연금", key: "pension" },
  { href: "/explore/?account=personal_pension", label: "연금저축", key: "personal_pension" },
  { href: "/explore/?account=isa", label: "중개형 ISA", key: "isa" },
] as const;

const strategyNavigation = [
  { href: "/quick/?mode=mixed_bonds", label: "혼합채권", key: "mixed_bonds" },
  { href: "/quick/?mode=tdf", label: "TDF", key: "tdf" },
  { href: "/quick/?mode=covered_call", label: "커버드콜", key: "covered_call" },
  { href: "/quick/?mode=derivatives", label: "레버리지·인버스", key: "derivatives" },
  { href: "/quick/?mode=new", label: "신규 상장", key: "new" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const getActiveHref = useCallback(() => {
    if (pathname === "/quick" || pathname === "/quick/") {
      const m = searchParams.get("mode") ?? "general";
      if (m === "general") return "/explore/?account=all";
      if (m === "pension") return "/explore/?account=pension";
      return `/quick/?mode=${m}`;
    }
    if (pathname.startsWith("/explore") || pathname.startsWith("/screener")) {
      const acct = searchParams.get("account");
      if (acct === "all") return "/explore/?account=all";
      if (acct === "personal_pension" || acct === "personal") return "/explore/?account=personal_pension";
      if (acct === "isa") return "/explore/?account=isa";
      return "/explore/?account=pension";
    }
    return undefined;
  }, [pathname, searchParams]);

  const computedHref = getActiveHref();
  const [activeFinderHref, setActiveFinderHref] = useState(computedHref);
  const [prevComputedHref, setPrevComputedHref] = useState(computedHref);

  if (prevComputedHref !== computedHref) {
    setPrevComputedHref(computedHref);
    setActiveFinderHref(computedHref);
  }

  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const isMac = useSyncExternalStore(
    () => () => {},
    () => /(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent || navigator.platform || ""),
    () => false,
  );
  const shortcutKey = isMac ? "⌘ K" : "Ctrl K";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // "ETF 탐색" owns both the screener and the preset ETF views.
  const isEtfSection = pathname.startsWith("/explore") || pathname.startsWith("/screener") || pathname === "/quick" || pathname === "/quick/";
  const showFinderNav = isEtfSection;

  // ResizeObserver 기반 고정 헤더 전체 높이 자동 동기화 (--site-header-height)
  useEffect(() => {
    const headerEl = document.getElementById("site-fixed-header");
    if (!headerEl) return;

    const applyHeight = (height: number) => {
      if (height > 0) {
        document.documentElement.style.setProperty("--site-header-height", `${Math.round(height)}px`);
      }
    };

    applyHeight(headerEl.offsetHeight);

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const newHeight = entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height;
          applyHeight(newHeight);
        }
      });
      observer.observe(headerEl);
      return () => observer.disconnect();
    } else {
      const handleResize = () => applyHeight(headerEl.offsetHeight);
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  const mobileNavRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!mobileNavRef.current) return;
    const activeEl = mobileNavRef.current.querySelector<HTMLElement>('[aria-current="page"]');
    if (activeEl && typeof activeEl.scrollIntoView === "function") {
      activeEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [pathname]);

  const isPrimaryActive = (href: string) => {
    if (href === "/") return pathname === "/" || pathname.startsWith("/briefing");
    if (href === "/explore/") return isEtfSection;
    const normalizedPath = pathname.endsWith("/") ? pathname : `${pathname}/`;
    return normalizedPath === href || normalizedPath.startsWith(href);
  };

  return (
    <header className="site-header relative border-b border-line bg-white shadow-[0_1px_0_rgba(23,32,30,0.03)] w-full max-w-full z-40">
      {/* ─────────────────────────────────────────────────────────────
          1. 데스크톱 통합 1행 (1280px 이상, xl:flex)
          높이: 64px (h-16), 본문 page-shell과 완벽 정렬 (px-5 sm:px-8 max-w-7xl)
          [로고] [주요 메뉴 7개]  ────────  [ETF 검색] [적성 리포트] [내 계정/로그인]
      ───────────────────────────────────────────────────────────── */}
      <div className="hidden xl:flex w-full max-w-7xl mx-auto px-5 sm:px-8 h-16 items-center justify-between gap-4">
        {/* Left: Brand Logo & 7 Navigation Items Naturally Grouped */}
        <div className="flex items-center gap-5 2xl:gap-7 shrink-0">
          <Link
            className="flex shrink-0 items-center gap-2 text-base 2xl:text-lg font-black tracking-tight text-brand-800 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg"
            href="/"
            aria-label="ETF 캠퍼스 홈으로 이동"
          >
            <span aria-hidden="true" className="grid size-9 shrink-0 overflow-hidden rounded-full border border-brand-200 bg-brand-50 shadow-2xs">
              <Tickery className="size-9 scale-125" pose="welcome" priority sizes="36px" />
            </span>
            <span className="shrink-0">{siteConfig.name}</span>
          </Link>

          <nav aria-label="주요 메뉴" className="flex items-center gap-0.5 rounded-xl bg-neutral-50/90 border border-neutral-200/60 p-1 font-bold shrink-0 shadow-2xs">
            {navigation.map((item) => {
              const active = isPrimaryActive(item.href);
              const className = `inline-flex min-h-9 items-center rounded-lg px-2.5 py-1.5 text-xs 2xl:text-[13px] transition-all whitespace-nowrap cursor-pointer ${
                active
                  ? "bg-white text-brand-800 shadow-xs ring-1 ring-neutral-200/80 font-black"
                  : "text-neutral-500 hover:bg-white/80 hover:text-neutral-900 font-semibold"
              }`;
              return (
                <Link aria-current={active ? "page" : undefined} className={className} href={item.href} key={item.href}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Quick Search, Compact StyleChip, & Compact AuthNav */}
        <div className="flex items-center gap-2 xl:gap-2.5 shrink-0">
          {/* ETF 빠른 검색 버튼 */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            aria-label={`ETF 종목명 또는 종목코드 빠른 검색 (${shortcutKey})`}
            className="inline-flex items-center gap-1.5 min-h-[40px] xl:min-h-[44px] h-10 xl:h-11 px-3 rounded-xl border border-neutral-200 bg-neutral-100/90 hover:bg-white hover:border-brand-400 hover:shadow-2xs active:scale-98 transition-all text-xs font-bold text-neutral-700 group cursor-pointer shrink-0"
          >
            <svg className="size-3.5 text-neutral-500 group-hover:text-brand-700 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>ETF 검색</span>
            <kbd className="hidden 2xl:inline-flex items-center rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-neutral-400 group-hover:text-brand-700 group-hover:border-brand-200 select-none shadow-2xs font-mono ml-0.5">
              {shortcutKey}
            </kbd>
          </button>

          {/* 컴팩트 적성 리포트 / 진단 알약 뱃지 */}
          <StyleChip />

          {/* 내 계정 드롭다운 또는 로그인 버튼 */}
          <AuthNav />
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. 모바일 / 태블릿 전용 상단 1행 (1280px 미만, xl:hidden)
          높이: 56px (h-14)
          [로고] ────────  [ETF 검색] [내 계정 / 로그인]
      ───────────────────────────────────────────────────────────── */}
      <div className="xl:hidden w-full max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2">
        {/* Left: Brand Logo */}
        <Link className="flex shrink-0 items-center gap-1.5 sm:gap-2 text-base sm:text-lg font-black tracking-tight text-brand-800" href="/">
          <span aria-hidden="true" className="grid size-8 sm:size-9 shrink-0 overflow-hidden rounded-full border border-brand-200 bg-brand-50 shadow-2xs">
            <Tickery className="size-8 sm:size-9 scale-125" pose="welcome" priority sizes="36px" />
          </span>
          <span className="shrink-0">{siteConfig.name}</span>
        </Link>

        {/* Right: Search & Account (진단 메뉴는 드롭다운 내부에 통합) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            aria-label="ETF 종목명 또는 코드 빠른 검색"
            className="inline-flex items-center gap-1 min-h-[44px] h-11 px-2.5 sm:px-3 rounded-xl border border-neutral-200 bg-neutral-100/90 hover:bg-white hover:border-brand-400 text-xs font-bold text-neutral-700 transition-all active:scale-98 cursor-pointer shrink-0"
          >
            <svg className="size-3.5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>ETF 검색</span>
          </button>

          <AuthNav />
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. 모바일 / 태블릿 전용 주요 메뉴 스크롤 행 (1280px 미만, xl:hidden)
          가로 스크롤 네비게이션 + 우측 페이드 힌트 + 최소 44px 터치 영역 확보
      ───────────────────────────────────────────────────────────── */}
      <div className="xl:hidden relative w-full border-t border-line bg-neutral-50/95">
        {/* 우측 페이드 힌트 (옆으로 더 스크롤할 메뉴가 있음을 시각적으로 안내) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-neutral-50/95 via-neutral-50/60 to-transparent z-10 flex items-center justify-end pr-1 text-neutral-400"
        >
          <svg className="size-3.5 opacity-60 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>

        <nav
          ref={mobileNavRef}
          aria-label="모바일 주요 메뉴"
          className="w-full max-w-full overflow-x-auto whitespace-nowrap scrollbar-hide scrollbar-none flex gap-1 px-3 sm:px-6 py-1.5 text-xs sm:text-sm font-bold overscroll-x-contain touch-pan-x"
        >
          {navigation.map((item) => {
            const active = isPrimaryActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-[44px] shrink-0 items-center rounded-lg px-3 py-2 text-xs sm:text-sm transition-all ${
                  active
                    ? "bg-white text-brand-800 font-black shadow-xs ring-1 ring-brand-300"
                    : "text-neutral-500 font-medium hover:bg-white/60 hover:text-neutral-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. ETF 탐색 전용 하위 서브메뉴 (계좌별 4종 + 전략별 5종)
      ───────────────────────────────────────────────────────────── */}
      {showFinderNav ? (
        <div className="relative w-full border-t border-line bg-brand-50/55 z-20">
          {/* 모바일 가로 스크롤 페이드 힌트 */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-brand-50/95 via-brand-50/60 to-transparent sm:hidden z-10 flex items-center justify-end pr-1 text-neutral-400"
          >
            <svg className="size-3.5 opacity-60 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <div className="w-full overflow-x-auto whitespace-nowrap scrollbar-hide overscroll-x-contain touch-pan-x">
            <nav aria-label="ETF 탐색 메뉴" className="page-shell flex items-center gap-1.5 sm:gap-2 py-2 text-xs sm:text-sm">
              <div role="group" aria-label="계좌별 ETF 탐색" className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-extrabold tracking-tight bg-neutral-200/80 text-neutral-600 shrink-0 select-none">
                  계좌별
                </span>
                {accountNavigation.map((item) => {
                  const active = item.href === activeFinderHref;
                  const className = `inline-flex min-h-[44px] shrink-0 items-center rounded-full border px-3.5 py-2 font-bold transition-all ${
                    active
                      ? "border-brand-700 bg-brand-700 text-white shadow-2xs"
                      : "border-neutral-200 bg-white text-neutral-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-900"
                  }`;
                  return (
                    <Link
                      aria-current={active ? "page" : undefined}
                      className={className}
                      href={item.href}
                      key={item.href}
                      onClick={() => {
                        setActiveFinderHref(item.href);
                        if (typeof window !== "undefined") {
                          window.scrollTo({ top: 0, behavior: "instant" });
                          if (window.location.pathname === "/explore" || window.location.pathname === "/explore/") {
                            window.history.pushState(null, "", item.href);
                            window.dispatchEvent(new Event("popstate"));
                          }
                        }
                      }}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>

              <span aria-hidden="true" className="h-5 w-px bg-neutral-300 mx-1.5 sm:mx-2.5 shrink-0" />

              <div role="group" aria-label="전략별 ETF 탐색" className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-extrabold tracking-tight bg-neutral-200/80 text-neutral-600 shrink-0 select-none">
                  전략별
                </span>
                {strategyNavigation.map((item) => {
                  const active = item.href === activeFinderHref;
                  const className = `inline-flex min-h-[44px] shrink-0 items-center rounded-full border px-3.5 py-2 font-bold transition-all ${
                    active
                      ? "border-brand-700 bg-brand-700 text-white shadow-2xs"
                      : "border-neutral-200 bg-white text-neutral-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-900"
                  }`;
                  return (
                    <Link
                      aria-current={active ? "page" : undefined}
                      className={className}
                      href={item.href}
                      key={item.href}
                      onClick={() => {
                        setActiveFinderHref(item.href);
                        if (typeof window !== "undefined") {
                          window.scrollTo({ top: 0, behavior: "instant" });
                        }
                      }}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </nav>
          </div>
        </div>
      ) : null}

      {/* 글로벌 퀵 검색 모달 */}
      <GlobalQuickSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </header>
  );
}

