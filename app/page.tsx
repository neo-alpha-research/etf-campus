import { Dashboard } from "@/components/dashboard/dashboard";
import { loadEtfs } from "@/lib/data/etf-repository";

export default function HomePage() {
  return <Dashboard etfs={loadEtfs()} />;
}
