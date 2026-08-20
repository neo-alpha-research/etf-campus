import sys

file_path = 'app/etf/[ticker]/page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('export const dynamicParams = false;', 'export const dynamicParams = true;\nexport const revalidate = 86400;')
content = content.replace('export function generateStaticParams() {', 'export function generateStaticParams() {\n  if (process.env.NODE_ENV === "production") return [];')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
