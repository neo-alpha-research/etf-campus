import { Screener } from "@/components/screener/screener";
import { loadEtfs } from "@/lib/data/etf-repository";

export default function ScreenerPage() {
  return <Screener etfs={loadEtfs()} />;
}
