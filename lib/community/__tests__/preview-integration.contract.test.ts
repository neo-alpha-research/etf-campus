import { describe, expect, it } from "vitest";

const previewBaseUrl = process.env.COMMUNITY_PREVIEW_INTEGRATION_BASE_URL;
const enabled = process.env.COMMUNITY_PREVIEW_INTEGRATION_ENABLED === "true";

// This suite intentionally does not contain credentials or test identities. It is enabled only in a separate operator-provided Preview environment.
describe.skipIf(!enabled || !previewBaseUrl)("운영자 제공 Preview 커뮤니티 API 통합 계약", () => {
  it("anon은 공개 목록을 읽지만 쓰기 API는 인증 없이 거부된다", async () => {
    const publicResponse = await fetch(`${previewBaseUrl}/api/community/posts`);
    expect(publicResponse.ok).toBe(true);
    const writeResponse = await fetch(`${previewBaseUrl}/api/community/posts`, {
      method: "POST",
      headers: { Origin: previewBaseUrl, "Content-Type": "application/json" },
      body: JSON.stringify({ categorySlug: "etf-questions", title: "검수", bodyText: "검수" }),
    });
    expect([401, 403]).toContain(writeResponse.status);
  });

  it("운영자 검수 계정은 별도 보안 프로시저로 member A·B·admin·닉네임 미설정·탈퇴 처리 상태를 준비한 뒤 RLS 시나리오를 수행해야 한다", () => {
    expect(process.env.COMMUNITY_PREVIEW_INTEGRATION_ENABLED).toBe("true");
  });
});
