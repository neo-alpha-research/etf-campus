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

export type BookStatus = "published" | "coming-soon";

export type Book = LearningExampleMetadata & {
  kind: "book";
  slug: string;
  title: string;
  summary: string;
  reader: string;
  topic: string;
  status?: BookStatus;
  seriesIndex?: number;
  coverImage?: string;
  affiliateUrl?: string;
  content: string;
};

export const EXTERNAL_BOOK_CATEGORIES = ["초보·입문", "연금·절세", "배당·현금흐름"] as const;
export type ExternalBookCategory = typeof EXTERNAL_BOOK_CATEGORIES[number];

export const BOOK_COVER_BASE_PATH = "/images/books";

export type ExternalBook = LearningExampleMetadata & {
  kind: "external-book";
  slug: string;
  title: string;
  author: string;
  publisher: string;
  category: ExternalBookCategory;
  tags: string[];
  rating: number;
  aladinRating?: number;
  yes24Rating?: number;
  kyoboRating?: number;
  reviewCount: number;
  ratingSource: string;
  shortTargetTag?: string;
  targetPersona?: string;
  targetRationale?: string;
  irpEligible: boolean;
  originalPrice?: number;
  discountPrice?: number;
  oneLineReview: string;
  summary: string;
  pros: string[];
  cons: string[];
  coverImage?: string;
  affiliateUrl?: string;
  relatedInternalLink?: string;
  backtestTicker?: string;
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

function findMetadataValue(metadata: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    if (metadata[key] !== undefined && metadata[key].trim() !== "") {
      return metadata[key].trim();
    }
  }
  return undefined;
}

