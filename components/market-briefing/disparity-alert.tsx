import { DisparityWarning } from "@/lib/hooks/use-market-briefing";
import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";

export function DisparityAlert({ warnings }: { warnings: DisparityWarning[] }) {
  if (!warnings || warnings.length === 0) return null;

  return (
    <section aria-labelledby="disparity-alert-title">
      <div className="rounded-[22px] border border-rose-200 bg-gradient-to-r from-[#FFF5F5] to-white p-5 sm:p-6 shadow-[0_4px_16px_rgba(27,38,26,0.03)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-rose-100">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
              <AlertTriangle className="h-4 w-4 stroke-[2.5]" />
            </span>
            <h3 id="disparity-alert-title" className="text-[14.5px] font-black text-rose-950 tracking-tight">
              수급 쏠림 주의 ETF (괴리율 경보)
            </h3>
          </div>
          <p className="text-[12px] font-medium text-rose-700">
            단기 매수세 집중으로 실제 가치(NAV) 대비 시장가격이 비싸게 형성된 종목입니다. (국내 1%, 해외 3% 이상)
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {warnings.map((w) => (
            <Link
              key={w.ticker}
              href={`/etf/${w.ticker}`}
              className="group flex flex-col justify-between rounded-xl border border-rose-100 bg-white p-3.5 shadow-2xs transition-all hover:border-rose-300 hover:shadow-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-bold text-neutral-900 group-hover:text-rose-700 group-hover:underline line-clamp-1">
                  {w.etfName}
                </p>
                {w.assetClass && (
                  <span className="shrink-0 text-[10.5px] font-semibold px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-500">
                    {w.assetClass}
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-neutral-400 tabular-nums">{w.ticker}</span>
                <div className="flex items-center gap-1">
                  <span className="text-[12px] font-black tabular-nums px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-600">
                    +{w.disparityPct.toFixed(2)}% 고평가
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-rose-500" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
