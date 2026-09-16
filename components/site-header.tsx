"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useRef } from "react";

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

  useEffect(() => {
    const updateHeaderHeight = () => {
      const headerEl = document.getElementById("site-fixed-header");
      if (headerEl) {
        document.documentElement.style.setProperty("--site-header-height", `${headerEl.offsetHeight}px`);
      }
    };
    updateHeaderHeight();
    window.addEventListener("resize", updateHeaderHeight);
    return () => window.removeEventListener("resize", updateHeaderHeight);
  }, [showFinderNav, pathname]);

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
    // Strip trailing slash for comparison if necessary, but hrefs now have it
    const normalizedPath = pathname.endsWith("/") ? pathname : `${pathname}/`;
    return normalizedPath === href || normalizedPath.startsWith(href);
  };

  return (
    <header className="site-header relative border-b border-line bg-white shadow-[0_1px_0_rgba(23,32,30,0.03)] w-full max-w-full overflow-x-hidden">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 flex min-h-14 sm:min-h-16 items-center justify-between gap-2 lg:gap-3 xl:gap-4">
        {/* Left: Logo & Menus */}
        <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 xl:gap-6 shrink-0">
          <Link className="flex shrink-0 items-center gap-1.5 sm:gap-2 text-base sm:text-lg font-extrabold tracking-[-0.03em] text-brand-800" href="/">
            <span aria-hidden="true" className="grid size-8 sm:size-10 shrink-0 overflow-hidden rounded-full border border-brand-200 bg-brand-50">
              <Tickery className="size-8 sm:size-10 scale-125" pose="welcome" priority sizes="40px" />
            </span>
            <span className="shrink-0">{siteConfig.name}</span>
          </Link>

          <nav aria-label="주요 메뉴" className="hidden items-center gap-0.5 rounded-xl bg-neutral-50 p-1 font-bold lg:flex shrink-0">
            {navigation.map((item) => {
              const className = `inline-flex min-h-9 xl:min-h-10 items-center rounded-lg px-2 xl:px-2.5 py-1.5 text-xs xl:text-[13px] transition-all whitespace-nowrap ${
                isPrimaryActive(item.href) ? "bg-surface text-brand-800 shadow-sm ring-1 ring-line font-black" : "text-muted hover:bg-surface hover:text-strong"
              }`;
              return (
                <Link aria-current={isPrimaryActive(item.href) ? "page" : undefined} className={className} href={item.href} key={item.href}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Quick Search, StyleChip & AuthNav */}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2.5 shrink-0 min-w-0">
          {/* Desktop Quick Search Input Bar (실제 검색창 디자인으로 시인성 극대화) */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            aria-label="ETF 종목명 또는 종목코드 빠른 검색 (Ctrl+K)"
            className="hidden md:inline-flex items-center justify-between w-36 lg:w-40 xl:w-52 2xl:w-60 h-9 px-2.5 xl:px-3 rounded-xl border border-neutral-200 bg-neutral-100/80 hover:bg-white hover:border-emerald-500 hover:shadow-xs transition-all text-xs text-neutral-400 group cursor-pointer shrink-0"
          >
            <div className="flex items-center gap-1.5 xl:gap-2 min-w-0">
              <svg className="size-3.5 xl:size-4 text-neutral-400 group-hover:text-emerald-600 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="truncate text-neutral-500 group-hover:text-neutral-800 font-medium text-[11px] xl:text-xs">
                종목명 또는 코드 검색...
              </span>
            </div>
            <kbd className="inline-flex items-center gap-0.5 rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-[9px] xl:text-[10px] font-bold text-neutral-400 group-hover:text-emerald-700 group-hover:border-emerald-300 select-none shrink-0 shadow-2xs font-mono">
              Ctrl K
            </kbd>
          </button>

          {/* Mobile/Tablet Quick Search Button (검색 라벨 포함 뚜렷한 버튼) */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            aria-label="ETF 빠른 검색 열기"
            className="md:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-neutral-200 bg-neutral-100 text-neutral-700 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 transition-colors cursor-pointer text-xs font-bold shrink-0"
          >
            <svg className="size-3.5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>검색</span>
          </button>

          <StyleChip />
          <AuthNav />
        </div>
      </div>
      <nav
        ref={mobileNavRef}
        aria-label="모바일 주요 메뉴"
        className="w-full max-w-full overflow-x-auto whitespace-nowrap scrollbar-hide scrollbar-none flex gap-1.5 border-t border-line bg-neutral-50/90 px-3 py-2 text-sm font-bold lg:hidden overscroll-x-contain touch-pan-x"
      >
        {navigation.map((item) => {
          const active = isPrimaryActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-10 shrink-0 items-center rounded-lg px-3 py-1.5 text-xs sm:text-sm transition-all ${
                active
                  ? "bg-white text-brand-800 font-extrabold shadow-xs ring-1 ring-brand-300"
                  : "text-neutral-500 font-medium hover:bg-white/60 hover:text-neutral-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      {showFinderNav ? (
        <div className="relative w-full border-t border-line bg-brand-50/55 z-20">
          {/* 모바일 가로 스크롤 페이드 힌트 (Fade Edge & Arrow) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-brand-50/95 via-brand-50/60 to-transparent sm:hidden z-10 flex items-center justify-end pr-1 text-neutral-400"
          >
            <svg className="w-3.5 h-3.5 opacity-60 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
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
                const className = `inline-flex min-h-9 sm:min-h-9.5 shrink-0 items-center rounded-full border px-3 sm:px-3.5 py-1.5 font-bold transition-all ${
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
                const className = `inline-flex min-h-9 sm:min-h-9.5 shrink-0 items-center rounded-full border px-3 sm:px-3.5 py-1.5 font-bold transition-all ${
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
      <GlobalQuickSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </header>
  );
}

