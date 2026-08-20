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

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-line" role="tablist" aria-label="ETF 상세 정보 탭">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "summary"}
          aria-current={activeTab === "summary" ? "page" : undefined}
          onClick={() => setActiveTab("summary")}
          className={`px-5 py-2.5 rounded-xl transition-all ${
            activeTab === "summary"
              ? "bg-brand-600 text-white shadow-md ring-1 ring-brand-700/50"
              : "bg-surface text-muted hover:bg-neutral-100 hover:text-strong border border-neutral-200 shadow-sm"
          }`}
          style={{ fontWeight: 800, fontSize: '17px' }}
        >
          요약 정보
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "peers"}
          aria-current={activeTab === "peers" ? "page" : undefined}
          onClick={() => setActiveTab("peers")}
          className={`px-5 py-2.5 rounded-xl transition-all ${
            activeTab === "peers"
              ? "bg-brand-600 text-white shadow-md ring-1 ring-brand-700/50"
              : "bg-surface text-muted hover:bg-neutral-100 hover:text-strong border border-neutral-200 shadow-sm"
          }`}
          style={{ fontWeight: 800, fontSize: '17px' }}
        >
          동종 ETF 비교
        </button>
      </div>
      <div className="mt-5" role="tabpanel">
        {activeTab === "summary" ? children : <PeerComparisonPanel etf={etf} comparison={peerComparison} />}
      </div>
    </div>
  );
}
