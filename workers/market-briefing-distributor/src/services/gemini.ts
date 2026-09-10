import type { MarketBriefingPayload, Env } from "../types";
import type { MarketRegime } from "./market-regime";

// 7대 마스터 검증 토큰 풀 (GEMINI_API_MASTER_REGISTRY.md SSOT)
export const MASTER_GEMINI_TOKENS = [
  "AIzaSyCvPN7npTB8WzB3fMAuP-JAdp_ooAenk5s", // Primary (#1)
  "AIzaSyAJNLIrtFz90VGnEQHSIpUVBcNYYVWPar0", // Backup 1 (#2)
  "AQ.Ab8RN6IhUi86rXWfKKSlb4Okj2tUS0kVVVs8ygq94s1vElw1Ng", // Backup 2 (#3)
  "AQ.Ab8RN6I6BZOQW23HVRzfoDdGYxCISpci5OItTEXeQSoLKGxOaQ", // Backup 3 (#4)
  "AQ.Ab8RN6I2hocZxArtRwjcKuu_FxnYIngCUH1noqApCfYtw68WsA", // Backup 4 (#5)
  "AQ.Ab8RN6JVoQos0hp7JpLRXNDroImdaeuyoMW31Su-hkHaQN2CJg", // Backup 5 (#6)
  "AQ.Ab8RN6KWvZcOxMN9Ks0WU4xbQjKZDatV28qtFDCbeGeIEY1WPw", // Backup 6 (#7)
];

// 최신 3.8 Flash부터 하향식으로 강하하는 5계층 모델 워터폴
export const MODEL_WATERFALL = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash",
];

export interface PolishedNarrative extends MarketRegime {
  // Slide 1
  slide1Subheadline: string;
  slide1Tip: string;

  // Slide 4
  slide4BannerTitle: string;
  slide4BannerDesc: string;

  // Slide 5
  slide5BannerTitle: string;
  slide5BannerDesc: string;
  slide5ActionTip: string;

  // Slide 6
  slide6Block1Title: string;
  slide6Block1Desc: string;

  // Instagram Caption
  captionOpening: string;
  captionMarketSummary: string;
  captionThemeAnalysis: string;
  captionWatchPoint: string;

  // Threads
  threadsOpening: string;
  threadsMarketSummary: string;
  threadsWatchPoint: string;

  // Common
  firstComment: string;
  source: "gemini-refined" | "rule-engine-fallback";
  modelUsed?: string;
  tokenIndex?: number;
  failoverSteps?: string[];
  debugError?: string;
}

const TOKEN_COOLDOWNS: Record<string, number> = {};

function getAllGeminiTokens(env?: Env): string[] {
  const tokens: string[] = [];

  const envKey = (env?.GEMINI_API_KEY || (typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : "") || "").trim();
  if (envKey && !tokens.includes(envKey)) {
    tokens.push(envKey);
  }

  for (const masterKey of MASTER_GEMINI_TOKENS) {
    if (!tokens.includes(masterKey)) {
      tokens.push(masterKey);
    }
  }

  return tokens;
}

