from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path


def load_holidays(path: Path) -> set[str]:
    """Read YYYYMMDD holiday dates, ignoring blank lines and # comments."""
    if not path.exists():
        return set()
    holidays: set[str] = set()
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        if len(line) != 8 or not line.isdigit():
            raise ValueError(f"{path}: 잘못된 날짜 형식입니다. {raw!r} (YYYYMMDD 필요)")
        holidays.add(line)
    return holidays


def latest_trading_day(today: date, holidays: set[str]) -> date:
    """Most recent closed trading day strictly before `today`."""
    day = today
    for _ in range(30):
        day -= timedelta(days=1)
        if day.weekday() < 5 and day.strftime("%Y%m%d") not in holidays:
            return day
    raise RuntimeError("30일을 거슬러도 거래일을 찾지 못했습니다. 휴장일 목록을 확인하십시오.")
