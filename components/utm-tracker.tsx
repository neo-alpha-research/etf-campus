"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export function UtmTracker() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const source = searchParams.get("utm_source");
    const medium = searchParams.get("utm_medium");
    const campaign = searchParams.get("utm_campaign");

    if (source) {
      sessionStorage.setItem("utm_source", source);
      if (medium) sessionStorage.setItem("utm_medium", medium);
      if (campaign) sessionStorage.setItem("utm_campaign", campaign);
    }
  }, [searchParams]);

  return null;
}