function requiredWithAliases(metadata: Record<string, string>, keys: string[], filename: string): string {
  const value = findMetadataValue(metadata, keys);
  if (!value) throw new Error(`${filename}: ${keys.join(" 또는 ")} 값이 필요합니다.`);
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

function readFiles(directory: "guides" | "books" | "external-books") {
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
  return readFiles("books").map(({ filename, slug, metadata, content }) => {
    const rawStatus = findMetadataValue(metadata, ["status"]);
    const status: BookStatus = rawStatus === "coming-soon" ? "coming-soon" : "published";
    const rawSeriesIndex = findMetadataValue(metadata, ["seriesIndex", "series_index"]);
    const seriesIndex = rawSeriesIndex ? Number(rawSeriesIndex) : undefined;
    const coverImage = resolveBookCoverUrl(findMetadataValue(metadata, ["coverImage", "cover_image"])) ?? undefined;

    return {
      kind: "book" as const,
      slug,
      title: required(metadata, "title", filename),
      summary: required(metadata, "summary", filename),
      reader: required(metadata, "reader", filename),
      topic: required(metadata, "topic", filename),
      status,
      seriesIndex,
      coverImage,
      affiliateUrl: metadata.affiliateUrl || undefined,
      content,
      ...learningExampleMetadata(metadata, filename),
    };
  }).sort((a, b) => {
    if (a.seriesIndex !== undefined && b.seriesIndex !== undefined) {
      return a.seriesIndex - b.seriesIndex;
    }
    if (a.seriesIndex !== undefined) return -1;
    if (b.seriesIndex !== undefined) return 1;
    return 0;
  });
}

export function loadExternalBooks(): ExternalBook[] {
  return readFiles("external-books").map(({ filename, slug, metadata, content }) => {
    const rawCategory = requiredWithAliases(metadata, ["category"], filename);
    if (!EXTERNAL_BOOK_CATEGORIES.includes(rawCategory as ExternalBookCategory)) {
      throw new Error(`${filename}: 유효하지 않은 도서 카테고리('${rawCategory}')입니다. 허용된 카테고리: ${EXTERNAL_BOOK_CATEGORIES.join(", ")}`);
    }
    const category = rawCategory as ExternalBookCategory;

    const rawRating = requiredWithAliases(metadata, ["rating"], filename);
    const rating = Number(rawRating);
    if (isNaN(rating) || rating < 0 || rating > 5) {
      throw new Error(`${filename}: 평점(rating)은 0.0에서 5.0 사이의 숫자여야 합니다. (입력값: ${rawRating})`);
    }

    const rawReviewCount = requiredWithAliases(metadata, ["reviewCount", "review_count"], filename);
    const reviewCount = Number(rawReviewCount);
    if (isNaN(reviewCount) || reviewCount < 0 || !Number.isInteger(reviewCount)) {
      throw new Error(`${filename}: 리뷰 수(reviewCount)는 0 이상의 정수여야 합니다. (입력값: ${rawReviewCount})`);
    }

    const rawIrp = requiredWithAliases(metadata, ["irpEligible", "irp_eligible"], filename).toLowerCase();
    if (!["true", "false", "yes", "no"].includes(rawIrp)) {
      throw new Error(`${filename}: irpEligible은 true 또는 false여야 합니다. (입력값: ${rawIrp})`);
    }
    const irpEligible = rawIrp === "true" || rawIrp === "yes";

    const tags = list(requiredWithAliases(metadata, ["tags"], filename));
    const pros = list(requiredWithAliases(metadata, ["pros"], filename));
    const cons = list(requiredWithAliases(metadata, ["cons"], filename));
    if (pros.length === 0) throw new Error(`${filename}: 장점(pros)이 1개 이상 필요합니다.`);
    if (cons.length === 0) throw new Error(`${filename}: 단점(cons)이 1개 이상 필요합니다.`);

    const backtestTicker = findMetadataValue(metadata, ["backtestTicker", "backtest_ticker"]);
    if (backtestTicker && !/^\d{6}$/.test(backtestTicker)) {
      throw new Error(`${filename}: backtestTicker는 6자리 숫자여야 합니다. (입력값: ${backtestTicker})`);
    }

    return {
      kind: "external-book",
      slug,
      title: requiredWithAliases(metadata, ["title"], filename),
      author: requiredWithAliases(metadata, ["author"], filename),
      publisher: requiredWithAliases(metadata, ["publisher"], filename),
      category,
      tags,
      rating,
      aladinRating: findMetadataValue(metadata, ["aladinRating", "aladin_rating"]) ? Number(findMetadataValue(metadata, ["aladinRating", "aladin_rating"])) : undefined,
      yes24Rating: findMetadataValue(metadata, ["yes24Rating", "yes24_rating"]) ? Number(findMetadataValue(metadata, ["yes24Rating", "yes24_rating"])) : undefined,
      kyoboRating: findMetadataValue(metadata, ["kyoboRating", "kyobo_rating"]) ? Number(findMetadataValue(metadata, ["kyoboRating", "kyobo_rating"])) : undefined,
      reviewCount,
      ratingSource: requiredWithAliases(metadata, ["ratingSource", "rating_source"], filename),
      shortTargetTag: findMetadataValue(metadata, ["shortTargetTag", "short_target_tag"]),
      targetPersona: findMetadataValue(metadata, ["targetPersona", "target_persona"]),
      targetRationale: findMetadataValue(metadata, ["targetRationale", "target_rationale"]),
      irpEligible,
      originalPrice: findMetadataValue(metadata, ["originalPrice", "original_price"]) ? Number(findMetadataValue(metadata, ["originalPrice", "original_price"])) : undefined,
      discountPrice: findMetadataValue(metadata, ["discountPrice", "discount_price"]) ? Number(findMetadataValue(metadata, ["discountPrice", "discount_price"])) : undefined,
      oneLineReview: requiredWithAliases(metadata, ["oneLineReview", "one_line_review"], filename),
      summary: requiredWithAliases(metadata, ["summary"], filename),
      pros,
      cons,
      coverImage: resolveBookCoverUrl(findMetadataValue(metadata, ["coverImage", "cover_image"])) ?? undefined,
      affiliateUrl: findMetadataValue(metadata, ["affiliateUrl", "affiliate_url"]),
      relatedInternalLink: findMetadataValue(metadata, ["relatedInternalLink", "related_internal_link"]),
      backtestTicker,
      content,
      ...learningExampleMetadata(metadata, filename),
    };
  });
}

export function resolveBookCoverUrl(coverImage?: string): string | null {
  if (!coverImage || coverImage.trim() === "") return null;
  let trimmed = coverImage.trim();
  if (trimmed.includes("image.aladin.co.kr")) {
    trimmed = trimmed.replace("/coversum/", "/cover500/").replace("/cover200/", "/cover500/");
  }
  if (trimmed.startsWith("/") || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `${BOOK_COVER_BASE_PATH}/${trimmed.replace(/^\/+/, "")}`;
}

export function findGuide(slug: string) { return loadGuides().find((guide) => guide.slug === slug); }
export function findBook(slug: string) { return loadBooks().find((book) => book.slug === slug); }
export function findExternalBook(slug: string) { return loadExternalBooks().find((book) => book.slug === slug); }
