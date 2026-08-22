import { authenticatedSupabase, publicSupabase } from "../../_lib/supabase";
import { enforceDatabaseRateLimit, parseJsonBody } from "../../_lib/request-security";
import { errorResponse, jsonResponse } from "../../_lib/api-security";
import { CommunityValidationError, validateChallengeApplication } from "../../_lib/contracts";

function challengeError(error) {
  const message = error?.message ?? "";
  if (message.includes("community member profile")) return errorResponse(403, "FORBIDDEN", "닉네임 설정을 완료한 인증 회원만 참가 신청할 수 있습니다.");
  if (message.includes("cohort capacity")) return errorResponse(409, "CONFLICT", "이 기수는 정원이 마감되었습니다.");
  if (message.includes("cohort unavailable")) return errorResponse(409, "CONFLICT", "현재 참가 신청을 받을 수 없는 기수입니다.");
  return errorResponse(503, "UNAVAILABLE", "챌린지 요청을 처리하지 못했습니다.");
}

export async function onRequestGet(context) {
  try {
    const { data, error } = await publicSupabase(context.env).rpc("list_community_challenge_cohorts");
    if (error) throw error;
    return jsonResponse({ cohorts: data ?? [] });
  } catch {
    return errorResponse(503, "UNAVAILABLE", "챌린지 기수를 불러오지 못했습니다.");
  }
}

export async function onRequestPost(context) {
  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;
  const payload = await parseJsonBody(context.request);

  try {
    const input = validateChallengeApplication(payload);
    const rateLimitError = await enforceDatabaseRateLimit(context, "challenge-apply", auth.user.id, 3, 3600);
    if (rateLimitError) return rateLimitError;

    const { data, error } = await auth.client.rpc("apply_to_community_challenge", {
      p_cohort_slug: input.cohortSlug,
      p_interest_account_type: input.interestAccountType,
      p_learning_topic: input.learningTopic,
      p_goal_note: input.goalNote,
      p_private_record_consent_version: input.privateRecordConsentVersion,
    });
    if (error) return challengeError(error);

    const result = Array.isArray(data) ? data[0] : data;
    return jsonResponse({ cohortSlug: result?.cohort_slug, participantStatus: result?.participant_status ?? "applied" }, 201);
  } catch (error) {
    return error instanceof CommunityValidationError
      ? errorResponse(400, "VALIDATION_ERROR", error.message)
      : challengeError(error);
  }
}
