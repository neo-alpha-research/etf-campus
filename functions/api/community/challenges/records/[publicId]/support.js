import { authenticatedSupabase } from "../../../../_lib/supabase";
import { enforceDatabaseRateLimit } from "../../../../_lib/request-security";
import { errorResponse, jsonResponse } from "../../../../_lib/api-security";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function onRequestPost(context) {
  const publicId = context.params.publicId;
  if (!UUID_PATTERN.test(publicId ?? "")) return errorResponse(404, "NOT_FOUND", "학습 기록을 찾을 수 없습니다.");

  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;

  const rateLimitError = await enforceDatabaseRateLimit(context, "challenge-support", auth.user.id, 20, 600);
  if (rateLimitError) return rateLimitError;

  const { error } = await auth.client.rpc("support_community_challenge_record", { p_public_id: publicId });
  if (error) {
    if (error.message?.includes("cannot support own")) return errorResponse(403, "FORBIDDEN", "본인 기록에는 응원을 남길 수 없습니다.");
    if (error.message?.includes("record not found")) return errorResponse(404, "NOT_FOUND", "학습 기록을 찾을 수 없습니다.");
    return errorResponse(503, "UNAVAILABLE", "응원을 남기지 못했습니다.");
  }

  return jsonResponse({ supported: true }, 201);
}
