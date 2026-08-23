import { authenticatedSupabase } from "../../_lib/supabase";
import { errorResponse, jsonResponse } from "../../_lib/api-security";
import { parseJsonBody } from "../../_lib/request-security";

export async function onRequestPost(context) {
  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;

  const { data: roleData, error: roleError } = await auth.supabase.rpc('current_community_role');
  if (roleError || roleData !== 'admin') {
    return errorResponse(403, "FORBIDDEN", "관리자만 접근할 수 있습니다.");
  }

  const payload = await parseJsonBody(context.request);
  if (!payload || !payload.participant_id || !payload.cohort_id || !payload.day_number || !payload.status) {
    return errorResponse(400, "BAD_REQUEST", "필수 파라미터 누락");
  }

  // Because the RPC needs profile_id, we fetch the profile_id first.
  const { data: participant, error: pError } = await auth.supabase
    .from('community_challenge_participants')
    .select('profile_id')
    .eq('id', payload.participant_id)
    .single();

  if (pError || !participant) {
    return errorResponse(404, "NOT_FOUND", "참가자를 찾을 수 없습니다.");
  }

  const { error } = await auth.supabase.rpc('admin_override_challenge_judgment', {
    p_participant_profile_id: participant.profile_id,
    p_cohort_id: payload.cohort_id,
    p_day_number: payload.day_number,
    p_new_status: payload.status
  });

  if (error) {
    return errorResponse(500, "INTERNAL_ERROR", error.message);
  }

  return jsonResponse({ success: true });
}
