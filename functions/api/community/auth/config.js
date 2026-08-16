import { errorResponse, jsonResponse } from "../_lib/api-security";

function isExternalEnvironment(env) {
  return env.COMMUNITY_ENVIRONMENT === "preview" || env.COMMUNITY_ENVIRONMENT === "production";
}

export async function onRequestGet(context) {
  const required = context.env.TURNSTILE_REQUIRED === "true";
  const siteKey = context.env.TURNSTILE_SITE_KEY;
  if (isExternalEnvironment(context.env) && !required) {
    return errorResponse(503, "CONFIGURATION_ERROR", "?��? Preview ?�증 보안 ?�정??준비되지 ?�았?�니??");
  }
  if (required && (!siteKey || !context.env.TURNSTILE_SECRET_KEY || !context.env.TURNSTILE_EXPECTED_HOSTNAME)) {
    return errorResponse(503, "CONFIGURATION_ERROR", "CAPTCHA 보안 ?�정???�인??주세??");
  }
  return jsonResponse({ required, siteKey: required ? siteKey : null });
}
