import re
with open('components/screener/screener.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# fieldset padding adjustments
content = content.replace('mt-5 border-b border-line pb-5', 'mt-4 border-b border-line pb-4')
content = content.replace('className="border-b border-line py-5"', 'className="border-b border-line py-4"')
content = content.replace('className="py-5"', 'className="py-4"')

# gap between legend and checkboxes
content = content.replace('className="mt-3 flex cursor-pointer', 'className="mt-2 flex cursor-pointer')
content = content.replace('<div className="mt-3 space-y-2">', '<div className="mt-2 space-y-1">')
content = content.replace('<div className="mt-3 flex flex-wrap gap-2">', '<div className="mt-2 flex flex-wrap gap-1.5">')

# header size adjustment to match dashboard if needed (user just asked for space, but making it consistent)
content = content.replace('<h2 className="text-lg font-extrabold">필터</h2>', '<h2 className="text-base font-extrabold">필터</h2>')

with open('components/screener/screener.tsx', 'w', encoding='utf-8', newline='') as f:
    f.write(content)
