import { authenticatedSupabase } from "../../../_lib/supabase";
import { errorResponse, jsonResponse } from "../../../_lib/api-security";

export async function onRequestGet(context) {
  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;

  const { data: roleData, error: roleError } = await auth.supabase.rpc('current_community_role');
  if (roleError || roleData !== 'admin') {
    return errorResponse(403, "FORBIDDEN", "관리자만 접근할 수 있습니다.");
  }

  const { data, error } = await auth.supabase
    .from('admin_community_challenge_dashboard')
    .select('*')
    .order('cohort_title', { ascending: false });

  if (error) {
    return errorResponse(500, "INTERNAL_ERROR", error.message);
  }

  return jsonResponse(data);
}
