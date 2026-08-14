import sys
import json
import urllib.request
import urllib.error
import csv

def main():
    if len(sys.argv) < 2:
        print("Usage: python validate_d1_status.py <bas_dt>")
        sys.exit(1)
        
    bas_dt = sys.argv[1]
    if len(bas_dt) == 8:
        formatted_date = f"{bas_dt[:4]}-{bas_dt[4:6]}-{bas_dt[6:8]}"
    else:
        formatted_date = bas_dt
        
    # Read master file to get count of tickers
    master_count = 0
    with open('data/etf_master_draft.csv', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            master_count += 1
            
    print(f"Master file has {master_count} tickers for {formatted_date}.")
    
    # We will check representative ticker 0182R0
    url = f"https://etf-campus.pages.dev/api/prices/history?ticker=0182R0&start={formatted_date}&end={formatted_date}"
    req = urllib.request.Request(url, headers={'User-Agent': 'etf-campus-validator'})
    
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            if "error" in data:
                print(f"API Error: {data['error']}")
                sys.exit(1)
                
            actual_end = data.get("actualEnd")
            if actual_end != formatted_date:
                print(f"Validation failed: D1 actualEnd is {actual_end}, expected {formatted_date}")
                sys.exit(1)
                
            print(f"Validation passed: D1 data for 0182R0 is up to date ({actual_end}).")
            
            # Write to github step summary
            import os
            summary_file = os.environ.get("GITHUB_STEP_SUMMARY")
            if summary_file:
                with open(summary_file, "a") as sf:
                    sf.write(f"\n### D1 Validation Status\n")
                    sf.write(f"- Master snapshot date: {bas_dt}\n")
                    sf.write(f"- D1 price history latest date: {actual_end}\n")
                    sf.write(f"- Expected ticker count: {master_count}\n")
                    sf.write(f"- Alignment status: ✅ Aligned\n")
                    
    except urllib.error.URLError as e:
        print(f"Failed to fetch D1 status: {e}")
        # In a real scenario, this shouldn't fail the build if it's just a validation endpoint 
        # that might take time to cache bust, but for this requirement we want atomic success.
        sys.exit(1)

if __name__ == "__main__":
    main()
