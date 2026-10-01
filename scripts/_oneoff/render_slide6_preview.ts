import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

const repoRoot = 'd:/ETFCampus';
const artifactDir = 'C:/Users/kibae/.gemini/antigravity/brain/774bc5ad-a35e-4bfd-8724-cec9d335f3ef';

// Common defs
const commonDefs = `
  <defs>
    <filter id="softShadow" x="-10%" y="-10%" width="120%" height="125%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#0F172A" flood-opacity="0.06"/>
    </filter>
    <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="125%">
      <feDropShadow dx="0" dy="4" stdDeviation="10" flood-color="#0F172A" flood-opacity="0.04"/>
    </filter>
    <style>
      @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css');
      * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', '맑은 고딕', 'Noto Sans KR', sans-serif; }
      .tabular { font-variant-numeric: tabular-nums; letter-spacing: -0.5px; }
    </style>
  </defs>
`;

const commonFooter = `
  <!-- Legal Disclaimer (자본시장법 제101조 준수) -->
  <text x="540" y="1224" fill="#64748B" font-size="18" font-weight="700" text-anchor="middle">
    * 본 자료는 투자 판단을 돕기 위한 정보 제공용이며, 특정 종목의 매수·매도를 권유하지 않습니다.
  </text>

  <!-- ETF 캠퍼스 공식 최신 표준 풋터 밴드 (Y: 1242 ~ 1306, H: 64) -->
  <g transform="translate(60, 1242)">
    <rect x="0" y="0" width="960" height="64" rx="8" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.2"/>
    <g transform="translate(480, 40)" text-anchor="middle">
      <text x="-195" y="0" fill="#059669" font-size="20" font-weight="800" letter-spacing="-0.2">
        🔍 DC/IRP, 연금저축, ISA 계좌별 ETF 비교 분석 최적화
      </text>
      <text x="90" y="-1" fill="#CBD5E1" font-size="20" font-weight="400">|</text>
      <text x="285" y="0" fill="#0F172A" font-size="20" font-weight="900">
        📊 ETF 캠퍼스 etf-campus.pages.dev
      </text>
    </g>
  </g>
`;

// 2026-09-30 Actual Data
const totalInflow = 2035.4;
const coreInflow = 1013.6; // S&P500 450.6 + KOSPI200 329.0 + S&P500TR 234.0
const growthInflow = 853.5; // KODEX 2차전지산업 853.5
const defensiveInflow = 168.3; // ACE 회사채액티브 168.3

const corePct = 49.8;
const growthPct = 41.9;
const defensivePct = 8.3;

// Bar calculation (Total width = 870)
const totalBarW = 870;
const coreW = Math.round(totalBarW * (corePct / 100)); // 433
const growthW = Math.round(totalBarW * (growthPct / 100)); // 365
const defW = totalBarW - coreW - growthW; // 72

