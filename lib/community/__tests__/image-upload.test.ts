import { describe, expect, it } from "vitest";
import {
  validateImageFile,
  convertImageToWebp,
  MAX_ORIGINAL_SIZE_BYTES,
  ImageProcessingError,
} from "../image-upload";

describe("클라이언트 이미지 처리 유틸리티", () => {
  it("지원하지 않는 MIME 타입은 오류를 발생시킨다", () => {
    const file = new File(["dummy"], "test.txt", { type: "text/plain" });
    expect(() => validateImageFile(file)).toThrow(ImageProcessingError);
    expect(() => validateImageFile(file)).toThrowError(/지원하지 않는 이미지 형식/);
  });

  it("20MB를 초과하는 대용량 파일은 차단한다", () => {
    const file = new File(["x"], "large.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: MAX_ORIGINAL_SIZE_BYTES + 1 });
    expect(() => validateImageFile(file)).toThrowError(/20MB/);
  });

  it("정상 이미지 파일 유효성 검증을 통과한다", () => {
    const file = new File(["valid-data"], "photo.jpg", { type: "image/jpeg" });
    expect(() => validateImageFile(file)).not.toThrow();
  });

  it("convertImageToWebp는 WebP Blob을 반환한다", async () => {
    const file = new File(["valid-data"], "photo.png", { type: "image/png" });
    const blob = await convertImageToWebp(file);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/webp");
  });
});
