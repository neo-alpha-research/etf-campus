from scripts.backfill_api import normalize_price_records


def main() -> None:
    records = normalize_price_records(
        {
            "09ABC0": {"TDD_CLSPRC": "12,345"},
            "123456": {"TDD_CLSPRC": "6,789"},
            "09abC0": {"TDD_CLSPRC": "222"},
            "12345": {"TDD_CLSPRC": "111"},
            "ABC-01": {"TDD_CLSPRC": "111"},
        },
        "2026-08-13",
    )
    output = {(row["ticker"], row["close"]) for row in records}
    assert ("09ABC0", 12345.0) in output
    assert ("123456", 6789.0) in output
    assert ("09ABC0", 222.0) in output
    assert all(code not in {"12345", "ABC-01"} for code, _ in output)
    print("alpha_numeric_ticker_backfill: PASS")


if __name__ == "__main__":
    main()
