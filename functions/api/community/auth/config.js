import { errorResponse, jsonResponse } from "../../../../lib/community/api-security";

function isExternalEnvironment(env) {
  return env.COMMUNITY_ENVIRONMENT === "preview" || env.COMMUNITY_ENVIRONMENT === "production";
}

export async function onRequestGet(context) {
  const required = context.env.TURNSTILE_REQUIRED === "true";
  const siteKey = context.env.TURNSTILE_SITE_KEY;
  if (isExternalEnvironment(context.env) && !required) {
    return errorResponse(503, "CONFIGURATION_ERROR", "외부 Preview 인증 보안 설정이 준비되지 않았습니다.");
  }
  if (required && (!siteKey || !context.env.TURNSTILE_SECRET_KEY || !context.env.TURNSTILE_EXPECTED_HOSTNAME)) {
    return errorResponse(503, "CONFIGURATION_ERROR", "CAPTCHA 보안 설정을 확인해 주세요.");
  }
  return jsonResponse({ required, siteKey: required ? siteKey : null });
}
