import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export type Briefing = {
  date: string;
  title: string;
  summary: string;
  content: string;
  isSample: boolean;
};

const BRIEFING_DIRECTORY = path.join(process.cwd(), "content", "briefings");
const FILE_PATTERN = /^(\[SAMPLE\]_)?(\d{4}-\d{2}-\d{2})\.md$/;

function parseBriefing(filename: string): Briefing {
  const match = filename.match(FILE_PATTERN);
  if (!match) throw new Error(`브리핑 파일명이 규칙과 다릅니다: ${filename}`);
  const content = readFileSync(path.join(BRIEFING_DIRECTORY, filename), "utf8").trim();
  const isSample = Boolean(match[1]);
  if (isSample && !content.startsWith("[SAMPLE]")) throw new Error(`${filename}: 첫 줄에 [SAMPLE] 표시가 없습니다.`);
  const title = content.match(/^#\s+(.+)$/m)?.[1];
  if (!title) throw new Error(`${filename}: H1 제목이 없습니다.`);
  const summary = content.split(/\r?\n/).map((line) => line.trim()).find((line) => line && line !== "[SAMPLE]" && !line.startsWith("#")) ?? "";
  return { date: match[2], title, summary, content, isSample };
}

export function loadBriefings(): Briefing[] {
  return readdirSync(BRIEFING_DIRECTORY).filter((filename) => filename.endsWith(".md")).map(parseBriefing).sort((a, b) => b.date.localeCompare(a.date));
}

export function findBriefing(date: string): Briefing | undefined {
  return loadBriefings().find((briefing) => briefing.date === date);
}
