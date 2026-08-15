"use client";

import { useState, type ReactNode } from "react";
import type { Etf } from "@/lib/domain/etf-types";
import type { PeerComparison } from "@/lib/data/etf-peer-groups";
import { PeerComparisonPanel } from "./peer-comparison-panel";

type Props = {
  etf: Etf;
  peerComparison: PeerComparison;
  children: ReactNode;
};

export function EtfDetailClient({ etf, peerComparison, children }: Props) {
  const [activeTab, setActiveTab] = useState<"summary" | "peers">("summary");
  const primary = peerComparison.groups.find((group) => group.isPrimary);
  const countLabel = primary ? ` ${primary.totalCount}개` : "";

  return (
    <div>
      <div className="-mx-4 border-b border-line px-4 sm:-mx-6 sm:px-6">
        <div className="mx-auto flex max-w-6xl gap-5" role="tablist" aria-label="ETF 상세 정보 탭">
          <button type="button" role="tab" aria-selected={activeTab === "summary"} aria-current={activeTab === "summary" ? "page" : undefined} onClick={() => setActiveTab("summary")} className={`border-b-2 py-3 text-sm font-bold transition-colors ${activeTab === "summary" ? "border-brand-600 text-brand-700" : "border-transparent text-muted hover:text-strong"}`}>요약 정보</button>
          <button type="button" role="tab" aria-selected={activeTab === "peers"} aria-current={activeTab === "peers" ? "page" : undefined} onClick={() => setActiveTab("peers")} className={`border-b-2 py-3 text-sm font-bold transition-colors ${activeTab === "peers" ? "border-brand-600 text-brand-700" : "border-transparent text-muted hover:text-strong"}`}>동종 ETF 비교</button>
        </div>
      </div>
      <div className="mt-8" role="tabpanel">
        {activeTab === "summary" ? children : <PeerComparisonPanel etf={etf} comparison={peerComparison} />}
      </div>
    </div>
  );
}
