from pathlib import Path
import subprocess

repo = Path(r'D:\ETFCampus')
path = repo / 'components/etf-detail/etf-detail.tsx'
current = path.read_text(encoding='utf-8')
head = subprocess.check_output(
    ['git', 'show', 'HEAD:components/etf-detail/etf-detail.tsx'],
    cwd=repo,
    encoding='utf-8',
)

def block_bounds(text: str):
    lines = text.splitlines(keepends=True)
    start = next(i for i, line in enumerate(lines) if '{/* Tooltip */}' in line)
    depth = 0
    end = None
    for i in range(start + 1, len(lines)):
        depth += lines[i].count('<div')
        depth -= lines[i].count('</div>')
        if depth == 0 and i > start + 1:
            end = i + 1
            break
    if end is None:
        raise RuntimeError('tooltip block end not found')
    return lines, start, end

current_lines, current_start, current_end = block_bounds(current)
head_lines, head_start, head_end = block_bounds(head)
updated = ''.join(current_lines[:current_start] + head_lines[head_start:head_end] + current_lines[current_end:])
path.write_text(updated, encoding='utf-8', newline='')
print('full tooltip block restored from HEAD')
