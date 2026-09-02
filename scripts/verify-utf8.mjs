import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const DIRECTORIES = ["app", "components", "functions", "lib", "scripts", "supabase", "workers"];
const TEXT_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".json", ".sql", ".md", ".yml", ".yaml", ".toml", ".css"]);
const IGNORED_DIRECTORIES = new Set(["node_modules", ".git", ".next", "out", "coverage", "dist", "build", ".data_raw", "scratch", "_archive"]);

function extensionOf(file) {
  const index = file.lastIndexOf(".");
  return index < 0 ? "" : file.slice(index);
}

async function collectFiles(directory, files = []) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") return files;
    throw error;
  }

  for (const entry of entries) {
    if (IGNORED_DIRECTORIES.has(entry.name)) continue;
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(fullPath, files);
    } else if (entry.isFile() && TEXT_EXTENSIONS.has(extensionOf(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function containsUtf8Bom(bytes) {
  return bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
}

function containsUtf16Bom(bytes) {
  return bytes.length >= 2 && ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff));
}

function decodeUtf8Strict(bytes) {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

const files = (await Promise.all(DIRECTORIES.map((directory) => collectFiles(join(ROOT, directory))))).flat();
const failures = [];

for (const file of files) {
  const bytes = await readFile(file);
  const displayPath = relative(ROOT, file).replaceAll("\\", "/");

  if (containsUtf8Bom(bytes)) {
    failures.push(`${displayPath}: UTF-8 BOM은 허용되지 않습니다.`);
    continue;
  }

  if (containsUtf16Bom(bytes)) {
    failures.push(`${displayPath}: UTF-16 인코딩은 허용되지 않습니다. UTF-8(BOM 없음)으로 저장하세요.`);
    continue;
  }

  try {
    const text = decodeUtf8Strict(bytes);
    if (text.includes("\uFFFD")) failures.push(`${displayPath}: 대체 문자(U+FFFD)가 포함되어 있습니다.`);
  } catch {
    failures.push(`${displayPath}: 유효한 UTF-8 텍스트가 아닙니다.`);
  }
}

if (failures.length > 0) {
  console.error("UTF-8 검증 실패:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`UTF-8 검증 통과: ${files.length}개 텍스트 파일`);
