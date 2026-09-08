import argparse
import csv
import json
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

KST = timezone(timedelta(hours=9))

def check_daily_market_ssot(now_kst: datetime) -> bool:
    """Check if data/etf_master_draft.csv already contains today's expected trading day."""
    try:
        from trading_days import load_holidays, latest_trading_day
    except ImportError:
        try:
            from scripts.trading_days import load_holidays, latest_trading_day
        except ImportError:
            return False

    holidays_path = Path("data/market_holidays.txt")
    if not holidays_path.exists():
        holidays_path = Path(__file__).resolve().parents[1] / "data" / "market_holidays.txt"
    holidays = load_holidays(holidays_path)
    expected_day = latest_trading_day(now_kst.date(), holidays)
    expected_str = expected_day.strftime("%Y%m%d")

    master_path = Path("data/etf_master_draft.csv")
    if not master_path.exists():
        master_path = Path(__file__).resolve().parents[1] / "data" / "etf_master_draft.csv"

    if master_path.exists():
        with open(master_path, encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            first_row = next(reader, None)
            if first_row and str(first_row.get("bas_dt", "")).strip() == expected_str:
                print(f"SSOT verified: data/etf_master_draft.csv already contains expected trading day {expected_str}.")
                return True
            else:
                current_bas = str(first_row.get("bas_dt", "")).strip() if first_row else "empty"
                print(f"SSOT pending: etf_master_draft has {current_bas}, expected {expected_str}.")
                return False
    return False

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workflow", required=True, help="Workflow filename or name (e.g. daily-fees.yml)")
    args = parser.parse_args()

    now_kst = datetime.now(KST)

    # For daily-market.yml, rely strictly on SSOT data parity rather than CI run metadata
    if args.workflow in ("daily-market.yml", "Daily ETF market data refresh"):
        if check_daily_market_ssot(now_kst):
            sys.exit(0)
        else:
            sys.exit(1)

    try:
        result = subprocess.run(
            ["gh", "run", "list", "--workflow", args.workflow, "--status", "success", "--json", "createdAt", "--limit", "1"],
            capture_output=True,
            text=True,
            check=True
        )
        runs = json.loads(result.stdout)
        
        if not runs:
            print(f"No successful runs found for {args.workflow}.")
            sys.exit(1)

        last_run_utc = datetime.fromisoformat(runs[0]["createdAt"].replace('Z', '+00:00'))
        last_run_kst = last_run_utc.astimezone(KST)

        if last_run_kst.date() == now_kst.date():
            print(f"Workflow {args.workflow} already succeeded today at {last_run_kst.isoformat()}.")
            sys.exit(0)
        else:
            print(f"Last successful run was on {last_run_kst.date()}, which is not today ({now_kst.date()}).")
            sys.exit(1)

    except subprocess.CalledProcessError as e:
        print(f"Error calling gh cli: {e.stderr}")
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()

