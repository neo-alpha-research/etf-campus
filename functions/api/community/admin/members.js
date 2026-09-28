import { adminSupabase } from "../_lib/supabase";
import { errorResponse, jsonResponse, readBearerToken } from "../_lib/api-security";

const ALLOWED_SORT_FIELDS = new Set(["created_at", "public_nickname", "status", "role"]);
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
  // 1. Strict environment guard: Preview and Production backoffice authorized
  const envType = context.env?.COMMUNITY_ENVIRONMENT;
  if (envType !== "preview" && envType !== "production") {
    return errorResponse(403, "FORBIDDEN", "백오피스 회원 조회 API는 승인된 운영 및 프리뷰 환경에서만 허용됩니다.");
  }

  // 2. Standardized Bearer token verification (RFC 6750)
  const authorization = context.request.headers.get("Authorization");
  const providedToken = readBearerToken(authorization) || context.request.headers.get("X-Backoffice-Token");

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
  const rawRoleParam = url.searchParams.get("role")?.trim() || null;
  const rawStatusParam = url.searchParams.get("status")?.trim() || null;
  const includeStats = url.searchParams.get("stats") === "true";
  const rawSort = url.searchParams.get("sort") || "created_at";
  const rawDir = (url.searchParams.get("dir") || "desc").toLowerCase();

  if (rawSearch && rawSearch.length > MAX_SEARCH_LENGTH) {
    return errorResponse(400, "VALIDATION_ERROR", `검색어는 최대 ${MAX_SEARCH_LENGTH}자까지 허용됩니다.`);
  }

  if (rawPage > MAX_PAGE) {
    return errorResponse(400, "VALIDATION_ERROR", `페이지 번호는 최대 ${MAX_PAGE}까지 허용됩니다.`);
  }

  if (rawRoleParam && !VALID_ROLES.has(rawRoleParam)) {
    return errorResponse(400, "VALIDATION_ERROR", `유효하지 않은 역할(role) 필터입니다: ${rawRoleParam}`);
  }

  if (rawStatusParam && !VALID_STATUSES.has(rawStatusParam)) {
    return errorResponse(400, "VALIDATION_ERROR", `유효하지 않은 상태(status) 필터입니다: ${rawStatusParam}`);
  }

  const rawRole = rawRoleParam || null;
  const rawStatus = rawStatusParam || null;

  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : DEFAULT_LIMIT, 1), MAX_LIMIT);
  const page = Math.max(Number.isFinite(rawPage) ? rawPage : 1, 1);
  const offset = (page - 1) * limit;

  const sortField = ALLOWED_SORT_FIELDS.has(rawSort) ? rawSort : "created_at";
  const sortDirection = ALLOWED_SORT_DIRECTIONS.has(rawDir) ? rawDir : "desc";

  try {
    const supabase = adminSupabase(context.env);

    const rpcPromises = [
      supabase.rpc("count_backoffice_members", {
        p_search: rawSearch,
        p_role: rawRole,
        p_status: rawStatus,
      }),
      supabase.rpc("get_backoffice_members", {
        p_limit: limit,
        p_offset: offset,
        p_search: rawSearch,
        p_role: rawRole,
        p_status: rawStatus,
        p_sort_field: sortField,
        p_sort_direction: sortDirection,
      }),
    ];

    if (includeStats) {
      rpcPromises.push(supabase.rpc("get_backoffice_member_stats"));
    }

    const [countResult, listResult, statsResult] = await Promise.all(rpcPromises);

    // 4. Strict validation of RPC count response
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

    // 6. Strict field validation & mapping (Zero-Hallucination: preserve nulls, no raw emails)
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
        // Detailed modal fields (Zero-Hallucination)
        age_band: row.age_band ?? null,
        interest_account_type: row.interest_account_type ?? null,
        terms_version: row.terms_version ?? null,
        marketing_consent_at: row.marketing_consent_at ?? null,
        signup_utm_medium: row.signup_utm_medium ?? null,
        signup_utm_campaign: row.signup_utm_campaign ?? null,
        last_sign_in_at: row.last_sign_in_at ?? null,
        suspended_until: row.suspended_until ?? null,
        oauth_providers: Array.isArray(row.oauth_providers) ? row.oauth_providers : [],
      });
    }

    let stats = null;
    if (includeStats) {
      if (!statsResult || statsResult.error || !Array.isArray(statsResult.data) || statsResult.data.length === 0) {
        stats = {
          status: "ERROR",
          total_members: null,
          today_signups: null,
          marketing_consent_count: null,
          marketing_consent_rate: null,
        };
      } else {
        const s = statsResult.data[0];
        stats = {
          status: "OK",
          total_members: s.total_members !== null && typeof s.total_members !== "undefined" ? Number(s.total_members) : null,
          today_signups: s.today_signups !== null && typeof s.today_signups !== "undefined" ? Number(s.today_signups) : null,
          marketing_consent_count: s.marketing_consent_count !== null && typeof s.marketing_consent_count !== "undefined" ? Number(s.marketing_consent_count) : null,
          marketing_consent_rate: s.marketing_consent_rate !== null && typeof s.marketing_consent_rate !== "undefined" ? Number(s.marketing_consent_rate) : null,
        };
      }
    }

    const responsePayload = {
      members,
      pagination: {
        total: totalCount,
        page,
        limit,
        has_more: offset + members.length < totalCount,
      },
    };

    if (stats) {
      responsePayload.stats = stats;
    }

    return jsonResponse(responsePayload);
  } catch {
    return errorResponse(503, "UNAVAILABLE", "회원 목록 조회 중 오류가 발생했습니다.");
  }
}
