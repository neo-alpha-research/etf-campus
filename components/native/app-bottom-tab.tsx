"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, BookOpen, Users } from "lucide-react";

export function AppBottomTab() {
  const pathname = usePathname();

  const tabs = [
    { label: "홈", href: "/", icon: Home },
    { label: "스크리너", href: "/explore", icon: Search },
    { label: "마켓브리핑", href: "/briefing", icon: BookOpen },
    { label: "커뮤니티", href: "/community", icon: Users },
  ];

  return (
    <nav className="app-bottom-tab fixed bottom-0 left-0 right-0 z-50 flex h-[64px] border-t border-neutral-200 bg-white/95 backdrop-blur shadow-[0_-2px_10px_rgba(0,0,0,0.05)] pb-[env(safe-area-inset-bottom)]">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || (tab.href !== "/" && pathname?.startsWith(tab.href));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-1 flex-col items-center justify-center gap-1 transition-colors ${
              isActive ? "text-brand-700" : "text-neutral-400 hover:text-neutral-600"
            }`}
          >
            <tab.icon className="size-6" strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[10px] font-bold tracking-tight">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
