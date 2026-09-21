import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticatedSupabase: vi.fn(),
  rpc: vi.fn(),
  parseJsonBody: vi.fn(),
}));

vi.mock("../_lib/supabase", () => ({
  authenticatedSupabase: mocks.authenticatedSupabase,
}));

vi.mock("../_lib/request-security", () => ({
  parseJsonBody: mocks.parseJsonBody,
}));

import { onRequestGet, onRequestPost } from "./profile.js";

describe("GET & POST /api/community/auth/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockReset();
    mocks.authenticatedSupabase.mockResolvedValue({
      client: { rpc: mocks.rpc },
      user: { id: "user-123", email: "neo.alpharesearch@gmail.com" },
    });
  });

  describe("onRequestGet", () => {
    it("미인증 상태이면 401 에러를 반환한다", async () => {
      const errorResp = Response.json({ error: { code: "AUTH_REQUIRED" } }, { status: 401 });
      mocks.authenticatedSupabase.mockResolvedValueOnce({ error: errorResp });

      const res = await onRequestGet({} as any);
      expect(res.status).toBe(401);
    });

    it("RPC 오류 발생 시 503 UNAVAILABLE을 반환한다", async () => {
      mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "RPC error" } });

      const res = await onRequestGet({} as any);
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error?.code).toBe("UNAVAILABLE");
    });

    it("닉네임과 필수 약관 동의가 모두 완료된 회원은 profileConfigured: true와 프로필을 정상 반환한다 (ReferenceError 회귀 검증)", async () => {
      mocks.rpc.mockResolvedValueOnce({
        data: {
          public_nickname: "Neo",
          terms_version: "v2026-08-24",
          interest_account_type: "dc",
          investment_experience: "experienced",
          age_band: "40s",
          marketing_consent: true,
        },
        error: null,
      });

      const res = await onRequestGet({} as any);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        profileConfigured: true,
        hasNickname: true,
        hasTermsConsent: true,
        profile: {
          nickname: "Neo",
          interestAccountType: "dc",
          investmentExperience: "experienced",
          ageBand: "40s",
          marketingConsent: true,
          termsVersion: "v2026-08-24",
        },
      });
    });

    it("닉네임은 있지만 필수 약관 동의가 누락된 경우 hasNickname: true, hasTermsConsent: false, profileConfigured: false를 분리 반환한다", async () => {
      mocks.rpc.mockResolvedValueOnce({
        data: [{
          public_nickname: "기존연구원",
          terms_version: null,
          interest_account_type: "none",
          investment_experience: "beginner",
          age_band: null,
          marketing_consent: false,
        }],
        error: null,
      });

      const res = await onRequestGet({} as any);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.profileConfigured).toBe(false);
      expect(body.hasNickname).toBe(true);
      expect(body.hasTermsConsent).toBe(false);
      expect(body.profile?.nickname).toBe("기존연구원");
    });

    it("프로필이 존재하지 않는 신규 사용자는 profileConfigured: false 및 profile: null을 반환한다", async () => {
      mocks.rpc.mockResolvedValueOnce({ data: null, error: null });

      const res = await onRequestGet({} as any);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        profileConfigured: false,
        hasNickname: false,
        hasTermsConsent: false,
        profile: null,
      });
    });
  });

  describe("onRequestPost", () => {
    it("유효한 회원가입 정보를 받아 bootstrap_community_profile RPC를 호출하고 201을 반환한다", async () => {
      mocks.parseJsonBody.mockResolvedValueOnce({
        nickname: "새로운투자자",
        termsVersion: "v2026-08-24",
        agreedToTerms: true,
        agreedToPrivacy: true,
        agreedToAge: true,
        agreedToMarketing: false,
      });

      mocks.rpc.mockResolvedValueOnce({
        data: { public_nickname: "새로운투자자", role: "member" },
        error: null,
      });

      const res = await onRequestPost({ request: new Request("https://example.com/api/community/auth/profile", { method: "POST" }) } as any);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.profileConfigured).toBe(true);
      expect(body.profile.nickname).toBe("새로운투자자");
      expect(mocks.rpc).toHaveBeenCalledWith("bootstrap_community_profile", expect.objectContaining({
        p_public_nickname: "새로운투자자",
        p_terms_version: "v2026-08-24",
        p_marketing_consent: false,
      }));
    });
  });
});
