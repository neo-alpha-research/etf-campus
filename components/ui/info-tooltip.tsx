"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Info } from "lucide-react";

export interface InfoTooltipProps {
  /** 툴팁 헤더 제목 */
  title?: React.ReactNode;
  /** 헤더 우측 슬림 뱃지 (예: '규모', '1일', '감독규정' 등) */
  badge?: string;
  /** 툴팁 본문 내용 (단락, 불릿 목록, 팁 박스 등) */
  content: React.ReactNode;
  /** 하단 금융 실전 팁 또는 법적 유의사항 (선택) */
  tip?: React.ReactNode;
  /** 툴팁을 여는 트리거 컴포넌트 (생략 시 기본 ⓘ 아이콘 버튼) */
  children?: React.ReactNode;
  /** 접근성 라벨 */
  ariaLabel?: string;
  /** 툴팁 노출 수직 위치 (기본: "top") */
  position?: "top" | "bottom";
  /** 툴팁 수평 정렬 (기본: "center") */
  align?: "left" | "center" | "right";
  /** 너비 클래스 (기본: "w-72") */
  widthClass?: string;
  /** 트리거 래퍼 커스텀 클래스 */
  className?: string;
  /** 툴팁 박스 커스텀 클래스 */
  contentClassName?: string;
}

/**
 * ETF 캠퍼스 표준 공통 툴팁 (Unified Tooltip Component)
 * - 부모 요소의 `whitespace-nowrap` 상속을 완벽 차단하는 `whitespace-normal` & `break-keep` 기본 내장
 * - 데스크톱 마우스 호버 + 모바일 터치 탭 토글(Outside Click 자동 닫기) 동시 지원
 * - 뷰포트 초과 방어(`max-w-[calc(100vw-32px)]`) 및 45도 회전 픽셀 퍼펙트 화살표 일체형
 */
export function InfoTooltip({
  title,
  badge,
  content,
  tip,
  children,
  ariaLabel,
  position = "top",
  align = "center",
  widthClass = "w-72",
  className = "",
  contentClassName = "",
}: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Outside Click 감지 (모바일 터치 닫기 지원)
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  // ESC 키 누를 때 닫기 (접근성)
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  }, []);

  // 위치 및 정렬 클래스
  const positionClass =
    position === "top"
      ? "bottom-[calc(100%+8px)]"
      : "top-[calc(100%+8px)]";

  const alignClass =
    align === "right"
      ? "right-0 translate-x-0"
      : align === "left"
      ? "left-0 translate-x-0"
      : "left-1/2 -translate-x-1/2";

  // 45도 회전 화살표 위치 계산
  const arrowPositionClass =
    position === "top"
      ? "-bottom-1.5 border-b border-r"
      : "-top-1.5 border-t border-l";

  const arrowAlignClass =
    align === "right"
      ? "right-5"
      : align === "left"
      ? "left-5"
      : "left-1/2 -translate-x-1/2";

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center group/tooltip cursor-help ${className}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {/* Trigger */}
      {children ? (
        <button
          type="button"
          onClick={handleToggle}
          aria-label={ariaLabel || undefined}
          aria-expanded={isOpen}
          className="inline-flex items-center justify-center cursor-help focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded-sm"
        >
          {children}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleToggle}
          aria-label={ariaLabel || "도움말 보기"}
          aria-expanded={isOpen}
          className="inline-flex items-center justify-center text-neutral-400 hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded-full p-0.5 transition-colors cursor-help"
        >
          <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" aria-hidden="true" />
        </button>
      )}

      {/* Tooltip Popup Content */}
      <div
        role="tooltip"
        className={`absolute ${positionClass} ${alignClass} ${widthClass} max-w-[calc(100vw-32px)] p-3.5 rounded-xl bg-slate-900/98 backdrop-blur-md text-white text-left shadow-2xl border border-slate-700/80 transition-all duration-200 z-[140] whitespace-normal break-keep font-sans ${
          isOpen
            ? "opacity-100 pointer-events-auto translate-y-0 visible"
            : "opacity-0 pointer-events-none -translate-y-1 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto group-hover/tooltip:translate-y-0 group-hover/tooltip:visible"
        } ${contentClassName}`}
      >
        {/* 화살표 (Caret) */}
        <div
          className={`absolute ${arrowPositionClass} ${arrowAlignClass} w-3 h-3 rotate-45 bg-slate-900 border-slate-700/80 pointer-events-none`}
        />

        {/* 헤더 (제목 + 뱃지) */}
        {(title || badge) && (
          <div className="flex items-center justify-between gap-1.5 mb-2 pb-1.5 border-b border-slate-800">
            {title && (
              <span className="text-[12.5px] font-black text-emerald-400 tracking-tight">
                {title}
              </span>
            )}
            {badge && (
              <span className="text-[10px] font-bold text-slate-300 bg-slate-800 border border-slate-700/80 px-2 py-0.5 rounded-full shrink-0">
                {badge}
              </span>
            )}
          </div>
        )}

        {/* 본문 콘텐츠 */}
        <div className="text-[11.5px] leading-relaxed text-slate-200 font-normal">
          {content}
        </div>

        {/* 하단 팁 박스 (선택) */}
        {tip && (
          <div className="mt-2.5 pt-2 border-t border-slate-800 text-[11px] leading-relaxed text-slate-300">
            {tip}
          </div>
        )}
      </div>
    </div>
  );
}
