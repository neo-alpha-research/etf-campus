import re

with open('scripts/build_classification_review.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('return "검수 필요", "시장 단서 부족"', 'return "국내", "시장 단서 부족으로 국내로 간주 (기본값)"')

with open('scripts/build_classification_review.py', 'w', encoding='utf-8') as f:
    f.write(content)
