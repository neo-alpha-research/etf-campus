import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type { LearningExampleType, ScenarioBasis } from "./learning-content";

export type Briefing = {
  date: string;
  title: string;
  summary: string;
  content: string;
  contentRole: "learning-example";
  exampleType: LearningExampleType;
  scenarioBasis: ScenarioBasis;
  asOf: string;
  sources: string;
  isLearningExample: true;
};

const BRIEFING_DIRECTORY = path.join(process.cwd(), "content", "briefings");
const EXAMPLE_MARKER = "[LEARNING_EXAMPLE]";
const FILE_PATTERN = /^\[LEARNING_EXAMPLE\]_(\d{4}-\d{2}-\d{2})\.md$/;
const EXAMPLE_TYPES = new Set<LearningExampleType>(["reading-path", "scenario", "briefing-reading-guide"]);
const SCENARIO_BASES = new Set<ScenarioBasis>(["fictional", "historical-source-verified"]);

function required(metadata: Record<string, string>, key: string, filename: string) {
  const value = metadata[key]?.trim();
  if (!value) throw new Error(`${filename}: ${key} 값이 필요합니다.`);
  return value;
}

function parseBriefing(filename: string): Briefing {
  const match = filename.match(FILE_PATTERN);
  if (!match) throw new Error(`브리핑 파일명이 학습용 예시 규칙과 다릅니다: ${filename}`);
  const normalized = readFileSync(path.join(BRIEFING_DIRECTORY, filename), "utf8").replace(/\r\n/g, "\n").trim();
  const opening = `${EXAMPLE_MARKER}\n---\n`;
  if (!normalized.startsWith(opening)) throw new Error(`${filename}: 첫 줄에 ${EXAMPLE_MARKER} 표시가 없습니다.`);
  const closing = normalized.indexOf("\n---\n", opening.length);
  if (closing < 0) throw new Error(`${filename}: frontmatter 닫는 구분선이 없습니다.`);

  const metadata = Object.fromEntries(normalized.slice(opening.length, closing).split("\n").filter(Boolean).map((line) => {
    const separator = line.indexOf(":");
    if (separator < 1) throw new Error(`${filename}: 잘못된 frontmatter 항목입니다.`);
    return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
  }));

  if (required(metadata, "contentRole", filename) !== "learning-example") throw new Error(`${filename}: contentRole은 learning-example이어야 합니다.`);
  const exampleType = required(metadata, "exampleType", filename) as LearningExampleType;
  if (!EXAMPLE_TYPES.has(exampleType)) throw new Error(`${filename}: 허용되지 않은 exampleType입니다.`);
  const scenarioBasis = required(metadata, "scenarioBasis", filename) as ScenarioBasis;
  if (!SCENARIO_BASES.has(scenarioBasis)) throw new Error(`${filename}: 허용되지 않은 scenarioBasis입니다.`);
  const asOf = required(metadata, "asOf", filename);
  if (asOf !== "not-applicable" && !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error(`${filename}: asOf는 YYYY-MM-DD 또는 not-applicable이어야 합니다.`);
  const sources = required(metadata, "sources", filename);
  if (scenarioBasis === "historical-source-verified" && sources === "not-applicable") throw new Error(`${filename}: 검증된 과거 자료 예시에는 sources가 필요합니다.`);

  const content = normalized.slice(closing + 5).trim();
  const title = content.match(/^#\s+(.+)$/m)?.[1];
  if (!title) throw new Error(`${filename}: H1 제목이 없습니다.`);
  const summary = content.split("\n").map((line) => line.trim()).find((line) => line && !line.startsWith("#") && !line.startsWith(">")) ?? "";

  return { date: match[1], title, summary, content, contentRole: "learning-example", exampleType, scenarioBasis, asOf, sources, isLearningExample: true };
}

export function loadBriefings(): Briefing[] {
  return readdirSync(BRIEFING_DIRECTORY).filter((filename) => filename.endsWith(".md")).map(parseBriefing).sort((a, b) => b.date.localeCompare(a.date));
}

export function findBriefing(date: string): Briefing | undefined {
  return loadBriefings().find((briefing) => briefing.date === date);
}
