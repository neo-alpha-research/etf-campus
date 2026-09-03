import type { MarketBriefingPayload, Env } from "../types";
import type { MarketRegime } from "./market-regime";

const FALLBACK_GEMINI_KEY = "AIzaSyAJNLIrtFz90VGnEQHSIpUVBcNYYVWPar0";

export interface PolishedNarrative {
  slide1Subheadline: string;
  slide1Tip: string;
  slide6Block1Title: string;
  slide6Block1Desc: string;
  captionOpening: string;
  captionMarketSummary: string;
  captionThemeAnalysis: string;
  captionWatchPoint: string;
  threadsOpening: string;
  threadsMarketSummary: string;
  threadsWatchPoint: string;
  firstComment: string;
  source: "gemini-refined" | "rule-engine-fallback";
}

export async function reviewAndRefineWithGemini(
  payload: MarketBriefingPayload,
  regime: MarketRegime,
  env: Env
): Promise<PolishedNarrative> {
  const apiKey = env.GEMINI_API_KEY || FALLBACK_GEMINI_KEY;
  if (!apiKey) {
    return { ...regime, source: "rule-engine-fallback" };
  }

  const kospi = payload.kospiChangePct ?? 0;
  const etfRet = payload.generalAumWeightedReturnPct ?? 0;
  const up = payload.upCount ?? 0;
  const down = payload.downCount ?? 0;

  const systemPrompt = `당신은 대한민국 최고 수준의 공인 펀드매니저이자 수석 금융 에디터 'Neo'입니다.
제공된 1차 마켓 브리핑 초안을 검토하여, 상업적 홍보색을 완전히 배제하고 독자가 믿고 읽는 '고밀도 순수 공공재 시황 정보 칼럼'으로 품격 있게 윤문(Polish)하십시오.

## 엄격 준수 원칙 (Strict Rules)
1. 팩트 수치 절대 변조 금지: KOSPI(${kospi}%), 일반 ETF(${etfRet}%), 상승(${up}개), 하락(${down}개) 등 모든 숫자를 임의로 바꾸지 마십시오.
2. 상업적 홍보색 전면 제거 (순수 공공재 시황 칼럼 원칙):
   - '무료', '완벽 비교', '프로필 링크', '리포트 보러가기', '다운로드', '클릭' 등 모든 세일즈/홍보 유도 어휘 전면 금지.
   - 외부 링크 없이도 본문 자체만으로 어제 시장의 핵심 맥락(Why it moved)을 100% 이해할 수 있는 완결형 정보 제공.
3. 본문 엔딩: 광고성 링크 유도 대신 오늘 개장 후 주목할 거시 지표나 심리적 체크포인트 1문장 + 대화형 질문으로 담백하게 종결.
4. 첫 댓글: 프로필 방문 유도 멘트 전면 금지. 오직 '한국거래소(KRX) 공시 데이터 마감 기준일 고지'로만 작성.
5. 컴플라이언스 절대 준수: '추천', '베스트', '대박', '목표가', '패닉', '폭락' 등 투기 조장이나 과장 어휘 절대 금지.
6. 페르소나 준수: '현직' 단어 전면 금지 ('운용역' 사용).
7. 스레드/댓글 내 외부 URL 링크('https://') 기재 전면 금지.
8. 출력 형식: 백틱(\`\`\`) 없는 순수 JSON 단 하나만 출력하십시오.

## JSON 출력 스키마
{
  "slide1Subheadline": "카드뉴스 1페이지 부제 (단문, 테마명과 스마트머니 유입 팩트 요약)",
  "slide1Tip": "카드뉴스 1페이지 💡 팁 문구 (지수 대비 ETF 완충 요인 분석 한 줄)",
  "slide6Block1Title": "카드뉴스 6페이지 1번 요약 제목",
  "slide6Block1Desc": "카드뉴스 6페이지 1번 요약 본문 (2~3문장, 가독성)",
  "captionOpening": "인스타그램 캡션 첫 단락 (장세 규정)",
  "captionMarketSummary": "인스타그램 캡션 시장 요약 문단",
  "captionThemeAnalysis": "인스타그램 본문용 테마별 등락 원인 팩트 분석 1문단 (담백한 정보)",
  "captionWatchPoint": "인스타그램 엔딩용 오늘의 시장 관전 포인트 (세일즈 멘트 없이 지적이고 담백하게)",
  "threadsOpening": "스레드 1번 포스트 오프닝 문장 (해요체, 공감형 화법)",
  "threadsMarketSummary": "스레드 시장 요약 문장 (해요체, 완충 효과 설명)",
  "threadsWatchPoint": "스레드 엔딩용 오늘의 시장 관전 포인트 및 대화형 질문 (외부 링크 유도 절대 금지)",
  "firstComment": "스레드 첫 댓글 (한국거래소 KRX 공시 데이터 마감 기준일 고지)"
}`;

  const userPrompt = `[당일 시장 데이터]
- 기준일: ${payload.asOfDate}
- 코스피 등락률: ${kospi > 0 ? "+" : ""}${kospi.toFixed(2)}%
- 일반 ETF 가중수익률: ${etfRet > 0 ? "+" : ""}${etfRet.toFixed(2)}%
- 상승/하락/보합 종목수: 상승 ${up}개, 하락 ${down}개, 보합 ${payload.flatCount ?? 0}개
- 판별된 국면: ${regime.statusName} (${regime.badgeTag})

[1차 템플릿 초안]
- slide1Subheadline: "${regime.slide1Subheadline}"
- slide1Tip: "${regime.slide1Tip}"
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

위 초안을 읽고 상업적 냄새가 전혀 없는 최고급 공공재 금융 시황 칼럼으로 교정한 JSON을 출력하십시오.`;

  const requestBody = {
    contents: [{ parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  };

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(12000), // 12초 안전 타임아웃
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.warn(`[Gemini] API error: ${response.status} ${response.statusText}`, errBody);
      return { ...regime, source: "rule-engine-fallback", debugError: `HTTP ${response.status}: ${errBody}` } as any;
    }

    const data: any = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      return { ...regime, source: "rule-engine-fallback" };
    }

    const parsed = JSON.parse(candidateText);

    // Compliance & Commercial Prohibition Hard Assertion
    const allText = JSON.stringify(parsed);
    const forbidden = [
      "추천", "베스트", "대박", "목표가", "패닉", "폭락", "현직",
      "프로필 링크", "무료로 확인", "완벽 비교", "리포트 보러", "보러가기", "클릭"
    ];
    for (const word of forbidden) {
      if (allText.includes(word)) {
        console.warn(`[Gemini] Commercial or compliance violation detected ('${word}'). Reverting to 1st draft.`);
        return { ...regime, source: "rule-engine-fallback" };
      }
    }

    if (/https?:\/\//.test(parsed.threadsOpening || "") || /https?:\/\//.test(parsed.threadsMarketSummary || "") || /https?:\/\//.test(parsed.firstComment || "")) {
      console.warn(`[Gemini] URL detected in threads narrative. Reverting to 1st draft.`);
      return { ...regime, source: "rule-engine-fallback" };
    }

    return {
      slide1Subheadline: parsed.slide1Subheadline || regime.slide1Subheadline,
      slide1Tip: parsed.slide1Tip || regime.slide1Tip,
      slide6Block1Title: parsed.slide6Block1Title || regime.slide6Block1Title,
      slide6Block1Desc: parsed.slide6Block1Desc || regime.slide6Block1Desc,
      captionOpening: parsed.captionOpening || regime.captionOpening,
      captionMarketSummary: parsed.captionMarketSummary || regime.captionMarketSummary,
      captionThemeAnalysis: parsed.captionThemeAnalysis || regime.captionThemeAnalysis,
      captionWatchPoint: parsed.captionWatchPoint || regime.captionWatchPoint,
      threadsOpening: parsed.threadsOpening || regime.threadsOpening,
      threadsMarketSummary: parsed.threadsMarketSummary || regime.threadsMarketSummary,
      threadsWatchPoint: parsed.threadsWatchPoint || regime.threadsWatchPoint,
      firstComment: parsed.firstComment || regime.firstComment,
      source: "gemini-refined",
    };
  } catch (err: any) {
    console.warn(`[Gemini] Failed to refine narrative (using fallback):`, err);
    return { ...regime, source: "rule-engine-fallback", debugError: String(err?.message || err) } as any;
  }
}
