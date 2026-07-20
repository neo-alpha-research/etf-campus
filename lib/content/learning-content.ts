import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { ASSET_CLASSES, type AssetClass } from "@/lib/domain/etf-types";
import { STYLE_PROFILES, type StyleId } from "@/lib/onboarding/style-diagnosis";

export type Guide = {
  kind: "guide";
  slug: string;
  title: string;
  summary: string;
  level: string;
  readMinutes: number;
  styles: StyleId[];
  assetClasses: AssetClass[];
  content: string;
  isSample: boolean;
};

export type Book = {
  kind: "book";
  slug: string;
  title: string;
  summary: string;
  reader: string;
  topic: string;
  affiliateUrl?: string;
  content: string;
  isSample: boolean;
};

const CONTENT_ROOT = path.join(process.cwd(), "content");
const FILE_PATTERN = /^(\[SAMPLE\]_)?([a-z0-9-]+)\.mdx$/;

function splitFrontmatter(source: string, filename: string) {
  if (!source.startsWith("[SAMPLE]\n---\n") && !source.startsWith("[SAMPLE]\r\n---\r\n")) {
    throw new Error(`${filename}: 샘플 콘텐츠 첫 줄에 [SAMPLE] 표시가 필요합니다.`);
  }
  const normalized = source.replace(/\r\n/g, "\n");
  const closing = normalized.indexOf("\n---\n", "[SAMPLE]\n---\n".length);
  if (closing < 0) throw new Error(`${filename}: frontmatter 닫는 구분선이 없습니다.`);
  const metadata = Object.fromEntries(normalized.slice(13, closing).split("\n").filter(Boolean).map((line) => {
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

function readFiles(directory: "guides" | "books") {
  const fullPath = path.join(CONTENT_ROOT, directory);
  return readdirSync(fullPath).filter((filename) => filename.endsWith(".mdx")).map((filename) => {
    const match = filename.match(FILE_PATTERN);
    if (!match) throw new Error(`${filename}: 콘텐츠 파일명 규칙과 다릅니다.`);
    if (!match[1]) throw new Error(`${filename}: 샘플 파일명에 [SAMPLE]_ 표시가 필요합니다.`);
    const parsed = splitFrontmatter(readFileSync(path.join(fullPath, filename), "utf8"), filename);
    return { filename, slug: match[2], ...parsed };
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
      isSample: true,
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
    isSample: true,
  }));
}

export function findGuide(slug: string) { return loadGuides().find((guide) => guide.slug === slug); }
export function findBook(slug: string) { return loadBooks().find((book) => book.slug === slug); }
