import ReactMarkdown from "react-markdown";
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
          a: ({ children, href }) => <a className="font-bold text-brand-700 underline underline-offset-2" href={href}>{children}</a>,
          table: ({ children }) => <div className="mt-5 overflow-x-auto rounded-xl border border-line"><table className="w-full text-left text-sm">{children}</table></div>,
          th: ({ children }) => <th className="bg-neutral-50 px-4 py-3 font-extrabold text-strong">{children}</th>,
          td: ({ children }) => <td className="border-t border-line px-4 py-3">{children}</td>,
          blockquote: ({ children }) => <blockquote className="mt-5 rounded-xl border-l-4 border-brand-500 bg-brand-50/70 p-4 text-brand-950">{children}</blockquote>,
          pre: ({ children }) => <pre className="mt-5 overflow-x-auto rounded-2xl border border-line/80 bg-neutral-50/80 p-4.5 text-xs font-mono leading-relaxed text-neutral-800 shadow-xs">{children}</pre>,
          code: ({ children, className }) => className ? <code className={className}>{children}</code> : <code className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-xs font-semibold text-brand-900 border border-line/60">{children}</code>,
          img: ({ src, alt }) => (
            <figure className="my-7 flex flex-col items-center justify-center">
              <div className="overflow-hidden rounded-2xl border border-line/80 bg-white p-2.5 shadow-xs sm:p-4">
                <img
                  src={src}
                  alt={alt || ""}
                  className="max-h-[520px] w-auto max-w-full rounded-xl object-contain"
                  loading="lazy"
                />
              </div>
              {alt ? <figcaption className="mt-2.5 text-center text-xs font-bold text-neutral-500">▲ {alt}</figcaption> : null}
            </figure>
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
