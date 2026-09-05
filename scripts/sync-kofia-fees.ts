import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// KOFIA 전자공시 데이터 규격에 맞춘 가상의 타입
type KofiaEtfRow = {
  ticker: string;
  fundName: string;
  totalFeePct: number;    // 총보수
  otherCostPct: number;   // 기타비용
  tradingCostPct: number; // 매매중개수수료
  baseDate: string;       // 기준일 (YYYYMM)
};

// JSON 레지스트리 규격
type RegistryRow = {
  ticker: string;
  total_fee_pct?: number | null;
  ter_pct?: number | null;
  other_cost_pct?: number | null;
  trading_cost_pct?: number | null;
  effective_date?: string | null;
  verified_at?: string | null;
  verification_status?: string | null;
  primary_source_type?: string | null;
  source_note?: string | null;
};

// 1. KOFIA 데이터 페치 (scripts/collector/kofia_fee_collector.py 호출)
async function fetchKofiaData(): Promise<KofiaEtfRow[]> {
  console.log("🚀 KOFIA 전자공시 수집 파이프라인(kofia_fee_collector.py)을 호출합니다...");
  const { execSync } = await import("node:child_process");
  const pythonScript = path.resolve(__dirname, "collector/kofia_fee_collector.py");
  
  try {
    execSync(`python "${pythonScript}" --headless`, { stdio: "inherit" });
  } catch (err) {
    throw new Error(`KOFIA 수집 스크립트 실행 실패: ${err instanceof Error ? err.message : String(err)}`);
  }

  // kofia_fee_collector.py가 레지스트리를 직접 원자적으로 갱신하므로 빈 배열 반환
  return [];
}

// 2. 동적 통계 기반 서킷 브레이커 로직
function validateChanges(oldRows: Map<string, RegistryRow>, newRows: KofiaEtfRow[]) {
  console.log("🛡️ 통계 기반 서킷 브레이커 검증을 실행합니다...");
  
  const THRESHOLD_PCT = 20; // 20% 이상 급변 시 이상치(Anomaly)로 간주
  let anomaliesFound = 0;
  let totalEvaluated = 0;

  for (const newRow of newRows) {
    const oldRow = oldRows.get(newRow.ticker);
    if (!oldRow) continue; // 신규 상장은 패스

    const oldSynthetic = (oldRow.ter_pct ?? 0) + (oldRow.trading_cost_pct ?? 0);
    const newSynthetic = newRow.totalFeePct + newRow.otherCostPct + newRow.tradingCostPct;

    if (oldSynthetic > 0) {
      totalEvaluated++;
      const changeRate = Math.abs(newSynthetic - oldSynthetic) / oldSynthetic * 100;
      
      if (changeRate > THRESHOLD_PCT) {
        console.warn(`[WARNING] 이상 감지! ${newRow.ticker} 실비용 급변 (이전: ${oldSynthetic.toFixed(3)}% -> 신규: ${newSynthetic.toFixed(3)}%, 변동률: ${changeRate.toFixed(1)}%)`);
        anomaliesFound++;
      }
    }
  }

  // 전체 유니버스의 5% 이상에서 20%가 넘는 변동이 발생하면 파이프라인 강제 정지
  const anomalyRate = totalEvaluated > 0 ? (anomaliesFound / totalEvaluated) : 0;
  console.log(`📊 이상치 발생률: ${(anomalyRate * 100).toFixed(1)}% (${anomaliesFound}/${totalEvaluated})`);

  if (anomalyRate > 0.05) {
    console.error("❌ [CRITICAL_ERROR] 전체 ETF의 5% 이상에서 심각한 비용 변동이 감지되었습니다. KOFIA 공시 양식 변경이 의심되므로 덮어쓰기를 취소하고 파이프라인을 중단합니다.");
    process.exit(1);
  } else {
    console.log("✅ 서킷 브레이커 검사 통과: 안전 범위 내에 있습니다.");
  }
}

// 3. 메인 파이프라인 (kofia_fee_collector.py 기반)
async function runPipeline() {
  try {
    console.log("🚀 [KOFIA DIS] ETF 실부담비용율 자동 동기화 파이프라인을 시작합니다...");
    const { execSync } = await import("node:child_process");
    const pythonScript = path.resolve(__dirname, "collector/kofia_fee_collector.py");
    execSync(`python "${pythonScript}" --headless`, { stdio: "inherit" });
    console.log("🎉 파이프라인 성공! etf_fee_registry.json 업데이트가 완료되었습니다.");

    console.log("🚀 [KOFIA DIS] 연금 적격성 공시대조 및 원장 갱신을 실행합니다...");
    const verifyScript = path.resolve(__dirname, "rules/verify_kofia_pension.py");
    execSync(`python "${verifyScript}"`, { stdio: "inherit" });
    console.log("🎉 연금 적격성 원장 대조 및 규제 판정 갱신이 완료되었습니다.");
  } catch (error) {
    console.error("❌ KOFIA 파이프라인 실행 중 오류 발생:", error);
    process.exit(1);
  }
}

runPipeline();
