import { DisparityWarning } from "@/lib/hooks/use-market-briefing";
import Link from "next/link";
import { Info } from "lucide-react";

export function DisparityAlert({ warnings }: { warnings: DisparityWarning[] }) {
  if (!warnings || warnings.length === 0) return null;

  return (
    <section aria-labelledby="disparity-alert-title" className="mt-8">
      <div className="rounded-[22px] border border-red-200 bg-red-50 p-5 sm:p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div className="flex-1">
            <h3 id="disparity-alert-title" className="text-lg font-bold text-red-900">
              지금 사면 비싸게 사는 ETF (괴리율 주의)
            </h3>
            <p className="mt-1 text-sm text-red-800">
              실제 가치(NAV)보다 시장 가격이 비싸게 형성되어 있어 매수 시 주의가 필요한 종목입니다. 
              (국내 자산 1%, 해외 자산 3% 이상 가격 차이 발생)
            </p>
            
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {warnings.map((w) => (
                <div key={w.ticker} className="flex flex-col justify-between rounded-xl border border-red-100 bg-white p-3 shadow-sm transition-colors hover:border-red-300">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/etf/${w.ticker}`} className="text-sm font-semibold text-neutral-900 hover:underline line-clamp-1">
                      {w.etfName}
                    </Link>
                    <span className="text-[10px] text-neutral-500">{w.assetClass}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-neutral-500">{w.ticker}</span>
                    <span className={`text-sm font-bold tabular-nums ${w.disparityPct > 0 ? "text-red-600" : "text-blue-600"}`}>
                      {w.disparityPct > 0 ? "+" : ""}{w.disparityPct.toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
