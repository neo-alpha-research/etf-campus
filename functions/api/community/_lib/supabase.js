import { errorResponse } from "../_lib/api-security";

function requiredEnv(env, name) {
  const value = env[name];
  if (!value || typeof value !== "string") throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function queryBuilder(config, table) {
  const state = { method: "GET", params: new URLSearchParams(), body: undefined, preferSingle: false };
  const builder = {
    select(columns) { state.params.set("select", columns); return builder; },
    eq(column, value) { state.params.set(column, `eq.${value}`); return builder; },
    order(column, options = {}) { state.params.set("order", `${column}.${options.ascending === false ? "desc" : "asc"}`); return builder; },
    limit(value) { state.params.set("limit", String(value)); return builder; },
    insert(value) { state.method = "POST"; state.body = value; return builder; },
    update(value) { state.method = "PATCH"; state.body = value; return builder; },
    async maybeSingle() { const result = await execute(); return { data: Array.isArray(result.data) ? result.data[0] ?? null : result.data ?? null, error: result.error }; },
    async single() { const result = await execute(); const data = Array.isArray(result.data) ? result.data[0] ?? null : result.data ?? null; return { data, error: result.error ?? (data ? null : { message: "No row returned" }) }; },
    then(resolve, reject) { return execute().then(resolve, reject); },
  };

  async function execute() {
    const url = new URL(`/rest/v1/${table}`, config.url);
    state.params.forEach((value, key) => url.searchParams.set(key, value));
    const headers = new Headers({ apikey: config.apiKey, Authorization: `Bearer ${config.accessToken ?? config.apiKey}` });
    if (state.method !== "GET") {
      headers.set("Content-Type", "application/json");
      headers.set("Prefer", "return=representation");
    }
    try {
      const response = await fetch(url, { method: state.method, headers, body: state.body === undefined ? undefined : JSON.stringify(state.body) });
      const data = await response.json().catch(() => null);
      if (!response.ok) return { data: null, error: data ?? { message: "Supabase request failed" } };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : "Supabase request failed" } };
    }
  }

  return builder;
}

function supabaseClient(env, accessToken, serviceRole = false) {
  const url = requiredEnv(env, "SUPABASE_URL");
  const apiKey = serviceRole ? requiredEnv(env, "SUPABASE_SERVICE_ROLE_KEY") : requiredEnv(env, "SUPABASE_ANON_KEY");
  const bearer = accessToken ?? apiKey;

  return {
    from(table) { return queryBuilder({ url, apiKey, accessToken: bearer }, table); },
    async rpc(functionName, args = {}) {
      try {
        const response = await fetch(new URL(`/rest/v1/rpc/${functionName}`, url), {
          method: "POST",
          headers: { apikey: apiKey, Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
          body: JSON.stringify(args),
        });
        const data = await response.json().catch(() => null);
        return response.ok ? { data, error: null } : { data: null, error: data ?? { message: "Supabase RPC failed" } };
      } catch (error) {
        return { data: null, error: { message: error instanceof Error ? error.message : "Supabase RPC failed" } };
      }
    },
    auth: {
      async getUser(token) {
        try {
          const response = await fetch(new URL("/auth/v1/user", url), { headers: { apikey: apiKey, Authorization: `Bearer ${token}` } });
          const data = await response.json().catch(() => null);
          return response.ok ? { data: { user: data }, error: null } : { data: { user: null }, error: data ?? { message: "Invalid session" } };
        } catch (error) { return { data: { user: null }, error: { message: error instanceof Error ? error.message : "Invalid session" } }; }
      },
      async signInWithOtp({ email, options }) {
        const response = await fetch(new URL("/auth/v1/otp", url), { method: "POST", headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ email, create_user: options?.shouldCreateUser !== false }) });
        const data = await response.json().catch(() => null);
        return response.ok ? { data, error: null } : { data: null, error: data ?? { message: "OTP request failed" } };
      },
      async verifyOtp({ email, token, type }) {
        const response = await fetch(new URL("/auth/v1/verify", url), { method: "POST", headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ email, token, type }) });
        const data = await response.json().catch(() => null);
        return response.ok ? { data: { session: data, user: data?.user ?? null }, error: null } : { data: null, error: data ?? { message: "OTP verification failed" } };
      },
      async updateUser(attributes) {
        try {
          const response = await fetch(new URL("/auth/v1/user", url), { method: "PUT", headers: { apikey: apiKey, Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" }, body: JSON.stringify(attributes) });
          const data = await response.json().catch(() => null);
          return response.ok ? { data: { user: data }, error: null } : { data: { user: null }, error: data ?? { message: "User update failed" } };
        } catch (error) { return { data: { user: null }, error: { message: error instanceof Error ? error.message : "User update failed" } }; }
      },
      async signOut() {
        const response = await fetch(new URL("/auth/v1/logout", url), { method: "POST", headers: { apikey: apiKey, Authorization: `Bearer ${bearer}` } });
        return { error: response.ok ? null : { message: "Sign out failed" } };
      },
      admin: {
        async deleteUser(userId) {
          const response = await fetch(new URL(`/auth/v1/admin/users/${userId}`, url), { method: "DELETE", headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` } });
          const data = await response.json().catch(() => null);
          return response.ok ? { data, error: null } : { data: null, error: data ?? { message: "Account deletion failed" } };
        },
      },
    },
  };
}

export function publicSupabase(env, accessToken) {
  return supabaseClient(env, accessToken, false);
}

export function adminSupabase(env) {
  return supabaseClient(env, undefined, true);
}

export async function authenticatedSupabase(context) {
  const authorization = context.request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
  if (!token) return { error: errorResponse(401, "AUTH_REQUIRED", "\ub85c\uadf8\uc778\uc774 \ud544\uc694\ud569\ub2c8\ub2e4.") };

  let client;
  try { client = publicSupabase(context.env, token); } catch { return { error: errorResponse(503, "CONFIGURATION_ERROR", "\uc778\uc99d \uc11c\ube44\uc2a4 \uc124\uc815\uc744 \ud655\uc778\ud574 \uc8fc\uc138\uc694.") }; }
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return { error: errorResponse(401, "AUTH_REQUIRED", "\ub85c\uadf8\uc778 \uc0c1\ud0dc\uac00 \ub9cc\ub8cc\ub418\uc5c8\uac70\ub098 \uc720\ud6a8\ud558\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4.") };
  return { client, token, user: data.user };
}
