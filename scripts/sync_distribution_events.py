import json, csv, sys
from pathlib import Path

def sync_events():
    summaries_path = Path('data/distributions/etf_distribution_summaries.json')
    out_path = Path('data/distributions/etf_distribution_events.csv')
    
    if not summaries_path.exists():
        print("summaries file missing")
        sys.exit(1)
        
    with open(summaries_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    events = []
    for summary in data.get('summaries', []):
        ticker = summary['ticker']
        for record in summary.get('records', []):
            if record.get('amountKrw') is not None and record.get('exDate'):
                events.append({
                    'event_id': record['eventId'],
                    'ticker': ticker,
                    'ex_date': record['exDate'],
                    'distribution_per_share_krw': record['amountKrw'],
                    'verification_status': 'verified'
                })

    with open(out_path, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=['event_id', 'ticker', 'ex_date', 'distribution_per_share_krw', 'verification_status'])
        writer.writeheader()
        writer.writerows(events)
        
    print(f'Synced {len(events)} events to {out_path}')

if __name__ == '__main__':
    sync_events()
