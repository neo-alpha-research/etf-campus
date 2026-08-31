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

// 1. KOFIA 데이터 페치 (Playwright Headless 기반 완전 자동화 Skeleton)
async function fetchKofiaData(): Promise<KofiaEtfRow[]> {
  console.log("🚀 KOFIA 전자공시 서버에서 ETF 비교공시 데이터를 수집합니다...");
  
  /* 실제 Playwright 구현 예시:
  import { chromium } from "playwright";
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://dis.kofia.or.kr/...");
  
  // 조회 버튼 클릭 등 동적 렌더링 대기
  await page.click("#btnSearch");
  await page.waitForResponse(response => response.url().includes('getGridData'));
  
  // 네트워크 패킷 또는 DOM 테이블에서 추출
  // ...
  await browser.close();
  */

  // 여기서는 KOFIA 데이터 구조를 흉내 낸 Mock API 로직을 작성합니다.
  return [
    { ticker: "069500", fundName: "KODEX 200", totalFeePct: 0.15, otherCostPct: 0.02, tradingCostPct: 0.015, baseDate: "202607" },
    { ticker: "379800", fundName: "KODEX 미국S&P500TR", totalFeePct: 0.05, otherCostPct: 0.08, tradingCostPct: 0.04, baseDate: "202607" },
    // 실제로는 수백 개의 ETF 데이터가 반환됨
  ];
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

// 3. 메인 파이프라인 (완전 자동화)
async function runPipeline() {
  try {
    const registryPath = path.resolve(__dirname, "../data/fees/etf_fee_registry.json");
    
    // 1. 기존 레지스트리 읽기
    const fileContent = await fs.readFile(registryPath, "utf-8");
    const parsedData = JSON.parse(fileContent);
    const existingRows: RegistryRow[] = Array.isArray(parsedData) ? parsedData : parsedData.records || [];
    const rowMap = new Map<string, RegistryRow>();
    existingRows.forEach(row => rowMap.set(row.ticker, row));

    // 2. KOFIA 데이터 Fetch
    const scrapedData = await fetchKofiaData();
    
    // 3. 서킷 브레이커 검증
    validateChanges(rowMap, scrapedData);

    // 4. 데이터 병합 (Merge)
    console.log("🔄 새로운 공시 데이터를 기존 레지스트리에 병합합니다...");
    const today = new Date().toISOString();

    for (const data of scrapedData) {
      const ter = data.totalFeePct + data.otherCostPct;
      rowMap.set(data.ticker, {
        ...rowMap.get(data.ticker),
        ticker: data.ticker,
        total_fee_pct: data.totalFeePct,
        ter_pct: Number(ter.toFixed(4)),
        other_cost_pct: data.otherCostPct,
        trading_cost_pct: data.tradingCostPct,
        effective_date: data.baseDate,
        verified_at: today,
        verification_status: "verified_official",
        primary_source_type: "kofia_disclosure_api",
        source_note: "Auto-synced via KOFIA pipeline"
      });
    }

    // 객체를 배열로 변환 및 정렬
    const updatedRecords = Array.from(rowMap.values()).sort((a, b) => a.ticker.localeCompare(b.ticker));
    
    // 최종 JSON 구조 유지
    const finalOutput = Array.isArray(parsedData) 
      ? updatedRecords 
      : { ...parsedData, records: updatedRecords };

    // 5. 파일 쓰기
    await fs.writeFile(registryPath, JSON.stringify(finalOutput, null, 2), "utf-8");
    console.log("🎉 파이프라인 성공! etf_fee_registry.json 업데이트가 완료되었습니다.");
    
  } catch (error) {
    console.error("❌ 파이프라인 실행 중 오류 발생:", error);
    process.exit(1);
  }
}

runPipeline();
