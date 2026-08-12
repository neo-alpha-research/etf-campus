import re

with open('components/dashboard/__tests__/dashboard.test.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(' 수익률, 단위 퍼센트', ' 수익률')

with open('components/dashboard/__tests__/dashboard.test.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
