import { authenticatedSupabase } from "../_lib/supabase";
import { parseJsonBody } from "../_lib/request-security";
import { errorResponse, jsonResponse } from "../_lib/api-security";
import { CommunityValidationError, validateSignupInput } from "../_lib/contracts";

export async function onRequestGet(context) {
  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;

  const { data, error } = await auth.client.rpc("get_community_profile");
  if (error) return errorResponse(503, "UNAVAILABLE", "프로필 정보를 불러오지 못했습니다.");

  const profile = Array.isArray(data) ? data[0] : data;

  const hasNickname = Boolean(
    profile?.public_nickname &&
    typeof profile.public_nickname === "string" &&
    profile.public_nickname.trim().length >= 2
  );
  const hasTermsConsent = Boolean(
    profile?.terms_version &&
    typeof profile.terms_version === "string" &&
    profile.terms_version.trim().length > 0
  );

  return jsonResponse({
    profileConfigured: hasNickname && hasTermsConsent,
    hasNickname,
    hasTermsConsent,
    profile: profile
      ? {
          nickname: profile.public_nickname,
          interestAccountType: profile.interest_account_type,
          investmentExperience: profile.investment_experience,
          ageBand: profile.age_band,
          marketingConsent: profile.marketing_consent,
          termsVersion: profile.terms_version,
        }
      : null,
  });
}

export async function onRequestPost(context) {
  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;
  const payload = await parseJsonBody(context.request);

  try {
    const signupData = validateSignupInput(payload);

    const { data, error } = await auth.client.rpc("bootstrap_community_profile", {
      p_public_nickname: signupData.nickname,
      p_terms_version: signupData.termsVersion,
      p_marketing_consent: signupData.agreedToMarketing,
      p_signup_utm_source: signupData.utmSource,
      p_signup_utm_medium: signupData.utmMedium,
      p_signup_utm_campaign: signupData.utmCampaign,
    });

    if (error) {
      return error.code === "23505"
        ? errorResponse(400, "VALIDATION_ERROR", "이미 사용 중인 닉네임입니다.")
        : errorResponse(503, "UNAVAILABLE", "프로필을 저장하지 못했습니다.");
    }

    const profile = Array.isArray(data) ? data[0] : data;
    return jsonResponse({
      profileConfigured: true,
      profile: {
        nickname: profile?.public_nickname ?? signupData.nickname,
        role: profile?.role ?? "member",
      },
    }, 201);
  } catch (error) {
    return error instanceof CommunityValidationError
      ? errorResponse(400, "VALIDATION_ERROR", error.message)
      : errorResponse(503, "UNAVAILABLE", "프로필을 저장하지 못했습니다.");
  }
}

export async function onRequestPatch(context) {
  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;
  const payload = await parseJsonBody(context.request);

  try {
    const updateData = {};
    if (payload.ageBand !== undefined) {
      updateData.age_band = payload.ageBand === "" ? null : payload.ageBand;
    }
    if (payload.interestAccountType !== undefined) {
      updateData.interest_account_type = payload.interestAccountType === "" ? null : payload.interestAccountType;
    }
    if (payload.marketingConsent !== undefined) {
      updateData.marketing_consent = Boolean(payload.marketingConsent);
    }

    if (Object.keys(updateData).length === 0) {
      return jsonResponse({ success: true });
    }

    const { error } = await auth.client.rpc("update_community_profile_fields", {
      p_updates: updateData
    });

    if (error) {
      return errorResponse(503, "UNAVAILABLE", "프로필을 업데이트하지 못했습니다.");
    }

    return jsonResponse({ success: true });
  } catch {
    return errorResponse(500, "INTERNAL_ERROR", "서버 오류가 발생했습니다.");
  }
}
