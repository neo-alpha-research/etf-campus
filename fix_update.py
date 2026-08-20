import sys
with open('scripts/update_daily_data.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('"r_12m": ("months", 12),\n}', '"r_12m": ("months", 12),\n    "r_24m": ("months", 24),\n    "r_36m": ("months", 36),\n}')
content = content.replace('"r_1d", "r_1w", "r_2w", "r_1m", "r_2m", "r_3m", "r_6m", "r_ytd", "r_12m"', '"r_1d", "r_1w", "r_2w", "r_1m", "r_2m", "r_3m", "r_6m", "r_ytd", "r_12m", "r_24m", "r_36m"')

with open('scripts/update_daily_data.py', 'w', encoding='utf-8') as f:
    f.write(content)
