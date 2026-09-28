export const COMMUNITY_CATEGORY_SLUGS = [
  "pension-etf-qna",
  "etf-questions",
  "challenge-30",
  "feedback",
] as const;

export type CommunityCategorySlug = (typeof COMMUNITY_CATEGORY_SLUGS)[number];
export type CommunityRole = "guest" | "member" | "moderator" | "admin";

export const CURRENT_TERMS_VERSION = "v2026-08-24" as const;
export const SUPPORTED_TERMS_VERSIONS = [CURRENT_TERMS_VERSION] as const;

export class CommunityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommunityValidationError";
  }
}

const HTML_TAG_PATTERN = /<\s*\/?\s*[a-z][^>]*>/i;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

function plainText(value: unknown, label: string, minLength: number, maxLength: number): string {
  if (typeof value !== "string") {
    throw new CommunityValidationError(`${label}을(를) 입력해 주세요.`);
  }

  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if (normalized.length < minLength || normalized.length > maxLength) {
    throw new CommunityValidationError(`${label}은(는) ${minLength}자 이상 ${maxLength}자 이하로 입력해 주세요.`);
  }
  if (HTML_TAG_PATTERN.test(normalized)) {
    throw new CommunityValidationError("HTML 태그는 사용할 수 없습니다.");
  }
  if (CONTROL_CHARACTER_PATTERN.test(normalized)) {
    throw new CommunityValidationError("허용되지 않는 제어 문자가 포함되어 있습니다.");
  }

  return normalized;
}

export function isCommunityCategorySlug(value: unknown): value is CommunityCategorySlug {
  return typeof value === "string" && (COMMUNITY_CATEGORY_SLUGS as readonly string[]).includes(value);
}

export function validatePostInput(payload: unknown): {
  categorySlug: CommunityCategorySlug;
  title: string;
  bodyText: string;
} {
  if (!payload || typeof payload !== "object") {
    throw new CommunityValidationError("게시물 입력값이 올바르지 않습니다.");
  }

  const input = payload as Record<string, unknown>;
  if (!isCommunityCategorySlug(input.categorySlug)) {
    throw new CommunityValidationError("게시판을 선택해 주세요.");
  }

  return {
    categorySlug: input.categorySlug,
    title: plainText(input.title, "제목", 2, 120),
    bodyText: plainText(input.bodyText, "본문", 2, 6000),
  };
}

export function validateCommentInput(payload: unknown): { bodyText: string } {
  if (!payload || typeof payload !== "object") {
    throw new CommunityValidationError("댓글 입력값이 올바르지 않습니다.");
  }
  return { bodyText: plainText((payload as Record<string, unknown>).bodyText, "댓글", 1, 2000) };
}

export function validateNickname(value: unknown): string {
  const nickname = plainText(value, "닉네임", 2, 24);
  if (!/^[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ _.-]+$/.test(nickname)) {
    throw new CommunityValidationError("닉네임에는 한글, 영문, 숫자, 공백, 밑줄, 점, 하이픈만 사용할 수 있습니다.");
  }
  return nickname;
}

export function validateWithdrawalDisposition(value: unknown): "anonymize" | "delete" {
  if (value === "anonymize" || value === "delete") {
    return value;
  }
  throw new CommunityValidationError("탈퇴 후 콘텐츠 처리 방식을 선택해 주세요.");
}

export type PublicPostRow = {
  slug: string;
  title: string;
  body_text?: string;
  excerpt?: string;
  category_slug: CommunityCategorySlug;
  category_name: string;
  author_nickname: string;
  created_at: string;
  updated_at: string;
  comment_count?: number;
};

export function toPublicPost(row: PublicPostRow) {
  return {
    slug: row.slug,
    title: row.title,
    bodyText: row.body_text,
    excerpt: row.excerpt,
    category: { slug: row.category_slug, name: row.category_name },
    authorNickname: row.author_nickname,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    commentCount: row.comment_count ?? 0,
  };
}

export type PublicCommentRow = {
  public_id: string;
  post_slug: string;
  body_text: string;
  author_nickname: string;
  created_at: string;
  updated_at: string;
};

export function toPublicComment(row: PublicCommentRow) {
  return {
    publicId: row.public_id,
    postSlug: row.post_slug,
    bodyText: row.body_text,
    authorNickname: row.author_nickname,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
