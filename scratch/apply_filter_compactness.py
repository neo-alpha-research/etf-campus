import re
with open('components/dashboard/dashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'p-5 shadow-2xl md:static md:mt-3 md:rounded-2xl md:border md:border-line md:bg-neutral-50 md:p-4',
    'p-4 shadow-2xl md:static md:mt-2 md:rounded-2xl md:border md:border-line md:bg-neutral-50 md:p-3.5'
)
content = content.replace(
    '<h2 className="text-lg font-extrabold">',
    '<h2 className="text-base font-extrabold">'
)
content = content.replace(
    'mt-3 grid gap-4 ${allowedRiskTypes.length ? "md:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]" : "md:grid-cols-1"}',
    'mt-2 grid gap-6 md:gap-8 ${allowedRiskTypes.length ? "md:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]" : "md:grid-cols-1"}'
)
content = content.replace(
    '<legend className="text-sm font-extrabold">',
    '<legend className="text-[13px] font-extrabold text-strong">'
)
content = content.replace(
    '<div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-7">',
    '<div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-7">'
)
content = content.replace(
    '<div className="mt-2 grid grid-cols-2 gap-2">',
    '<div className="mt-1.5 grid grid-cols-2 gap-1.5">'
)
content = content.replace(
    'min-h-10 items-center gap-2',
    'min-h-9 items-center gap-2'
)
content = content.replace(
    'className="size-4 accent-brand-700"',
    'className="size-3.5 accent-brand-700"'
)
content = content.replace(
    'mt-6 w-full rounded-xl bg-brand-700 px-4 py-3',
    'mt-5 w-full rounded-xl bg-brand-700 px-4 py-2.5'
)

with open('components/dashboard/dashboard.tsx', 'w', encoding='utf-8', newline='') as f:
    f.write(content)
