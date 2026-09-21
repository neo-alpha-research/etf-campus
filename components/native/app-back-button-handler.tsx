"use client";

import { useEffect, useRef } from "react";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { usePathname, useRouter } from "next/navigation";

export function AppBackButtonHandler() {
  const pathname = usePathname();
  const router = useRouter();
  const lastBackPressRef = useRef<number>(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const setupBackButton = async () => {
      listenerHandle = await CapApp.addListener("backButton", () => {
        const isRootPath = pathname === "/" || pathname === "/screener" || pathname === "/briefing" || pathname === "/community";

        if (!isRootPath && typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          const now = Date.now();
          if (now - lastBackPressRef.current < 2000) {
            CapApp.exitApp();
          } else {
            lastBackPressRef.current = now;
            const toast = document.createElement("div");
            toast.innerText = "뒤로가기 버튼을 한 번 더 누르면 종료됩니다.";
            toast.className =
              "fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] bg-neutral-900/90 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg pointer-events-none transition-opacity duration-300";
            document.body.appendChild(toast);
            setTimeout(() => {
              toast.style.opacity = "0";
              setTimeout(() => toast.remove(), 300);
            }, 1800);
          }
        }
      });
    };

    setupBackButton();

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, [pathname, router]);

  return null;
}
