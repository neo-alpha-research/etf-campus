import { errorResponse, jsonResponse } from "../community/_lib/api-security";

function isValidEmail(email: unknown): email is string {
  return (
    typeof email === "string" &&
    email.trim().length > 5 &&
    email.includes("@") &&
    email.includes(".")
  );
}

interface WaitlistPayload {
  email?: string;
  interest?: string;
  source?: string;
  agreeRequired?: boolean;
}

interface D1DatabaseLike {
  prepare: (query: string) => {
    bind: (...args: unknown[]) => {
      run: () => Promise<unknown>;
    };
  };
}

export async function onRequestPost(context: {
  request: Request;
  env?: { ETF_PRICES?: D1DatabaseLike };
}) {
  try {
    const { request, env } = context;
    const cloned = request.clone();
    const payload = (await cloned.json().catch(() => null)) as WaitlistPayload | null;

    if (!payload || typeof payload !== "object") {
      return errorResponse(400, "VALIDATION_ERROR", "올바른 JSON 요청이 아닙니다.");
    }

    const { email, interest, source, agreeRequired } = payload;

    if (!agreeRequired) {
      return errorResponse(400, "VALIDATION_ERROR", "개인정보 수집 및 출시 알림 수신에 동의해 주세요.");
    }

    if (!isValidEmail(email)) {
      return errorResponse(400, "VALIDATION_ERROR", "유효한 이메일 주소를 입력해 주세요.");
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

    const db = env?.ETF_PRICES;
    if (db) {
      try {
        await db
          .prepare(
            `INSERT INTO lead_waitlist (email, interest, source, status, created_at)
             VALUES (?, ?, ?, 'pending', datetime('now'))`
          )
          .bind(trimmedEmail, selectedInterest, leadSource)
          .run();
      } catch (dbError) {
        // D1 테이블 미적용 시에도 Graceful Fallback 유지
        console.warn("[Waitlist] D1 insert failed or fallback:", dbError);
      }
    }

    return jsonResponse(
      {
        success: true,
        message: "얼리버드 대기자 등록이 완료되었습니다. 런칭 시 가장 먼저 안내해 드리겠습니다.",
      },
      201
    );
  } catch {
    return errorResponse(500, "UNAVAILABLE", "얼리버드 신청 처리 중 일시적인 서버 오류가 발생했습니다.");
  }
}
