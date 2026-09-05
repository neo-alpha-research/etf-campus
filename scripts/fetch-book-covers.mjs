/**
 * scripts/fetch-book-covers.mjs
 * 9권의 추천 도서 고화질 공식 커버 이미지를 교보문고 CDN에서 자동 다운로드하여
 * public/images/books/ 디렉토리에 저장하는 스크립트입니다.
 * 
 * 사용법: node scripts/fetch-book-covers.mjs
 */

import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEST_DIR = path.resolve(__dirname, "../public/images/books");

const BOOKS = [
  // 초보·입문 Top 3
  { isbn: "9791188096923", file: "common-sense-investing.png", title: "존 보글의 모든 주식을 소유하라" },
  { isbn: "9791140710010", file: "etf-blindly.png", title: "ETF 투자 무작정 따라하기" },
  { isbn: "9788991378193", file: "four-pillars.png", title: "투자의 네 기둥" },
  // 연금·절세 Top 3
  { isbn: "9788998342784", file: "magic-pension.png", title: "마법의 연금 굴리기" },
  { isbn: "9791168342941", file: "parkgomhee-pension.png", title: "박곰희 연금 부자 수업" },
  { isbn: "9788901294179", file: "three-us-etfs.png", title: "단 3개의 미국 ETF로 은퇴하라" },
  // 배당·현금흐름 Top 3
  { isbn: "9788997345083", file: "dividends-dont-lie.png", title: "절대로 배당은 거짓말하지 않는다" },
  { isbn: "9791186137864", file: "us-dividend.png", title: "잠든 사이 월급 버는 미국 배당주 투자" },
  { isbn: "9791175488595", file: "monthly-dividend.png", title: "100세까지 월 500만 원 받는 ETF 연금 수업" },
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on("finish", () => {
        file.close(resolve);
      });
    }).on("error", reject);
  });
}

async function main() {
  fs.mkdirSync(DEST_DIR, { recursive: true });
  console.log(`[Sync] Downloading ${BOOKS.length} book covers to ${DEST_DIR}...`);

  for (const book of BOOKS) {
    const dest = path.join(DEST_DIR, book.file);
    const url = `https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/${book.isbn}.jpg`;
    try {
      await download(url, dest);
      const size = fs.statSync(dest).size;
      console.log(`  ✓ ${book.title} -> ${book.file} (${Math.round(size / 1024)} KB)`);
    } catch (err) {
      console.error(`  ✗ ${book.title} failed: ${err.message}`);
    }
  }

  console.log("[Sync] All book covers synchronized successfully!");
}

main().catch(console.error);
