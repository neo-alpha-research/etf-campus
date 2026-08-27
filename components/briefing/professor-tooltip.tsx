"use client";

import { useState } from "react";

interface Props {
  children: React.ReactNode;
  definition: string;
}

export function ProfessorTooltip({ children, definition }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span className="relative inline-block z-20">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        className="inline cursor-help border-b-2 border-dotted border-brand-400 font-extrabold text-brand-700 transition-colors hover:border-brand-600 hover:text-brand-900 focus:outline-none focus:bg-brand-50 rounded-sm px-0.5"
      >
        {children}
      </button>

      {/* Tooltip Content */}
      <span
        className={`absolute bottom-full left-1/2 mb-2 w-64 -translate-x-1/2 transform rounded-2xl border border-brand-100 bg-white p-4 shadow-xl transition-all duration-200 ease-in-out pointer-events-none ${
          isOpen ? "visible translate-y-0 opacity-100" : "invisible translate-y-2 opacity-0"
        }`}
        role="tooltip"
      >
        <span className="flex gap-3 text-left">
          <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full border border-brand-100 shadow-sm">
            <img src="/images/professor_owl.jpg" alt="부엉이 교수님" className="size-full object-cover" />
          </span>
          <span className="flex-1">
            <span className="block text-[13px] font-extrabold tracking-[0.02em] text-brand-900">
              부엉이 교수님의 첨삭
            </span>
            <span className="mt-1.5 block text-[13px] leading-relaxed text-neutral-600 break-keep font-medium">
              {definition}
            </span>
          </span>
        </span>
        {/* Triangle pointer */}
        <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-brand-100 bg-white shadow-sm"></span>
      </span>
    </span>
  );
}
