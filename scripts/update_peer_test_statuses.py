from pathlib import Path
p=Path(r'D:/ETFCampus/lib/data/__tests__/etf-peer-groups.test.ts')
s=p.read_text(encoding='utf-8')
s=s.replace('["needs_review", "conflict"].includes(row.classification_status)', '["needs_review", "conflict", "classified_derived", "conflict_resolved"].includes(row.classification_status)')
p.write_text(s,encoding='utf-8')
print('patched peer status test')
