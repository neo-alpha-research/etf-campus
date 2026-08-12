import argparse
import base64
import datetime
import hashlib
import hmac
import json
import math
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Any

# Import existing logic. The fallback preserves direct execution via
# `python scripts/backfill_api.py`, while the package import supports unit tests.
try:
    from scripts.update_daily_data import fetch_krx_snapshot, fetch_snapshot
except ModuleNotFoundError:
    from update_daily_data import fetch_krx_snapshot, fetch_snapshot

# A free D1 invocation permits 50 queries. The ingestion Function performs
# three bookkeeping queries plus one UPSERT per record, so 40 keeps a safe
# margin for one transactional batch.
MAX_RECORDS_PER_REQUEST = 40
DEFAULT_INGEST_ENDPOINT = "https://etf-campus.pages.dev/api/internal/ingest-prices"
KST = datetime.timezone(datetime.timedelta(hours=9))


def get_market_holidays() -> set[str]:
    path = Path("data/market_holidays.txt")
    if not path.exists():
        return set()
    holidays = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.split("#")[0].strip()
        if line:
            holidays.add(line)
    return holidays


def is_trading_day(dt: datetime.date, holidays: set[str]) -> bool:
    if dt.weekday() >= 5:  # 5=Sat, 6=Sun
        return False
    if dt.strftime("%Y%m%d") in holidays:
        return False
    return True


