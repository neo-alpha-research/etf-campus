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
    const sessionResponse = await communityFetch("/api/community/auth/session", { method: "GET" });
    if (!sessionResponse.authenticated || !sessionResponse.user) return { authenticated: false };

    const profileResponse = await communityFetch("/api/community/auth/profile", { method: "GET" });
    
    return {
      authenticated: true,
      user: {
        id: sessionResponse.user.id,
        email: sessionResponse.user.email,
        displayName: profileResponse.profile?.nickname ?? null,
      }
    };
  } catch {
    return { authenticated: false };
  }
}

export async function logout() {
  await signOutCommunity();
}
