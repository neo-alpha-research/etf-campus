import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runPipeline() {
  const pythonBin = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
  const pythonCollector = path.resolve(__dirname, "collector/kofia_fee_collector.py");
  const verifyPensionScript = path.resolve(__dirname, "rules/verify_kofia_pension.py");

  // Pass any CLI arguments forwarded from caller, default to --headless if none provided
  const userArgs = process.argv.slice(2);
  const collectorArgs = userArgs.length > 0 ? userArgs.join(" ") : "--headless";

  try {
    console.log("🚀 [KOFIA DIS] ETF 실부담비용율 자동 동기화 파이프라인을 시작합니다...");
    console.log(`[EXEC] ${pythonBin} "${pythonCollector}" ${collectorArgs}`);
    execSync(`"${pythonBin}" "${pythonCollector}" ${collectorArgs}`, { stdio: "inherit" });
    console.log("🎉 파이프라인 성공: etf_fee_registry.json 업데이트가 완료되었습니다.");

    console.log("🚀 [KOFIA DIS] 연금 적격성 공시대조 및 원장 갱신을 실행합니다...");
    console.log(`[EXEC] ${pythonBin} "${verifyPensionScript}"`);
    execSync(`"${pythonBin}" "${verifyPensionScript}"`, { stdio: "inherit" });
    console.log("🎉 연금 적격성 원장 대조 및 규제 판정 갱신이 완료되었습니다.");
  } catch (error) {
    console.error("❌ KOFIA 파이프라인 실행 중 오류 발생:", error);
    process.exit(1);
  }
}

runPipeline();