def required_environment(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(
            f"{name} is required. Configure it as a GitHub Actions secret; do not store it in source code."
        )
    return value


def get_ingest_endpoint() -> str:
    """Return only the fixed production ingestion route; a secret must never be sent elsewhere."""
    endpoint = os.environ.get("PRICE_INGEST_ENDPOINT", DEFAULT_INGEST_ENDPOINT).strip()
    parsed = urllib.parse.urlparse(endpoint)
    if (
        parsed.scheme != "https"
        or parsed.netloc != "etf-campus.pages.dev"
        or parsed.path != "/api/internal/ingest-prices"
        or parsed.params
        or parsed.query
        or parsed.fragment
    ):
        raise RuntimeError("PRICE_INGEST_ENDPOINT must target the ETF Campus internal price endpoint.")
    return endpoint


def normalize_price_records(snapshot: dict[str, dict[str, Any]], date_str: str) -> list[dict[str, str | float]]:
    """Normalize only valid KRX-style ETF closing-price records for the fixed ingestion schema."""
    records: list[dict[str, str | float]] = []
    for ticker, data in snapshot.items():
        if not isinstance(ticker, str) or not ticker.isdigit() or len(ticker) != 6:
            continue
        close_price = data.get("TDD_CLSPRC") or data.get("close") or data.get("clpr")
        if close_price is None:
            continue
        try:
            normalized_price = float(str(close_price).replace(",", ""))
        except (TypeError, ValueError):
            continue
        if not math.isfinite(normalized_price) or normalized_price <= 0 or normalized_price > 100_000_000:
            continue
        records.append({"ticker": ticker, "date": date_str, "close": normalized_price})
    return records


def chunk_records(records: list[dict[str, str | float]]) -> list[list[dict[str, str | float]]]:
    return [records[index : index + MAX_RECORDS_PER_REQUEST] for index in range(0, len(records), MAX_RECORDS_PER_REQUEST)]


def build_signed_payload(
    records: list[dict[str, str | float]],
    *,
    request_id: str,
    timestamp: int,
    secret: str,
) -> tuple[bytes, str]:
    """Build the exact compact JSON body and base64 HMAC-SHA256 signature expected by Pages."""
    payload = {"requestId": request_id, "records": records}
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    message = b"POST\n" + str(timestamp).encode("ascii") + b"\n" + body
    signature = base64.b64encode(hmac.new(secret.encode("utf-8"), message, hashlib.sha256).digest()).decode("ascii")
    return body, signature


def send_price_batch(
    records: list[dict[str, str | float]],
    *,
    endpoint: str,
    secret: str,
    request_id: str | None = None,
    now: int | None = None,
) -> int:
    """Send one schema-limited, signed price batch. No SQL is ever sent by this client."""
    if not records or len(records) > MAX_RECORDS_PER_REQUEST:
        raise ValueError(f"records must contain 1 to {MAX_RECORDS_PER_REQUEST} items")

    timestamp = now if now is not None else int(time.time())
    generated_id = request_id or f"backfill_{uuid.uuid4().hex}"
    body, signature = build_signed_payload(records, request_id=generated_id, timestamp=timestamp, secret=secret)
    request = urllib.request.Request(
        endpoint,
        data=body,
        headers={
            "Content-Type": "application/json",
            "X-ETF-Ingest-Timestamp": str(timestamp),
            "X-ETF-Ingest-Signature": signature,
            "User-Agent": "etf-campus-price-backfill/2.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        # Do not print request headers, the request body, or the HMAC signature.
        raise RuntimeError(f"Signed price ingestion failed with HTTP {error.code}.") from error
    except urllib.error.URLError as error:
        raise RuntimeError("Signed price ingestion could not reach the ETF Campus endpoint.") from error
    except json.JSONDecodeError as error:
        raise RuntimeError("Signed price ingestion returned invalid JSON.") from error

    accepted = response_payload.get("accepted")
    if not isinstance(accepted, int) or accepted != len(records):
        raise RuntimeError("Signed price ingestion did not confirm the submitted record count.")
    return accepted


def missing_trading_days(
    days: int,
    holidays: set[str],
    *,
    today: datetime.date | None = None,
) -> list[datetime.date]:
    """Return recent *closed* sessions; never request today's unfinished close."""
    trading_days: list[datetime.date] = []
    current_date = (
        today or datetime.datetime.now(KST).date()
    ) - datetime.timedelta(days=1)
    while len(trading_days) < days:
        if is_trading_day(current_date, holidays):
            trading_days.insert(0, current_date)
        current_date -= datetime.timedelta(days=1)
    return trading_days


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill KRX ETF prices through signed ingestion")
    parser.add_argument(
        "--days",
        type=int,
        default=5,
        help="Recent trading days to submit. UPSERT makes re-submission safe; use a larger value for backfill.",
    )
    args = parser.parse_args()
    if args.days < 1 or args.days > 365:
        parser.error("--days must be between 1 and 365")

    krx_key = os.environ.get("KRX_OPEN_API_KEY")
    go_kr_key = os.environ.get("DATA_GO_KR_SERVICE_KEY")
    secret = required_environment("PRICE_INGEST_HMAC_SECRET")
    endpoint = get_ingest_endpoint()

    holidays = get_market_holidays()
    trading_days = missing_trading_days(args.days, holidays)
    print(f"Submitting {len(trading_days)} trading days through signed price ingestion.")

    accepted_total = 0
    failed_days = 0
    for index, trading_date in enumerate(trading_days):
        day_text = trading_date.strftime("%Y%m%d")
        sql_date = trading_date.strftime("%Y-%m-%d")
        print(f"[{index + 1}/{len(trading_days)}] Fetching and submitting {sql_date}...")

        snapshot = None
        if krx_key:
            try:
                snapshot = fetch_krx_snapshot(krx_key, day_text)
            except Exception as error:
                print(f"  KRX API failed for {sql_date}: {error}")

        if not snapshot and go_kr_key:
            try:
                print(f"  Attempting fallback to data.go.kr for {sql_date}...")
                snapshot = fetch_snapshot(go_kr_key, day_text)
            except Exception as error:
                print(f"  Fallback data.go.kr API failed for {sql_date}: {error}")

        if not snapshot:
            print(f"  Failed to get data for {sql_date} from any API. Skipping.")
            failed_days += 1
            continue

        records = normalize_price_records(snapshot, sql_date)
        if not records:
            print(f"  No valid prices found in snapshot for {sql_date}.")
            failed_days += 1
            continue

        try:
            accepted_for_day = 0
            for batch_number, batch in enumerate(chunk_records(records), start=1):
                request_id = f"backfill_{day_text}_{batch_number}_{uuid.uuid4().hex}"
                accepted_for_day += send_price_batch(
                    batch,
                    endpoint=endpoint,
                    secret=secret,
                    request_id=request_id,
                )
                time.sleep(0.1)
            accepted_total += accepted_for_day
            print(f"  Accepted {accepted_for_day} prices for {sql_date}.")
        except Exception as error:
            print(f"  Failed to submit {sql_date}: {error}")
            failed_days += 1

    print(f"Signed price ingestion completed: {accepted_total} accepted records, {failed_days} failed dates.")
    if failed_days:
        sys.exit(1)


if __name__ == "__main__":
    main()
