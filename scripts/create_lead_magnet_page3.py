"""Create the final one-page AI ETF lead-magnet PDF (page 3 of 3)."""

from __future__ import annotations

import csv
import os
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
AS_OF = os.environ.get("LEAD_MAGNET_AS_OF", "20260810")
if not re.fullmatch(r"\d{8}", AS_OF):
    raise ValueError("LEAD_MAGNET_AS_OF must use YYYYMMDD")
AS_OF_DISPLAY = f"{AS_OF[:4]}.{AS_OF[4:6]}.{AS_OF[6:]}"
OUT = Path(os.environ.get("LEAD_MAGNET_OUTPUT_DIR", ROOT / "output" / "pdf")) / "etf-campus-lead-magnet-page-3.pdf"
PERFORMANCE = ROOT / "data" / "lead_magnet" / "generated" / AS_OF / "page3_performance_metrics.csv"
HOLDINGS = ROOT / "data" / "lead_magnet" / "generated" / AS_OF / "page3_holdings_summary.csv"
W, H = landscape(A4)

THEMES = {
    "ai_semiconductor": "반도체",
    "ai_infrastructure_power": "AI 전력 인프라",
    "ai_it_bigtech": "IT·빅테크",
    "broad_ai_value_chain": "글로벌 AI 밸류체인",
    "ai_robotics_automation": "로봇·자동화",
}
ORDER = ["396500", "487240", "139260", "456600", "445290"]


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))


def draw_text(
    page: canvas.Canvas,
    value: str,
    x: float,
    y: float,
    size: float,
    color: colors.Color,
    bold: bool = False,
    align: str = "left",
) -> None:
    page.setFont("MalgunBold" if bold else "Malgun", size)
    page.setFillColor(color)
    draw = {"left": page.drawString, "center": page.drawCentredString, "right": page.drawRightString}[align]
    draw(x, y, value)


def draw_fit(
    page: canvas.Canvas,
    value: str,
    x: float,
    y: float,
    max_width: float,
    size: float,
    color: colors.Color,
    bold: bool = False,
    min_size: float = 6.0,
) -> None:
    font = "MalgunBold" if bold else "Malgun"
    current_size = size
    while current_size > min_size and pdfmetrics.stringWidth(value, font, current_size) > max_width:
        current_size -= 0.2
    if pdfmetrics.stringWidth(value, font, current_size) > max_width:
        suffix = "…"
        while value and pdfmetrics.stringWidth(value + suffix, font, current_size) > max_width:
            value = value[:-1]
        value += suffix
    draw_text(page, value, x, y, current_size, color, bold)


def box(page: canvas.Canvas, x: float, y: float, width: float, height: float, color: colors.Color, radius: float = 8) -> None:
    page.setFillColor(color)
    page.setStrokeColor(color)
    page.roundRect(x, y, width, height, radius, stroke=0, fill=1)


def pct(value: str) -> str:
    number = float(value)
    return f"{number:+.2f}%" if number > 0 else f"{number:.2f}%"


