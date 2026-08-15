import { authenticatedSupabase } from "../_lib/supabase";
import { parseJsonBody } from "../_lib/request-security";
import { errorResponse, jsonResponse } from "../../../../lib/community/api-security";
import { CommunityValidationError, validateNickname } from "../../../../lib/community/contracts";

export async function onRequestGet(context) {
  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;

  const { data, error } = await auth.client
    .from("user_profiles")
    .select("public_nickname, interest_account_type, investment_experience")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (error) {
    console.error("community profile fetch failed", error.message);
    return errorResponse(503, "UNAVAILABLE", "프로필 정보를 불러올 수 없습니다.");
  }

  return jsonResponse({
    profileConfigured: Boolean(data?.public_nickname),
    profile: data
      ? {
        nickname: data.public_nickname,
        interestAccountType: data.interest_account_type,
        investmentExperience: data.investment_experience,
      }
      : null,
  });
}

export async function onRequestPost(context) {
  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;
  const payload = await parseJsonBody(context.request);

  try {
    const nickname = validateNickname(payload?.nickname);
    const interestAccountType = ["dc", "irp", "pension_savings", "general", "none"].includes(payload?.interestAccountType)
      ? payload.interestAccountType
      : null;
    const investmentExperience = ["beginner", "intermediate", "experienced"].includes(payload?.investmentExperience)
      ? payload.investmentExperience
      : null;

    const { data, error } = await auth.client.rpc("bootstrap_community_profile", {
      p_public_nickname: nickname,
      p_interest_account_type: interestAccountType,
      p_investment_experience: investmentExperience,
    });
    if (error) {
      if (error.code === "23505") {
        return errorResponse(400, "VALIDATION_ERROR", "이미 사용 중인 닉네임입니다.");
      }
      throw error;
    }

    const result = Array.isArray(data) ? data[0] : data;
    return jsonResponse({
      profileConfigured: true,
      profile: {
        nickname: result?.public_nickname ?? nickname,
        role: result?.role ?? "member",
      },
    }, 201);
  } catch (error) {
    if (error instanceof CommunityValidationError) {
      return errorResponse(400, "VALIDATION_ERROR", error.message);
    }
    console.error("community profile bootstrap failed", error instanceof Error ? error.message : "unknown");
    return errorResponse(503, "UNAVAILABLE", "프로필을 저장할 수 없습니다.");
  }
}
