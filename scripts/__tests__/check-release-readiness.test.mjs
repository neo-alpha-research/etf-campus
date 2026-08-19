import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { validateReleaseContent } from "../check-release-readiness.mjs";

const temporaryRoots = [];

function makeContentRoot() {
  const root = mkdtempSync(path.join(os.tmpdir(), "etf-campus-release-"));
  temporaryRoots.push(root);
  mkdirSync(path.join(root, "guides"));
  return root;
}

function writeLearningExample(root, filename = "[LEARNING_EXAMPLE]_risk-check.mdx", overrides = "") {
  writeFileSync(path.join(root, "guides", filename), `[LEARNING_EXAMPLE]\n---\ncontentRole: learning-example\nexampleType: scenario\nscenarioBasis: fictional\nasOf: not-applicable\nsources: not-applicable\n---\n# 위험 확인 예시\n\n이 콘텐츠는 학습용 예시이며 투자 권유가 아닙니다.\n${overrides}`);
}

afterEach(() => {
  temporaryRoots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
});

describe("release readiness content gate", () => {
  it("accepts a complete learning example", () => {
    const root = makeContentRoot();
    writeLearningExample(root);
    expect(validateReleaseContent(root)).toEqual({ errors: [], learningExamples: ["guides/[LEARNING_EXAMPLE]_risk-check.mdx"] });
  });

  it("blocks a legacy SAMPLE marker", () => {
    const root = makeContentRoot();
    writeFileSync(path.join(root, "guides", "[SAMPLE]_legacy.mdx"), "[SAMPLE]\nlegacy");
    expect(validateReleaseContent(root).errors.join(" ")).toContain("레거시 SAMPLE");
  });

  it("blocks learning examples without the required user-facing notice", () => {
    const root = makeContentRoot();
    writeLearningExample(root, "[LEARNING_EXAMPLE]_missing-notice.mdx", "");
    writeFileSync(path.join(root, "guides", "[LEARNING_EXAMPLE]_missing-notice.mdx"), `[LEARNING_EXAMPLE]\n---\ncontentRole: learning-example\nexampleType: scenario\nscenarioBasis: fictional\nasOf: not-applicable\nsources: not-applicable\n---\n# 위험 확인 예시\n\n확인 기준을 연습합니다.\n`);
    expect(validateReleaseContent(root).errors.join(" ")).toContain("학습용 예시 고지");
  });
});