def main() -> None:
    performance = {row["ticker"]: row for row in read_csv(PERFORMANCE)}
    holdings = {row["ticker"]: row for row in read_csv(HOLDINGS)}
    missing = [ticker for ticker in ORDER if ticker not in performance or ticker not in holdings]
    if missing:
        raise RuntimeError(f"Missing page-3 data for {missing}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    pdfmetrics.registerFont(TTFont("Malgun", r"C:\Windows\Fonts\malgun.ttf"))
    pdfmetrics.registerFont(TTFont("MalgunBold", r"C:\Windows\Fonts\malgunbd.ttf"))
    page = canvas.Canvas(str(OUT), pagesize=landscape(A4))

    navy = colors.HexColor("#102A43")
    navy_2 = colors.HexColor("#243B53")
    ink = colors.HexColor("#172B4D")
    muted = colors.HexColor("#5E6C84")
    line = colors.HexColor("#D9E2EC")
    background = colors.HexColor("#F7FAFC")
    blue = colors.HexColor("#1D72F3")
    pale_blue = colors.HexColor("#EAF2FF")
    pale_green = colors.HexColor("#E7F8F1")
    pale_orange = colors.HexColor("#FFF3E0")
    white = colors.white

    box(page, 0, 0, W, H, background, 0)
    box(page, 0, H - 108, W, 108, navy, 0)
    box(page, 42, H - 33, 161, 19, blue, 9)
    draw_text(page, "ETF CAMPUS | 30일 챌린지", 122.5, H - 27, 7.8, white, True, "center")
    draw_text(page, "AI ETF 5종, 수익률보다 먼저 봐야 할 집중도와 낙폭", 42, H - 61, 20.5, white, True)
    draw_text(
        page,
        "AI와 연결된 5개 테마에서 순자산 1위 ETF만 선별했습니다. 같은 AI라도 보유종목 집중도와 중간 낙폭은 크게 다릅니다.",
        42,
        H - 81,
        9.0,
        colors.HexColor("#D9E2EC"),
    )

    chips = [("5개 AI 연결 테마", 42, 26), ("시장가 기준 총수익률", 228, 27), (f"기준일 {AS_OF_DISPLAY}", 427, 22)]
    for label, x, size in chips:
        width = 125 if label != "시장가 기준 총수익률" else 158
        box(page, x, H - 103, width, 22, navy_2, 7)
        draw_text(page, label, x + width / 2, H - 95, size / 2.75, white, True, "center")

    draw_text(page, "성과와 집중도 비교", 42, 456, 10.5, ink, True)
    headers = ["AI 연결 테마", "ETF", "지역", "6개월", "YTD", "1년", "1년 MDD", "TOP 5"]
    widths = [114, 210, 52, 65, 65, 65, 76, 68]
    x0, header_y, row_h = 42, 421, 37
    total_width = sum(widths)
    box(page, x0, header_y, total_width, 27, navy, 6)
    x = x0
    for label, width in zip(headers, widths):
        draw_text(page, label, x + width / 2, header_y + 9, 7.8, white, True, "center")
        x += width

    for row_number, ticker in enumerate(ORDER, 1):
        item = performance[ticker]
        hold = holdings[ticker]
        y = header_y - row_h * row_number
        box(page, x0, y, total_width, row_h, white if row_number % 2 else colors.HexColor("#F1F5F9"), 0)
        x = x0
        draw_text(page, f"{row_number}. {THEMES[item['theme']]}", x + 10, y + 14, 8.0, ink, True)
        x += widths[0]
        draw_fit(page, item["name"], x + 10, y + 14, widths[1] - 18, 8.8, ink, True, 7.0)
        x += widths[1]
        draw_text(page, item["region"], x + widths[2] / 2, y + 14, 7.8, muted, False, "center")
        x += widths[2]
        for field, width in (("return_6m_pct", widths[3]), ("return_ytd_pct", widths[4]), ("return_1y_pct", widths[5])):
            value = pct(item[field])
            color = blue if float(item[field]) > 0 else colors.HexColor("#B42318")
            draw_text(page, value, x + width / 2, y + 14, 8.3, color, True, "center")
            x += width
        draw_text(page, pct(item["mdd_1y_pct"]), x + widths[6] / 2, y + 14, 8.3, colors.HexColor("#B42318"), True, "center")
        x += widths[6]
        box(page, x + 9, y + 7, widths[7] - 18, 23, pale_orange if float(hold["top5_concentration_pct"]) >= 70 else pale_green, 7)
        draw_text(page, f"{float(hold['top5_concentration_pct']):.2f}%", x + widths[7] / 2, y + 14, 8.0, ink, True, "center")

    draw_text(page, "TOP 5 편입종목 - 현금은 제외", 42, 219, 10.3, ink, True)
    for index, ticker in enumerate(ORDER):
        item = performance[ticker]
        hold = holdings[ticker]
        y = 188 - index * 23
        concentration = float(hold["top5_concentration_pct"])
        tag_color = pale_orange if concentration >= 70 else pale_green
        tag_text = colors.HexColor("#9C5700") if concentration >= 70 else colors.HexColor("#067647")
        box(page, 42, y - 5, 110, 18, tag_color, 6)
        draw_text(page, f"{THEMES[item['theme']]}  {concentration:.2f}%", 97, y + 1, 6.9, tag_text, True, "center")
        holdings_text = hold["top5_holdings"].replace(" | ", "  ·  ")
        draw_fit(page, holdings_text, 164, y + 1, 625, 7.0, ink, False, 5.8)

    box(page, 42, 44, W - 84, 27, colors.HexColor("#EAF2FF"), 8)
    draw_text(page, "읽는 법", 55, 56, 8.2, navy, True)
    draw_text(page, "TOP 5 비중이 높을수록 소수 종목의 움직임이 ETF 성과에 더 크게 반영됩니다. MDD는 최근 1년 총수익지수의 최대 낙폭입니다.", 102, 56, 7.4, ink)

    page.setStrokeColor(line)
    page.line(42, 34, W - 42, 34)
    holding_dates = sorted(item["holdings_date"] for item in holdings.values())
    holding_range = holding_dates[0] if holding_dates[0] == holding_dates[-1] else f"{holding_dates[0]}~{holding_dates[-1]}"
    draw_text(page, f"수익률: 원화 시장가격 + 공식 현금분배금 재투자 | 편입종목: {holding_range} | 출처: 각 운용사 공식 상품 페이지", 42, 20, 6.5, muted)
    draw_text(page, "3 / 3", W - 42, 20, 7.0, muted, True, "right")
    page.save()
    print(OUT)


if __name__ == "__main__":
    main()
