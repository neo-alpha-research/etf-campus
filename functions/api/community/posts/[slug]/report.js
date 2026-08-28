import { authenticatedSupabase } from "../../_lib/supabase";
import { enforceDatabaseRateLimit, parseJsonBody } from "../../_lib/request-security";
import { errorResponse, jsonResponse } from "../../_lib/api-security";
import { CommunityValidationError, validateCommunityReport } from "../../_lib/contracts";

function validSlug(value) {
  return typeof value === "string" && /^[a-z0-9-_]{2,128}$/i.test(value);
}

function reportRpcError(error) {
  const message = error?.message ?? "";
  if (message.includes("own content")) return errorResponse(400, "VALIDATION_ERROR", "본인이 작성한 게시물은 신고할 수 없습니다.");
  if (message.includes("member profile")) return errorResponse(403, "FORBIDDEN", "닉네임 설정을 완료한 인증 회원만 신고할 수 있습니다.");
  if (message.includes("target not found")) return errorResponse(404, "NOT_FOUND", "신고할 게시물을 찾을 수 없습니다.");
  return null;
}

export async function onRequestPost(context) {
  const slug = context.params.slug;
  if (!validSlug(slug)) return errorResponse(404, "NOT_FOUND", "신고할 게시물을 찾을 수 없습니다.");

  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;
  const payload = await parseJsonBody(context.request);

  try {
    const input = validateCommunityReport(payload);
    const rateLimitError = await enforceDatabaseRateLimit(context, "community-report-create", auth.user.id, 5, 600);
    if (rateLimitError) return rateLimitError;

    const { data, error } = await auth.client.rpc("create_community_report", {
      p_target_type: "post",
      p_target_reference: slug,
      p_reason_code: input.reasonCode,
      p_details: input.details,
    });
    if (error) return reportRpcError(error) ?? errorResponse(503, "UNAVAILABLE", "신고를 접수하지 못했습니다.");

    const report = Array.isArray(data) ? data[0] : data;
    return jsonResponse({ report: { id: report?.report_id, status: report?.status ?? "open" } }, 201);
  } catch (error) {
    return error instanceof CommunityValidationError
      ? errorResponse(400, "VALIDATION_ERROR", error.message)
      : errorResponse(503, "UNAVAILABLE", "신고를 접수하지 못했습니다.");
  }
}
