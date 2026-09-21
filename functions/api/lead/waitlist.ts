import { errorResponse, jsonResponse } from "../community/_lib/api-security";

const MAX_PAYLOAD_BYTES = 4096; // 4KB 요청 크기 제한
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const ALLOWED_CAMPAIGNS = new Set(["challenge_guide_2026"]);
const SERVER_TERMS_VERSION = "v1.0";

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
 * 요청 본문을 스트리밍 방식으로 누적 바이트를 세며 읽고,
 * 허용 바이트(4096B)를 초과하는 즉시 스트림을 중단(abort)하여 서버 자원을 보호함.
 */
async function readBodyStreamWithLimit(
  request: Request,
  maxBytes: number
): Promise<{ text?: string; exceeded?: boolean; error?: boolean }> {
  if (request.body && typeof request.body.getReader === "function") {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.byteLength;
          if (totalBytes > maxBytes) {
            await reader.cancel("Payload exceeds limit");
            return { exceeded: true };
          }
          chunks.push(value);
        }
      }

      const combined = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return { text: new TextDecoder().decode(combined) };
    } catch {
      return { error: true };
    }
  }

  // 스트림 인터페이스가 없는 테스트/폴백 환경 대응
  try {
    const raw = await request.text();
    const byteLength = new TextEncoder().encode(raw).length;
    if (byteLength > maxBytes) {
      return { exceeded: true };
    }
    return { text: raw };
  } catch {
    return { error: true };
  }
}

/**
 * 속도 제한 키의 개인정보(IP, 이메일) 노출을 차단하기 위한 솔트 기반 SHA-256 단방향 해시
 */
async function hashRateLimitKey(prefix: "rl_ip" | "rl_em", value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`lead_rate_salt_2026:${prefix}:${value}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hashHex.slice(0, 32)}`;
}

/**
 * SQLite 단일 쿼리 기반 원자적(Atomic) 레이트 리밋 검사 및 갱신
 * D1/SQLite 직렬화 트랜잭션과 RETURNING 절을 활용하여 경쟁 상태(Race Condition)를 원천 차단함.
 * 장애 발생 시 인메모리 임의 우회를 금지하고 즉시 오류(Fail-Closed)를 전파함.
 */
async function enforceAtomicRateLimit(
  db: D1DatabaseLike,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ limited: boolean; retryAfter?: number }> {
  const now = Math.floor(Date.now() / 1000);
  const resetAt = now + windowSeconds;

  const row = await db
    .prepare(
      `INSERT INTO lead_rate_limits (key, count, reset_at)
       VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN reset_at > ? THEN count + 1 ELSE 1 END,
         reset_at = CASE WHEN reset_at > ? THEN reset_at ELSE excluded.reset_at END
       RETURNING count, reset_at`
    )
    .bind(key, resetAt, now, now)
    .first<{ count: number; reset_at: number }>();

  if (!row || typeof row.count !== "number") {
    throw new Error("Rate limit store query failed or returned invalid response");
  }

  if (row.count > limit) {
    const retryAfter = Math.max(1, (row.reset_at ?? resetAt) - now);
    return { limited: true, retryAfter };
  }

  return { limited: false };
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

    // 3. 실제 본문 스트림 누적 바이트 검증 및 조기 중단 (Content-Length 누락/위조에 무관하게 4096B 초과 즉시 중단)
    const bodyResult = await readBodyStreamWithLimit(request, MAX_PAYLOAD_BYTES);
    if (bodyResult.exceeded) {
      return errorResponse(400, "VALIDATION_ERROR", "요청 데이터가 허용 크기(4KB)를 초과했습니다.");
    }
    if (bodyResult.error || typeof bodyResult.text !== "string") {
      return errorResponse(400, "VALIDATION_ERROR", "요청 본문을 읽을 수 없습니다.");
    }

    let payload: WaitlistPayload | null = null;
    try {
      payload = JSON.parse(bodyResult.text) as WaitlistPayload;
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

    // 9. 원자적 동시성 레이트 리밋 검증 (IP 60초 내 5회, Email 60초 내 3회)
    // 개인정보 보호를 위해 IP/이메일은 SHA-256 단방향 해시 키로 변환하여 보관
    const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
    const ipKey = await hashRateLimitKey("rl_ip", clientIp);
    const emailKey = await hashRateLimitKey("rl_em", trimmedEmail);

    try {
      const ipResult = await enforceAtomicRateLimit(db, ipKey, 5, 60);
      if (ipResult.limited) {
        return errorResponse(429, "RATE_LIMITED", "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
      }

      const emailResult = await enforceAtomicRateLimit(db, emailKey, 3, 60);
      if (emailResult.limited) {
        return errorResponse(429, "RATE_LIMITED", "동일 이메일로 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
      }
    } catch {
      // 레이트 리밋 저장소 장애 시 임의 인메모리 폴백으로 우회하지 않고 503 반환
      return errorResponse(
        503,
        "UNAVAILABLE",
        "보안 확인 서비스를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요."
      );
    }

    // 10. 기신청자 상태 확인 (신청 범위 엄격 일치: 이미 발송 완료된 경우 후속 판본 자동 확장 금지)
    try {
      const existing = await db
        .prepare("SELECT status FROM lead_waitlist WHERE email = ? AND campaign = ?")
        .bind(trimmedEmail, activeCampaign)
        .first<{ status: string }>();

      if (existing && existing.status === "sent") {
        return jsonResponse(
          {
            success: true,
            alreadySent: true,
            message: "이미 해당 이메일로 가이드 출시 알림이 발송 완료되었습니다. 추가 발송이 필요하시면 고객센터로 문의해 주세요.",
          },
          200
        );
      }
    } catch {
      return errorResponse(
        500,
        "UNAVAILABLE",
        "대기자 정보 저장 중 오류가 발생했습니다. 입력값은 유지되니 다시 시도해 주세요."
      );
    }

    // 11. 멱등 저장 쿼리 실행 (ON CONFLICT 업데이트)
    // - 중복 신청 (pending): 1행 유지, 최신 관심사/출처/동의시각 갱신
    // - 철회 후 재신청 (withdrawn): 사용자의 신규 동의에 따라 status = 'pending' 복구 및 신규 동의시각 갱신
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
      return errorResponse(
        500,
        "UNAVAILABLE",
        "대기자 정보 저장 중 오류가 발생했습니다. 입력값은 유지되니 다시 시도해 주세요."
      );
    }

    // 12. 실제 저장 성공 여부 엄격 확인 (result.success === true 필수 검증)
    if (!result || result.success !== true) {
      return errorResponse(
        500,
        "UNAVAILABLE",
        "데이터베이스에 접수 내역을 기록하지 못했습니다. 잠시 후 다시 시도해 주세요."
      );
    }

    return jsonResponse(
      {
        success: true,
        message: "출시 알림 신청이 정상적으로 완료되었습니다.",
      },
      201
    );
  } catch {
    return errorResponse(
      500,
      "UNAVAILABLE",
      "신청 처리 중 일시적인 서버 오류가 발생했습니다. 입력값은 유지되니 잠시 후 다시 시도해 주세요."
    );
  }
}
