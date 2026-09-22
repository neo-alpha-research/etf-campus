import ReactMarkdown from "react-markdown";
import { ProfessorTooltip } from "@/components/briefing/professor-tooltip";

import remarkGfm from "remark-gfm";

export function MarkdownContent({ source }: { source: string }) {
  return (
    <div className="markdown-content text-[0.95rem] leading-7 text-neutral-700">
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h2 className="mt-10 text-2xl font-extrabold tracking-[-0.03em] text-strong first:mt-0">{children}</h2>,
          h2: ({ children }) => <h2 className="mt-10 text-xl font-extrabold text-strong">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-8 text-lg font-extrabold text-strong">{children}</h3>,
          p: ({ children }) => <p className="mt-4">{children}</p>,
          ul: ({ children }) => <ul className="mt-4 list-disc space-y-2 pl-6">{children}</ul>,
          ol: ({ children }) => <ol className="mt-4 list-decimal space-y-2 pl-6">{children}</ol>,
          a: ({ children, href }) => {
            if (href?.startsWith('tooltip:')) {
              const definition = decodeURIComponent(href.replace('tooltip:', ''));
              return <ProfessorTooltip definition={definition}>{children}</ProfessorTooltip>;
            }
            return <a className="font-bold text-brand-700 underline underline-offset-2" href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
          },
          table: ({ children }) => (
            <div className="mt-5 overflow-hidden rounded-xl border border-line">
              <div className="flex items-center justify-between border-b border-line/70 bg-neutral-50/90 px-3 py-1.5 text-[11px] font-semibold text-neutral-500 sm:hidden">
                <span>← 좌우로 밀어서 전체 내용 확인 →</span>
                <span aria-hidden="true">⇄</span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[640px] w-full text-left text-sm border-collapse">{children}</table>
              </div>
            </div>
          ),
          th: ({ children }) => (
            <th className="bg-neutral-50 px-4 py-3 font-extrabold text-strong first:sticky first:left-0 first:z-10 first:bg-neutral-50 first:border-r first:border-line">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-t border-line px-4 py-3 first:sticky first:left-0 first:z-10 first:bg-surface first:border-r first:border-line">
              {children}
            </td>
          ),
          blockquote: ({ children }) => <blockquote className="mt-5 rounded-xl border-l-4 border-brand-500 bg-brand-50/70 p-4 text-brand-950">{children}</blockquote>,
          pre: ({ children }) => <pre className="mt-5 overflow-x-auto rounded-2xl border border-line/80 bg-neutral-50/80 p-4.5 text-xs font-mono leading-relaxed text-neutral-800 shadow-xs">{children}</pre>,
          code: ({ children, className }) => className ? <code className={className}>{children}</code> : <code className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-xs font-semibold text-brand-900 border border-line/60">{children}</code>,
          img: ({ src, alt }) => (
            <span className="my-7 flex flex-col items-center justify-center">
              <span className="inline-block overflow-hidden rounded-2xl border border-line/80 bg-white p-2.5 shadow-xs sm:p-4">
                <img
                  src={src}
                  alt={alt || ""}
                  className="max-h-[520px] w-auto max-w-full rounded-xl object-contain block"
                  loading="lazy"
                />
              </span>
              {alt ? <span className="mt-2.5 block text-center text-xs font-bold text-neutral-500">▲ {alt}</span> : null}
            </span>
          ),
        }}
        remarkPlugins={[remarkGfm]}
        skipHtml
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
