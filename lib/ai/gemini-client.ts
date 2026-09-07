/**
 * 🤖 ETF Campus - 공용 Gemini AI 클라이언트 (SSOT)
 * 7대 마스터 검증 토큰 풀 & 5계층 모델 워터폴 (3.8 Flash -> 2.5 Flash)
 */

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

export interface GeminiWaterfallOptions {
  prompt: string;
  systemInstruction?: string;
  responseJson?: boolean;
  temperature?: number;
  timeoutMs?: number;
  envKey?: string;
}

export interface GeminiWaterfallResult<T = any> {
  success: boolean;
  text?: string;
  data?: T;
  modelUsed?: string;
  tokenIndex?: number;
  failoverSteps?: string[];
  error?: string;
}

const TOKEN_COOLDOWNS: Record<string, number> = {};

export function getAllGeminiTokens(customEnvKey?: string): string[] {
  const tokens: string[] = [];

  const envKey = (customEnvKey || (typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : "") || "").trim();
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

/**
 * 7대 토큰 풀과 5계층 모델 워터폴을 순회하며 Gemini API를 안전하게 호출합니다.
 */
export async function callGeminiWithWaterfall<T = any>(
  options: GeminiWaterfallOptions
): Promise<GeminiWaterfallResult<T>> {
  const {
    prompt,
    systemInstruction,
    responseJson = false,
    temperature = 0.3,
    timeoutMs = 25000,
    envKey,
  } = options;

  const tokens = getAllGeminiTokens(envKey);
  if (!tokens || tokens.length === 0) {
    return { success: false, error: "사용 가능한 Gemini API 토큰이 없습니다." };
  }

  const requestBody: any = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
    },
  };

  if (responseJson) {
    requestBody.generationConfig.responseMimeType = "application/json";
  }

  if (systemInstruction) {
    requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const now = Date.now();
  const sortedTokens = [...tokens].sort((a, b) => (TOKEN_COOLDOWNS[a] || 0) - (TOKEN_COOLDOWNS[b] || 0));
  const failoverHistory: string[] = [];

  for (const token of sortedTokens) {
    const realIdx = tokens.indexOf(token) + 1;
    let tokenExhausted = false;

    // 쿨다운 검사
    if (TOKEN_COOLDOWNS[token] && TOKEN_COOLDOWNS[token] > now) {
      failoverHistory.push(`Token #${realIdx} in cooldown`);
      continue;
    }

    for (const modelName of MODEL_WATERFALL) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${token}`;

      try {
        const controller = new AbortController();
        const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
        clearTimeout(timeoutTimer);

        if (response.ok) {
          const data: any = await response.json();
          let candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

          if (candidateText && candidateText.trim()) {
            candidateText = candidateText.trim();
            if (responseJson) {
              if (candidateText.startsWith("```json")) {
                candidateText = candidateText.replace(/^```json/, "").replace(/```$/, "").trim();
              } else if (candidateText.startsWith("```")) {
                candidateText = candidateText.replace(/^```/, "").replace(/```$/, "").trim();
              }
              const parsed = JSON.parse(candidateText);
              return {
                success: true,
                text: candidateText,
                data: parsed as T,
                modelUsed: modelName,
                tokenIndex: realIdx,
                failoverSteps: failoverHistory,
              };
            }

            return {
              success: true,
              text: candidateText,
              modelUsed: modelName,
              tokenIndex: realIdx,
              failoverSteps: failoverHistory,
            };
          }
        }

        // Quota / Auth 에러 처리 -> 즉시 다음 토큰(최상위 3.8 모델)으로 이동
        if (response.status === 429 || response.status === 403 || response.status === 402) {
          TOKEN_COOLDOWNS[token] = Date.now() + 60000;
          tokenExhausted = true;
          failoverHistory.push(`Token #${realIdx} Quota Exhausted (${response.status})`);
          console.warn(`[Gemini Failover] Token #${realIdx} quota exhausted (${response.status}) -> 다음 토큰으로 전환`);
          break;
        } else if (response.status === 503 || response.status === 500 || response.status === 502 || response.status === 504 || response.status === 404) {
          // 일시적 오류 또는 미지원 모델 -> 동일 토큰 내 하위 모델로 강하
          failoverHistory.push(`Token #${realIdx} ${modelName} (${response.status})`);
          console.warn(`[Gemini Failover] Model ${modelName} unavailable on Token #${realIdx} (${response.status}) -> 하위 모델 시도`);
          continue;
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

  console.warn(`[Gemini] All ${tokens.length} tokens and models exhausted. History:`, failoverHistory.slice(-4));
  return {
    success: false,
    error: `모든 Gemini 토큰 및 모델 워터폴 호출에 실패했습니다. (시도 이력: ${failoverHistory.join(" -> ")})`,
    failoverSteps: failoverHistory,
  };
}
