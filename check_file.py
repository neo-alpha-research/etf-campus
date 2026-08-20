import sys
with open('lib/data/__tests__/etf-repository.test.ts', 'r', encoding='utf-8') as f:
    for line in f.readlines():
        if "pension" in line:
            print(line.strip())
