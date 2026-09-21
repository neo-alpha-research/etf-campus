import { errorResponse, jsonResponse } from "../community/_lib/api-security";

const MAX_PAYLOAD_BYTES = 4096; // 4KB 요청 크기 제한
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const ALLOWED_CAMPAIGNS = new Set(["challenge_guide_2026"]);
const SERVER_TERMS_VERSION = "v1.0";

// 인메모리 레이트 리밋 폴백 저장소 (DB 테이블 장애 또는 테스트 환경 대비)
const memoryRateLimits = new Map<string, { count: number; resetAt: number }>();

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

interface D1PreparedStatementLike {
  bind: (...args: unknown[]) => D1PreparedStatementLike;
  run: () => Promise<{ success?: boolean; meta?: Record<string, unknown> }>;
  first: <T = unknown>(colName?: string) => Promise<T | null>;
  all: <T = unknown>() => Promise<{ results?: T[]; success?: boolean }>;
}

interface D1DatabaseLike {
  prepare: (query: string) => D1PreparedStatementLike;
}

/**
 * IP 및 이메일 기반 이중 레이트 리밋 검사
 * D1 DB의 lead_rate_limits 테이블을 우선 조회/갱신하며,
 * 미생성 상태이거나 D1 오류 시 인메모리 토큰 버킷으로 Graceful Fallback 수행
 */
async function isRateLimited(
  db: D1DatabaseLike | undefined,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);

  if (db) {
    try {
      const row = await db
        .prepare("SELECT count, reset_at FROM lead_rate_limits WHERE key = ?")
        .bind(key)
        .first<{ count: number; reset_at: number }>();

      if (row && row.reset_at > now) {
        if (row.count >= limit) {
          return true; // 한도 초과
        }
        await db
          .prepare("UPDATE lead_rate_limits SET count = count + 1 WHERE key = ?")
          .bind(key)
          .run();
        return false;
      } else {
        const resetAt = now + windowSeconds;
        await db
          .prepare(
            `INSERT INTO lead_rate_limits (key, count, reset_at)
             VALUES (?, 1, ?)
             ON CONFLICT(key) DO UPDATE SET count = 1, reset_at = excluded.reset_at`
          )
          .bind(key, resetAt)
          .run();
        return false;
      }
    } catch {
      // 테이블 미존재 또는 일시적 오류 시 인메모리 폴백으로 안전 전환
    }
  }

  // 인메모리 폴백 레이트 리밋 로직
  const entry = memoryRateLimits.get(key);
  if (entry && entry.resetAt > now) {
    if (entry.count >= limit) {
      return true;
    }
    entry.count += 1;
    return false;
  }
  memoryRateLimits.set(key, { count: 1, resetAt: now + windowSeconds });
  return false;
}

