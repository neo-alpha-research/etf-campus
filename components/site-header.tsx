"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, Fragment } from "react";

import { siteConfig } from "@/config/site";
import { Tickery } from "@/components/brand/tickery";
import { StyleChip } from "@/components/onboarding/style-chip";
import { AuthNav } from "@/components/auth/auth-nav";

const navigation = [
  { href: "/", label: "마켓 브리핑" },
  { href: "/tutorial/", label: "캠퍼스 투어" },
  { href: "/explore/", label: "ETF 탐색" },
  { href: "/compare", label: "ETF 비교" },
  { href: "/community/", label: "ETF 이야기" },
  { href: "/books/", label: "도서·리뷰" },
  { href: "/notice/", label: "알림·참여" },
] as const;

const finderNavigation = [
  { href: "/explore/", label: "조건으로 찾기" },
  { href: "/quick/?mode=general", label: "일반 계좌" },
  { href: "/quick/?mode=pension", label: "연금 계좌" },
  { href: "/quick/?mode=mixed_bonds", label: "혼합 채권" },
  { href: "/quick/?mode=tdf", label: "TDF" },
  { href: "/quick/?mode=derivatives", label: "레버리지·인버스" },
  { href: "/quick/?mode=new", label: "신규 상장" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Explicitly track active sub-tab href so highlighting updates
  // immediately on both pathname and searchParam changes.
  const [activeFinderHref, setActiveFinderHref] = useState(() => {
    if (pathname === "/quick" || pathname === "/quick/") {
      const m = searchParams.get("mode") ?? "general";
      return `/quick/?mode=${m}`;
    }
    return (pathname.startsWith("/explore") || pathname.startsWith("/screener")) ? "/explore/" : undefined;
  });

  useEffect(() => {
    if (pathname === "/quick" || pathname === "/quick/") {
      const m = searchParams.get("mode") ?? "general";
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveFinderHref(`/quick/?mode=${m}`);
    } else if (pathname.startsWith("/explore") || pathname.startsWith("/screener")) {
      setActiveFinderHref("/explore/");
    }
  }, [pathname, searchParams]);

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

  const isPrimaryActive = (href: string) => {
    if (href === "/") return pathname === "/" || pathname.startsWith("/briefing");
    if (href === "/explore/") return isEtfSection;
    // Strip trailing slash for comparison if necessary, but hrefs now have it
    const normalizedPath = pathname.endsWith("/") ? pathname : `${pathname}/`;
    return normalizedPath === href || normalizedPath.startsWith(href);
  };

  return (
    <header className="site-header relative border-b border-line bg-white shadow-[0_1px_0_rgba(23,32,30,0.03)] w-full max-w-full overflow-x-hidden">
      <div className="page-shell flex min-h-14 sm:min-h-16 items-center justify-between gap-2 sm:gap-4 w-full max-w-full">
        {/* Left: Logo & Menus */}
        <div className="flex items-center gap-2 sm:gap-4 lg:gap-8 min-w-0 shrink">
          <Link className="flex shrink-0 items-center gap-1.5 sm:gap-2 text-base sm:text-lg font-extrabold tracking-[-0.03em] text-brand-800" href="/">
            <span aria-hidden="true" className="grid size-8 sm:size-10 shrink-0 overflow-hidden rounded-full border border-brand-200 bg-brand-50">
              <Tickery className="size-8 sm:size-10 scale-125" pose="welcome" priority sizes="40px" />
            </span>
            <span className="shrink-0">{siteConfig.name}</span>
          </Link>

          <nav aria-label="주요 메뉴" className="hidden items-center gap-1 rounded-xl bg-neutral-50 p-1 text-sm font-bold lg:flex shrink-0">
            {navigation.map((item) => {
              const className = `inline-flex min-h-11 items-center rounded-lg px-3 py-2.5 transition-all whitespace-nowrap ${
                isPrimaryActive(item.href) ? "bg-surface text-brand-800 shadow-sm ring-1 ring-line" : "text-muted hover:bg-surface hover:text-strong"
              }`;
              return (
                <Link aria-current={isPrimaryActive(item.href) ? "page" : undefined} className={className} href={item.href} key={item.href}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: StyleChip & AuthNav */}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2.5 shrink-0 min-w-0">
          <StyleChip />
          <AuthNav />
        </div>
      </div>
      <nav aria-label="모바일 주요 메뉴" className="w-full max-w-full overflow-x-auto whitespace-nowrap scrollbar-hide scrollbar-none flex gap-2 border-t border-line bg-neutral-50 px-4 sm:px-5 py-2.5 text-sm font-bold lg:hidden">
        {navigation.map((item) => (
          <Link aria-current={isPrimaryActive(item.href) ? "page" : undefined} className={`inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 py-2 ${isPrimaryActive(item.href) ? "bg-surface text-brand-800 shadow-sm ring-1 ring-line" : "text-muted"}`} href={item.href} key={item.href}>{item.label}</Link>
        ))}
      </nav>
      {showFinderNav ? (
        <div className="w-full max-w-full border-t border-line bg-brand-50/55">
          <nav aria-label="ETF 탐색 메뉴" className="page-shell w-full max-w-full overflow-x-auto whitespace-nowrap scrollbar-hide scrollbar-none flex items-center gap-2 py-2.5 text-sm">
            {finderNavigation.map((item, index) => {
              const active = item.href === activeFinderHref;
              const className = `inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 py-2.5 font-bold transition-all ${active ? "border-brand-700 bg-brand-700 text-white shadow-sm" : "border-brand-200 bg-surface text-brand-800 hover:border-brand-400 hover:bg-brand-50"}`;
              return (
                <Fragment key={item.href}>
                  <Link aria-current={active ? "page" : undefined} className={className} href={item.href} onClick={() => setActiveFinderHref(item.href)}>{item.label}</Link>
                  {index === 0 && <span aria-hidden="true" className="hidden h-5 w-px bg-brand-300 md:block ml-1 shrink-0" />}
                </Fragment>
              );
            })}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
