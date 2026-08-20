import re

with open('d1_unadjusted_prices.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

prices = {}
for match in re.finditer(r"\('(\d{6})',\s*'(\d{4}-\d{2}-\d{2})',\s*(\d+)\)", sql):
    t, d, p = match.groups()
    if t not in prices:
        prices[t] = {}
    prices[t][d] = int(p)

p1 = prices['117700'].get('2023-07-19')
p2 = prices['117700'].get('2026-07-20')
print(f'2023-07-19: {p1}, 2026-07-20: {p2}, ret: {(p2-p1)/p1*100:.2f}%')
