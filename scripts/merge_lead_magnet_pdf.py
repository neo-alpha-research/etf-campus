import os
from pathlib import Path

from pypdf import PdfReader, PdfWriter

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = Path(os.environ.get("LEAD_MAGNET_OUTPUT_DIR", ROOT / "output" / "pdf"))
PAGES = [
    OUTPUT_DIR / 'etf-campus-lead-magnet-page-1.pdf',
    OUTPUT_DIR / 'etf-campus-lead-magnet-page-2.pdf',
    OUTPUT_DIR / 'etf-campus-lead-magnet-page-3.pdf',
]
OUT = OUTPUT_DIR / 'etf-campus-3-page-etf-lead-magnet.pdf'


def main():
    writer = PdfWriter()
    for source in PAGES:
        reader = PdfReader(source)
        if len(reader.pages) != 1:
            raise ValueError(f'{source.name} must contain exactly one page')
        writer.add_page(reader.pages[0])
    with OUT.open('wb') as stream:
        writer.write(stream)
    merged = PdfReader(OUT)
    if len(merged.pages) != 3:
        raise ValueError('Merged PDF must contain exactly three pages')
    print(OUT)


if __name__ == '__main__':
    main()
