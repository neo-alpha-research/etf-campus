import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticatedSupabase: vi.fn(),
  adminSupabase: vi.fn(),
  parseJsonBody: vi.fn(),
}));

vi.mock("../_lib/supabase", () => ({
  authenticatedSupabase: mocks.authenticatedSupabase,
  adminSupabase: mocks.adminSupabase,
}));

vi.mock("../_lib/request-security", () => ({
  parseJsonBody: mocks.parseJsonBody,
}));

import { onRequestPost } from "./terms.js";

describe("POST /api/community/auth/terms (기존 회원 필수 약관 보완)", () => {
  let mockUpdate: ReturnType<typeof vi.fn>;
  let mockEqUpdate: ReturnType<typeof vi.fn>;
  let mockSelectUpdate: ReturnType<typeof vi.fn>;
  let mockSingleUpdate: ReturnType<typeof vi.fn>;

  let mockSelectQuery: ReturnType<typeof vi.fn>;
  let mockEqQuery: ReturnType<typeof vi.fn>;
  let mockMaybeSingleQuery: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSingleUpdate = vi.fn().mockResolvedValue({
      data: { public_nickname: "Neo", terms_version: "v2026-08-24", marketing_consent: true },
      error: null,
    });
    mockSelectUpdate = vi.fn().mockReturnValue({ single: mockSingleUpdate });
    mockEqUpdate = vi.fn().mockReturnValue({ select: mockSelectUpdate });
    mockUpdate = vi.fn().mockReturnValue({ eq: mockEqUpdate });

    mockMaybeSingleQuery = vi.fn().mockResolvedValue({
      data: {
        id: "user-123",
        public_nickname: "Neo",
        marketing_consent: true,
        signup_utm_source: "newsletter",
        signup_utm_medium: "email",
        signup_utm_campaign: "launch",
      },
      error: null,
    });
    mockEqQuery = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingleQuery });
    mockSelectQuery = vi.fn().mockReturnValue({ eq: mockEqQuery });

    mocks.authenticatedSupabase.mockResolvedValue({
      user: { id: "user-123", email: "neo.alpharesearch@gmail.com" },
    });

    mocks.adminSupabase.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "user_profiles") {
          return {
            select: mockSelectQuery,
            update: mockUpdate,
          };
        }
        return {};
      }),
    });
  });

  it("미인증 상태이면 401 에러를 반환한다", async () => {
    mocks.authenticatedSupabase.mockResolvedValueOnce({
      error: Response.json({ error: { code: "AUTH_REQUIRED" } }, { status: 401 }),
    });

    const res = await onRequestPost({ request: new Request("https://example.com/api/community/auth/terms", { method: "POST" }) } as any);
    expect(res.status).toBe(401);
  });

  it("필수 약관 동의(연령, 약관, 개인정보)가 누락되면 400 VALIDATION_ERROR를 반환한다", async () => {
    mocks.parseJsonBody.mockResolvedValueOnce({
      agreedToAge: true,
      agreedToTerms: false, // 누락
      agreedToPrivacy: true,
      termsVersion: "v2026-08-24",
    });

    const res = await onRequestPost({ request: new Request("https://example.com/api/community/auth/terms", { method: "POST" }) } as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error?.code).toBe("VALIDATION_ERROR");
  });

  it("약관 버전이 비어 있거나 올바르지 않으면 400 VALIDATION_ERROR를 반환한다", async () => {
    mocks.parseJsonBody.mockResolvedValueOnce({
      agreedToAge: true,
      agreedToTerms: true,
      agreedToPrivacy: true,
      termsVersion: "",
    });

    const res = await onRequestPost({ request: new Request("https://example.com/api/community/auth/terms", { method: "POST" }) } as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error?.message).toContain("약관 버전");
  });

  it("기존 닉네임이 없는 신규 유저가 접근하면 400 에러를 반환한다", async () => {
    mocks.parseJsonBody.mockResolvedValueOnce({
      agreedToAge: true,
      agreedToTerms: true,
      agreedToPrivacy: true,
      termsVersion: "v2026-08-24",
    });

    mockMaybeSingleQuery.mockResolvedValueOnce({
      data: null, // 기존 프로필 없음
      error: null,
    });

    const res = await onRequestPost({ request: new Request("https://example.com/api/community/auth/terms", { method: "POST" }) } as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error?.message).toContain("프로필 설정이 선행");
  });

  it("기존 회원의 약관 보완 시 기존 UTM/프로필을 보존하고 terms_version만 갱신한다", async () => {
    mocks.parseJsonBody.mockResolvedValueOnce({
      agreedToAge: true,
      agreedToTerms: true,
      agreedToPrivacy: true,
      agreedToMarketing: true,
      termsVersion: "v2026-08-24",
    });

    const res = await onRequestPost({ request: new Request("https://example.com/api/community/auth/terms", { method: "POST" }) } as any);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toEqual({
      success: true,
      profileConfigured: true,
      hasNickname: true,
      hasTermsConsent: true,
      user: {
        id: "user-123",
        email: "neo.alpharesearch@gmail.com",
        nickname: "Neo",
      },
    });

    // update 호출 인자 검증: signup_utm_* 및 nickname은 업데이트 대상에 일체 포함되지 않음
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      terms_version: "v2026-08-24",
      marketing_consent: true,
    }));
    const updateArg = mockUpdate.mock.calls[0][0];
    expect(updateArg).not.toHaveProperty("signup_utm_source");
    expect(updateArg).not.toHaveProperty("signup_utm_medium");
    expect(updateArg).not.toHaveProperty("signup_utm_campaign");
    expect(updateArg).not.toHaveProperty("public_nickname");
  });

  it("DB 갱신 오류 발생 시 503 UNAVAILABLE을 반환한다", async () => {
    mocks.parseJsonBody.mockResolvedValueOnce({
      agreedToAge: true,
      agreedToTerms: true,
      agreedToPrivacy: true,
      termsVersion: "v2026-08-24",
    });

    mockSingleUpdate.mockResolvedValueOnce({
      data: null,
      error: { message: "Database update error" },
    });

    const res = await onRequestPost({ request: new Request("https://example.com/api/community/auth/terms", { method: "POST" }) } as any);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error?.code).toBe("UNAVAILABLE");
  });
});
