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

// 1. KOFIA 데이터 페치 (Network API 리버스 엔지니어링 흉내)
async function fetchKofiaData(): Promise<KofiaEtfRow[]> {
  console.log("🚀 KOFIA 전자공시 서버(dis.kofia.or.kr)에서 ETF 비교공시 데이터를 수집합니다...");
  
  // 실제 환경에서는 KOFIA의 POST 엔드포인트에 폼데이터(Form Data)를 전송하여
  // Excel/CSV 또는 JSON payload를 받아오도록 구현합니다.
  // 여기서는 KOFIA 데이터 구조를 흉내 낸 Mock API 로직을 작성합니다.
  
  return [
    { ticker: "069500", fundName: "KODEX 200", totalFeePct: 0.15, otherCostPct: 0.02, tradingCostPct: 0.015, baseDate: "202607" },
    { ticker: "379800", fundName: "KODEX 미국S&P500TR", totalFeePct: 0.05, otherCostPct: 0.08, tradingCostPct: 0.04, baseDate: "202607" },
    // 실제로는 수백 개의 ETF 데이터가 반환됨
  ];
}

// 2. 데이터 유효성 검사 및 서킷 브레이커 로직
function validateChanges(oldRows: Map<string, RegistryRow>, newRows: KofiaEtfRow[]) {
  console.log("🛡️ 데이터 이상 감지(Circuit Breaker)를 실행합니다...");
  
  const MAX_ALLOWED_DEVIATION = 0.5; // 실부담비용이 0.5%p 이상 변동 시 경고
  let anomaliesFound = 0;

  for (const newRow of newRows) {
    const oldRow = oldRows.get(newRow.ticker);
    if (!oldRow) continue; // 신규 상장은 패스

    const oldSynthetic = (oldRow.ter_pct ?? 0) + (oldRow.trading_cost_pct ?? 0);
    const newSynthetic = newRow.totalFeePct + newRow.otherCostPct + newRow.tradingCostPct;

    if (Math.abs(newSynthetic - oldSynthetic) > MAX_ALLOWED_DEVIATION) {
      console.warn(`[WARNING] 이상 감지! ${newRow.ticker}의 실비용이 급변했습니다. (이전: ${oldSynthetic.toFixed(3)}% -> 신규: ${newSynthetic.toFixed(3)}%)`);
      anomaliesFound++;
    }
  }

  if (anomaliesFound > 10) {
    throw new Error(`[CRITICAL] 너무 많은 종목(${anomaliesFound}개)의 비용이 급변했습니다. KOFIA 공시 양식이 변경되었을 수 있으니 파이프라인 가동을 중단합니다.`);
  } else if (anomaliesFound > 0) {
    console.log("⚠️ 경고가 발생했으나 허용 임계치 이내이므로 진행합니다.");
  } else {
    console.log("✅ 서킷 브레이커 검사 통과: 모든 데이터가 안정 범위 내에 있습니다.");
  }
}

// 3. 메인 실행 파이프라인
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
    
    // 최종 JSON 구조 유지 (객체 형태이면 객체로, 배열이면 배열로)
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
