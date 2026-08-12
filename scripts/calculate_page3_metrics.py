import csv
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / 'data' / 'page3_price_history.csv'
OUTPUT = ROOT / 'data' / 'page3_price_metrics.csv'
REFERENCE = date(2026, 7, 31)
YTD_ANCHOR = date(2025, 12, 31)
THREE_MONTH_ANCHOR = date(2026, 4, 30)


def on_or_before(series, target):
    eligible = [item for item in series if item[0] <= target]
    if not eligible:
        raise ValueError(f'No price on or before {target.isoformat()}')
    return eligible[-1]


def calculate_mdd(series):
    peak = None
    worst = 0.0
    for _, close in series:
        peak = close if peak is None else max(peak, close)
        worst = min(worst, close / peak - 1)
    return worst


def main():
    grouped = {}
    with INPUT.open(encoding='utf-8-sig', newline='') as stream:
        for row in csv.DictReader(stream):
            grouped.setdefault(row['ticker'], []).append((date.fromisoformat(row['date']), float(row['close'])))

    rows = []
    for ticker, series in sorted(grouped.items()):
        series.sort()
        reference_date, reference_close = on_or_before(series, REFERENCE)
        ytd_date, ytd_close = on_or_before(series, YTD_ANCHOR)
        three_month_date, three_month_close = on_or_before(series, THREE_MONTH_ANCHOR)
        mdd = calculate_mdd(series)
        mdd_label = '상장 후 시장가격 MDD' if ticker == '0093A0' else '1년 시장가격 MDD'
        rows.append({
            'ticker': ticker,
            'reference_date': reference_date.isoformat(),
            'reference_close': f'{reference_close:.0f}',
            'ytd_anchor_date': ytd_date.isoformat(),
            'ytd_price_return_pct': f'{(reference_close / ytd_close - 1) * 100:.2f}',
            'three_month_anchor_date': three_month_date.isoformat(),
            'three_month_price_return_pct': f'{(reference_close / three_month_close - 1) * 100:.2f}',
            'mdd_start_date': series[0][0].isoformat(),
            'mdd_end_date': reference_date.isoformat(),
            'mdd_label': mdd_label,
            'mdd_pct': f'{mdd * 100:.2f}',
            'observation_count': len(series),
            'return_basis': '거래소 시장가격 종가, 분배금 제외',
        })

    fields = list(rows[0])
    with OUTPUT.open('w', encoding='utf-8-sig', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    print('saved', OUTPUT)
    for row in rows:
        print(row['ticker'], row['ytd_price_return_pct'], row['three_month_price_return_pct'], row['mdd_pct'])


if __name__ == '__main__':
    main()
