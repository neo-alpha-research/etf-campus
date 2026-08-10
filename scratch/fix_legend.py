content = open('components/screener/screener.tsx', encoding='utf-8').read()
content = content.replace('legend className="text-sm font-extrabold"', 'legend className="text-[15px] font-extrabold text-strong"')
open('components/screener/screener.tsx', 'w', encoding='utf-8', newline='').write(content)
