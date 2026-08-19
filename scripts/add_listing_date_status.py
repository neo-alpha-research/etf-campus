from pathlib import Path

repo = Path(r'D:\ETFCampus')
types_path = repo / 'lib' / 'domain' / 'etf-types.ts'
repo_path = repo / 'lib' / 'data' / 'etf-repository.ts'

types = types_path.read_text(encoding='utf-8')
if 'export type ListingDateStatus' not in types:
    marker = 'export type Etf = {'
    if marker not in types:
        raise SystemExit('Etf type marker not found')
    declaration = '''export type ListingDateStatus =\n  | "verified_official"\n  | "official_notice_pending_isin"\n  | "provisional_first_trade"\n  | "conflict"\n  | "manual_review"\n  | "unavailable";\n\n'''
    types = types.replace(marker, declaration + marker, 1)
old_type = '  listingDateSource: string | null;\n'
new_type = old_type + '  listingDateStatus: ListingDateStatus | null;\n'
if '  listingDateStatus: ListingDateStatus | null;' not in types:
    if old_type not in types:
        raise SystemExit('listingDateSource field not found')
    types = types.replace(old_type, new_type, 1)
types_path.write_text(types, encoding='utf-8')

repo_text = repo_path.read_text(encoding='utf-8')
old = '      listingDateSource: optionalText(master, "listing_date_source"),\n'
new = '''      listingDateSource: optionalText(master, "listing_date_source"),\n      listingDateStatus: deriveListingDateStatus(\n        optionalText(master, "listing_date"),\n        optionalText(master, "listing_date_source"),\n      ),\n'''
if 'function deriveListingDateStatus' not in repo_text:
    marker = 'function optionalText(row: CsvRow, field: string): string | null {'
    if marker not in repo_text:
        raise SystemExit('optionalText function marker not found')
    helper = '''function deriveListingDateStatus(\n  listingDate: string | null,\n  listingDateSource: string | null,\n): Etf["listingDateStatus"] {\n  if (!listingDate) return "unavailable";\n  if (listingDateSource === "KRX KIND ETF 종목상세 검증") {\n    return "verified_official";\n  }\n  if (listingDateSource === "KRX KIND 신규상장 공시") {\n    return "official_notice_pending_isin";\n  }\n  if (listingDateSource === "최초 거래 확인일" || listingDateSource === "price_api_first_seen") {\n    return "provisional_first_trade";\n  }\n  return "manual_review";\n}\n\n'''
    repo_text = repo_text.replace(marker, helper + marker, 1)
if '      listingDateStatus: deriveListingDateStatus(' not in repo_text:
    if old not in repo_text:
        raise SystemExit('listing_date_source mapping not found')
    repo_text = repo_text.replace(old, new, 1)
repo_path.write_text(repo_text, encoding='utf-8')
print('listing date status patch applied')
