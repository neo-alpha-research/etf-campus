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
          blockquote: ({ children }) => <blockquote className="mt-5 border-l-4 border-brand-300 bg-brand-50 px-5 py-3 text-brand-900">{children}</blockquote>,
        }}
        remarkPlugins={[remarkGfm]}
        skipHtml
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
