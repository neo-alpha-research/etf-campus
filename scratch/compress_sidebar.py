import re

with open('components/screener/screener.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update FilterChips
content = content.replace(
    'pt-2 flex flex-wrap gap-1.5',
    'pt-1.5 flex flex-wrap gap-1'
)
content = content.replace(
    'px-3 py-1.5 text-xs font-semibold',
    'px-2.5 py-1 text-[11px] font-semibold'
)

# 2. Update AUM mapping (similar to FilterChips but hardcoded inside the component)
content = content.replace(
    'pt-1 flex flex-wrap gap-1.5',
    'pt-1 flex flex-wrap gap-1'
)

# 3. Update fieldset padding
content = content.replace(
    'mt-4 border-b border-line pb-4',
    'mt-2 border-b border-line pb-3'
)
content = content.replace(
    'border-b border-line py-4',
    'border-b border-line py-3'
)
content = content.replace(
    'border-t border-line py-4',
    'border-t border-line py-3'
)
content = content.replace(
    'border-t border-line pt-4',
    'border-t border-line pt-3'
)
content = content.replace(
    '<div className="py-4">',
    '<div className="py-3">'
)

# 4. Decrease padding on Pension switch
content = content.replace(
    'bg-brand-50 p-3 text-sm',
    'bg-brand-50 p-2 text-xs'
)
content = content.replace(
    'h-6 w-11',
    'h-5 w-9'
)
content = content.replace(
    'translate-x-6',
    'translate-x-4'
)

with open('components/screener/screener.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
