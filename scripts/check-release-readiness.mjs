import { readdirSync } from "node:fs";
import path from "node:path";

const contentRoot = path.join(process.cwd(), "content");

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

const samples = walk(contentRoot).filter((filename) => path.basename(filename).startsWith("[SAMPLE]_"));

if (samples.length) {
  console.error(`출시 차단: 교체되지 않은 SAMPLE 콘텐츠 ${samples.length}건`);
  samples.forEach((filename) => console.error(`- ${path.relative(process.cwd(), filename)}`));
  process.exitCode = 1;
} else {
  console.log("출시 콘텐츠 게이트 통과: SAMPLE 파일이 없습니다.");
}
