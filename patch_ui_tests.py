from pathlib import Path

test = Path('components/etf-detail/__tests__/etf-detail.test.tsx')
s = test.read_text(encoding='utf-8')
old1 = '    expect(screen.getByText("테스트 기초지수")).toBeInTheDocument();'
old2 = '    expect(screen.getByText(/테스트 기초지수를 기준으로 운용되는 미국 주식 ETF입니다/)).toBeInTheDocument();'
if old1 not in s or old2 not in s:
    raise SystemExit('expected legacy ETF detail assertions not found')
s = s.replace(old1, '    expect(screen.queryByText("테스트 기초지수")).not.toBeInTheDocument();')
s = s.replace(old2, '    expect(screen.queryByText(/테스트 기초지수를 기준으로 운용되는 미국 주식 ETF입니다/)).not.toBeInTheDocument();')
test.write_text(s, encoding='utf-8')

header = Path('components/site-header.tsx')
h = header.read_text(encoding='utf-8')
h2 = h.replace('       >', '      >')
if h2 == h:
    raise SystemExit('site-header trailing whitespace target not found')
header.write_text(h2, encoding='utf-8')
