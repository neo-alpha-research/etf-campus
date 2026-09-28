import { communityFetch, signOutCommunity } from "@/lib/community/browser-client";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
};

export type SessionResponse = {
  authenticated: boolean;
  user?: AuthUser;
};

export async function getSession(): Promise<SessionResponse> {
  try {
    const sessionResponse = await communityFetch<{
      authenticated: boolean;
      user?: { id: string; email: string | null; displayName?: string | null };
    }>("/api/community/auth/session", { method: "GET" });
    if (!sessionResponse.authenticated || !sessionResponse.user) return { authenticated: false };

    let displayName: string | null = sessionResponse.user.displayName ?? null;
    if (sessionResponse.user.displayName === undefined) {
      const profileResponse = await communityFetch("/api/community/auth/profile", { method: "GET" }).catch(() => null);
      displayName = profileResponse?.profile?.nickname ?? null;
    }

    return {
      authenticated: true,
      user: {
        id: sessionResponse.user.id,
        email: sessionResponse.user.email ?? "",
        displayName,
      }
    };
  } catch {
    return { authenticated: false };
  }
}

export async function logout() {
  await signOutCommunity();
}
