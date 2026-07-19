import type { AssetClass } from "@/lib/domain/etf-types";

export function AssetClassTag({ assetClass }: { assetClass: AssetClass }) {
  return <span className="inline-flex rounded-md bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700">{assetClass}</span>;
}

