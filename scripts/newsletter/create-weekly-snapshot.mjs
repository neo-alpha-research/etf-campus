import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { buildSnapshot, readCsvFile } from "./newsletter-core.mjs";

function argument(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const root = process.cwd();
const snapshotDate = argument("date", new Date().toISOString().slice(0, 10));
const dataDirectory = path.join(root, "data");
const outputDirectory = path.join(dataDirectory, "newsletter", "weekly-snapshots");
const outputPath = path.join(outputDirectory, `${snapshotDate}.json`);

if (fs.existsSync(outputPath) && !process.argv.includes("--force")) {
  throw new Error(`이미 스냅숏이 있습니다: ${outputPath}\n덮어쓰려면 --force를 명시하세요.`);
}

const snapshot = buildSnapshot({
  masterRows: readCsvFile(path.join(dataDirectory, "etf_master_draft.csv")),
  returnRows: readCsvFile(path.join(dataDirectory, "etf_returns_draft.csv")),
  pensionRows: readCsvFile(path.join(dataDirectory, "pension_verify_sheet.csv")),
  snapshotDate,
});

fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

console.log(`주간 스냅숏 생성: ${outputPath}`);
console.log(`기준일 ${snapshot.dataAsOf}, ${snapshot.recordCount.toLocaleString("ko-KR")}종목`);
