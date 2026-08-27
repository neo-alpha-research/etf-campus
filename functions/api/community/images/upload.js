import { authenticatedSupabase } from "../_lib/supabase";
import { enforceDatabaseRateLimit } from "../_lib/request-security";
import { errorResponse, jsonResponse } from "../_lib/api-security";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export async function onRequestPost(context) {
  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;

  const rateLimitError = await enforceDatabaseRateLimit(context, "image-upload", auth.user.id, 10, 60);
  if (rateLimitError) return rateLimitError;

  let imageBuffer;
  const contentType = context.request.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await context.request.formData();
      const file = formData.get("file") || formData.get("image");
      if (!file || typeof file === "string") {
        return errorResponse(400, "INVALID_FILE", "업로드할 이미지 파일이 없습니다.");
      }
      imageBuffer = await file.arrayBuffer();
    } else {
      imageBuffer = await context.request.arrayBuffer();
    }

    if (!imageBuffer || imageBuffer.byteLength === 0) {
      return errorResponse(400, "EMPTY_FILE", "이미지 파일 데이터가 비어 있습니다.");
    }

    if (imageBuffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
      return errorResponse(400, "FILE_TOO_LARGE", "업로드 이미지 크기는 5MB 이하여야 합니다.");
    }

    const key = crypto.randomUUID() + ".webp";

    if (context.env && context.env.COMMUNITY_IMAGES && context.env.COMMUNITY_IMAGES.put) {
      await context.env.COMMUNITY_IMAGES.put(key, imageBuffer, {
        httpMetadata: {
          contentType: "image/webp",
        },
      });
    }

    const publicBaseUrl = (context.env && context.env.COMMUNITY_IMAGES_PUBLIC_URL) || "/api/community/images";
    const url = publicBaseUrl.replace(/\/$/, "") + "/" + key;

    return jsonResponse({
      url,
      key,
      size: imageBuffer.byteLength,
    }, 201);
  } catch (error) {
    return errorResponse(500, "UPLOAD_FAILED", "이미지 업로드 처리에 실패했습니다.");
  }
}
