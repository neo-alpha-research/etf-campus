import { adminSupabase, authenticatedSupabase } from "../_lib/supabase";
import { parseJsonBody } from "../_lib/request-security";
import { errorResponse, jsonResponse } from "../_lib/api-security";

export async function onRequestPost(context) {
  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;

  const payload = await parseJsonBody(context.request);
  const agreedToTerms = Boolean(payload?.agreedToTerms);
  const agreedToPrivacy = Boolean(payload?.agreedToPrivacy);
  const agreedToAge = Boolean(payload?.agreedToAge);
  const termsVersion = typeof payload?.termsVersion === "string" ? payload.termsVersion.trim() : "";

  if (!agreedToTerms || !agreedToPrivacy || !agreedToAge) {
    return errorResponse(400, "VALIDATION_ERROR", "필수 약관에 모두 동의해 주세요.");
  }

  if (!termsVersion || termsVersion.length > 50) {
    return errorResponse(400, "VALIDATION_ERROR", "유효한 약관 버전이 필요합니다.");
  }

  const admin = adminSupabase(context.env);

  // 1. 기존 프로필 확인: 닉네임이 존재하는 기존 회원인지 확인
  const { data: existingProfile, error: fetchError } = await admin
    .from("user_profiles")
    .select("id, public_nickname, marketing_consent, signup_utm_source, signup_utm_medium, signup_utm_campaign")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (fetchError) {
    return errorResponse(503, "UNAVAILABLE", "프로필 정보를 확인하지 못했습니다.");
  }

  if (!existingProfile?.public_nickname) {
    return errorResponse(400, "VALIDATION_ERROR", "프로필 설정이 선행되어야 합니다.");
  }

  // 2. 필수 약관 정보만 갱신: 기존 가입 유입(UTM), 닉네임, 계좌정보 등은 일체 건드리지 않고 보존
  const updates = {
    terms_version: termsVersion,
    updated_at: new Date().toISOString(),
  };

  // 마케팅 수신 동의가 명시적으로 전달된 경우에만 갱신
  if (typeof payload?.agreedToMarketing === "boolean") {
    updates.marketing_consent = payload.agreedToMarketing;
    if (payload.agreedToMarketing) {
      updates.marketing_consent_at = new Date().toISOString();
    }
  }

  const { data: updatedProfile, error: updateError } = await admin
    .from("user_profiles")
    .update(updates)
    .eq("id", auth.user.id)
    .select("public_nickname, terms_version, marketing_consent")
    .single();

  if (updateError) {
    return errorResponse(503, "UNAVAILABLE", "약관 동의 정보를 저장하지 못했습니다.");
  }

  return jsonResponse({
    success: true,
    profileConfigured: true,
    hasNickname: true,
    hasTermsConsent: true,
    user: {
      id: auth.user.id,
      email: auth.user.email,
      nickname: updatedProfile?.public_nickname ?? existingProfile.public_nickname,
    },
  });
}
