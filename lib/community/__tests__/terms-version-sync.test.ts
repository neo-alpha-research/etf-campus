import { describe, expect, it } from "vitest";
import {
  CURRENT_TERMS_VERSION as CLIENT_TERMS_VERSION,
  SUPPORTED_TERMS_VERSIONS as CLIENT_SUPPORTED_VERSIONS,
} from "../contracts";
import {
  CURRENT_TERMS_VERSION as SERVER_TERMS_VERSION,
  SUPPORTED_TERMS_VERSIONS as SERVER_SUPPORTED_VERSIONS,
} from "../../../functions/api/community/_lib/contracts";

describe("약관 버전 SSOT(Single Source of Truth) 동기화 검증", () => {
  it("클라이언트와 서버의 공인 약관 버전(CURRENT_TERMS_VERSION)이 완벽히 일치해야 한다", () => {
    expect(typeof CLIENT_TERMS_VERSION).toBe("string");
    expect(CLIENT_TERMS_VERSION.length).toBeGreaterThan(0);
    expect(CLIENT_TERMS_VERSION).toBe(SERVER_TERMS_VERSION);
  });

  it("클라이언트와 서버의 지원 약관 버전 목록(SUPPORTED_TERMS_VERSIONS)이 서로 동기화되어 있어야 한다", () => {
    expect(CLIENT_SUPPORTED_VERSIONS).toContain(SERVER_TERMS_VERSION);
    expect(SERVER_SUPPORTED_VERSIONS).toContain(CLIENT_TERMS_VERSION);
  });
});
