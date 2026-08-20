import argparse
import json
import subprocess
import sys
from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workflow", required=True, help="Workflow filename or name (e.g. daily-fees.yml)")
    args = parser.parse_args()

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
        now_kst = datetime.now(KST)

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
