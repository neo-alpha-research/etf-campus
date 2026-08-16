from pathlib import Path
import subprocess
import tempfile

repo = Path(r'D:\ETFCampus')
path = 'components/etf-detail/etf-detail.tsx'
diff = subprocess.check_output(['git', 'diff', '--unified=0', '--', path], cwd=repo, text=True, encoding='utf-8')
lines = diff.splitlines(keepends=True)
header = []
hunk = []
in_hunk = False
for line in lines:
    if line.startswith('@@'):
        in_hunk = '-235' in line
        if in_hunk:
            hunk.append(line)
        elif hunk:
            break
    elif not in_hunk:
        if line.startswith('diff --git') or line.startswith('index ') or line.startswith('--- ') or line.startswith('+++ '):
            header.append(line)
    else:
        hunk.append(line)
if not hunk:
    raise SystemExit('tooltip hunk not found')
patch = ''.join(header + hunk)
with tempfile.NamedTemporaryFile('w', suffix='.patch', delete=False, encoding='utf-8', newline='') as f:
    f.write(patch)
    patch_path = f.name
subprocess.check_call(['git', 'apply', '-R', '--unidiff-zero', '--whitespace=nowarn', patch_path], cwd=repo)
print('tooltip hunk restored')
