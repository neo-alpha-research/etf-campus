import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { publicSupabase } from "./supabase.js";

describe("Supabase Client", () => {
  let globalFetch;

  beforeEach(() => {
    globalFetch = vi.fn();
    vi.stubGlobal("fetch", globalFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("T-5: signOut({ scope: 'global' }) 호출 시 /auth/v1/logout?scope=global로 요청한다", async () => {
    globalFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

    const client = publicSupabase({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "anon-key"
    }, "access-token");

    await client.auth.signOut({ scope: "global" });

    expect(globalFetch).toHaveBeenCalledTimes(1);
    const requestUrl = globalFetch.mock.calls[0][0].toString();
    expect(requestUrl).toBe("https://example.supabase.co/auth/v1/logout?scope=global");
    
    const requestOptions = globalFetch.mock.calls[0][1];
    expect(requestOptions.method).toBe("POST");
    expect(requestOptions.headers.Authorization).toBe("Bearer access-token");
  });

  it("verifyOtp with token_hash sends { token_hash, type } payload", async () => {
    globalFetch.mockResolvedValue({ ok: true, json: async () => ({ session: { access_token: "mock-token" }, user: { id: "user-123" } }) });

    const client = publicSupabase({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "anon-key"
    });

    const result = await client.auth.verifyOtp({
      token_hash: "hashed_magiclink_token",
      type: "magiclink",
    });

    expect(result.error).toBeNull();
    expect(globalFetch).toHaveBeenCalledTimes(1);
    const requestOptions = globalFetch.mock.calls[0][1];
    expect(requestOptions.method).toBe("POST");
    expect(JSON.parse(requestOptions.body)).toEqual({
      token_hash: "hashed_magiclink_token",
      type: "magiclink",
    });
  });

  it("verifyOtp with email and token sends { email, token, type } payload", async () => {
    globalFetch.mockResolvedValue({ ok: true, json: async () => ({ session: { access_token: "mock-token" }, user: { id: "user-123" } }) });

    const client = publicSupabase({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "anon-key"
    });

    const result = await client.auth.verifyOtp({
      email: "test@example.com",
      token: "123456",
      type: "email",
    });

    expect(result.error).toBeNull();
    expect(globalFetch).toHaveBeenCalledTimes(1);
    const requestOptions = globalFetch.mock.calls[0][1];
    expect(requestOptions.method).toBe("POST");
    expect(JSON.parse(requestOptions.body)).toEqual({
      email: "test@example.com",
      token: "123456",
      type: "email",
    });
  });
});
