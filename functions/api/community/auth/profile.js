import { authenticatedSupabase } from "../_lib/supabase";
import { parseJsonBody } from "../_lib/request-security";
import { errorResponse, jsonResponse } from "../../../../lib/community/api-security";
import { CommunityValidationError, validateNickname } from "../../../../lib/community/contracts";

export async function onRequestGet(context) {
  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;
  const { data, error } = await auth.client.rpc("get_community_profile");
  if (error) return errorResponse(503, "UNAVAILABLE", "프로필 정보를 불러올 수 없습니다.");
  const profile = Array.isArray(data) ? data[0] : data;
  return jsonResponse({ profileConfigured: Boolean(profile?.public_nickname), profile: profile ? { nickname: profile.public_nickname, interestAccountType: profile.interest_account_type, investmentExperience: profile.investment_experience, role: profile.role } : null });
}

export async function onRequestPost(context) {
  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;
  const payload = await parseJsonBody(context.request);
  try {
    const nickname = validateNickname(payload?.nickname);
    const interestAccountType = ["dc", "irp", "pension_savings", "general", "none"].includes(payload?.interestAccountType) ? payload.interestAccountType : null;
    const investmentExperience = ["beginner", "intermediate", "experienced"].includes(payload?.investmentExperience) ? payload.investmentExperience : null;
    const { data, error } = await auth.client.rpc("bootstrap_community_profile", { p_public_nickname: nickname, p_interest_account_type: interestAccountType, p_investment_experience: investmentExperience });
    if (error) return error.code === "23505" ? errorResponse(400, "VALIDATION_ERROR", "이미 사용 중인 닉네임입니다.") : errorResponse(503, "UNAVAILABLE", "프로필을 저장할 수 없습니다.");
    const profile = Array.isArray(data) ? data[0] : data;
    return jsonResponse({ profileConfigured: true, profile: { nickname: profile?.public_nickname ?? nickname, role: profile?.role ?? "member" } }, 201);
  } catch (error) { return error instanceof CommunityValidationError ? errorResponse(400, "VALIDATION_ERROR", error.message) : errorResponse(503, "UNAVAILABLE", "프로필을 저장할 수 없습니다."); }
}
