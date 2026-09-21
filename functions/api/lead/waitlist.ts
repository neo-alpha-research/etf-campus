import { errorResponse, jsonResponse } from "../community/_lib/api-security";

const MAX_PAYLOAD_BYTES = 4096; // 4KB 요청 크기 제한
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function isValidEmail(email: unknown): email is string {
  return (
    typeof email === "string" &&
    email.trim().length >= 6 &&
    email.trim().length <= 100 &&
    EMAIL_REGEX.test(email.trim())
  );
}

interface WaitlistPayload {
  email?: string;
  interest?: string;
  source?: string;
  campaign?: string;
  termsVersion?: string;
  agreeRequired?: boolean;
}

interface D1DatabaseLike {
  prepare: (query: string) => {
    bind: (...args: unknown[]) => {
      run: () => Promise<{ success?: boolean; meta?: Record<string, unknown> }>;
    };
  };
}

export async function onRequestPost(context: {
  request: Request;
  env?: { ETF_PRICES?: D1DatabaseLike };
}) {
  try {
    const { request, env } = context;

    // 1. 요청 크기 제한 검증
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
      return errorResponse(400, "VALIDATION_ERROR", "요청 데이터가 허용 크기(4KB)를 초과했습니다.");
    }

    // 2. Content-Type 검증
    const contentType = request.headers.get("content-type")?.toLowerCase() || "";
    if (!contentType.startsWith("application/json")) {
      return errorResponse(400, "VALIDATION_ERROR", "JSON 형식의 요청만 지원합니다.");
    }

    const cloned = request.clone();
    const payload = (await cloned.json().catch(() => null)) as WaitlistPayload | null;

    if (!payload || typeof payload !== "object") {
      return errorResponse(400, "VALIDATION_ERROR", "올바른 JSON 요청이 아닙니다.");
    }

    const { email, interest, source, campaign, termsVersion, agreeRequired } = payload;

    // 3. 필수 동의 검증 (서버 엄격 검문)
    if (agreeRequired !== true) {
      return errorResponse(400, "VALIDATION_ERROR", "개인정보 수집 및 출시 알림 수신에 동의해 주세요.");
    }

    // 4. 이메일 형식 검증
    if (!isValidEmail(email)) {
      return errorResponse(400, "VALIDATION_ERROR", "유효한 이메일 주소를 입력해 주세요.");
    }

    // 5. 저장소 바인딩 검증 (Fail-Closed: 누락 시 성공 응답 절대 금지)
    const db = env?.ETF_PRICES;
    if (!db) {
      return errorResponse(503, "UNAVAILABLE", "저장소 연결이 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.");
    }

    const trimmedEmail = email.trim().toLowerCase();
    const selectedInterest =
      typeof interest === "string" && interest.trim()
        ? interest.trim().slice(0, 50)
        : "all";
    const leadSource =
      typeof source === "string" && source.trim()
        ? source.trim().slice(0, 50)
        : "compare_bridge";
    const activeCampaign =
      typeof campaign === "string" && campaign.trim()
        ? campaign.trim().slice(0, 50)
        : "challenge_guide_2026";
    const currentTermsVersion =
      typeof termsVersion === "string" && termsVersion.trim()
        ? termsVersion.trim().slice(0, 20)
        : "v1.0";

    // 6. 멱등 저장 쿼리 실행 (ON CONFLICT 업데이트 지원)
    let result: { success?: boolean; meta?: Record<string, unknown> };
    try {
      result = await db
        .prepare(
          `INSERT INTO lead_waitlist (
            email, interest, source, campaign, terms_version,
            agreed_at, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, datetime('now'), 'pending', datetime('now'), datetime('now'))
          ON CONFLICT(email, campaign) DO UPDATE SET
            interest = excluded.interest,
            source = excluded.source,
            terms_version = excluded.terms_version,
            agreed_at = excluded.agreed_at,
            updated_at = datetime('now')`
        )
        .bind(trimmedEmail, selectedInterest, leadSource, activeCampaign, currentTermsVersion)
        .run();
    } catch {
      // 테이블 미적용 또는 D1 장애 시 500 에러 반환 (성공 은폐 금지)
      return errorResponse(500, "UNAVAILABLE", "대기자 정보 저장 중 오류가 발생했습니다. 입력값은 유지되니 다시 시도해 주세요.");
    }

    // 7. 실제 저장 성공 여부 확인
    if (!result || result.success === false) {
      return errorResponse(500, "UNAVAILABLE", "데이터베이스에 접수 내역을 기록하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }

    return jsonResponse(
      {
        success: true,
        message: "출시 알림 신청이 정상적으로 완료되었습니다.",
      },
      201
    );
  } catch {
    return errorResponse(500, "UNAVAILABLE", "신청 처리 중 일시적인 서버 오류가 발생했습니다. 입력값은 유지되니 잠시 후 다시 시도해 주세요.");
  }
}
