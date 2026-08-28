"use client";

import { useEffect, useState } from "react";
import { CommunityComposer } from "./community-composer";
import { ChallengeComposer } from "./challenge-composer";

export function CommunityWriteWrapper() {
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    // Check local storage draft first
    const saved = localStorage.getItem("community_write_draft_v1");
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        if (draft.categorySlug) {
          setTimeout(() => setCategory(draft.categorySlug), 0);
          return;
        }
      } catch {}
    }
    const params = new URLSearchParams(window.location.search);
    setTimeout(() => setCategory(params.get("category") || "pension-etf-qna"), 0);
  }, []);

  if (category === null) return null; // loading

  if (category === "challenge-30") {
    return <ChallengeComposer />;
  }

  return <CommunityComposer />;
}
