import { errorResponse, jsonResponse } from "../community/_lib/api-security";

// Simple validation
function isValidEmail(email) {
  return typeof email === "string" && email.length > 3 && email.includes("@");
}

export async function onRequestPost(context) {
  try {
    const cloned = context.request.clone();
    const payload = await cloned.json().catch(() => null);

    if (!payload || typeof payload !== "object") {
      return errorResponse(400, "BAD_REQUEST", "잘못된 요청입니다.");
    }

    const { email, agreeRequired } = payload;

    if (!agreeRequired) {
      return errorResponse(400, "VALIDATION_ERROR", "필수 항목(이용약관 및 개인정보 처리방침)에 동의해 주세요.");
    }

    if (!isValidEmail(email)) {
      return errorResponse(400, "VALIDATION_ERROR", "유효한 이메일 주소를 입력해 주세요.");
    }

    // TODO: In Phase 4, we only need to provide the "shell" (껍데기) of this API.
    // External API integration (Stibee, Mailchimp, etc.) will be decided later.
    // We just return a success response to indicate the UI form works and double opt-in is requested.

    return jsonResponse({
      success: true,
      message: "구독 이중 확인 메일 발송이 요청되었습니다.",
    });
  } catch (error) {
    return errorResponse(500, "INTERNAL_ERROR", "구독 처리 중 서버 오류가 발생했습니다.");
  }
}
