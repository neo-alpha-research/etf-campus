from pathlib import Path

panel = Path(r"D:/ETFCampus/components/etf-detail/peer-comparison-panel.tsx")
source = panel.read_text(encoding="utf-8")
old_unverified = '동종 ETF 분류가 확인되지 않아 직접 비교를 준비하고 있습니다.'
if old_unverified in source:
    source = source.replace(old_unverified, '동종 ETF 분류를 확인하고 있습니다.', 1)
else:
    marker = '<p className="text-sm font-semibold text-brand-700">'
    start = source.find(marker)
    if start < 0:
        raise RuntimeError("unverified empty-state marker not found")
    end = source.find('</p>', start)
    if end < 0:
        raise RuntimeError("unverified empty-state closing tag not found")
    source = source[:start] + marker + '동종 ETF 분류를 확인하고 있습니다.' + source[end:]
old_no_peers = '현재 분류에서 직접 비교할 수 있는 ETF가 없습니다.'
if old_no_peers in source:
    source = source.replace(old_no_peers, '현재 기준으로 직접 비교할 수 있는 동종 ETF가 없습니다.', 1)
elif '현재 기준으로 직접 비교할 수 있는 동종 ETF가 없습니다.' not in source:
    marker = '<h3 className="text-lg font-extrabold text-strong">'
    start = source.find(marker, source.find('comparison.state === "no_peers"'))
    if start < 0:
        raise RuntimeError("no-peers empty-state marker not found")
    end = source.find('</h3>', start)
    if end < 0:
        raise RuntimeError("no-peers empty-state closing tag not found")
    source = source[:start] + marker + '현재 기준으로 직접 비교할 수 있는 동종 ETF가 없습니다.' + source[end:]
source = source.replace('comparison.state === "no_peers" || selected.candidates.length === 0', 'comparison.state === "no_peers"', 1)
if '현재 기준으로 직접 비교할 수 있는 동종 ETF가 없습니다.' not in source:
    raise RuntimeError("no-peers message was not applied")
if '후보 수를 채우기 위해 관련성이 낮은 ETF를 표시하지 않습니다.' not in source:
    raise RuntimeError("no-peers caution message is missing")
if '동종 ETF 분류를 확인하고 있습니다.' not in source:
    raise RuntimeError("unverified message was not applied")
panel.write_text(source, encoding="utf-8")
print("Patched", panel)

adapter = Path(r"D:/ETFCampus/lib/data/etf-peer-groups.ts")
source = adapter.read_text(encoding="utf-8")
source = source.replace('state: "ready" | "unverified" | "no_peers";', 'state: "ready" | "unverified" | "no_peers";', 1)
adapter.write_text(source, encoding="utf-8")
print("Verified", adapter)

# Add focused tests to the existing regression file only if they are not already present.
test = Path(r"D:/ETFCampus/lib/data/__tests__/etf-peer-groups.test.ts")
test_source = test.read_text(encoding="utf-8")
if "no_peers state excludes the target" not in test_source:
    test_source += "\n\ndescribe(\"peer comparison empty-state contract\", () => {\n  it(\"does not force-fill a verified group with unrelated peers\", () => {\n    const source = readFileSync(path.join(process.cwd(), \"components\", \"etf-detail\", \"peer-comparison-panel.tsx\"), \"utf8\");\n    expect(source).toContain(\"현재 기준으로 직접 비교할 수 있는 동종 ETF가 없습니다.\");\n    expect(source).toContain(\"후보 수를 채우기 위해 관련성이 낮은 ETF를 표시하지 않습니다.\");\n    expect(source).toContain(\"동종 ETF 분류를 확인하고 있습니다.\");\n    expect(source).not.toContain('comparison.state === \"no_peers\" || selected.candidates.length === 0');\n  });\n});\n"
    test.write_text(test_source, encoding="utf-8")
    print("Added focused empty-state regression test")
else:
    print("Focused empty-state regression test already exists")

# Retain the existing 4-card cap and make it explicit in the adapter source contract.
if "slice(0, MAX_PEERS)" not in adapter.read_text(encoding="utf-8"):
    raise RuntimeError("maximum peer cap is missing")
print("Verified MAX_PEERS cap")
