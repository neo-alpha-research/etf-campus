import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticatedSupabase: vi.fn(),
  enforceDatabaseRateLimit: vi.fn(),
  put: vi.fn(),
}));

vi.mock("../_lib/supabase", () => ({
  authenticatedSupabase: mocks.authenticatedSupabase,
}));

vi.mock("../_lib/request-security", () => ({
  enforceDatabaseRateLimit: mocks.enforceDatabaseRateLimit,
}));

vi.mock("../_lib/api-security", () => ({
  errorResponse: (status: number, code: string, message: string) => Response.json({ error: { code, message } }, { status }),
  jsonResponse: (body: unknown, status = 200) => Response.json(body, { status }),
}));

import { onRequestPost } from "./upload.js";

function requestContext(body: ArrayBuffer | null, contentType = "image/webp") {
  return {
    request: new Request("https://preview.example.com/api/community/images/upload", {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: body || undefined,
    }),
    env: {
      COMMUNITY_IMAGES: { put: mocks.put },
      COMMUNITY_IMAGES_PUBLIC_URL: "https://images.etfcampus.com",
    },
  };
}

describe("커뮤니티 이미지 업로드 API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceDatabaseRateLimit.mockResolvedValue(null);
    mocks.authenticatedSupabase.mockResolvedValue({
      user: { id: "user-123" },
      client: {},
    });
  });

  it("비로그인 사용자는 401 에러를 반환한다", async () => {
    mocks.authenticatedSupabase.mockResolvedValue({
      error: Response.json({ error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } }, { status: 401 }),
    });

    const response = await onRequestPost(requestContext(new ArrayBuffer(10)));
    expect(response.status).toBe(401);
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("속도 제한 초과 시 429 에러를 반환한다", async () => {
    mocks.enforceDatabaseRateLimit.mockResolvedValue(
      Response.json({ error: { code: "RATE_LIMITED", message: "요청이 너무 많습니다." } }, { status: 429 })
    );

    const response = await onRequestPost(requestContext(new ArrayBuffer(10)));
    expect(response.status).toBe(429);
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("유효한 바이너리 업로드 시 R2에 저장하고 URL을 반환한다", async () => {
    const buffer = new Uint8Array([0x52, 0x49, 0x46, 0x46]).buffer;
    const response = await onRequestPost(requestContext(buffer));

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.url).toMatch(/^https:\/\/images\.etfcampus\.com\/[0-9a-f-]+\.webp$/);
    expect(data.key).toMatch(/^[0-9a-f-]+\.webp$/);
    expect(data.size).toBe(4);
    expect(mocks.put).toHaveBeenCalledWith(data.key, expect.any(ArrayBuffer), {
      httpMetadata: { contentType: "image/webp" },
    });
  });
});
