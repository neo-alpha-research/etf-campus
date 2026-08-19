import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { ASSET_CLASSES, type AssetClass } from "@/lib/domain/etf-types";
import { STYLE_PROFILES, type StyleId } from "@/lib/onboarding/style-diagnosis";

export type LearningExampleType = "reading-path" | "scenario" | "briefing-reading-guide";
export type ScenarioBasis = "fictional" | "historical-source-verified";

type LearningExampleMetadata = {
  contentRole: "learning-example";
  exampleType: LearningExampleType;
  scenarioBasis: ScenarioBasis;
  asOf: string;
  sources: string;
  isLearningExample: true;
};

export type Guide = LearningExampleMetadata & {
  kind: "guide";
  slug: string;
  title: string;
  summary: string;
  level: string;
  readMinutes: number;
  styles: StyleId[];
  assetClasses: AssetClass[];
  content: string;
};

export type Book = LearningExampleMetadata & {
  kind: "book";
  slug: string;
  title: string;
  summary: string;
  reader: string;
  topic: string;
  affiliateUrl?: string;
  content: string;
};

const CONTENT_ROOT = path.join(process.cwd(), "content");
const EXAMPLE_MARKER = "[LEARNING_EXAMPLE]";
const FILE_PATTERN = /^\[LEARNING_EXAMPLE\]_([a-z0-9-]+)\.mdx$/;
const EXAMPLE_TYPES = new Set<LearningExampleType>(["reading-path", "scenario", "briefing-reading-guide"]);
const SCENARIO_BASES = new Set<ScenarioBasis>(["fictional", "historical-source-verified"]);

function splitFrontmatter(source: string, filename: string) {
  const normalized = source.replace(/\r\n/g, "\n");
  const opening = `${EXAMPLE_MARKER}\n---\n`;
  if (!normalized.startsWith(opening)) {
    throw new Error(`${filename}: 학습용 예시 첫 줄에 ${EXAMPLE_MARKER} 표시가 필요합니다.`);
  }
  const closing = normalized.indexOf("\n---\n", opening.length);
  if (closing < 0) throw new Error(`${filename}: frontmatter 닫는 구분선이 없습니다.`);
  const metadata = Object.fromEntries(normalized.slice(opening.length, closing).split("\n").filter(Boolean).map((line) => {
    const separator = line.indexOf(":");
    if (separator < 1) throw new Error(`${filename}: 잘못된 frontmatter 항목입니다.`);
    return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
  }));
  return { metadata, content: normalized.slice(closing + 5).trim() };
}

function required(metadata: Record<string, string>, key: string, filename: string) {
  const value = metadata[key]?.trim();
  if (!value) throw new Error(`${filename}: ${key} 값이 필요합니다.`);
  return value;
}

function list(value: string) {
  return value.split("|").map((item) => item.trim()).filter(Boolean);
}

function learningExampleMetadata(metadata: Record<string, string>, filename: string): LearningExampleMetadata {
  const contentRole = required(metadata, "contentRole", filename);
  if (contentRole !== "learning-example") throw new Error(`${filename}: contentRole은 learning-example이어야 합니다.`);

  const exampleType = required(metadata, "exampleType", filename) as LearningExampleType;
  if (!EXAMPLE_TYPES.has(exampleType)) throw new Error(`${filename}: 허용되지 않은 exampleType입니다.`);

  const scenarioBasis = required(metadata, "scenarioBasis", filename) as ScenarioBasis;
  if (!SCENARIO_BASES.has(scenarioBasis)) throw new Error(`${filename}: 허용되지 않은 scenarioBasis입니다.`);

  const asOf = required(metadata, "asOf", filename);
  if (asOf !== "not-applicable" && !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
    throw new Error(`${filename}: asOf는 YYYY-MM-DD 또는 not-applicable이어야 합니다.`);
  }

  const sources = required(metadata, "sources", filename);
  if (scenarioBasis === "historical-source-verified" && sources === "not-applicable") {
    throw new Error(`${filename}: 검증된 과거 자료 예시에는 sources가 필요합니다.`);
  }

  return { contentRole: "learning-example", exampleType, scenarioBasis, asOf, sources, isLearningExample: true };
}

function readFiles(directory: "guides" | "books") {
  const fullPath = path.join(CONTENT_ROOT, directory);
  return readdirSync(fullPath).filter((filename) => filename.endsWith(".mdx")).map((filename) => {
    const match = filename.match(FILE_PATTERN);
    if (!match) throw new Error(`${filename}: 학습용 예시 콘텐츠 파일명 규칙과 다릅니다.`);
    const parsed = splitFrontmatter(readFileSync(path.join(fullPath, filename), "utf8"), filename);
    return { filename, slug: match[1], ...parsed };
  });
}

export function loadGuides(): Guide[] {
  return readFiles("guides").map(({ filename, slug, metadata, content }) => {
    const styles = list(required(metadata, "styles", filename));
    const assetClasses = list(required(metadata, "assetClasses", filename));
    if (!styles.every((style) => Object.hasOwn(STYLE_PROFILES, style))) throw new Error(`${filename}: 알 수 없는 스타일이 있습니다.`);
    if (!assetClasses.every((asset) => ASSET_CLASSES.includes(asset as AssetClass))) throw new Error(`${filename}: 알 수 없는 자산군이 있습니다.`);
    return {
      kind: "guide",
      slug,
      title: required(metadata, "title", filename),
      summary: required(metadata, "summary", filename),
      level: required(metadata, "level", filename),
      readMinutes: Number(required(metadata, "readMinutes", filename)),
      styles: styles as StyleId[],
      assetClasses: assetClasses as AssetClass[],
      content,
      ...learningExampleMetadata(metadata, filename),
    };
  });
}

export function loadBooks(): Book[] {
  return readFiles("books").map(({ filename, slug, metadata, content }) => ({
    kind: "book",
    slug,
    title: required(metadata, "title", filename),
    summary: required(metadata, "summary", filename),
    reader: required(metadata, "reader", filename),
    topic: required(metadata, "topic", filename),
    affiliateUrl: metadata.affiliateUrl || undefined,
    content,
    ...learningExampleMetadata(metadata, filename),
  }));
}

export function findGuide(slug: string) { return loadGuides().find((guide) => guide.slug === slug); }
export function findBook(slug: string) { return loadBooks().find((book) => book.slug === slug); }
