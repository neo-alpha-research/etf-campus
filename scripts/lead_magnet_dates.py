"""Shared, explicit date handling for lead-magnet data jobs."""

from __future__ import annotations

from datetime import date


def parse_as_of(value: str) -> date:
    normalized = value.strip().replace("-", "")
    if len(normalized) != 8 or not normalized.isdigit():
        raise ValueError("as-of date must use YYYYMMDD or YYYY-MM-DD")
    return date.fromisoformat(f"{normalized[:4]}-{normalized[4:6]}-{normalized[6:]}")


def compact(value: date) -> str:
    return value.strftime("%Y%m%d")


def years_before(value: date, years: int) -> date:
    try:
        return value.replace(year=value.year - years)
    except ValueError:  # Feb 29 -> Feb 28 in a non-leap year
        return value.replace(year=value.year - years, month=2, day=28)


def months_before(value: date, months: int) -> date:
    ordinal = value.year * 12 + value.month - 1 - months
    year, month_index = divmod(ordinal, 12)
    month = month_index + 1
    # All current ETF anchors use the 10th, but clamp safely for month-end jobs.
    import calendar
    return value.replace(year=year, month=month, day=min(value.day, calendar.monthrange(year, month)[1]))
