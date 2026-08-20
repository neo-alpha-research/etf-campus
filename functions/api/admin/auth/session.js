import { requirePermission } from "../../../_shared/rbac.js";

export async function onRequestGet(context) {
  const auth = await requirePermission(context.request, context.env, null);
  if (auth.error) {
    return auth.error;
  }
  return Response.json({ success: true, userId: auth.userId });
}
