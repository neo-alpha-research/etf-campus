import type { Metadata } from "next";

import { Dashboard } from "@/components/dashboard/dashboard";
import { loadEtfs } from "@/lib/data/etf-repository";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function HomePage() {
  return <Dashboard etfs={loadEtfs()} />;
}
