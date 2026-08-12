import re

with open("components/screener/return-ranking-chart.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Container padding
content = content.replace('className="bg-white p-2.5 sm:p-3"', 'className="bg-white p-2 sm:p-2.5"')
# Title margin
content = content.replace('className="mb-2.5"', 'className="mb-2"')
content = content.replace('text-sm font-extrabold tracking-tight text-strong sm:text-base', 'text-[13px] font-extrabold tracking-tight text-strong sm:text-sm')
# space between items
content = content.replace('className="space-y-1.5"', 'className="space-y-1"')
# item padding/gap
content = content.replace('group flex flex-col gap-1 rounded-lg bg-neutral-50 p-2 sm:flex-row sm:items-center sm:gap-2 sm:p-2', 'group flex items-center gap-1.5 rounded-lg bg-neutral-50 py-1.5 px-2 sm:gap-2')
# left side width
content = content.replace('sm:w-[180px]', 'sm:w-[150px]')
# text size
content = content.replace('truncate text-[13px] font-extrabold text-strong', 'truncate text-xs font-bold text-strong')
# gap inside left side
content = content.replace('flex items-center gap-2 sm:w-[150px]', 'flex items-center gap-1.5 sm:w-[150px]')
# bar height
content = content.replace('h-1.5 items-center rounded-full bg-neutral-200/50 sm:h-2', 'h-1.5 items-center rounded-full bg-neutral-200/50 sm:h-1.5')
# return text width
content = content.replace('w-[50px] shrink-0 text-right whitespace-nowrap text-xs font-extrabold tabular-nums sm:text-[13px]', 'w-[48px] shrink-0 text-right whitespace-nowrap text-[11px] font-bold tabular-nums')

with open("components/screener/return-ranking-chart.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("done")
