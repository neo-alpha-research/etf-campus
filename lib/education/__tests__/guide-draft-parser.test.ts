import { describe, expect, it } from "vitest";

import {
  parseGuideDraft,
  loadGuideDraft,
  PART3_MARKER,
  PART4_MARKER,
} from "../guide-draft-parser";

describe("guide-draft-parser - Markdown Splitting & Fallbacks", () => {
  it("1. 정상 문서: Part 3와 Part 4 마커가 올바른 순서로 존재할 때 분리하며, 정적 체크리스트를 누락/중복 없이 제거한다", () => {
    const raw = `
# 도입부
본문 내용입니다.
${PART3_MARKER}
### [체크리스트 문항 및 확인 경로]
| 1 | 문항내용 |
${PART4_MARKER}
본문 출처 내용입니다.
`;
    const result = parseGuideDraft(raw);

    expect(result.topContent).toContain("# 도입부");
    expect(result.topContent).toContain("본문 내용입니다.");
    expect(result.topContent).not.toContain(PART3_MARKER);
    expect(result.topContent).not.toContain("문항내용"); // 정적 테이블 제외

    expect(result.bottomContent).toContain(PART4_MARKER);
    expect(result.bottomContent).toContain("본문 출처 내용입니다.");
  });

  it("2. 빈 문자열 또는 결측치: 파일이 비어있거나 올바르지 않을 때 안전한 안내 문구를 반환한다", () => {
    const emptyResult = parseGuideDraft("");
    expect(emptyResult.topContent).toContain("가이드 문서를 불러올 수 없습니다");
    expect(emptyResult.bottomContent).toBe("");

    // @ts-expect-error - testing invalid runtime input
    const nullResult = parseGuideDraft(null);
    expect(nullResult.topContent).toContain("가이드 문서를 불러올 수 없습니다");
    expect(nullResult.bottomContent).toBe("");
  });

  it("3. 마커 순서 역전 (Corrupted Order): Part 4가 Part 3보다 앞에 올 때 비정상 병합 없이 안전하게 폴백한다", () => {
    const corrupted = `
# 상단 내용
${PART4_MARKER}
중간 내용
${PART3_MARKER}
정적 체크리스트
`;
    const result = parseGuideDraft(corrupted);

    expect(result.topContent).toContain("# 상단 내용");
    expect(result.topContent).not.toContain(PART4_MARKER);
    expect(result.topContent).not.toContain("정적 체크리스트");
    expect(result.bottomContent).toBe("");
  });

  it("4. Part 4 마커 누락: Part 3 이후의 정적 체크리스트 테이블이 상단 본문에 누출되지 않는다", () => {
    const noPart4 = `
# 상단 내용
${PART3_MARKER}
### [체크리스트 문항 및 확인 경로]
| 1 | 정적문항 |
`;
    const result = parseGuideDraft(noPart4);

    expect(result.topContent).toContain("# 상단 내용");
    expect(result.topContent).not.toContain(PART3_MARKER);
    expect(result.topContent).not.toContain("정적문항");
    expect(result.bottomContent).toBe("");
  });

  it("5. Part 3 마커 누락: 정적 체크리스트 표가 포함되어 있어도 정규식 필터링을 통해 제거하고 Part 4를 보존한다", () => {
    const noPart3 = `
# 상단 내용
### [체크리스트 문항 및 확인 경로]
| 1 | 정적문항 |
${PART4_MARKER}
하단 출처
`;
    const result = parseGuideDraft(noPart3);

    expect(result.topContent).toContain("# 상단 내용");
    expect(result.topContent).not.toContain("정적문항");
    expect(result.bottomContent).toContain(PART4_MARKER);
    expect(result.bottomContent).toContain("하단 출처");
  });

  it("6. loadGuideDraft: 실제 파일 로드 및 존재하지 않는 파일 경로 시 예외 발생 없이 폴백", () => {
    // 1) Real file loading
    const realResult = loadGuideDraft();
    expect(realResult.topContent).toContain("PART 1 — ETF 비용 공시 읽기");
    expect(realResult.bottomContent).toContain("PART 4 — 출처, 시행일 및 적용 조건");

    // 2) Non-existent file path fallback
    const fallbackResult = loadGuideDraft("non-existent-path.md");
    expect(fallbackResult.topContent).toContain("가이드 문서를 불러올 수 없습니다");
    expect(fallbackResult.bottomContent).toBe("");
  });
});
