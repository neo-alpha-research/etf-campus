export const COMMUNITY_CATEGORY_SLUGS = [
  "free-qna",
  "strategy-portfolio",
  "stock-cost-analysis",
  "pension-etf-qna",
  "etf-questions",
  "challenge-30",
  "feedback",
] as const;

export const PUBLIC_COMMUNITY_CATEGORY_SLUGS = ["notice", ...COMMUNITY_CATEGORY_SLUGS] as const;

export type CommunityCategorySlug = (typeof COMMUNITY_CATEGORY_SLUGS)[number];
export type PublicCommunityCategorySlug = (typeof PUBLIC_COMMUNITY_CATEGORY_SLUGS)[number];
export type CommunityRole = "guest" | "member" | "moderator" | "admin";

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
  challengeDayNumber?: number;
  challengeCohortId?: string;
  challengeMetricKey?: string;
  challengeMetricValue?: number;
  challengeVisibility?: "cohort" | "public";
} {
  if (!payload || typeof payload !== "object") {
    throw new CommunityValidationError("게시물 입력값이 올바르지 않습니다.");
  }

  const input = payload as Record<string, unknown>;
  if (!isCommunityCategorySlug(input.categorySlug)) {
    throw new CommunityValidationError("게시판을 선택해 주세요.");
  }

  const result: ReturnType<typeof validatePostInput> = {
    categorySlug: input.categorySlug,
    title: plainText(input.title, "제목", 2, 120),
    bodyText: plainText(input.bodyText, "본문", 2, 6000),
  };

  if (input.categorySlug === "challenge-30") {
    const dayNumber = Number(input.challengeDayNumber);
    if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 30) {
      throw new CommunityValidationError("챌린지 일차는 1일부터 30일까지 입력할 수 있습니다.");
    }
    result.challengeDayNumber = dayNumber;
    
    if (typeof input.challengeCohortId === "string") {
      result.challengeCohortId = input.challengeCohortId;
    }

    if (input.challengeMetricKey) {
      if (!CHALLENGE_METRIC_KEYS.includes(input.challengeMetricKey as typeof CHALLENGE_METRIC_KEYS[number])) {
        throw new CommunityValidationError("허용되지 않는 학습 지표입니다.");
      }
      result.challengeMetricKey = input.challengeMetricKey as string;
      const mv = Number(input.challengeMetricValue);
      if (!Number.isInteger(mv) || mv < 0 || mv > 10) {
        throw new CommunityValidationError("학습 지표 값은 0부터 10까지 입력할 수 있습니다.");
      }
      result.challengeMetricValue = mv;
    }

    if (input.challengeVisibility) {
      if (input.challengeVisibility !== "cohort" && input.challengeVisibility !== "public") {
        throw new CommunityValidationError("허용되지 않는 공개 범위입니다.");
      }
      result.challengeVisibility = input.challengeVisibility as "cohort" | "public";
    }
  }

  return result;
}

export function validateCommentInput(payload: unknown): { bodyText: string } {
  if (!payload || typeof payload !== "object") {
    throw new CommunityValidationError("댓글 입력값이 올바르지 않습니다.");
  }
  return { bodyText: plainText((payload as Record<string, unknown>).bodyText, "댓글", 1, 2000) };
}

export const COMMUNITY_REPORT_REASON_CODES = [
  "privacy_exposure",
  "scam_or_external_inducement",
  "guaranteed_return_or_trade_signal",
  "misleading_information",
  "harassment_or_abuse",
  "advertising_or_copyright",
  "other",
] as const;

export type CommunityReportReasonCode = (typeof COMMUNITY_REPORT_REASON_CODES)[number];

export function validateCommunityReport(payload: unknown): { reasonCode: CommunityReportReasonCode; details: string | null } {
  if (!payload || typeof payload !== "object") {
    throw new CommunityValidationError("신고 입력값이 올바르지 않습니다.");
  }
  const input = payload as Record<string, unknown>;
  if (!COMMUNITY_REPORT_REASON_CODES.includes(input.reasonCode as CommunityReportReasonCode)) {
    throw new CommunityValidationError("신고 사유를 선택해 주세요.");
  }
  const details = input.details === null || input.details === undefined || input.details === ""
    ? null
    : plainText(input.details, "추가 설명", 2, 600);
  return { reasonCode: input.reasonCode as CommunityReportReasonCode, details };
}

