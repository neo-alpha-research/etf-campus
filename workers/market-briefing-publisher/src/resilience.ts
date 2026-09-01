export interface ResilienceEnv {
  ETF_PRICES: D1Database;
  BRIEFING_KV: KVNamespace;
}

const nowIso = () => new Date().toISOString();
const briefingPayloadKey = (date: string, version: number) => `market-briefing:v0:payload:${date}:v${version}`;
const briefingPointerKey = "market-briefing:v0:latest-pointer";

/**
 * D1 is canonical. The publisher writes a versioned payload to KV only after the
 * briefing has been committed, so cache propagation never determines correctness.
 */
export async function cacheReadyBriefing(
  env: ResilienceEnv,
  input: { asOfDate: string; publicationVersion: number; payload: unknown },
): Promise<void> {
  const payloadKey = briefingPayloadKey(input.asOfDate, input.publicationVersion);
  const pointer = {
    payloadKey,
    asOfDate: input.asOfDate,
    publicationVersion: input.publicationVersion,
    updatedAt: nowIso(),
  };
  await env.BRIEFING_KV.put(payloadKey, JSON.stringify(input.payload));
  await env.BRIEFING_KV.put(briefingPointerKey, JSON.stringify(pointer));
}
