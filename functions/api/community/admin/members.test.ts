import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("../_lib/supabase", () => ({
  adminSupabase: () => ({ rpc: mocks.rpc }),
}));

import { onRequestGet } from "./members.js";

const VALID_SECRET = "pilot-secret-test-token-12345";

function makeContext(params: {
  url?: string;
  authorization?: string | null;
  secret?: string | null;
  envName?: string;
}) {
  const headers = new Headers();
  if (params.authorization) headers.set("Authorization", params.authorization);

  return {
    request: new Request(params.url ?? "https://etf-campus.pages.dev/api/community/admin/members", {
      method: "GET",
      headers,
    }),
    env: {
      COMMUNITY_ENVIRONMENT: params.envName ?? "preview",
      BACKOFFICE_READ_SECRET: params.secret !== undefined ? params.secret : VALID_SECRET,
    },
  };
}

describe("GET /api/community/admin/members - 백오피스 회원 읽기 전용 API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("COMMUNITY_ENVIRONMENT가 preview가 아닌 경우 403 FORBIDDEN으로 차단한다", async () => {
    const ctx = makeContext({
      authorization: `Bearer ${VALID_SECRET}`,
      envName: "production",
    });
    const res = await onRequestGet(ctx as unknown as Parameters<typeof onRequestGet>[0]);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.error.message).toContain("프리뷰 환경에서만");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("인증 헤더가 누락된 경우 401 AUTH_REQUIRED를 반환한다", async () => {
    const ctx = makeContext({ authorization: null });
    const res = await onRequestGet(ctx as unknown as Parameters<typeof onRequestGet>[0]);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("AUTH_REQUIRED");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("잘못된 비밀값(토큰 불일치)을 전달한 경우 403 FORBIDDEN을 반환한다", async () => {
    const ctx = makeContext({ authorization: "Bearer wrong-invalid-secret" });
    const res = await onRequestGet(ctx as unknown as Parameters<typeof onRequestGet>[0]);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("환경변수에 BACKOFFICE_READ_SECRET이 설정되지 않은 경우 403 FORBIDDEN으로 안전 거부한다", async () => {
    const ctx = makeContext({ authorization: `Bearer ${VALID_SECRET}`, secret: null });
    const res = await onRequestGet(ctx as unknown as Parameters<typeof onRequestGet>[0]);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("검색어가 100자를 초과하면 400 VALIDATION_ERROR를 반환한다", async () => {
    const longSearch = "a".repeat(101);
    const ctx = makeContext({
      url: `https://etf-campus.pages.dev/api/community/admin/members?search=${longSearch}`,
      authorization: `Bearer ${VALID_SECRET}`,
    });
    const res = await onRequestGet(ctx as unknown as Parameters<typeof onRequestGet>[0]);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toContain("최대 100자");
  });

  it("페이지 번호가 1000을 초과하면 400 VALIDATION_ERROR를 반환한다", async () => {
    const ctx = makeContext({
      url: "https://etf-campus.pages.dev/api/community/admin/members?page=1001",
      authorization: `Bearer ${VALID_SECRET}`,
    });
    const res = await onRequestGet(ctx as unknown as Parameters<typeof onRequestGet>[0]);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toContain("최대 1000");
  });

  it("정상 토큰 인증 시 합성 회원 목록을 페이징과 함께 반환한다", async () => {
    mocks.rpc.mockImplementation((name: string) => {
      if (name === "count_backoffice_members") {
        return Promise.resolve({ data: 3, error: null });
      }
      if (name === "get_backoffice_members") {
        return Promise.resolve({
          data: [
            {
              id: "00000000-0000-0000-0000-000000000001",
              public_nickname: "테스트회원A",
              email_masked: "t***@test.local",
              role: "member",
              status: "active",
              profile_complete: true,
              terms_consented_at: "2026-09-27T00:00:00Z",
              marketing_consent: true,
              signup_utm_source: "instagram",
              created_at: "2026-09-27T00:00:00Z",
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: { message: "Unknown RPC" } });
    });

    const ctx = makeContext({ authorization: `Bearer ${VALID_SECRET}` });
    const res = await onRequestGet(ctx as unknown as Parameters<typeof onRequestGet>[0]);

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("no-store");

    const body = await res.json();
    expect(body.pagination).toEqual({
      total: 3,
      page: 1,
      limit: 20,
      has_more: true,
    });
    expect(body.members).toHaveLength(1);
    expect(body.members[0]).toMatchObject({
      public_nickname: "테스트회원A",
      email_masked: "t***@test.local",
      role: "member",
      status: "active",
      marketing_consent: true,
      profile_complete: true,
    });
  });

  it("권한, 상태, 동의 결측치를 임의의 정상 상태로 바꾸지 않고 확인 불가/null로 반환한다 (Zero-Hallucination)", async () => {
    mocks.rpc.mockImplementation((name: string) => {
      if (name === "count_backoffice_members") return Promise.resolve({ data: 1, error: null });
      if (name === "get_backoffice_members") {
        return Promise.resolve({
          data: [
            {
              id: "00000000-0000-0000-0000-000000000002",
              public_nickname: "결측치회원",
              email_masked: null,
              role: null, // role missing
              status: "corrupted_status", // invalid status
              profile_complete: null, // missing boolean
              terms_consented_at: null,
              marketing_consent: null, // missing consent
              signup_utm_source: null,
              created_at: "2026-09-27T00:00:00Z",
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const ctx = makeContext({ authorization: `Bearer ${VALID_SECRET}` });
    const res = await onRequestGet(ctx as unknown as Parameters<typeof onRequestGet>[0]);
    expect(res.status).toBe(200);

    const body = await res.json();
    const member = body.members[0];

    // Must NOT default to "member", "active", false
    expect(member.role).toBe("확인 불가");
    expect(member.status).toBe("확인 불가");
    expect(member.marketing_consent).toBeNull();
    expect(member.profile_complete).toBeNull();
  });

  it("카운트 RPC가 null 또는 비정상 값을 반환하면 0명으로 표시하지 않고 503 오류를 반환한다", async () => {
    mocks.rpc.mockImplementation((name: string) => {
      if (name === "count_backoffice_members") return Promise.resolve({ data: null, error: null });
      if (name === "get_backoffice_members") return Promise.resolve({ data: [], error: null });
      return Promise.resolve({ data: null, error: null });
    });

    const ctx = makeContext({ authorization: `Bearer ${VALID_SECRET}` });
    const res = await onRequestGet(ctx as unknown as Parameters<typeof onRequestGet>[0]);

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("UNAVAILABLE");
    expect(body.error.message).toContain("집계");
  });

  it("행 데이터에 id 또는 created_at이 누락된 비정상 데이터인 경우 503 오류를 반환한다", async () => {
    mocks.rpc.mockImplementation((name: string) => {
      if (name === "count_backoffice_members") return Promise.resolve({ data: 1, error: null });
      if (name === "get_backoffice_members") {
        return Promise.resolve({
          data: [
            {
              // id is missing!
              public_nickname: "손상된데이터",
              created_at: "2026-09-27T00:00:00Z",
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const ctx = makeContext({ authorization: `Bearer ${VALID_SECRET}` });
    const res = await onRequestGet(ctx as unknown as Parameters<typeof onRequestGet>[0]);

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("UNAVAILABLE");
  });

  it("원본 이메일(email, contact_email)은 응답 필드에서 원천 배제된다", async () => {
    mocks.rpc.mockImplementation((name: string) => {
      if (name === "count_backoffice_members") return Promise.resolve({ data: 1, error: null });
      if (name === "get_backoffice_members") {
        return Promise.resolve({
          data: [
            {
              id: "00000000-0000-0000-0000-000000000001",
              public_nickname: "테스트회원",
              email_masked: "t***@test.local",
              // Raw email injected maliciously in mock DB response
              email: "raw_leak@test.local",
              contact_email: "raw_contact@test.local",
              created_at: "2026-09-27T00:00:00Z",
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const ctx = makeContext({ authorization: `Bearer ${VALID_SECRET}` });
    const res = await onRequestGet(ctx as unknown as Parameters<typeof onRequestGet>[0]);
    const body = await res.json();

    const member = body.members[0];
    expect(member.email_masked).toBe("t***@test.local");
    expect((member as Record<string, unknown>).email).toBeUndefined();
    expect((member as Record<string, unknown>).contact_email).toBeUndefined();
  });

  it("요청 limit이 50을 초과할 경우 최대 50건으로 자동 상한 제한(Cap)된다", async () => {
    mocks.rpc.mockImplementation((name: string) => {
      if (name === "count_backoffice_members") return Promise.resolve({ data: 0, error: null });
      if (name === "get_backoffice_members") return Promise.resolve({ data: [], error: null });
      return Promise.resolve({ data: null, error: null });
    });

    const ctx = makeContext({
      url: "https://etf-campus.pages.dev/api/community/admin/members?limit=200&page=2",
      authorization: `Bearer ${VALID_SECRET}`,
    });
    await onRequestGet(ctx as unknown as Parameters<typeof onRequestGet>[0]);

    expect(mocks.rpc).toHaveBeenCalledWith("get_backoffice_members", {
      p_limit: 50, // Clamped to 50
      p_offset: 50, // (2 - 1) * 50
      p_search: null,
      p_sort_field: "created_at",
      p_sort_direction: "desc",
    });
  });

  it("허용되지 않은 정렬 필드 전달 시 created_at desc로 안전 폴백한다", async () => {
    mocks.rpc.mockImplementation((name: string) => {
      if (name === "count_backoffice_members") return Promise.resolve({ data: 0, error: null });
      if (name === "get_backoffice_members") return Promise.resolve({ data: [], error: null });
      return Promise.resolve({ data: null, error: null });
    });

    const ctx = makeContext({
      url: "https://etf-campus.pages.dev/api/community/admin/members?sort=malicious_col;--&dir=INVALID",
      authorization: `Bearer ${VALID_SECRET}`,
    });
    await onRequestGet(ctx as unknown as Parameters<typeof onRequestGet>[0]);

    expect(mocks.rpc).toHaveBeenCalledWith("get_backoffice_members", {
      p_limit: 20,
      p_offset: 0,
      p_search: null,
      p_sort_field: "created_at",
      p_sort_direction: "desc",
    });
  });

  it("데이터베이스 RPC 오류 발생 시 503 UNAVAILABLE을 반환한다", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Database connection failed" } });

    const ctx = makeContext({ authorization: `Bearer ${VALID_SECRET}` });
    const res = await onRequestGet(ctx as unknown as Parameters<typeof onRequestGet>[0]);

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("UNAVAILABLE");
  });
});
