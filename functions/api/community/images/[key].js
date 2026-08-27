import { errorResponse } from "../_lib/api-security";

const KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i;

export async function onRequestGet(context) {
  const key = context.params.key;
  if (!key || typeof key !== "string" || !KEY_PATTERN.test(key)) {
    return errorResponse(404, "NOT_FOUND", "이미지를 찾을 수 없습니다.");
  }

  if (context.env && context.env.COMMUNITY_IMAGES && context.env.COMMUNITY_IMAGES.get) {
    const object = await context.env.COMMUNITY_IMAGES.get(key);
    if (!object) {
      return errorResponse(404, "NOT_FOUND", "이미지를 찾을 수 없습니다.");
    }

    const headers = new Headers();
    headers.set("Content-Type", "image/webp");
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("ETag", object.httpEtag || key);

    return new Response(object.body, { headers });
  }

  return errorResponse(404, "NOT_FOUND", "이미지 저장소를 사용할 수 없습니다.");
}
