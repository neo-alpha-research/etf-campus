import { describe, expect, it } from "vitest";
import { CommunityValidationError, toPublicPost, validatePostInput } from "@/lib/community/contracts";
import { mutationOutcome, readBearerToken } from "@/lib/community/api-security";

describe("커뮤니티 인증·권한 보안 규칙", () => {
  it("비로그인 작성 API 요청에는 bearer 토큰이 없음을 판정한다", () => {
    expect(readBearerToken(null)).toBeNull();
    expect(readBearerToken("Basic user:password")).toBeNull();
  });

  it("유효한 bearer 토큰만 인증 요청에 전달한다", () => {
    expect(readBearerToken("Bearer access-token-value")).toBe("access-token-value");
  });

  it("타 사용자 게시물 수정은 대상은 존재하지만 수정 권한이 없는 상태로 판정한다", () => {
    expect(mutationOutcome(false, true)).toBe("forbidden");
  });

  it("존재하지 않는 게시물 수정은 not_found로 판정한다", () => {
    expect(mutationOutcome(false, false)).toBe("not_found");
  });

  it("작성자가 수정한 경우에만 updated로 판정한다", () => {
    expect(mutationOutcome(true, true)).toBe("updated");
  });
});

describe("커뮤니티 입력값과 공개 응답", () => {
  it("게시물 본문에 HTML 태그를 저장하지 않는다", () => {
    expect(() => validatePostInput({
      categorySlug: "etf-questions",
      title: "ETF 비용 확인",
      bodyText: "<script>alert('xss')</script>",
    })).toThrow(CommunityValidationError);
  });

  it("공개 게시물 응답에 이메일과 내부 작성자 ID를 포함하지 않는다", () => {
    const publicPost = toPublicPost({
      slug: "0c4d8ee3-0f97-4fef-9f3e-ea2d0c891746",
      title: "연금 ETF 질문",
      body_text: "공시에서 확인할 항목이 궁금합니다.",
      category_slug: "pension-etf-qna",
      category_name: "연금 ETF Q&A",
      author_nickname: "연금공부중",
      created_at: "2026-08-15T00:00:00.000Z",
      updated_at: "2026-08-15T00:00:00.000Z",
      comment_count: 0,
    });

    expect(publicPost).toMatchObject({ authorNickname: "연금공부중" });
    const postJson = JSON.stringify(publicPost);
    expect(postJson).not.toContain("@example.com");
    expect(postJson).not.toContain("author_profile_id");
    expect(postJson).not.toContain("internal_user_id");
    expect(postJson).not.toContain("uuid");
    expect(postJson).not.toContain("token");
    expect(postJson).not.toContain("email");
  });
});
