import fs from "node:fs";
import path from "node:path";

export interface ParsedGuideDraft {
  topContent: string;
  bottomContent: string;
}

export const PART3_MARKER = "## PART 3 — 확인 중심 자가 점검 체크리스트 (10문항)";
export const PART4_MARKER = "## PART 4 — 출처, 시행일 및 적용 조건 (Provenance SSOT)";

export function parseGuideDraft(raw: string): ParsedGuideDraft {
  if (!raw || typeof raw !== "string" || raw.trim().length === 0) {
    return {
      topContent: "# ETF 비용·계좌별 규칙 자가 점검 가이드\n\n가이드 문서를 불러올 수 없습니다.",
      bottomContent: "",
    };
  }

  const p3Index = raw.indexOf(PART3_MARKER);
  const p4Index = raw.indexOf(PART4_MARKER);

  // Normal expected case: both markers exist in proper chronological order
  if (p3Index !== -1 && p4Index !== -1 && p3Index < p4Index) {
    const top = raw.slice(0, p3Index).trim();
    const bottom = raw.slice(p4Index).trim();
    return {
      topContent: top,
      bottomContent: bottom,
    };
  }

  // Corrupted marker order: PART 4 appears before PART 3
  if (p3Index !== -1 && p4Index !== -1 && p3Index > p4Index) {
    const top = raw.slice(0, p4Index).trim();
    return {
      topContent: top,
      bottomContent: "",
    };
  }

  // PART 3 marker exists, but PART 4 is missing: drop static checklist table after Part 3
  if (p3Index !== -1 && p4Index === -1) {
    return {
      topContent: raw.slice(0, p3Index).trim(),
      bottomContent: "",
    };
  }

  // PART 4 marker exists, but PART 3 is missing
  if (p3Index === -1 && p4Index !== -1) {
    let topPart = raw.slice(0, p4Index);
    const staticChecklistRegex = /(?:###\s*\[?체크리스트\s*문항[\s\S]*?)(?=\n##|$)/;
    topPart = topPart.replace(staticChecklistRegex, "").trim();

    return {
      topContent: topPart,
      bottomContent: raw.slice(p4Index).trim(),
    };
  }

  // Fallback if neither marker is found: strip any static checklist table if present
  const staticChecklistRegex = /(?:###\s*\[?체크리스트\s*문항[\s\S]*?)(?=\n##|$)/;
  const sanitized = raw.replace(staticChecklistRegex, "").trim();

  return {
    topContent: sanitized,
    bottomContent: "",
  };
}

const DEFAULT_GUIDE_DRAFT_PATH = path.join(
  process.cwd(),
  "docs",
  "education",
  "etf-self-check-guide-draft.md"
);

export function loadGuideDraft(customPath?: string): ParsedGuideDraft {
  try {
    const raw = customPath
      ? fs.readFileSync(customPath, "utf-8")
      : fs.readFileSync(DEFAULT_GUIDE_DRAFT_PATH, "utf-8");
    return parseGuideDraft(raw);
  } catch {
    return {
      topContent: "# ETF 비용·계좌별 규칙 자가 점검 가이드\n\n가이드 문서를 불러올 수 없습니다.",
      bottomContent: "",
    };
  }
}
