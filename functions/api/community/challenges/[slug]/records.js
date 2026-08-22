import { authenticatedSupabase, publicSupabase } from "../../_lib/supabase";
import { enforceDatabaseRateLimit, parseJsonBody } from "../../_lib/request-security";
import { errorResponse, jsonResponse } from "../../_lib/api-security";
import { CommunityValidationError, validateChallengeRecord } from "../../_lib/contracts";

function validCohortSlug(value) {
  return typeof value === "string" && /^[a-z0-9-]{2,80}$/.test(value);
}

function recordError(error) {
  const message = error?.message ?? "";
  if (message.includes("active participant")) return errorResponse(403, "FORBIDDEN", "진행 중인 챌린지 참가자만 학습 기록을 남길 수 있습니다.");
  if (message.includes("record not found")) return errorResponse(404, "NOT_FOUND", "학습 기록을 찾을 수 없습니다.");
  return errorResponse(503, "UNAVAILABLE", "학습 기록을 처리하지 못했습니다.");
}

export async function onRequestGet(context) {
  const slug = context.params.slug;
  if (!validCohortSlug(slug)) return errorResponse(404, "NOT_FOUND", "챌린지 기수를 찾을 수 없습니다.");

  try {
    const limit = Math.min(Math.max(Number.parseInt(new URL(context.request.url).searchParams.get("limit") ?? "20", 10) || 20, 1), 30);
    const { data, error } = await publicSupabase(context.env).rpc("list_public_community_challenge_records", { p_cohort_slug: slug, p_limit: limit });
    if (error) throw error;
    return jsonResponse({ records: data ?? [] });
  } catch {
    return errorResponse(503, "UNAVAILABLE", "공개 학습 기록을 불러오지 못했습니다.");
  }
}

export async function onRequestPost(context) {
  const slug = context.params.slug;
  if (!validCohortSlug(slug)) return errorResponse(404, "NOT_FOUND", "챌린지 기수를 찾을 수 없습니다.");

  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;
  const payload = await parseJsonBody(context.request);

  try {
    const input = validateChallengeRecord(payload);
    const rateLimitError = await enforceDatabaseRateLimit(context, "challenge-record", auth.user.id, 20, 600);
    if (rateLimitError) return rateLimitError;

    const { data, error } = await auth.client.rpc("record_community_challenge_metric", {
      p_cohort_slug: slug,
      p_day_number: input.dayNumber,
      p_metric_key: input.metricKey,
      p_metric_value: input.metricValue,
      p_note: input.note,
      p_is_public: input.isPublic,
    });
    if (error) return recordError(error);

    const result = Array.isArray(data) ? data[0] : data;
    return jsonResponse({ publicId: result?.public_id, isPublic: result?.is_public === true }, 201);
  } catch (error) {
    return error instanceof CommunityValidationError
      ? errorResponse(400, "VALIDATION_ERROR", error.message)
      : recordError(error);
  }
}