export function validateContentVisibilityAction(payload: unknown): { isHidden: boolean; reason: string } {
  if (!payload || typeof payload !== "object") {
    throw new CommunityValidationError("임시 숨김 입력값이 올바르지 않습니다.");
  }
  const input = payload as Record<string, unknown>;
  if (typeof input.isHidden !== "boolean") {
    throw new CommunityValidationError("임시 숨김 상태를 선택해 주세요.");
  }
  return { isHidden: input.isHidden, reason: plainText(input.reason, input.isHidden ? "임시 숨김 사유" : "복원 사유", 2, 500) };
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

export const CHALLENGE_ACCOUNT_TYPES = ["dc", "irp", "db", "both", "unknown", "none"] as const;
export const AGE_BANDS = ["20s", "30s", "40s", "50s", "60s_plus"] as const;
export const CURRENT_TERMS_VERSION = "v2026-08-24" as const;
export const SUPPORTED_TERMS_VERSIONS = [CURRENT_TERMS_VERSION] as const;

export function validateSignupInput(payload: unknown) {
  if (!payload || typeof payload !== "object") throw new CommunityValidationError("가입 입력값이 올바르지 않습니다.");
  const input = payload as Record<string, unknown>;
  
  const nickname = validateNickname(input.nickname);
  
  if (input.agreedToTerms !== true) throw new CommunityValidationError("이용약관 동의가 필요합니다.");
  if (input.agreedToPrivacy !== true) throw new CommunityValidationError("개인정보 수집 및 이용 동의가 필요합니다.");
  if (input.agreedToAge !== true) throw new CommunityValidationError("만 14세 이상 확인이 필요합니다.");
  
  const agreedToMarketing = input.agreedToMarketing === true;
  const termsVersion = plainText(input.termsVersion, "약관 버전", 1, 80);
  if (termsVersion !== CURRENT_TERMS_VERSION) {
    throw new CommunityValidationError("유효한 약관 버전이 아닙니다.");
  }
  
  const utmSource = input.utmSource ? String(input.utmSource) : "direct";
  const utmMedium = input.utmMedium ? String(input.utmMedium) : null;
  const utmCampaign = input.utmCampaign ? String(input.utmCampaign) : null;

  return { nickname, agreedToMarketing, termsVersion, utmSource, utmMedium, utmCampaign };
}

export function validateOnboardingInput(payload: unknown) {
  if (!payload || typeof payload !== "object") throw new CommunityValidationError("입력값이 올바르지 않습니다.");
  const input = payload as Record<string, unknown>;
  
  let ageBand: string | null = null;
  if (input.ageBand) {
    if (!AGE_BANDS.includes(input.ageBand as typeof AGE_BANDS[number])) {
      throw new CommunityValidationError("올바른 연령대를 선택해 주세요.");
    }
    ageBand = input.ageBand as string;
  }
  
  let interestAccountType: string | null = null;
  if (input.interestAccountType) {
    if (!CHALLENGE_ACCOUNT_TYPES.includes(input.interestAccountType as typeof CHALLENGE_ACCOUNT_TYPES[number])) {
      throw new CommunityValidationError("올바른 퇴직연금 유형을 선택해 주세요.");
    }
    interestAccountType = input.interestAccountType as string;
  }
  
  return { ageBand, interestAccountType };
}
const CHALLENGE_METRIC_KEYS = ["study_checkin", "source_review", "criteria_check", "learning_note"] as const;

export function validateChallengeApplication(payload: unknown) {
  if (!payload || typeof payload !== "object") throw new CommunityValidationError("참가 신청 입력값이 올바르지 않습니다.");
  const input = payload as Record<string, unknown>;
  const cohortSlug = plainText(input.cohortSlug, "기수", 2, 80);
  const interestAccountType = CHALLENGE_ACCOUNT_TYPES.includes(input.interestAccountType as typeof CHALLENGE_ACCOUNT_TYPES[number])
    ? (input.interestAccountType as typeof CHALLENGE_ACCOUNT_TYPES[number])
    : (() => { throw new CommunityValidationError("계좌 유형을 선택해 주세요."); })();
  const goalNote = plainText(input.goalNote, "참여 목표", 2, 240);
  if (input.agreedToDailyRecord !== true) {
    throw new CommunityValidationError("매일 기록 및 비공개 저장 동의가 필요합니다.");
  }
  const consentVersion = plainText(input.privateRecordConsentVersion, "기록 저장 동의 버전", 1, 80);
  return { cohortSlug, interestAccountType, goalNote, privateRecordConsentVersion: consentVersion };
}

export function validateChallengeRecord(payload: unknown) {
  if (!payload || typeof payload !== "object") throw new CommunityValidationError("학습 기록 입력값이 올바르지 않습니다.");
  const input = payload as Record<string, unknown>;
  const dayNumber = Number(input.dayNumber);
  const metricValue = Number(input.metricValue);
  if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 30) throw new CommunityValidationError("챌린지 일차는 1일부터 30일까지 입력할 수 있습니다.");
  if (!CHALLENGE_METRIC_KEYS.includes(input.metricKey as typeof CHALLENGE_METRIC_KEYS[number])) {
    throw new CommunityValidationError("허용되지 않는 학습 지표입니다.");
  }
  if (!Number.isInteger(metricValue) || metricValue < 0 || metricValue > 10) throw new CommunityValidationError("학습 지표 값은 0부터 10까지 입력할 수 있습니다.");
  const note = input.note === null || input.note === undefined || input.note === "" ? null : plainText(input.note, "학습 메모", 2, 500);
  return { dayNumber, metricKey: input.metricKey as typeof CHALLENGE_METRIC_KEYS[number], metricValue, note, isPublic: input.isPublic === true };
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
  is_pinned?: boolean;
  is_author_seed?: boolean;
  challenge_day_number?: number;
  challenge_cohort_id?: string;
  challenge_metric_key?: string;
  challenge_metric_value?: number;
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
    isPinned: row.is_pinned ?? false,
    isAuthorSeed: row.is_author_seed ?? false,
    challengeDayNumber: row.challenge_day_number,
    challengeCohortId: row.challenge_cohort_id,
    challengeMetricKey: row.challenge_metric_key,
    challengeMetricValue: row.challenge_metric_value,
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