export async function onRequestPost(context: {
  request: Request;
  env?: { ETF_PRICES?: D1DatabaseLike };
}) {
  try {
    const { request, env } = context;

    // 1. Content-Length 헤더 사전 점검 (헤더가 있는 경우 빠른 거부)
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
      return errorResponse(400, "VALIDATION_ERROR", "요청 데이터가 허용 크기(4KB)를 초과했습니다.");
    }

    // 2. Content-Type 검증
    const contentType = request.headers.get("content-type")?.toLowerCase() || "";
    if (!contentType.startsWith("application/json")) {
      return errorResponse(400, "VALIDATION_ERROR", "JSON 형식의 요청만 지원합니다.");
    }

    // 3. 실제 본문 바이트 수 검증 (Content-Length 누락/위조에 무관하게 엄격 차단)
    const rawText = await request.text().catch(() => null);
    if (rawText === null) {
      return errorResponse(400, "VALIDATION_ERROR", "요청 본문을 읽을 수 없습니다.");
    }

    const rawByteLength = new TextEncoder().encode(rawText).length;
    if (rawByteLength > MAX_PAYLOAD_BYTES) {
      return errorResponse(400, "VALIDATION_ERROR", "요청 데이터가 허용 크기(4KB)를 초과했습니다.");
    }

    let payload: WaitlistPayload | null = null;
    try {
      payload = JSON.parse(rawText) as WaitlistPayload;
    } catch {
      return errorResponse(400, "VALIDATION_ERROR", "올바른 JSON 요청이 아닙니다.");
    }

    if (!payload || typeof payload !== "object") {
      return errorResponse(400, "VALIDATION_ERROR", "올바른 JSON 요청이 아닙니다.");
    }

    const { email, interest, source, campaign, termsVersion, agreeRequired } = payload;

    // 4. 필수 동의 검증 (서버 엄격 검문)
    if (agreeRequired !== true) {
      return errorResponse(400, "VALIDATION_ERROR", "개인정보 수집 및 출시 알림 수신에 동의해 주세요.");
    }

    // 5. 이메일 형식 검증
    if (!isValidEmail(email)) {
      return errorResponse(400, "VALIDATION_ERROR", "유효한 이메일 주소를 입력해 주세요.");
    }

    // 6. 캠페인 허용 목록 화이트리스트 검증 (타 캠페인 위변조 방지)
    if (typeof campaign !== "string" || !ALLOWED_CAMPAIGNS.has(campaign.trim())) {
      return errorResponse(400, "VALIDATION_ERROR", "허용되지 않거나 위변조된 캠페인 식별자입니다.");
    }

    // 7. 동의 약관 버전 검증 (서버 SSOT 기준값 v1.0 강제)
    if (typeof termsVersion !== "string" || termsVersion.trim() !== SERVER_TERMS_VERSION) {
      return errorResponse(400, "VALIDATION_ERROR", "동의 약관 버전이 일치하지 않습니다.");
    }

    // 8. 저장소 바인딩 검증 (Fail-Closed: 누락 시 성공 응답 절대 금지)
    const db = env?.ETF_PRICES;
    if (!db) {
      return errorResponse(503, "UNAVAILABLE", "저장소 연결이 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.");
    }

    const trimmedEmail = email.trim().toLowerCase();
    const activeCampaign = campaign.trim();
    const currentTermsVersion = termsVersion.trim();
    const selectedInterest =
      typeof interest === "string" && interest.trim()
        ? interest.trim().slice(0, 50)
        : "all";
    const leadSource =
      typeof source === "string" && source.trim()
        ? source.trim().slice(0, 50)
        : "compare_bridge";

    // 9. 레이트 리밋 검증 (IP 60초 내 5회, Email 60초 내 3회)
    const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
    const ipLimited = await isRateLimited(db, `ip:${clientIp}`, 5, 60);
    if (ipLimited) {
      return errorResponse(429, "RATE_LIMITED", "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
    }

    const emailLimited = await isRateLimited(db, `email:${trimmedEmail}`, 3, 60);
    if (emailLimited) {
      return errorResponse(429, "RATE_LIMITED", "동일 이메일로 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
    }

    // 10. 멱등 저장 쿼리 실행 (ON CONFLICT 업데이트 및 상태 전이 완결)
    // - 중복 신청 (pending): 1행 유지, 최신 관심사/출처/동의시각 갱신
    // - 철회 후 재신청 (withdrawn/deleted): status = 'pending' 복구, 신규 동의시각 갱신
    // - 가이드 발송 후 재신청 (sent): status = 'pending' 복구, 후속 판본 발송 대기자로 전환
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
            status = 'pending',
            updated_at = datetime('now')`
        )
        .bind(trimmedEmail, selectedInterest, leadSource, activeCampaign, currentTermsVersion)
        .run();
    } catch {
      // 테이블 미적용 또는 D1 장애 시 500 에러 반환 (성공 은폐 금지)
      return errorResponse(500, "UNAVAILABLE", "대기자 정보 저장 중 오류가 발생했습니다. 입력값은 유지되니 다시 시도해 주세요.");
    }

    // 11. 실제 저장 성공 여부 확인
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
