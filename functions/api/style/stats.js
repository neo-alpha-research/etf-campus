import { errorResponse, jsonResponse } from "../community/_lib/api-security";

const KV_CACHE_KEY = "style_diagnosis_stats_v1";
const KV_CACHE_TTL = 300; // 5분 (300초)

const ALL_STYLES = [
  "turtle",
  "owl",
  "squirrel",
  "dolphin",
  "elephant",
  "fox",
  "octopus",
  "eagle",
  "hedgehog",
  "otter",
];

const ALL_BOOKS = [
  "momentum-etf-system",
  "index-asset-allocation",
  "dividend-cashflow",
];

export async function onRequestGet(context) {
  try {
    const { env } = context;
    const kv = env?.BRIEFING_KV;
    const db = env?.ETF_PRICES;

    // 1. Check KV Cache
    if (kv) {
      const cached = await kv.get(KV_CACHE_KEY, "json").catch(() => null);
      if (cached && typeof cached === "object" && typeof cached.total === "number") {
        return jsonResponse(cached, 200);
      }
    }

    // 2. Query D1
    let total = 0;
    const styleCountMap = new Map();
    const bookCountMap = new Map();

    if (db) {
      const totalResult = await db
        .prepare("SELECT COUNT(*) as total FROM style_diagnosis_results")
        .first()
        .catch(() => null);
      total = Number(totalResult?.total ?? 0);

      const styleResults = await db
        .prepare("SELECT style_id, COUNT(*) as count FROM style_diagnosis_results GROUP BY style_id")
        .all()
        .catch(() => ({ results: [] }));
      for (const row of styleResults?.results ?? []) {
        styleCountMap.set(row.style_id, Number(row.count ?? 0));
      }

      const bookResults = await db
        .prepare("SELECT book_slug, COUNT(*) as count FROM style_diagnosis_results GROUP BY book_slug")
        .all()
        .catch(() => ({ results: [] }));
      for (const row of bookResults?.results ?? []) {
        bookCountMap.set(row.book_slug, Number(row.count ?? 0));
      }
    }

    const styles = ALL_STYLES.map((styleId) => {
      const count = styleCountMap.get(styleId) ?? 0;
      const share = total > 0 ? Math.round((count / total) * 10_000) / 10_000 : 0;
      return { styleId, count, share };
    });

    const books = ALL_BOOKS.map((bookSlug) => {
      const count = bookCountMap.get(bookSlug) ?? 0;
      const share = total > 0 ? Math.round((count / total) * 10_000) / 10_000 : 0;
      return { bookSlug, count, share };
    });

    const payload = {
      total,
      updatedAt: new Date().toISOString(),
      styles,
      books,
    };

    // 3. Save to KV Cache
    if (kv) {
      await kv.put(KV_CACHE_KEY, JSON.stringify(payload), {
        expirationTtl: KV_CACHE_TTL,
      }).catch(() => {});
    }

    return jsonResponse(payload, 200);
  } catch (error) {
    return errorResponse(500, "UNAVAILABLE", "통계 조회 중 서버 오류가 발생했습니다.");
  }
}
