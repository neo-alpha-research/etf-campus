import csv
import re
from datetime import datetime, timedelta

with open('d1_unadjusted_prices.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

prices = {}
for match in re.finditer(r"\('(\d{6})',\s*'(\d{4}-\d{2}-\d{2})',\s*(\d+)\)", sql):
    t, d, p = match.groups()
    if t not in prices:
        prices[t] = {}
    prices[t][d] = int(p)

print(f"117700 2023-08-18: {prices.get('117700', {}).get('2023-08-18')}")
print(f"117700 2024-08-19: {prices.get('117700', {}).get('2024-08-19')}")
print(f"117700 2026-08-19: {prices.get('117700', {}).get('2026-08-19')}")
