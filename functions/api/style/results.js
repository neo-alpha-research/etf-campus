import { errorResponse, jsonResponse } from "../community/_lib/api-security";

const VALID_STYLES = new Set([
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
]);

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const cloned = request.clone();
    const payload = await cloned.json().catch(() => null);

    if (!payload || typeof payload !== "object") {
      return errorResponse(400, "VALIDATION_ERROR", "요청 본문이 올바른 JSON 형식이 아닙니다.");
    }

    const { resultId, styleId, bookSlug, axisScores, needScores, completedDate } = payload;

    if (typeof resultId !== "string" || !resultId.trim()) {
      return errorResponse(400, "VALIDATION_ERROR", "resultId는 필수 항목입니다.");
    }

    if (!VALID_STYLES.has(styleId)) {
      return errorResponse(400, "VALIDATION_ERROR", "유효하지 않은 styleId입니다.");
    }

    if (typeof bookSlug !== "string" || !bookSlug.trim()) {
      return errorResponse(400, "VALIDATION_ERROR", "bookSlug는 필수 항목입니다.");
    }

    if (!axisScores || typeof axisScores !== "object") {
      return errorResponse(400, "VALIDATION_ERROR", "axisScores 항목이 올바르지 않습니다.");
    }

    const { view, range, timing, criteria, depth } = axisScores;
    if (
      typeof view !== "number" ||
      typeof range !== "number" ||
      typeof timing !== "number" ||
      typeof criteria !== "number" ||
      typeof depth !== "number"
    ) {
      return errorResponse(400, "VALIDATION_ERROR", "모든 축 점수(view, range, timing, criteria, depth)는 숫자여야 합니다.");
    }

    const { signal, map, income } = needScores || {};
    const needSignal = Number.isInteger(signal) ? signal : 0;
    const needMap = Number.isInteger(map) ? map : 0;
    const needIncome = Number.isInteger(income) ? income : 0;

    if (!completedDate || !DATE_PATTERN.test(completedDate)) {
      return errorResponse(400, "VALIDATION_ERROR", "completedDate는 YYYY-MM-DD 형식이어야 합니다.");
    }

    const db = env?.ETF_PRICES;
    if (db) {
      const query = `
        INSERT OR IGNORE INTO style_diagnosis_results (
          id, style_id, book_slug,
          axis_view, axis_range, axis_timing, axis_criteria, axis_depth,
          need_signal, need_map, need_income,
          completed_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await db
        .prepare(query)
        .bind(
          resultId.trim(),
          styleId,
          bookSlug.trim(),
          view,
          range,
          timing,
          criteria,
          depth,
          needSignal,
          needMap,
          needIncome,
          completedDate,
        )
        .run();
    }

    return jsonResponse(
      {
        success: true,
        resultId: resultId.trim(),
      },
      201,
    );
  } catch (error) {
    return errorResponse(500, "UNAVAILABLE", "통계 저장 중 서버 오류가 발생했습니다.");
  }
}
