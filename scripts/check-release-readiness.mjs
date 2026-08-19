import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LEGACY_MARKER = "[SAMPLE]";
const EXAMPLE_MARKER = "[LEARNING_EXAMPLE]";
const EXAMPLE_FILE_PATTERN = /^\[LEARNING_EXAMPLE\]_[a-z0-9-]+\.(md|mdx)$/;
const EXAMPLE_TYPES = new Set(["reading-path", "scenario", "briefing-reading-guide"]);
const SCENARIO_BASES = new Set(["fictional", "historical-source-verified"]);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function parseLearningExample(source, relativePath, errors) {
  const normalized = source.replace(/\r\n/g, "\n");
  const opening = `${EXAMPLE_MARKER}\n---\n`;
  if (!normalized.startsWith(opening)) {
    errors.push(`${relativePath}: 첫 줄에 ${EXAMPLE_MARKER} 표시가 필요합니다.`);
    return;
  }

  const closing = normalized.indexOf("\n---\n", opening.length);
  if (closing < 0) {
    errors.push(`${relativePath}: frontmatter 닫는 구분선이 없습니다.`);
    return;
  }

  const metadata = Object.fromEntries(normalized.slice(opening.length, closing).split("\n").filter(Boolean).map((line) => {
    const separator = line.indexOf(":");
    return separator < 1 ? [line, ""] : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
  }));

  const required = ["contentRole", "exampleType", "scenarioBasis", "asOf", "sources"];
  required.forEach((key) => {
    if (!metadata[key]) errors.push(`${relativePath}: ${key} 메타데이터가 필요합니다.`);
  });
  if (metadata.contentRole && metadata.contentRole !== "learning-example") errors.push(`${relativePath}: contentRole은 learning-example이어야 합니다.`);
  if (metadata.exampleType && !EXAMPLE_TYPES.has(metadata.exampleType)) errors.push(`${relativePath}: 허용되지 않은 exampleType입니다.`);
  if (metadata.scenarioBasis && !SCENARIO_BASES.has(metadata.scenarioBasis)) errors.push(`${relativePath}: 허용되지 않은 scenarioBasis입니다.`);
  if (metadata.asOf && metadata.asOf !== "not-applicable" && !/^\d{4}-\d{2}-\d{2}$/.test(metadata.asOf)) errors.push(`${relativePath}: asOf는 YYYY-MM-DD 또는 not-applicable이어야 합니다.`);
  if (metadata.scenarioBasis === "historical-source-verified" && metadata.sources === "not-applicable") errors.push(`${relativePath}: 검증된 과거 자료 예시에는 sources가 필요합니다.`);

  const body = normalized.slice(closing + 5);
  const hasNonRecommendationNotice = body.includes("투자 권유") || body.includes("매수·매도·보유를 권유하지");
  if (!body.includes("학습용 예시") || !hasNonRecommendationNotice) {
    errors.push(`${relativePath}: 이용자에게 보이는 학습용 예시 고지와 투자 권유 아님 안내가 필요합니다.`);
  }
}

export function validateReleaseContent(contentRoot) {
  const errors = [];
  const learningExamples = [];

  walk(contentRoot).forEach((filename) => {
    const relativePath = path.relative(contentRoot, filename).split(path.sep).join("/");
    const basename = path.basename(filename);
    const source = readFileSync(filename, "utf8");

    if (basename.startsWith(`${LEGACY_MARKER}_`) || source.startsWith(LEGACY_MARKER)) {
      errors.push(`${relativePath}: 레거시 SAMPLE 콘텐츠는 정식 학습용 예시로 전환하거나 제거해야 합니다.`);
      return;
    }

    if (basename.startsWith(`${EXAMPLE_MARKER}_`)) {
      learningExamples.push(relativePath);
      if (!EXAMPLE_FILE_PATTERN.test(basename)) {
        errors.push(`${relativePath}: 학습용 예시 파일명 규칙과 다릅니다.`);
        return;
      }
      parseLearningExample(source, relativePath, errors);
    }
  });

  return { errors, learningExamples: learningExamples.sort() };
}

function main() {
  const contentRoot = path.join(process.cwd(), "content");
  const { errors, learningExamples } = validateReleaseContent(contentRoot);
  if (errors.length) {
    console.error(`출시 차단: 콘텐츠 검증 오류 ${errors.length}건`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }
  console.log(`출시 콘텐츠 게이트 통과: 정식 학습용 예시 ${learningExamples.length}건을 검증했습니다.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
