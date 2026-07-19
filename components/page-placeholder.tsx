type PagePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PagePlaceholder({ eyebrow, title, description }: PagePlaceholderProps) {
  return (
    <main className="page-shell flex-1 py-10 sm:py-14">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-strong sm:text-4xl">{title}</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted">{description}</p>
      <div className="mt-10 rounded-3xl border border-dashed border-brand-300 bg-brand-50 p-8 text-sm text-brand-800">
        단계별 구현을 위한 화면 자리입니다.
      </div>
    </main>
  );
}

