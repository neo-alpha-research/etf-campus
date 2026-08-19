"use client";

import { useCallback } from "react";
import useSWR from "swr";
import { getSession, logout, type SessionResponse } from "@/lib/auth/client";

export function useAuthSession() {
  const { data, error, isLoading, mutate } = useSWR<SessionResponse>(
    "/api/community/auth/session",
    getSession,
    {
      shouldRetryOnError: false,
      revalidateOnFocus: true,
      dedupingInterval: 30_000,
    },
  );

  const signOut = useCallback(async () => {
    await logout();
    await mutate({ authenticated: false }, { revalidate: false });
  }, [mutate]);

  return {
    user: data?.authenticated ? data.user ?? null : null,
    authenticated: Boolean(data?.authenticated),
    isLoading,
    error,
    refresh: mutate,
    signOut,
  };
}
