import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

import { onRequestGet } from "./[key].js";

const validKey = "11111111-1111-4111-8111-111111111111.webp";

function requestContext(key = validKey, r2Object: { body: unknown; httpEtag?: string } | null = null) {
  return {
    params: { key },
    request: new Request("https://preview.example.com/api/community/images/" + key),
    env: {
      COMMUNITY_IMAGES: {
        get: mocks.get.mockResolvedValue(r2Object),
      },
    },
  };
}

describe("커뮤니티 이미지 조회 API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("유효하지 않은 키 형식은 404를 반환한다", async () => {
    const response = await onRequestGet(requestContext("invalid-image-key"));
    expect(response.status).toBe(404);
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("존재하지 않는 이미지 파일은 404를 반환한다", async () => {
    const response = await onRequestGet(requestContext(validKey, null));
    expect(response.status).toBe(404);
    expect(mocks.get).toHaveBeenCalledWith(validKey);
  });

  it("정상적인 이미지는 올바른 WebP 및 캐시 헤더와 함께 본문을 반환한다", async () => {
    const mockBody = new Uint8Array([1, 2, 3]).buffer;
    const response = await onRequestGet(
      requestContext(validKey, { body: mockBody, httpEtag: "etag-123" })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(response.headers.get("ETag")).toBe("etag-123");
  });
});
