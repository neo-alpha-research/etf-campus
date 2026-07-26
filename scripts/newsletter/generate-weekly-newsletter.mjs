import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { buildNewsletterModel, renderNewsletterHtml } from "./newsletter-core.mjs";

function argument(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const root = process.cwd();
const issueDate = argument("date", new Date().toISOString().slice(0, 10));
const siteUrl = argument("site-url", "http://localhost:3000");
const snapshotDirectory = path.join(root, "data", "newsletter", "weekly-snapshots");
const currentPath = path.join(snapshotDirectory, `${issueDate}.json`);

if (!fs.existsSync(currentPath)) {
  throw new Error(`현재 스냅숏이 없습니다: ${currentPath}\n먼저 npm run newsletter:snapshot -- --date ${issueDate} 를 실행하세요.`);
}

const snapshotFiles = fs.readdirSync(snapshotDirectory)
  .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
  .sort();
const previousFile = snapshotFiles.filter((name) => name < `${issueDate}.json`).at(-1);
const current = readJson(currentPath);
const previous = previousFile ? readJson(path.join(snapshotDirectory, previousFile)) : null;
const model = buildNewsletterModel(current, previous);

const outputDirectory = path.join(root, "artifacts", "newsletter", issueDate);
const assetDirectory = path.join(outputDirectory, "assets");
fs.mkdirSync(assetDirectory, { recursive: true });
fs.copyFileSync(
  path.join(root, "public", "brand", "final-v2", "tickery-briefing.png"),
  path.join(assetDirectory, "tickery-briefing.png"),
);
fs.writeFileSync(path.join(outputDirectory, "newsletter-model.json"), `${JSON.stringify(model, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(outputDirectory, "index.html"), renderNewsletterHtml(model, { siteUrl }), "utf8");

console.log(`뉴스레터 시제품 생성: ${path.join(outputDirectory, "index.html")}`);
console.log(`데이터 기준일 ${model.dataAsOf}, 이전 스냅숏 ${model.previousIssueDate ?? "없음(첫 집계)"}`);