export async function reviewAndRefineWithGemini(
  payload: MarketBriefingPayload,
  regime: MarketRegime,
  env?: Env
): Promise<PolishedNarrative> {
  const tokens = getAllGeminiTokens(env);
  if (!tokens || tokens.length === 0) {
    return { ...regime, source: "rule-engine-fallback" };
  }

  const kospi = payload.kospiChangePct ?? 0;
  const kosdaq = payload.kosdaqChangePct ?? 0;
  const etfRet = payload.generalAumWeightedReturnPct ?? 0;
  const capSpread = regime.capSpread ?? Number((kospi - kosdaq).toFixed(2));
  const etfDivergence = regime.etfDivergence ?? Number((kospi - etfRet).toFixed(2));
  const up = payload.upCount ?? 0;
  const down = payload.downCount ?? 0;
  const flat = payload.flatCount ?? 0;
  const topInflowsList = payload.periodicFlows?.dailyFundFlows?.topInflows?.slice(0, 5) || [];
  const topInflowsStr = topInflowsList.length > 0
    ? topInflowsList.map(i => `${i.name || (i as any).etfName} +${i.inflow || Math.round(((i as any).netInflowValue || 0) / 100000000)}억원`).join(", ")
    : "집계 중";

  const sortedPeerGroups = [...(payload.peerGroups || [])].sort(
    (a, b) => (b.cappedAumWeightedReturnPct ?? 0) - (a.cappedAumWeightedReturnPct ?? 0)
  );
  const cleanTheme = (str?: string) => (str || "").replace(/\s*\([^)]*\)/g, "").trim();
  const topTheme = sortedPeerGroups[0];
  const bottomTheme = sortedPeerGroups.length > 1 ? sortedPeerGroups[sortedPeerGroups.length - 1] : undefined;
  const topThemeText = topTheme ? `${cleanTheme(topTheme.peerGroup)} ${topTheme.cappedAumWeightedReturnPct !== undefined ? (topTheme.cappedAumWeightedReturnPct >= 0 ? "+" : "") + topTheme.cappedAumWeightedReturnPct.toFixed(2) + "%" : ""}`.trim() : "없음";
  const bottomThemeText = bottomTheme ? `${cleanTheme(bottomTheme.peerGroup)} ${bottomTheme.cappedAumWeightedReturnPct !== undefined ? (bottomTheme.cappedAumWeightedReturnPct >= 0 ? "+" : "") + bottomTheme.cappedAumWeightedReturnPct.toFixed(2) + "%" : ""}`.trim() : "없음";

  const systemPrompt = `당신은 숫자를 다루고 AI 금융 도구를 직접 만드는 1인 빌더이자 금융 분석가 'Neo'입니다.
제공된 1차 마켓 브리핑 초안을 검토하여, 상업적 홍보색을 완전히 배제하고 독자가 믿고 읽는 '고밀도 순수 공공재 시황 정보 칼럼'으로 품격 있게 교정(Polish)하십시오.

## 3축 시장 분석 가이드 (3-Axis Fund Analyst Perspective)
1. 코스피 vs 코스닥 스프레드: 대형주 쏠림인지, 코스닥 중심 중소형/성장 테마 장세인지 명확히 짚어주십시오.
2. 코스피 vs 일반 ETF 가중수익률 괴리: 코스피 지수가 급등했더라도 분산 ETF 가중수익률과의 괴리가 크다면 '지수 착시형 차별화 장세'임을 짚어주고, 지수 하락 시 ETF가 버텼다면 '자산배분의 완충 선방'임을 부각하십시오.
3. 실질 수급 맥락 (Why it moved): 지수 등락 수치 나열에 그치지 않고, 스마트머니 순유입 종목군과 주도 테마의 결합으로 시장의 실질 체감 온도를 설명하십시오.

## 엄격 준수 원칙 (Strict Rules)
1. 팩트 데이터 및 수급 사실 절대 변조/날조 금지:
   - KOSPI ${kospi}%, KOSDAQ ${kosdaq}%, 일반 ETF ${etfRet}%, 상승 ${up}개, 하락 ${down}개 등 모든 숫자를 임의로 바꾸지 마십시오.
   - [수급 팩트 엄수]: 실제 스마트머니 순유입 상위 종목(${topInflowsStr})에 존재하지 않는 종목이나 지수(예: 당일 목록에 없는 '미국 대표지수' 등)를 절대 언급하거나 지어내지 마십시오. 오직 실제 유입 종목과 그 성격(채권, 금리, 배당 등)만 서술하십시오.
2. 괄호() 남발 절대 금지:
   - 본문 요약, 타래, 슬라이드 텍스트 어디에도 수익률이나 부연 설명을 감싸는 괄호를 일체 사용하지 마십시오. (예: '에너지 +2.95%' ⭕, '에너지 (+2.95%)' ❌, '하락 종목 181개' ⭕, '하락 종목(181개)' ❌). 단, ETF 정식 종목명에 포함된 고유 괄호는 검색/식별을 위해 예외 허용합니다.
3. 테마명 부연 괄호 정제:
   - 테마명에 포함된 괄호 부연 설명(예: '(원유·천연가스)')은 모두 제거하고 핵심 명칭만 사용하십시오.
4. 상위/하위 랭킹 표기 통일:
   - 모든 장세(전체 하락일·전체 상승일 등)의 정합성을 위해 테마 랭킹은 '상승/하락' 대신 반드시 '상위/하위'('▲ 상위 1위', '▼ 하위 1위', '▲ 상위 Top 3', '▼ 하위 Worst 3')로만 표기하십시오.
5. Absolute Zero Emoji 절대 준수:
   - 본문, 타래, 슬라이드 텍스트 어디에도 이모지를 단 하나도 포함하지 마십시오 (이모지 0개).
6. 상업적 홍보색 전면 제거 (순수 공공재 시황 칼럼 원칙):
   - '무료', '완벽 비교', '프로필 링크', '리포트 보러가기', '다운로드', '클릭' 등 모든 세일즈/홍보 유도 어휘 전면 금지.
   - 외부 링크 없이도 본문 자체만으로 해당 거래일 시장의 핵심 맥락(Why it moved)을 100% 이해할 수 있는 완결형 정보 제공.
7. 인스타그램 캡션 엔딩: 세일즈 멘트 없이 오늘 개장 후 주목할 거시 지표나 심리적 체크포인트 1문장으로 담백하게 종결.
8. 스레드 문체 및 첫 댓글 헌법 (골든 3단 압축 & 친근한 설명체 반말 — 2026-09-10 운영자 확정):
   - 스레드 단일 타래 본문(threadsOpening, threadsMarketSummary, threadsWatchPoint) 및 첫 댓글(firstComment)은 공급자 어투(~알려드립니다, ~소개합니다) 및 해요체(~해요, ~했어요), 공지형 존댓말(~했습니다)을 전면 영구 금지하고, 친근하고 단단한 멘토형 설명체 반말(~했거든, ~이잖아, ~인 셈이지, ~있어, ~끝났어, ~한 거야, ~해야 해, ~될 거야)을 일관 적용하십시오.
   - threadsWatchPoint: '다들 앞으로의 흐름을 어떻게 봐?' 질문과 함께 1번/2번 선택지 제시 후 '댓글에 1 또는 2 숫자만 툭 남겨줘도 좋아.'로 마감하십시오.
   - firstComment: 40~60자 초단문 친근한 반말 롤모델('1. [내 생각 1줄]. [상황 예상 1줄].')과 '* 한국거래소(KRX) 공시 데이터 마감 기준 · 국내 상장 일반 ETF 전수 분석'을 병기하십시오.
9. 컴플라이언스 절대 준수: '추천', '베스트', '대박', '목표가', '패닉', '폭락' 등 투기 조장이나 과장 어휘 절대 금지.
10. 페르소나 준수: '현직', '운용역' 등 일체의 직함 표기 전면 금지.
11. 스레드/댓글 내 외부 URL 링크('https://') 기재 전면 금지.
12. '어제' 등 상대적 시간 표현 절대 금지 (시점 왜곡 방지):
   - 금요일 종가 데이터가 토요일이나 월요일에 발행되는 등 주말/연휴 시차로 인한 독자의 시간 인식 혼선을 원천 차단하기 위해, 본문, 타래, 캡션 어디에도 '어제'라는 표현을 절대 쓰지 마십시오.
   - '장 마감 기준' 또는 '국내 증시는', '코스피는'과 같이 객관적 시점 표현만 사용하십시오.
13. 글자 수 예산(Character Budget) 절대 엄수 (카드뉴스 텍스트 넘침 방지):
   - slide1Subheadline: 공백 포함 최대 26자 이내
   - slide4BannerTitle: 공백 포함 최대 22자 이내
   - slide4BannerDesc: 공백 포함 최대 30자 이내
   - slide5BannerTitle: 공백 포함 최대 24자 이내
   - slide5BannerDesc: 공백 포함 최대 32자 이내
   - slide6Block1Title: 공백 포함 최대 20자 이내
   - slide6Block1Desc: 공백 포함 최대 30자 이내
14. 출력 형식: 백틱(\`\`\`) 없는 순수 JSON 단 하나만 출력하십시오.

## JSON 출력 스키마
{
  "slide1Subheadline": "카드뉴스 1페이지 부제 (공백 포함 최대 26자, 테마명과 실제 유입 종목 팩트 요약, 이모지 0개, 괄호 금지)",
  "slide1Tip": "카드뉴스 1페이지 팁 문구 (공백 포함 최대 28자, 지수 대비 ETF 완충 요인 한 줄, 이모지 0개, 괄호 금지)",
  "slide4BannerTitle": "카드뉴스 4페이지 수급 배너 제목 (공백 포함 최대 22자, 실제 유입 종목 특성 요약, 이모지 0개, 괄호 금지)",
  "slide4BannerDesc": "카드뉴스 4페이지 수급 설명 (공백 포함 최대 30자, 이모지 0개, 괄호 금지)",
  "slide5BannerTitle": "카드뉴스 5페이지 괴리율 배너 제목 (공백 포함 최대 24자, 왜곡 진단 한 줄, 이모지 0개, 괄호 금지)",
  "slide5BannerDesc": "카드뉴스 5페이지 괴리율 설명 (공백 포함 최대 32자, 이모지 0개, 괄호 금지)",
  "slide5ActionTip": "카드뉴스 5페이지 실전 투자자 팁 (공백 포함 최대 35자, 호가 점검 조언, 이모지 0개, 괄호 금지)",
  "slide6Block1Title": "카드뉴스 6페이지 1번 요약 제목 (공백 포함 최대 20자, 이모지 0개, 괄호 금지)",
  "slide6Block1Desc": "카드뉴스 6페이지 1번 요약 본문 (공백 포함 최대 30자, 이모지 0개, 괄호 금지)",
  "captionOpening": "인스타그램 캡션 첫 단락 (장세 규정, '어제' 표현 절대 금지, 이모지 0개, 괄호 금지)",
  "captionMarketSummary": "인스타그램 캡션 시장 요약 문단 (이모지 0개, 괄호 금지)",
  "captionThemeAnalysis": "인스타그램 본문용 테마별 등락 원인 팩트 분석 1문단 (이모지 0개, 괄호 금지)",
  "captionWatchPoint": "인스타그램 엔딩용 오늘의 시장 관전 포인트 (세일즈 멘트 없이 지적이고 담백하게, 이모지 0개, 괄호 금지)",
  "threadsOpening": "스레드 1번 포스트 오프닝 문장 (친근한 설명체 반말(~했거든, ~이잖아, ~인 셈이지), '어제' 표현 절대 금지, 공감형 화법, 이모지 0개, 괄호 금지)",
  "threadsMarketSummary": "스레드 시장 요약 문장 (친근한 설명체 반말(~했어, ~인 셈이지, ~있어), 완충 효과 설명, 이모지 0개, 괄호 금지)",
  "threadsWatchPoint": "스레드 엔딩용 관전 포인트 및 1 vs 2 참여 질문 (친근한 설명체 반말, '1번: ... \\n2번: ... \\n\\n댓글에 1 또는 2 숫자만 툭 남겨줘도 좋아.' 마감, 외부 링크 절대 금지, 이모지 0개, 괄호 금지)",
  "firstComment": "스레드 첫 댓글 (40~60자 친근한 반말 롤모델 '1. [내 생각 1줄]. [상황 예상 1줄].' + '\\n\\n* 한국거래소(KRX) 공시 데이터 마감 기준 · 국내 상장 일반 ETF 전수 분석' 병기, 이모지 0개)"
}`;

  const userPrompt = `[당일 3대 시장 지표 및 펀드애널리스트 분석 팩트]
- 기준일: ${payload.asOfDate}
- 코스피 (KOSPI): ${kospi > 0 ? "+" : ""}${kospi.toFixed(2)}%
- 코스닥 (KOSDAQ): ${kosdaq > 0 ? "+" : ""}${kosdaq.toFixed(2)}%
- 일반 ETF 가중수익률: ${etfRet > 0 ? "+" : ""}${etfRet.toFixed(2)}%
- 대형주 vs 중소형주 격차 (KOSPI - KOSDAQ 스프레드): ${capSpread > 0 ? "+" : ""}${capSpread.toFixed(2)}%p (${capSpread >= 1.5 ? "대형주 쏠림 심화" : capSpread <= -1.5 ? "중소형 성장주 우위" : "동행"})
- 지수 vs 분산 ETF 괴리 (KOSPI - 일반 ETF 괴리): ${etfDivergence > 0 ? "+" : ""}${etfDivergence.toFixed(2)}%p (${etfDivergence >= 1.5 ? "지수 착시형 쏠림 (분산 ETF 속도 조절)" : etfDivergence <= -1.0 ? "자산배분 방어 선방" : "동행"})
- 판별된 국면: ${regime.statusName} (${regime.badgeTag})
- 상승/하락/보합 종목수: 상승 ${up}개, 보합 ${flat}개, 하락 ${down}개
- 당일 주도/부진 테마: 상위 1위 '${topThemeText}', 하위 1위 '${bottomThemeText}'
- 당일 스마트머니 순유입 TOP: ${topInflowsStr}
- 당일 괴리율 상태: ${regime.disparityStatus}

[1차 시나리오 템플릿 초안]
- slide1Subheadline: "${regime.slide1Subheadline}"
- slide1Tip: "${regime.slide1Tip}"
- slide4BannerTitle: "${regime.slide4BannerTitle}"
- slide4BannerDesc: "${regime.slide4BannerDesc}"
- slide5BannerTitle: "${regime.slide5BannerTitle}"
- slide5BannerDesc: "${regime.slide5BannerDesc}"
- slide5ActionTip: "${regime.slide5ActionTip}"
- slide6Block1Title: "${regime.slide6Block1Title}"
- slide6Block1Desc: "${regime.slide6Block1Desc}"
- captionOpening: "${regime.captionOpening}"
- captionMarketSummary: "${regime.captionMarketSummary}"
- captionThemeAnalysis: "${regime.captionThemeAnalysis}"
- captionWatchPoint: "${regime.captionWatchPoint}"
- threadsOpening: "${regime.threadsOpening}"
- threadsMarketSummary: "${regime.threadsMarketSummary}"
- threadsWatchPoint: "${regime.threadsWatchPoint}"
- firstComment: "${regime.firstComment}"

위 1차 초안을 팩트 데이터와 대조 검토하여, 어긋남이 전혀 없고 상업적 냄새가 배제된 최고급 공공재 금융 시황 칼럼으로 교정한 JSON을 출력하십시오.`;

  const requestBody = {
    contents: [{ parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  };

  const now = Date.now();
  const sortedTokens = [...tokens].sort((a, b) => (TOKEN_COOLDOWNS[a] || 0) - (TOKEN_COOLDOWNS[b] || 0));
  const failoverHistory: string[] = [];

  for (const token of sortedTokens) {
    const realIdx = tokens.indexOf(token) + 1;
    let tokenExhausted = false;

    // 만약 쿨다운 중이라면 일단 스킵 시도
    if (TOKEN_COOLDOWNS[token] && TOKEN_COOLDOWNS[token] > now) {
      failoverHistory.push(`Token #${realIdx} in cooldown`);
      continue;
    }

    for (const modelName of MODEL_WATERFALL) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${token}`;

      try {
        const startTime = Date.now();
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(20000), // 20초 안전 타임아웃
        });

        if (response.ok) {
          const data: any = await response.json();
          const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

          if (candidateText && candidateText.trim()) {
            const parsed = JSON.parse(candidateText);

            // 컴플라이언스 및 금지어 하드 필터링
            const allText = JSON.stringify(parsed);
            const forbidden = [
              "추천", "베스트", "대박", "목표가", "패닉", "폭락", "현직",
              "프로필 링크", "무료로 확인", "완벽 비교", "리포트 보러", "보러가기", "클릭"
            ];
            let hasViolation = false;
            for (const word of forbidden) {
              if (allText.includes(word)) {
                console.warn(`[Gemini] Commercial or compliance violation detected ('${word}'). Reverting to 1st draft.`);
                hasViolation = true;
                break;
              }
            }

            if (!hasViolation) {
              const elapsed = Date.now() - startTime;
              console.log(`[AI Fact-Check] SUCCESS -> Token #${realIdx} with ${modelName} in ${elapsed}ms (Failover steps: ${failoverHistory.length})`);

              // 이모지 및 '어제' 표현 정제 정규식
              const stripEmoji = (str?: string) => (str || "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim();
              const cleanText = (str?: string) => stripEmoji(str).replace(/어제\s*/g, "").trim();

              return {
                ...regime,
                slide1Subheadline: stripEmoji(parsed.slide1Subheadline) || regime.slide1Subheadline,
                slide1Tip: stripEmoji(parsed.slide1Tip) || regime.slide1Tip,
                slide4BannerTitle: stripEmoji(parsed.slide4BannerTitle) || regime.slide4BannerTitle,
                slide4BannerDesc: stripEmoji(parsed.slide4BannerDesc) || regime.slide4BannerDesc,
                slide5BannerTitle: stripEmoji(parsed.slide5BannerTitle) || regime.slide5BannerTitle,
                slide5BannerDesc: stripEmoji(parsed.slide5BannerDesc) || regime.slide5BannerDesc,
                slide5ActionTip: stripEmoji(parsed.slide5ActionTip) || regime.slide5ActionTip,
                slide6Block1Title: stripEmoji(parsed.slide6Block1Title) || regime.slide6Block1Title,
                slide6Block1Desc: stripEmoji(parsed.slide6Block1Desc) || regime.slide6Block1Desc,
                captionOpening: cleanText(parsed.captionOpening) || regime.captionOpening,
                captionMarketSummary: cleanText(parsed.captionMarketSummary) || regime.captionMarketSummary,
                captionThemeAnalysis: cleanText(parsed.captionThemeAnalysis) || regime.captionThemeAnalysis,
                captionWatchPoint: cleanText(parsed.captionWatchPoint) || regime.captionWatchPoint,
                threadsOpening: cleanText(parsed.threadsOpening) || regime.threadsOpening,
                threadsMarketSummary: cleanText(parsed.threadsMarketSummary) || regime.threadsMarketSummary,
                threadsWatchPoint: cleanText(parsed.threadsWatchPoint) || regime.threadsWatchPoint,
                firstComment: stripEmoji(parsed.firstComment) || regime.firstComment,
                source: "gemini-refined",
                modelUsed: modelName,
                tokenIndex: realIdx,
                failoverSteps: failoverHistory,
              };
            }
          }
        }

        // HTTP 에러 처리
        if (response.status === 429 || response.status === 403 || response.status === 402) {
          TOKEN_COOLDOWNS[token] = Date.now() + 60000; // 60초 쿨다운
          tokenExhausted = true;
          failoverHistory.push(`Token #${realIdx} Quota Exhausted (${response.status})`);
          console.warn(`[AI Failover] Token #${realIdx} quota exhausted (${response.status})! Switching immediately to next token from highest model (3.8)...`);
          break; // 즉시 다음 토큰으로 점프 (최상위 3.8부터 다시 시작)
        } else if (response.status === 503 || response.status === 500 || response.status === 502 || response.status === 504 || response.status === 404) {
          failoverHistory.push(`Token #${realIdx} ${modelName} (${response.status})`);
          console.warn(`[AI Failover] Model ${modelName} unavailable on Token #${realIdx} (${response.status}). Stepping down...`);
          continue; // 동일 토큰에서 다음 하위 모델로 강하
        } else {
          failoverHistory.push(`Token #${realIdx} ${modelName} (HTTP ${response.status})`);
          continue;
        }
      } catch (err: any) {
        failoverHistory.push(`Token #${realIdx} ${modelName} (${err?.message || err})`);
        continue;
      }
    }

    if (tokenExhausted) {
      continue;
    }
  }

  console.warn(`[Gemini] All ${tokens.length} tokens and models exhausted. Using 1st draft rule-engine fallback. History:`, failoverHistory.slice(-4));
  return {
    ...regime,
    source: "rule-engine-fallback",
    failoverSteps: failoverHistory,
  };
}
