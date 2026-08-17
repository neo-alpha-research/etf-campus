import { describe, expect, it, vi } from "vitest";
import { onRequest } from "../_middleware.js";
import { onRequestGet } from "../auth/config.js";

describe("Community Auth Config Endpoint Security", () => {
  it("GET /api/community/auth/config is not blocked by middleware", async () => {
    const next = vi.fn().mockResolvedValue(new Response("OK"));
    const context = {
      request: new Request("https://example.com/api/community/auth/config", { method: "GET" }),
      next,
      env: {}
    };
    await onRequest(context);
    expect(next).toHaveBeenCalled();
  });

  it("POST /api/community/auth/config is blocked by middleware", async () => {
    const next = vi.fn();
    const context = {
      request: new Request("https://example.com/api/community/auth/config", { 
        method: "POST",
        headers: new Headers({ "Content-Type": "application/json", "Origin": "https://example.com" })
      }),
      next,
      env: {}
    };
    const response = await onRequest(context);
    expect([401, 403]).toContain(response.status);
  });

  it("GET /api/community/auth/config handler returns only public data", async () => {
    const context = {
      env: {
        COMMUNITY_ENVIRONMENT: "preview",
        TURNSTILE_REQUIRED: "true",
        TURNSTILE_SITE_KEY: "PUBLIC_SITE_KEY_123",
        TURNSTILE_SECRET_KEY: "SECRET_KEY_DO_NOT_EXPOSE",
        TURNSTILE_EXPECTED_HOSTNAME: "example.com"
      }
    };
    const response = await onRequestGet(context);
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.required).toBe(true);
    expect(data.siteKey).toBe("PUBLIC_SITE_KEY_123");
    
    const responseText = JSON.stringify(data);
    expect(responseText).not.toContain("SECRET_KEY_DO_NOT_EXPOSE");
    expect(responseText).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(responseText).not.toContain("SMTP");
    expect(responseText).not.toContain("@"); // Email
  });
});