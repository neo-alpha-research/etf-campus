"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Share2, Copy, Check, Download, Sparkles } from "lucide-react";
import { toPng } from "html-to-image";
import {
  AXIS_DEFINITIONS,
  type AxisScores,
  type StyleId,
  type StyleProfile,
} from "@/lib/onboarding/style-diagnosis";

interface StyleShareBarProps {
  styleId: StyleId;
  profile: StyleProfile;
  axisScores?: AxisScores;
  rarityShare?: number | null;
  totalStatsCount?: number;
}

export function StyleShareBar({
  styleId,
  profile,
  axisScores,
  rarityShare,
  totalStatsCount = 0,
}: StyleShareBarProps) {
  const [copied, setCopied] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const getShareUrl = (channel: string) => {
    if (typeof window === "undefined") return `https://etf-campus.pages.dev/style/${styleId}/`;
    return `${window.location.origin}/style/${styleId}/?ref=${channel}`;
  };

  const handleNativeShare = async () => {
    const url = getShareUrl("share_btn");
    const shareData = {
      title: `${profile.name} | ETF 투자 스타일 | ETF Campus`,
      text: `나의 ETF 투자 스타일은 [${profile.name} ${profile.emoji}]입니다! 당신의 스타일도 확인해 보세요.`,
      url,
    };

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }
    // Fallback to copy link
    handleCopyLink();
  };

  const handleCopyLink = async () => {
    const url = getShareUrl("copy_btn");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = url;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      alert("링크 복사에 실패했습니다. 브라우저 주소를 직접 복사해 주세요.");
    }
  };

  const handleDownloadCard = async () => {
    if (!cardRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      await new Promise((r) => setTimeout(r, 150));

      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        backgroundColor: "#022c22",
        pixelRatio: 2,
      });

      const link = document.createElement("a");
      link.download = `ETF_투자스타일_${profile.animal}_ETF캠퍼스.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to capture story card:", err);
      alert("카드 이미지 생성 중 오류가 발생했습니다.");
    } finally {
      setIsCapturing(false);
    }
  };

  const currentScores = axisScores || profile.vector;

  return (
    <div className="mt-5 rounded-2xl border border-brand-200/90 bg-brand-50/70 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-extrabold text-brand-800">결과 공유하기</p>
          <p className="text-[11px] text-muted">친구와 동료에게 내 스타일을 공유하고 서로의 차이를 비교해 보세요.</p>
        </div>
        {copied && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs">
            <Check className="h-3 w-3" /> 복사 완료!
          </span>
        )}
      </div>

      <div className="mt-3.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-brand-700 px-4 py-2 text-xs font-extrabold text-white shadow-xs transition-colors hover:bg-brand-800"
          onClick={handleNativeShare}
          type="button"
        >
          <Share2 className="h-3.5 w-3.5" />
          <span>카카오톡 · SNS 공유</span>
        </button>

        <button
          className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-brand-300 bg-white px-4 py-2 text-xs font-extrabold text-brand-900 shadow-2xs transition-colors hover:bg-brand-50"
          onClick={handleCopyLink}
          type="button"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? "링크 복사됨" : "결과 링크 복사"}</span>
        </button>

        <button
          className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-4 py-2 text-xs font-extrabold text-neutral-800 shadow-2xs transition-colors hover:bg-neutral-50 disabled:opacity-60"
          disabled={isCapturing}
          onClick={handleDownloadCard}
          type="button"
        >
          <Download className="h-3.5 w-3.5" />
          <span>{isCapturing ? "이미지 생성 중..." : "인스타 스토리 카드 저장"}</span>
        </button>
      </div>

      {/* Hidden 9:16 Story Card for html-to-image capture */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px", overflow: "hidden" }}>
        <div
          className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[#022c22] via-[#064e3b] to-[#041f1e] p-8 text-white font-sans"
          ref={cardRef}
          style={{ width: "540px", height: "960px" }}
        >
          {/* Header */}
          <div>
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black tracking-wider text-emerald-300">
                ETF CAMPUS · 투자 스타일
              </span>
              {rarityShare !== null && rarityShare !== undefined && totalStatsCount >= 300 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-amber-300">
                  <Sparkles className="h-3 w-3" />
                  전체의 {Math.max(1, Math.round(rarityShare * 100))}%
                </span>
              ) : null}
            </div>

            {/* Animal Illustration Frame */}
            <div className="mt-6 flex justify-center">
              <div className="relative size-44 overflow-hidden rounded-3xl border-4 border-emerald-400/30 bg-white/5 shadow-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={profile.name}
                  className="h-full w-full object-cover"
                  src={profile.imagePath}
                />
                <span className="absolute bottom-2 right-2 grid size-10 place-items-center rounded-full border-2 border-white/20 bg-black/60 text-2xl backdrop-blur-xs">
                  {profile.emoji}
                </span>
              </div>
            </div>

            {/* Titles */}
            <div className="mt-5 text-center">
              <h2 className="text-3xl font-black tracking-tight text-white">{profile.name}</h2>
              <p className="mt-1.5 text-sm font-bold text-emerald-300">{profile.tagline}</p>
            </div>

            {/* Punchline Card */}
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs font-extrabold text-emerald-400">💡 투자 스타일 명언</p>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-100">
                &ldquo;{profile.punchline}&rdquo;
              </p>
            </div>

            {/* 5 Axes Summary */}
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-extrabold text-slate-300">5가지 탐색 축 기준점</p>
              <div className="mt-2.5 space-y-2 text-xs">
                {AXIS_DEFINITIONS.map((axis) => {
                  const score = currentScores[axis.id] ?? 0;
                  const pct = Math.round(((score + 1) / 2) * 100);
                  return (
                    <div key={axis.id}>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-300">
                        <span>{axis.name}</span>
                        <span className="text-emerald-300 font-bold">
                          {score <= 0 ? axis.lowLabel : axis.highLabel}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-emerald-400"
                          style={{ width: `${Math.max(8, Math.min(92, pct))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer with Mandatory Compliance Notice */}
          <div className="border-t border-white/10 pt-4 text-center">
            <p className="text-xs font-bold text-emerald-300 tracking-wide">
              etf-campus.pages.dev/style/{styleId}/
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              * 교육용 콘텐츠 · 투자권유 아님 · ETF 캠퍼스
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