const svg = `
<svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ETF 데일리 마켓 브리핑 - 오늘 시장 수급 나침반: 스마트머니 스타일 로테이션">
  <title>ETF 데일리 마켓 브리핑 - 6페이지</title>
  ${commonDefs}
  <rect width="1080" height="1350" fill="#F8FAFC"/>
  <circle cx="950" cy="180" r="300" fill="#059669" fill-opacity="0.035"/>
  <circle cx="100" cy="1150" r="260" fill="#3B82F6" fill-opacity="0.03"/>

  <!-- Header (y=40) -->
  <g transform="translate(70, 40)">
    <rect x="0" y="4" width="8" height="42" rx="4" fill="#10B981"/>
    <text x="22" y="38" fill="#047857" font-size="44" font-weight="900" letter-spacing="-0.8">오늘 시장 수급 나침반</text>
    <rect x="825" y="0" width="115" height="50" rx="15" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.8" filter="url(#cardShadow)"/>
    <text x="882.5" y="34" fill="#0F172A" font-size="24" font-weight="900" text-anchor="middle" class="tabular">6 / 6</text>
  </g>

  <!-- 1. Hero 3-Way Segment Bar Card (y=104, h=200) -->
  <g transform="translate(70, 104)" filter="url(#cardShadow)">
    <rect width="940" height="200" rx="24" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.8"/>
    
    <!-- Title row inside Hero -->
    <text x="35" y="44" fill="#0F172A" font-size="24" font-weight="900">
      스마트머니 3대 스타일 로테이션
    </text>
    <rect x="710" y="20" width="195" height="38" rx="10" fill="#ECFDF5" stroke="#A7F3D0" stroke-width="1.2"/>
    <text x="807.5" y="45" fill="#047857" font-size="20" font-weight="900" text-anchor="middle">
      총 순유입 +2,036억원
    </text>

    <!-- 3-Segment Stack Bar (y=62, w=870, h=58, rx=16) -->
    <g transform="translate(35, 62)">
      <clipPath id="heroBarClip">
        <rect width="870" height="58" rx="16"/>
      </clipPath>
      <g clip-path="url(#heroBarClip)">
        <!-- Seg 1: Core Index (Green) -->
        <rect x="0" y="0" width="${coreW}" height="58" fill="#10B981"/>
        <!-- Seg 2: Growth Tech (Rose) -->
        <rect x="${coreW}" y="0" width="${growthW}" height="58" fill="#F43F5E"/>
        <!-- Seg 3: Defensive Income (Blue) -->
        <rect x="${coreW + growthW}" y="0" width="${defW}" height="58" fill="#3B82F6"/>
      </g>
      
      <!-- Segment Text Labels -->
      <text x="${coreW / 2}" y="38" fill="#FFFFFF" font-size="22" font-weight="900" text-anchor="middle">🏛️ 시장대표 50%</text>
      <text x="${coreW + growthW / 2}" y="38" fill="#FFFFFF" font-size="22" font-weight="900" text-anchor="middle">🚀 공격성장 42%</text>
      <text x="${coreW + growthW + defW / 2}" y="38" fill="#FFFFFF" font-size="18" font-weight="900" text-anchor="middle">🛡️ 8%</text>
    </g>

    <!-- Hero Summary Fact Text (y=162) -->
    <rect x="35" y="136" width="870" height="48" rx="12" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.2"/>
    <text x="470" y="167" fill="#1E293B" font-size="20" font-weight="800" text-anchor="middle">
      💡 <tspan font-weight="900" fill="#047857">시장대표 패시브 적립(50%)</tspan>과 <tspan font-weight="900" fill="#BE123C">성장 테마 저가매수(42%)</tspan>로 스마트머니 92% 집중
    </text>
  </g>

  <!-- 2. Detailed Style Cards (y=320, step=236, h=220) -->

  <!-- Card 01: [시장 대표형] (y=320, h=220) -->
  <g transform="translate(70, 320)" filter="url(#cardShadow)">
    <rect width="940" height="220" rx="24" fill="#FFFFFF" stroke="#BBF7D0" stroke-width="2"/>
    <rect x="0" y="0" width="8" height="220" rx="4" fill="#10B981"/>

    <!-- Header line -->
    <rect x="35" y="20" width="180" height="46" rx="12" fill="#DCFCE7" stroke="#86EFAC" stroke-width="1.4"/>
    <text x="125" y="51" fill="#15803D" font-size="24" font-weight="900" text-anchor="middle">01 시장 대표형</text>
    <text x="235" y="52" fill="#0F172A" font-size="26" font-weight="900">Core Passive Index</text>
    <text x="905" y="52" fill="#15803D" font-size="28" font-weight="900" text-anchor="end" class="tabular">+1,014억원 <tspan font-size="20" fill="#475569" font-weight="800">(점유율 49.8%)</tspan></text>

    <line x1="35" y1="80" x2="905" y2="80" stroke="#F1F5F9" stroke-width="1.5"/>

    <!-- Inflow ETF Items -->
    <text x="35" y="118" fill="#1E293B" font-size="24" font-weight="900">
      • TIGER 미국S&amp;P500 <tspan fill="#047857" font-size="22">(+451억)</tspan> · TIGER 200 <tspan fill="#047857" font-size="22">(+329억)</tspan> · KODEX 미국S&amp;P500TR <tspan fill="#047857" font-size="22">(+234억)</tspan>
    </text>

    <!-- Factual Commentary Band -->
    <rect x="35" y="142" width="870" height="60" rx="14" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.2"/>
    <rect x="48" y="154" width="110" height="36" rx="8" fill="#DCFCE7"/>
    <text x="103" y="179" fill="#15803D" font-size="18" font-weight="900" text-anchor="middle">수급 팩트</text>
    <text x="175" y="180" fill="#166534" font-size="21" font-weight="800">
      양대 지수 조정에도 시장 대표 지수군으로 기계적 패시브 적립 자금 최다 유입
    </text>
  </g>

  <!-- Card 02: [공격 성장형] (y=556, h=220) -->
  <g transform="translate(70, 556)" filter="url(#cardShadow)">
    <rect width="940" height="220" rx="24" fill="#FFFFFF" stroke="#FECDD3" stroke-width="2"/>
    <rect x="0" y="0" width="8" height="220" rx="4" fill="#F43F5E"/>

    <!-- Header line -->
    <rect x="35" y="20" width="180" height="46" rx="12" fill="#FFE4E6" stroke="#FDA4AF" stroke-width="1.4"/>
    <text x="125" y="51" fill="#BE123C" font-size="24" font-weight="900" text-anchor="middle">02 공격 성장형</text>
    <text x="235" y="52" fill="#0F172A" font-size="26" font-weight="900">Growth &amp; Tech</text>
    <text x="905" y="52" fill="#BE123C" font-size="28" font-weight="900" text-anchor="end" class="tabular">+854억원 <tspan font-size="20" fill="#475569" font-weight="800">(점유율 41.9%)</tspan></text>

    <line x1="35" y1="80" x2="905" y2="80" stroke="#F1F5F9" stroke-width="1.5"/>

    <!-- Inflow ETF Items -->
    <text x="35" y="118" fill="#1E293B" font-size="24" font-weight="900">
      • KODEX 2차전지산업 <tspan fill="#DC2626" font-size="22">(+854억 · 당일 전체 순유입 1위 집중)</tspan>
    </text>

    <!-- Factual Commentary Band -->
    <rect x="35" y="142" width="870" height="60" rx="14" fill="#FFF1F2" stroke="#FECDD3" stroke-width="1.2"/>
    <rect x="48" y="154" width="110" height="36" rx="8" fill="#FFE4E6"/>
    <text x="103" y="179" fill="#BE123C" font-size="18" font-weight="900" text-anchor="middle">수급 팩트</text>
    <text x="175" y="180" fill="#9F1239" font-size="21" font-weight="800">
      단기 낙폭 과대 기술주 테마를 겨냥한 스마트머니의 선별적 저가 매수세 집중
    </text>
  </g>

  <!-- Card 03: [방어 인컴형] (y=792, h=220) -->
  <g transform="translate(70, 792)" filter="url(#cardShadow)">
    <rect width="940" height="220" rx="24" fill="#FFFFFF" stroke="#BFDBFE" stroke-width="2"/>
    <rect x="0" y="0" width="8" height="220" rx="4" fill="#3B82F6"/>

    <!-- Header line -->
    <rect x="35" y="20" width="180" height="46" rx="12" fill="#DBEAFE" stroke="#93C5FD" stroke-width="1.4"/>
    <text x="125" y="51" fill="#1D4ED8" font-size="24" font-weight="900" text-anchor="middle">03 방어 인컴형</text>
    <text x="235" y="52" fill="#0F172A" font-size="26" font-weight="900">Defensive &amp; Income</text>
    <text x="905" y="52" fill="#1D4ED8" font-size="28" font-weight="900" text-anchor="end" class="tabular">+168억원 <tspan font-size="20" fill="#475569" font-weight="800">(점유율 8.3%)</tspan></text>

    <line x1="35" y1="80" x2="905" y2="80" stroke="#F1F5F9" stroke-width="1.5"/>

    <!-- Inflow ETF Items -->
    <text x="35" y="118" fill="#1E293B" font-size="24" font-weight="900">
      • ACE 회사채(AA-이상)액티브 <tspan fill="#2563EB" font-size="22">(+168억)</tspan>
    </text>

    <!-- Factual Commentary Band -->
    <rect x="35" y="142" width="870" height="60" rx="14" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1.2"/>
    <rect x="48" y="154" width="110" height="36" rx="8" fill="#DBEAFE"/>
    <text x="103" y="179" fill="#1D4ED8" font-size="18" font-weight="900" text-anchor="middle">수급 팩트</text>
    <text x="175" y="180" fill="#1E40AF" font-size="21" font-weight="800">
      시장 변동성 속 우량 크레딧 회사채 중심의 안전 이자수익 완충 수급 형성
    </text>
  </g>

  <!-- Bottom KRX Notice Banner (y=1036, h=56) -->
  <g transform="translate(70, 1036)">
    <rect width="940" height="56" rx="16" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.4"/>
    <text x="470" y="36" fill="#475569" font-size="20" font-weight="800" text-anchor="middle">
      KRX 2026.09.30 마감 공시 기준 · 당일 실질 순유입 상위 종목군 스타일 분류 통계
    </text>
  </g>

  <!-- Common Disclaimer & Watermark -->
  ${commonFooter}
</svg>
`;

async function run() {
  const outSvgPath = path.join(artifactDir, 'slide_06_preview.svg');
  const outPngPath = path.join(artifactDir, 'slide_06_preview.png');
  fs.writeFileSync(outSvgPath, svg, 'utf-8');
  console.log('Saved SVG to:', outSvgPath);

  await sharp(Buffer.from(svg))
    .resize(1080, 1350)
    .png()
    .toFile(outPngPath);
  console.log('Rendered PNG to:', outPngPath);
}

run().catch(console.error);
