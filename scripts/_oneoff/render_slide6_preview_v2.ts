import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

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
  <text x="540" y="1204" fill="#64748B" font-size="18" font-weight="700" text-anchor="middle">
    * 본 자료는 투자 판단을 돕기 위한 정보 제공용이며, 특정 종목의 매수·매도를 권유하지 않습니다.
  </text>

  <!-- ETF 캠퍼스 공식 최신 표준 풋터 밴드 (Y: 1226 ~ 1290, H: 64) -->
  <g transform="translate(60, 1226)">
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
const totalInflow = 2036;
const coreInflow = 1014;
const growthInflow = 854;
const defensiveInflow = 168;

const corePct = 50;
const growthPct = 42;
const defensivePct = 8;

const totalBarW = 870;
const coreW = Math.round(totalBarW * (corePct / 100)); // 435
const growthW = Math.round(totalBarW * (growthPct / 100)); // 365
const defW = totalBarW - coreW - growthW; // 70

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

  <!-- 1. Hero 3-Way Segment Bar Card (y=104, h=204) -->
  <g transform="translate(70, 104)" filter="url(#cardShadow)">
    <rect width="940" height="204" rx="24" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.8"/>
    
    <!-- Title row inside Hero -->
    <text x="35" y="42" fill="#0F172A" font-size="25" font-weight="900">
      스마트머니 3대 스타일 로테이션
    </text>
    <rect x="695" y="18" width="210" height="38" rx="10" fill="#ECFDF5" stroke="#A7F3D0" stroke-width="1.2"/>
    <text x="800" y="43" fill="#047857" font-size="20" font-weight="900" text-anchor="middle" class="tabular">
      총 순유입 +${totalInflow.toLocaleString()}억원
    </text>

    <!-- 3-Segment Stack Bar (y=62, w=870, h=56, rx=16) -->
    <g transform="translate(35, 62)">
      <clipPath id="heroBarClip">
        <rect width="870" height="56" rx="16"/>
      </clipPath>
      <g clip-path="url(#heroBarClip)">
        <rect x="0" y="0" width="${coreW}" height="56" fill="#10B981"/>
        <rect x="${coreW}" y="0" width="${growthW}" height="56" fill="#F43F5E"/>
        <rect x="${coreW + growthW}" y="0" width="${defW}" height="56" fill="#3B82F6"/>
      </g>
      
      <!-- Segment Text Labels inside Bar -->
      <text x="${coreW / 2}" y="36" fill="#FFFFFF" font-size="22" font-weight="900" text-anchor="middle">🏛️ 시장대표 ${corePct}% (+${coreInflow}억)</text>
      <text x="${coreW + growthW / 2}" y="36" fill="#FFFFFF" font-size="22" font-weight="900" text-anchor="middle">🚀 공격성장 ${growthPct}% (+${growthInflow}억)</text>
      <text x="${coreW + growthW + defW / 2}" y="36" fill="#FFFFFF" font-size="18" font-weight="900" text-anchor="middle">🛡️ ${defensivePct}%</text>
    </g>

    <!-- Hero Summary Fact Text (y=134) -->
    <rect x="35" y="134" width="870" height="52" rx="14" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.2"/>
    <text x="470" y="167" fill="#1E293B" font-size="21" font-weight="800" text-anchor="middle">
      💡 <tspan font-weight="900" fill="#047857">시장대표 패시브 적립(50%)</tspan>과 <tspan font-weight="900" fill="#BE123C">성장 테마 저가매수(42%)</tspan>로 스마트머니 92% 집중
    </text>
  </g>

  <!-- 2. Detailed Style Cards (y=324, step=256, h=242) -->

  <!-- Card 01: [시장 대표형] (y=324, h=242) -->
  <g transform="translate(70, 324)" filter="url(#cardShadow)">
    <rect width="940" height="242" rx="24" fill="#FFFFFF" stroke="#BBF7D0" stroke-width="2"/>
    <rect x="0" y="0" width="8" height="242" rx="4" fill="#10B981"/>

    <!-- Header line: 스타일명 + 직관적 한글 목적 뱃지 + 금액/점유율 -->
    <rect x="35" y="18" width="165" height="42" rx="10" fill="#DCFCE7" stroke="#86EFAC" stroke-width="1.4"/>
    <text x="117.5" y="47" fill="#15803D" font-size="22" font-weight="900" text-anchor="middle">01 시장 대표형</text>
    
    <rect x="210" y="18" width="150" height="42" rx="10" fill="#F1F5F9" stroke="#E2E8F0" stroke-width="1.2"/>
    <text x="285" y="46" fill="#475569" font-size="20" font-weight="900" text-anchor="middle">지수 패시브 적립</text>

    <text x="905" y="48" fill="#15803D" font-size="30" font-weight="900" text-anchor="end" class="tabular">+${coreInflow.toLocaleString()}억원 <tspan font-size="20" fill="#64748B" font-weight="800">(점유율 ${corePct}%)</tspan></text>

    <line x1="35" y1="72" x2="905" y2="72" stroke="#F1F5F9" stroke-width="1.5"/>

    <!-- Middle: 3개 독립 칩 그리드 (각 w=280, gap=15, h=62, y=84) -->
    <!-- Chip 1 -->
    <g transform="translate(35, 84)">
      <rect width="280" height="62" rx="12" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.4"/>
      <rect x="12" y="14" width="34" height="34" rx="8" fill="#DCFCE7"/>
      <text x="29" y="38" fill="#15803D" font-size="18" font-weight="900" text-anchor="middle">1</text>
      <text x="56" y="32" fill="#0F172A" font-size="17" font-weight="900">TIGER 미국S&amp;P500</text>
      <text x="56" y="52" fill="#059669" font-size="17" font-weight="900" class="tabular">+451억원 유입</text>
    </g>
    <!-- Chip 2 -->
    <g transform="translate(330, 84)">
      <rect width="280" height="62" rx="12" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.4"/>
      <rect x="12" y="14" width="34" height="34" rx="8" fill="#DCFCE7"/>
      <text x="29" y="38" fill="#15803D" font-size="18" font-weight="900" text-anchor="middle">2</text>
      <text x="56" y="32" fill="#0F172A" font-size="17" font-weight="900">TIGER 200</text>
      <text x="56" y="52" fill="#059669" font-size="17" font-weight="900" class="tabular">+329억원 유입</text>
    </g>
    <!-- Chip 3 -->
    <g transform="translate(625, 84)">
      <rect width="280" height="62" rx="12" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.4"/>
      <rect x="12" y="14" width="34" height="34" rx="8" fill="#DCFCE7"/>
      <text x="29" y="38" fill="#15803D" font-size="18" font-weight="900" text-anchor="middle">3</text>
      <text x="56" y="32" fill="#0F172A" font-size="16" font-weight="900">KODEX 미국S&amp;P500TR</text>
      <text x="56" y="52" fill="#059669" font-size="17" font-weight="900" class="tabular">+234억원 유입</text>
    </g>

    <!-- Bottom: Factual Commentary Band (y=160, h=64) -->
    <rect x="35" y="160" width="870" height="64" rx="14" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.2"/>
    <rect x="48" y="174" width="105" height="36" rx="8" fill="#DCFCE7"/>
    <text x="100.5" y="199" fill="#15803D" font-size="18" font-weight="900" text-anchor="middle">수급 팩트</text>
    <text x="168" y="198" fill="#166534" font-size="20" font-weight="800">
      지수 조정에도 대표 벤치마크군으로 기계적 패시브 적립 자금 최다 유입
    </text>
  </g>

  <!-- Card 02: [공격 성장형] (y=580, h=242) -->
  <g transform="translate(70, 580)" filter="url(#cardShadow)">
    <rect width="940" height="242" rx="24" fill="#FFFFFF" stroke="#FECDD3" stroke-width="2"/>
    <rect x="0" y="0" width="8" height="242" rx="4" fill="#F43F5E"/>

    <!-- Header line: 스타일명 + 직관적 한글 목적 뱃지 + 금액/점유율 -->
    <rect x="35" y="18" width="165" height="42" rx="10" fill="#FFE4E6" stroke="#FDA4AF" stroke-width="1.4"/>
    <text x="117.5" y="47" fill="#BE123C" font-size="22" font-weight="900" text-anchor="middle">02 공격 성장형</text>
    
    <rect x="210" y="18" width="150" height="42" rx="10" fill="#F1F5F9" stroke="#E2E8F0" stroke-width="1.2"/>
    <text x="285" y="46" fill="#475569" font-size="20" font-weight="900" text-anchor="middle">혁신 성장 저가매수</text>

    <text x="905" y="48" fill="#BE123C" font-size="30" font-weight="900" text-anchor="end" class="tabular">+${growthInflow.toLocaleString()}억원 <tspan font-size="20" fill="#64748B" font-weight="800">(점유율 ${growthPct}%)</tspan></text>

    <line x1="35" y1="72" x2="905" y2="72" stroke="#F1F5F9" stroke-width="1.5"/>

    <!-- Middle: 와이드 단일 칩 (h=62, y=84) -->
    <g transform="translate(35, 84)">
      <rect width="870" height="62" rx="12" fill="#FFF1F2" stroke="#FECDD3" stroke-width="1.4"/>
      <rect x="16" y="14" width="70" height="34" rx="8" fill="#FFE4E6"/>
      <text x="51" y="38" fill="#BE123C" font-size="18" font-weight="900" text-anchor="middle">1위 집중</text>
      <text x="100" y="40" fill="#0F172A" font-size="21" font-weight="900">KODEX 2차전지산업</text>
      <rect x="315" y="14" width="155" height="34" rx="8" fill="#FFFFFF" stroke="#FECDD3" stroke-width="1.2"/>
      <text x="392.5" y="38" fill="#BE123C" font-size="18" font-weight="900" text-anchor="middle" class="tabular">+854억원 순유입</text>
      <text x="485" y="40" fill="#475569" font-size="18" font-weight="800">(당일 전체 ETF 단일 종목 순유입 압도적 1위)</text>
    </g>

    <!-- Bottom: Factual Commentary Band (y=160, h=64) -->
    <rect x="35" y="160" width="870" height="64" rx="14" fill="#FFF1F2" stroke="#FECDD3" stroke-width="1.2"/>
    <rect x="48" y="174" width="105" height="36" rx="8" fill="#FFE4E6"/>
    <text x="100.5" y="199" fill="#BE123C" font-size="18" font-weight="900" text-anchor="middle">수급 팩트</text>
    <text x="168" y="198" fill="#9F1239" font-size="20" font-weight="800">
      단기 낙폭 과대 기술주 테마를 겨냥한 스마트머니의 선별적 저가 매수세 집중
    </text>
  </g>

  <!-- Card 03: [방어 인컴형] (y=836, h=242) -->
  <g transform="translate(70, 836)" filter="url(#cardShadow)">
    <rect width="940" height="242" rx="24" fill="#FFFFFF" stroke="#BFDBFE" stroke-width="2"/>
    <rect x="0" y="0" width="8" height="242" rx="4" fill="#3B82F6"/>

    <!-- Header line: 스타일명 + 직관적 한글 목적 뱃지 + 금액/점유율 -->
    <rect x="35" y="18" width="165" height="42" rx="10" fill="#DBEAFE" stroke="#93C5FD" stroke-width="1.4"/>
    <text x="117.5" y="47" fill="#1D4ED8" font-size="22" font-weight="900" text-anchor="middle">03 방어 인컴형</text>
    
    <rect x="210" y="18" width="150" height="42" rx="10" fill="#F1F5F9" stroke="#E2E8F0" stroke-width="1.2"/>
    <text x="285" y="46" fill="#475569" font-size="20" font-weight="900" text-anchor="middle">변동성 방어·채권</text>

    <text x="905" y="48" fill="#1D4ED8" font-size="30" font-weight="900" text-anchor="end" class="tabular">+${defensiveInflow.toLocaleString()}억원 <tspan font-size="20" fill="#64748B" font-weight="800">(점유율 ${defensivePct}%)</tspan></text>

    <line x1="35" y1="72" x2="905" y2="72" stroke="#F1F5F9" stroke-width="1.5"/>

    <!-- Middle: 와이드 단일 칩 (h=62, y=84) -->
    <g transform="translate(35, 84)">
      <rect width="870" height="62" rx="12" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1.4"/>
      <rect x="16" y="14" width="70" height="34" rx="8" fill="#DBEAFE"/>
      <text x="51" y="38" fill="#1D4ED8" font-size="18" font-weight="900" text-anchor="middle">1위 집중</text>
      <text x="100" y="40" fill="#0F172A" font-size="21" font-weight="900">ACE 회사채(AA-이상)액티브</text>
      <rect x="390" y="14" width="155" height="34" rx="8" fill="#FFFFFF" stroke="#BFDBFE" stroke-width="1.2"/>
      <text x="467.5" y="38" fill="#1D4ED8" font-size="18" font-weight="900" text-anchor="middle" class="tabular">+168억원 순유입</text>
      <text x="560" y="40" fill="#475569" font-size="18" font-weight="800">(우량 신용등급 안전 이자수익 완충)</text>
    </g>

    <!-- Bottom: Factual Commentary Band (y=160, h=64) -->
    <rect x="35" y="160" width="870" height="64" rx="14" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1.2"/>
    <rect x="48" y="174" width="105" height="36" rx="8" fill="#DBEAFE"/>
    <text x="100.5" y="199" fill="#1D4ED8" font-size="18" font-weight="900" text-anchor="middle">수급 팩트</text>
    <text x="168" y="198" fill="#1E40AF" font-size="20" font-weight="800">
      시장 변동성 속 우량 크레딧 회사채 중심의 안전 이자수익 완충 수급 형성
    </text>
  </g>

  <!-- Bottom KRX Notice Banner (y=1092, h=54) -->
  <g transform="translate(70, 1092)">
    <rect width="940" height="54" rx="14" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.4"/>
    <text x="470" y="34" fill="#475569" font-size="20" font-weight="800" text-anchor="middle">
      KRX 2026.09.30 마감 공시 기준 · 당일 실질 순유입 상위 종목군 스타일 분류 통계
    </text>
  </g>

  <!-- Common Disclaimer & Watermark -->
  ${commonFooter}
</svg>
`;

async function run() {
  const outSvgPath = path.join(artifactDir, 'slide_06_preview_v2.svg');
  const outPngPath = path.join(artifactDir, 'slide_06_preview_v2.png');
  fs.writeFileSync(outSvgPath, svg, 'utf-8');
  console.log('Saved SVG to:', outSvgPath);

  await sharp(Buffer.from(svg))
    .resize(1080, 1350)
    .png()
    .toFile(outPngPath);
  console.log('Rendered PNG to:', outPngPath);
}

run().catch(console.error);
