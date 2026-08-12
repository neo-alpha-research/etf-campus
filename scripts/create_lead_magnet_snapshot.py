"""Freeze the current processed ETF data into a traceable lead-magnet staging snapshot.

This command deliberately does not call external APIs or overwrite the service CSV files.
It is a bootstrap for the first lead-magnet run when the latest ETF master already exists.
Raw API downloads collected in a later step must be stored beside this staging snapshot,
not substituted silently for it.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MASTER_NAME = "etf_master_draft.csv"
RETURNS_NAME = "etf_returns_draft.csv"


def read_csv(path: Path) -> tuple[list[dict[str, str]], list[str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        return list(reader), list(reader.fieldnames or [])


def write_csv(path: Path, rows: list[dict[str, str]], fields: list[str]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def display_path(path: Path) -> str:
    """Use a repository-relative path when possible, otherwise retain an absolute path."""
    try:
        return str(path.relative_to(ROOT)).replace("\\", "/")
    except ValueError:
        return str(path)


def resolve_as_of(master_rows: list[dict[str, str]], return_fields: list[str]) -> str:
    dates = {str(row.get("bas_dt") or "").strip() for row in master_rows}
    dates.discard("")
    if len(dates) != 1:
        raise ValueError(f"Expected exactly one bas_dt in master data, found: {sorted(dates)}")
    as_of = dates.pop()
    if len(as_of) != 8 or not as_of.isdigit():
        raise ValueError(f"Invalid bas_dt: {as_of}")
    if f"close_{as_of}" not in return_fields:
        raise ValueError(f"Returns file is missing close_{as_of}")
    return as_of


def create_snapshot(data_dir: Path, output_root: Path) -> Path:
    master_path = data_dir / MASTER_NAME
    returns_path = data_dir / RETURNS_NAME
    master_rows, master_fields = read_csv(master_path)
    return_rows, return_fields = read_csv(returns_path)
    if not master_rows or not return_rows:
        raise ValueError("Master and returns data must both contain at least one row.")

    as_of = resolve_as_of(master_rows, return_fields)
    snapshot_dir = output_root / "staging" / as_of
    snapshot_dir.mkdir(parents=True, exist_ok=False)

    master_out = snapshot_dir / "etf_master_snapshot.csv"
    returns_out = snapshot_dir / "etf_returns_snapshot.csv"
    write_csv(master_out, master_rows, master_fields)
    write_csv(returns_out, return_rows, return_fields)

    aum_count = sum(
        1
        for row in master_rows
        if str(row.get("aum") or "").replace(",", "").strip() not in {"", "0"}
    )
    manifest = {
        "schema_version": "1.0.0",
        "snapshot_kind": "processed_official_data_bootstrap",
        "as_of_date": as_of,
        "created_at_utc": datetime.now(UTC).replace(microsecond=0).isoformat(),
        "source_status": "inherited_processed_snapshot_not_raw_api_response",
        "source_files": [
            {
                "source_path": display_path(master_path),
                "snapshot_path": display_path(master_out),
                "rows": len(master_rows),
                "sha256": sha256(master_out),
                "purpose": "ETF master, current price, direct AUM field, classification baseline",
            },
            {
                "source_path": display_path(returns_path),
                "snapshot_path": display_path(returns_out),
                "rows": len(return_rows),
                "sha256": sha256(returns_out),
                "purpose": "Existing price-return history baseline only; not final total-return data",
            },
        ],
        "quality_summary": {
            "master_row_count": len(master_rows),
            "returns_row_count": len(return_rows),
            "direct_aum_nonzero_count": aum_count,
            "master_bas_dt_uniform": True,
        },
        "limitations": [
            "This bootstrap snapshot is copied from the current processed service data.",
            "It is not a replacement for archived raw KRX or FSC API responses.",
            "The returns file contains existing price-return fields and cannot satisfy the final total-return requirement by itself.",
            "A later raw collection step must add official daily prices, distributions, holdings, costs, and strategy-change evidence.",
        ],
    }
    (snapshot_dir / "source_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return snapshot_dir


def main() -> None:
    parser = argparse.ArgumentParser(description="Freeze the current ETF data as a lead-magnet staging snapshot.")
    parser.add_argument("--data-dir", type=Path, default=ROOT / "data")
    parser.add_argument("--output-root", type=Path, default=ROOT / "data" / "lead_magnet")
    args = parser.parse_args()
    snapshot_dir = create_snapshot(args.data_dir, args.output_root)
    print(snapshot_dir)


if __name__ == "__main__":
    main()
