import { describe, expect, it } from "vitest";
import { __testables } from "./index";

describe("community maintenance worker", () => {
  it("UTC 날짜 경계에서도 KST 실행일을 사용한다", () => {
    expect(__testables.koreaRunKey(new Date("2026-08-21T18:30:00.000Z"))).toBe("2026-08-22");
  });

  it("수동 실행은 일치하는 Bearer 토큰에서만 허용한다", () => {
    const env = { MANUAL_RUN_TOKEN: "test-token" } as never;
    expect(__testables.authorized(new Request("https://worker.example/internal/run", { headers: { Authorization: "Bearer test-token" } }), env)).toBe(true);
    expect(__testables.authorized(new Request("https://worker.example/internal/run", { headers: { Authorization: "Bearer wrong" } }), env)).toBe(false);
  });
});
