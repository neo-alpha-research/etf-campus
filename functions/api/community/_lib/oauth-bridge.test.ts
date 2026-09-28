import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  getUserById: vi.fn(),
  createUser: vi.fn(),
}));

vi.mock("./supabase", () => ({
  adminSupabase: () => ({
    rpc: mocks.rpc,
    auth: {
      admin: {
        getUserById: mocks.getUserById,
        createUser: mocks.createUser,
      },
    },
  }),
}));

import { computeSubjectHash, resolveOrCreateOAuthUser } from "./oauth-bridge";

describe("OAuth Bridge - Dual-Key Fallback & Rotation Promotion", () => {
  const currentSecret = "current-identity-secret-2026";
  const previousSecret = "previous-identity-secret-2025";
  const provider = "kakao";
  const appId = "123456";
  const subject = "user_987654321";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves user immediately using current secret without fallback", async () => {
    const env = {
      OAUTH_IDENTITY_HMAC_SECRET: currentSecret,
      OAUTH_IDENTITY_HMAC_PREVIOUS_SECRET: previousSecret,
      SUPABASE_URL: "https://mock.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "mock-key",
    };

    const currentHash = await computeSubjectHash(currentSecret, provider, appId, subject);

    mocks.rpc.mockImplementation((rpcName: string, args: any) => {
      if (rpcName === "resolve_oauth_identity" && args.p_subject_hash === currentHash) {
        return Promise.resolve({ data: "existing-user-uuid-1" });
      }
      return Promise.resolve({ data: null });
    });

    mocks.getUserById.mockResolvedValue({
      data: {
        user: {
          id: "existing-user-uuid-1",
          email: "kakao_test@oauth.etfcampus.kr",
        },
      },
    });

    const result = await resolveOrCreateOAuthUser(env, { provider, appId, subject });

    expect(result.userId).toBe("existing-user-uuid-1");
    expect(result.isNewUser).toBe(false);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("resolve_oauth_identity", {
      p_provider: provider,
      p_provider_app_id: appId,
      p_subject_hash: currentHash,
    });
  });

  it("successfully falls back to previous secret and auto-promotes identity link", async () => {
    const env = {
      OAUTH_IDENTITY_HMAC_SECRET: currentSecret,
      OAUTH_IDENTITY_HMAC_PREVIOUS_SECRET: previousSecret,
      SUPABASE_URL: "https://mock.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "mock-key",
    };

    const currentHash = await computeSubjectHash(currentSecret, provider, appId, subject);
    const prevHash = await computeSubjectHash(previousSecret, provider, appId, subject);

    mocks.rpc.mockImplementation((rpcName: string, args: any) => {
      if (rpcName === "resolve_oauth_identity") {
        if (args.p_subject_hash === currentHash) {
          // Current secret hash not found (e.g. newly rotated key)
          return Promise.resolve({ data: null });
        }
        if (args.p_subject_hash === prevHash) {
          // Found under previous secret
          return Promise.resolve({ data: "legacy-user-uuid-99" });
        }
      }
      if (rpcName === "link_oauth_identity") {
        return Promise.resolve({ error: null });
      }
      return Promise.resolve({ data: null });
    });

    mocks.getUserById.mockResolvedValue({
      data: {
        user: {
          id: "legacy-user-uuid-99",
          email: "kakao_legacy@oauth.etfcampus.kr",
        },
      },
    });

    const result = await resolveOrCreateOAuthUser(env, { provider, appId, subject });

    expect(result.userId).toBe("legacy-user-uuid-99");
    expect(result.isNewUser).toBe(false);

    // Verify fallback lookup occurred
    expect(mocks.rpc).toHaveBeenCalledWith("resolve_oauth_identity", {
      p_provider: provider,
      p_provider_app_id: appId,
      p_subject_hash: prevHash,
    });

    // Verify auto-promotion (linking new hash to legacy user) occurred
    expect(mocks.rpc).toHaveBeenCalledWith("link_oauth_identity", {
      p_provider: provider,
      p_provider_app_id: appId,
      p_subject_hash: currentHash,
      p_user_id: "legacy-user-uuid-99",
    });
  });
});
