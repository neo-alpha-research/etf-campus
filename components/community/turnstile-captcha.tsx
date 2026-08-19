"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: { render: (element: HTMLElement, options: Record<string, unknown>) => string; remove: (widgetId: string) => void; reset: (widgetId: string) => void };
  }
}

type Props = { action: "community_otp_request" | "community_otp_verify" | "community_password_login"; onToken: (token: string | null) => void };

export function TurnstileCaptcha({ action, onToken }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let disposed = false;
    let script: HTMLScriptElement | null = null;
    async function mount() {
      try {
        const response = await fetch("/api/community/auth/config", { credentials: "same-origin" });
        const config = await response.json();
        if (!response.ok) throw new Error(config?.error?.message ?? "CAPTCHA 설정을 확인할 수 없습니다.");
        if (!config.required) { onToken("local-operator-bypass"); return; }
        if (!container.current) return;
        const render = () => {
          if (disposed || !container.current || !window.turnstile) return;
          widgetId.current = window.turnstile.render(container.current, {
            sitekey: config.siteKey,
            action,
            callback: (token: string) => { onToken(token); setMessage(""); },
            "expired-callback": () => { onToken(null); setMessage("보안 확인이 만료되었습니다. 다시 확인해 주세요."); },
            "error-callback": () => { onToken(null); setMessage("보안 확인을 완료하지 못했습니다. 다시 시도해 주세요."); },
          });
        };
        if (window.turnstile) { render(); return; }
        script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.onload = render;
        script.onerror = () => setMessage("보안 확인 도구를 불러오지 못했습니다.");
        document.head.appendChild(script);
      } catch (error) { setMessage(error instanceof Error ? error.message : "보안 확인을 준비하지 못했습니다."); }
    }
    mount();
    return () => {
      disposed = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      script?.remove();
    };
  }, [action, onToken]);

  return <div className="space-y-2"><div ref={container} /><p aria-live="polite" className="text-xs text-rose-700">{message}</p></div>;
}
