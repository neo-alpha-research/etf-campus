"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: { render: (element: HTMLElement, options: Record<string, unknown>) => string; remove: (widgetId: string) => void; reset: (widgetId: string) => void };
  }
}

type Props = { action: "community_otp_request" | "community_otp_verify" | "community_password_login" | "community_password_set"; onToken: (token: string | null) => void };

type AuthConfig = { required: boolean; siteKey: string | null };

let cachedConfigPromise: Promise<AuthConfig> | null = null;

function getAuthConfig(): Promise<AuthConfig> {
  if (!cachedConfigPromise) {
    cachedConfigPromise = fetch("/api/community/auth/config", { credentials: "same-origin" })
      .then(async (response) => {
        const config = await response.json();
        if (!response.ok) throw new Error(config?.error?.message ?? "CAPTCHA 설정을 확인할 수 없습니다.");
        return config as AuthConfig;
      })
      .catch((err) => {
        cachedConfigPromise = null;
        throw err;
      });
  }
  return cachedConfigPromise;
}

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();

  const existing = document.querySelector<HTMLScriptElement>('script[src*="challenges.cloudflare.com/turnstile"]');
  if (existing) {
    return new Promise((resolve, reject) => {
      if (window.turnstile) { resolve(); return; }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("보안 확인 도구를 불러오지 못했습니다.")), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("보안 확인 도구를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
}

export function TurnstileCaptcha({ action, onToken }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let disposed = false;

    async function mount() {
      try {
        const [config] = await Promise.all([
          getAuthConfig(),
          loadTurnstileScript(),
        ]);

        if (disposed) return;
        if (!config.required) {
          onToken("local-operator-bypass");
          return;
        }
        if (!container.current || !window.turnstile) return;

        widgetId.current = window.turnstile.render(container.current, {
          sitekey: config.siteKey,
          action,
          callback: (token: string) => {
            if (!disposed) {
              onToken(token);
              setMessage("");
            }
          },
          "expired-callback": () => {
            if (!disposed) {
              onToken(null);
              setMessage("보안 확인이 만료되었습니다. 다시 확인해 주세요.");
            }
          },
          "error-callback": () => {
            if (!disposed) {
              onToken(null);
              setMessage("보안 확인을 완료하지 못했습니다. 다시 시도해 주세요.");
            }
          },
        });
      } catch (error) {
        if (!disposed) {
          setMessage(error instanceof Error ? error.message : "보안 확인을 준비하지 못했습니다.");
        }
      }
    }

    mount();

    return () => {
      disposed = true;
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
      }
    };
  }, [action, onToken]);

  return (
    <div className="space-y-2">
      <div ref={container} />
      {message ? <p aria-live="polite" className="text-xs text-rose-700">{message}</p> : null}
    </div>
  );
}
