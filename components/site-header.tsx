import Link from "next/link";

import { siteConfig } from "@/config/site";
import { StyleChip } from "@/components/onboarding/style-chip";

const navigation = [
  { href: "/", label: "대시보드" },
  { href: "/screener", label: "스크리너" },
  { href: "/briefing", label: "브리핑" },
  { href: "/guides", label: "가이드" },
  { href: "/books", label: "북 큐레이션" },
] as const;

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface/95">
      <div className="page-shell flex min-h-16 items-center justify-between gap-6">
        <Link className="text-lg font-extrabold tracking-[-0.03em] text-brand-800" href="/">
          {siteConfig.name}
        </Link>
        <nav aria-label="주요 메뉴" className="hidden items-center gap-5 text-sm font-semibold text-muted md:flex">
          {navigation.map((item) => (
            <Link className="transition-colors hover:text-brand-700" href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <StyleChip />
      </div>
      <nav aria-label="모바일 주요 메뉴" className="scrollbar-none flex gap-5 overflow-x-auto border-t border-line px-5 py-3 text-sm font-semibold text-muted md:hidden">
        {navigation.map((item) => (
          <Link className="shrink-0" href={item.href} key={item.href}>{item.label}</Link>
        ))}
      </nav>
    </header>
  );
}
