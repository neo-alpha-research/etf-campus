import { adminSupabase } from "../_lib/supabase";
import { errorResponse, jsonResponse, readBearerToken } from "../_lib/api-security";

const ALLOWED_SORT_FIELDS = new Set(["created_at", "public_nickname", "status"]);
const ALLOWED_SORT_DIRECTIONS = new Set(["asc", "desc"]);
const VALID_ROLES = new Set(["guest", "member", "moderator", "admin"]);
const VALID_STATUSES = new Set(["active", "suspended", "blocked"]);

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;
const MAX_PAGE = 1000;
const MAX_SEARCH_LENGTH = 100;

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function onRequestGet(context) {
  // 1. Strict environment guard: Preview only during pilot phase
  if (context.env?.COMMUNITY_ENVIRONMENT !== "preview") {
    return errorResponse(403, "FORBIDDEN", "백오피스 회원 조회 API는 프리뷰 환경에서만 허용됩니다.");
  }

  // 2. Standardized Bearer token verification (RFC 6750)
  const authorization = context.request.headers.get("Authorization");
  const providedToken = readBearerToken(authorization);

  if (!providedToken) {
    return errorResponse(401, "AUTH_REQUIRED", "백오피스 인증 토큰이 필요합니다.");
  }

  const configuredSecret = context.env?.BACKOFFICE_READ_SECRET;
  if (!configuredSecret || typeof configuredSecret !== "string" || !timingSafeEqual(providedToken, configuredSecret)) {
    return errorResponse(403, "FORBIDDEN", "유효하지 않은 백오피스 인증 토큰입니다.");
  }

  // 3. Input validation and parameter bounds
  const url = new URL(context.request.url);
  const rawLimit = parseInt(url.searchParams.get("limit") || `${DEFAULT_LIMIT}`, 10);
  const rawPage = parseInt(url.searchParams.get("page") || "1", 10);
  const rawSearch = url.searchParams.get("search")?.trim() || null;
  const rawSort = url.searchParams.get("sort") || "created_at";
  const rawDir = (url.searchParams.get("dir") || "desc").toLowerCase();

  if (rawSearch && rawSearch.length > MAX_SEARCH_LENGTH) {
    return errorResponse(400, "VALIDATION_ERROR", `검색어는 최대 ${MAX_SEARCH_LENGTH}자까지 허용됩니다.`);
  }

  if (rawPage > MAX_PAGE) {
    return errorResponse(400, "VALIDATION_ERROR", `페이지 번호는 최대 ${MAX_PAGE}까지 허용됩니다.`);
  }

  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : DEFAULT_LIMIT, 1), MAX_LIMIT);
  const page = Math.max(Number.isFinite(rawPage) ? rawPage : 1, 1);
  const offset = (page - 1) * limit;

  const sortField = ALLOWED_SORT_FIELDS.has(rawSort) ? rawSort : "created_at";
  const sortDirection = ALLOWED_SORT_DIRECTIONS.has(rawDir) ? rawDir : "desc";

  try {
    const supabase = adminSupabase(context.env);

    const [countResult, listResult] = await Promise.all([
      supabase.rpc("count_backoffice_members", { p_search: rawSearch }),
      supabase.rpc("get_backoffice_members", {
        p_limit: limit,
        p_offset: offset,
        p_search: rawSearch,
        p_sort_field: sortField,
        p_sort_direction: sortDirection,
      }),
    ]);

    // 4. Strict validation of RPC count response (never silently coerce errors or nulls to 0)
    if (countResult.error || countResult.data === null || typeof countResult.data === "undefined") {
      return errorResponse(503, "UNAVAILABLE", "회원 수 집계에 실패했습니다.");
    }

    const totalCount = Number(countResult.data);
    if (!Number.isFinite(totalCount) || totalCount < 0) {
      return errorResponse(503, "UNAVAILABLE", "회원 수 집계 데이터가 올바르지 않습니다.");
    }

    // 5. Strict validation of RPC list response
    if (listResult.error || !Array.isArray(listResult.data)) {
      return errorResponse(503, "UNAVAILABLE", "회원 목록을 조회하지 못했습니다.");
    }

    const rawRows = listResult.data;

    // 6. Strict field validation & mapping (Zero-Hallucination: do NOT convert missing values into false/active/member)
    const members = [];
    for (const row of rawRows) {
      if (!row || typeof row !== "object" || !row.id || !row.created_at) {
        return errorResponse(503, "UNAVAILABLE", "회원 데이터 형식이 올바르지 않습니다.");
      }

      members.push({
        id: row.id,
        public_nickname: row.public_nickname ?? "",
        email_masked: row.email_masked ?? null,
        role: VALID_ROLES.has(row.role) ? row.role : "확인 불가",
        status: VALID_STATUSES.has(row.status) ? row.status : "확인 불가",
        profile_complete: typeof row.profile_complete === "boolean" ? row.profile_complete : null,
        terms_consented_at: row.terms_consented_at ?? null,
        marketing_consent: typeof row.marketing_consent === "boolean" ? row.marketing_consent : null,
        signup_utm_source: row.signup_utm_source ?? null,
        created_at: row.created_at,
      });
    }

    return jsonResponse({
      members,
      pagination: {
        total: totalCount,
        page,
        limit,
        has_more: offset + members.length < totalCount,
      },
    });
  } catch {
    return errorResponse(503, "UNAVAILABLE", "회원 목록 조회 중 오류가 발생했습니다.");
  }
}
