import { authenticatedSupabase } from "../_lib/supabase";
import { parseJsonBody } from "../_lib/request-security";
import { errorResponse, jsonResponse } from "../_lib/api-security";
import { CommunityValidationError, validateOnboardingInput } from "../_lib/contracts";

export async function onRequestPost(context) {
  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;
  const payload = await parseJsonBody(context.request);

  try {
    const { ageBand, interestAccountType } = validateOnboardingInput(payload);

    const { error } = await auth.client.rpc("update_community_profile_onboarding", {
      p_age_band: ageBand,
      p_interest_account_type: interestAccountType,
    });

    if (error) {
      return errorResponse(503, "UNAVAILABLE", "온보딩 정보를 저장하지 못했습니다.");
    }

    return jsonResponse({
      success: true,
    });
  } catch (err) {
    if (err instanceof CommunityValidationError) {
      return errorResponse(400, "VALIDATION_ERROR", err.message);
    }
    return errorResponse(500, "INTERNAL_ERROR", "서버 오류가 발생했습니다.");
  }
}
