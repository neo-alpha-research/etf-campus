"""Generate SQL statements to sync all 12 market indices from data/market_indices.json to D1 market_source_index_daily."""

from __future__ import annotations

import json
from pathlib import Path


def main() -> None:
    indices_file = Path("data/market_indices.json")
    if not indices_file.exists():
        raise FileNotFoundError(f"{indices_file} does not exist.")

    with open(indices_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    as_of_date = "2026-09-16"
    source_version = "market-source-2026-09-16-bd9450dcf8ddb141"

    indices = data.get("indices", [])
    if len(indices) != 12:
        raise ValueError(f"Expected 12 indices in {indices_file}, found {len(indices)}")

    statements = []
    for item in indices:
        code = (item.get("code") or item.get("label") or "").strip().upper()
        name = (item.get("label") or code).strip()
        close = float(item.get("value", 0.0))
        change_points = item.get("changePoints")
        change_pct = float(item.get("change", 0.0))
        volume = item.get("volumeValue")

        pts_str = "NULL" if change_points is None else str(float(change_points))
        vol_str = "NULL" if volume is None else str(float(volume))

        sql = f"""INSERT INTO market_source_index_daily (
  as_of_date, source_version, index_code, index_name, close_value, change_points, change_pct, volume_value, source_hash, ingested_at
) VALUES ('{as_of_date}', '{source_version}', '{code}', '{name}', {close}, {pts_str}, {change_pct}, {vol_str}, 'sync_script', datetime('now'))
ON CONFLICT(as_of_date, source_version, index_code) DO UPDATE SET
  index_name=excluded.index_name, close_value=excluded.close_value, change_points=excluded.change_points,
  change_pct=excluded.change_pct, volume_value=excluded.volume_value, source_hash=excluded.source_hash,
  ingested_at=excluded.ingested_at;"""
        statements.append(sql)

    output_path = Path("data/sync_market_indices.sql")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(statements) + "\n")

    print(f"Generated {len(statements)} SQL statements to {output_path}")


if __name__ == "__main__":
    main()
