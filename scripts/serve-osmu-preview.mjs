import http from "http";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const archiveDir = path.join(rootDir, "OSMU_Archive");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
};

const DEFAULT_PORT = 3333;

function startServer(port) {
  const server = http.createServer((req, res) => {
    try {
      const decodedUrl = decodeURIComponent(req.url?.split("?")[0] || "/");
      let relativePath = decodedUrl.startsWith("/") ? decodedUrl.slice(1) : decodedUrl;

      let filePath = path.join(archiveDir, relativePath);

      // Handle directories -> look for index.html
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`
          <!DOCTYPE html>
          <html>
            <body style="font-family:sans-serif;padding:40px;background:#f8fafc;color:#1e293b;">
              <h2>404 - 파일을 찾을 수 없습니다</h2>
              <p>요청 경로: <code>${decodedUrl}</code></p>
              <a href="/" style="color:#059669;font-weight:bold;">← 마스터 허브로 돌아가기</a>
            </body>
          </html>
        `);
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";

      const stat = fs.statSync(filePath);
      res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": stat.size,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      });

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Internal Server Error: " + (err instanceof Error ? err.message : String(err)));
    }
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`포트 ${port}번이 사용 중입니다. ${port + 1}번 포트로 재시도합니다...`);
      startServer(port + 1);
    } else {
      console.error("서버 시작 중 오류 발생:", err);
    }
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`\n==============================================================`);
    console.log(`🚀 ETF Campus OSMU 로컬 프리뷰 서버가 준비되었습니다!`);
    console.log(`🌐 마스터 허브 접속: ${url}`);
    console.log(`📁 서빙 디렉토리: ${archiveDir}`);
    console.log(`==============================================================\n`);

    // Open browser automatically
    const startCmd = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
    exec(`${startCmd} ${url}`, (e) => {
      if (e) {
        console.log(`(브라우저 자동 열기 실패: 브라우저에서 직접 ${url} 로 접속해주세요)`);
      }
    });
  });
}

if (!fs.existsSync(archiveDir)) {
  console.error(`[오류] OSMU_Archive 디렉토리를 찾을 수 없습니다: ${archiveDir}`);
  process.exit(1);
}

startServer(DEFAULT_PORT);
