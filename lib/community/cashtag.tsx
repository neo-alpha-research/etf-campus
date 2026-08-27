import React from "react";
import Link from "next/link";

export const CASHTAG_REGEX = /\$([0-9]{6}|[0-9]{5}[A-Z]|[A-Z]{1,5})(?=[^0-9A-Za-z]|$)/g;

export type TextSegment =
  | { type: "text"; value: string }
  | { type: "cashtag"; ticker: string; raw: string };

export function parseCashtags(text: string): TextSegment[] {
  if (!text) return [];

  const segments: TextSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const regex = new RegExp(CASHTAG_REGEX.source, "g");

  while ((match = regex.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = regex.lastIndex;
    const raw = match[0];
    const ticker = match[1];

    if (matchStart > lastIndex) {
      segments.push({
        type: "text",
        value: text.slice(lastIndex, matchStart),
      });
    }

    segments.push({
      type: "cashtag",
      ticker,
      raw,
    });

    lastIndex = matchEnd;
  }

  if (lastIndex < text.length) {
    segments.push({
      type: "text",
      value: text.slice(lastIndex),
    });
  }

  return segments;
}

export function CashtagText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}): React.ReactElement {
  const segments = parseCashtags(text);

  return (
    <span className={className}>
      {segments.map((seg, idx) => {
        if (seg.type === "text") {
          return <React.Fragment key={idx}>{seg.value}</React.Fragment>;
        }

        const isKrTicker = /^[0-9]{6}$/.test(seg.ticker) || /^[0-9]{5}[A-Z]$/.test(seg.ticker);
        const href = isKrTicker ? "/etf/" + seg.ticker : "/explore/?q=" + encodeURIComponent(seg.ticker);

        return (
          <Link
            key={idx}
            href={href}
            className="inline-flex items-center font-mono font-semibold text-brand-700 hover:text-brand-900 hover:underline bg-brand-50/80 px-1.5 py-0.5 rounded text-xs sm:text-sm mx-0.5 align-baseline"
            title={seg.ticker + " ETF 상세 정보 조회"}
          >
            {"$" + seg.ticker}
          </Link>
        );
      })}
    </span>
  );
}
