"""Render the validated dividend ETF comparison as lead-magnet page 2."""
from __future__ import annotations

import csv
import os
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
AS_OF = os.environ.get("LEAD_MAGNET_AS_OF", "20260810")
if not re.fullmatch(r"\d{8}", AS_OF):
    raise ValueError("LEAD_MAGNET_AS_OF must use YYYYMMDD")
AS_OF_DISPLAY = f"{AS_OF[:4]}.{AS_OF[4:6]}.{AS_OF[6:]}"
DATA = ROOT / "data" / "lead_magnet" / "generated" / AS_OF / "page2_metrics.csv"
OUTPUT = Path(os.environ.get("LEAD_MAGNET_OUTPUT_DIR", ROOT / "output" / "pdf")) / "etf-campus-lead-magnet-page-2.pdf"
W, H = landscape(A4)

def box(pdf, x, y, w, h, colour, radius=0):
    pdf.setFillColor(colour); pdf.setStrokeColor(colour)
    if radius: pdf.roundRect(x, y, w, h, radius, fill=1, stroke=0)
    else: pdf.rect(x, y, w, h, fill=1, stroke=0)

def write(pdf, value, x, y, size, colour, bold=False, align="left"):
    pdf.setFont("MalgunBold" if bold else "Malgun", size); pdf.setFillColor(colour)
    {"left": pdf.drawString, "center": pdf.drawCentredString, "right": pdf.drawRightString}[align](x, y, value)

def short_aum(value):
    number = float(value)
    return f"{number/1_0000_0000_0000:.1f}조" if number >= 1_0000_0000_0000 else f"{number/1_0000_0000:.0f}억"

def pct(value): return f"{float(value):+.1f}%"

def main():
    pdfmetrics.registerFont(TTFont("Malgun", r"C:\Windows\Fonts\malgun.ttf"))
    pdfmetrics.registerFont(TTFont("MalgunBold", r"C:\Windows\Fonts\malgunbd.ttf"))
    with DATA.open(encoding="utf-8-sig", newline="") as stream: rows = list(csv.DictReader(stream))
    navy, blue, ink, muted, line, bg, white = [colors.HexColor(x) for x in ("#102A43", "#175CD3", "#1D2939", "#667085", "#D0D5DD", "#F8FAFC", "#FFFFFF")]
    green, red, orange, pale_orange = [colors.HexColor(x) for x in ("#067647", "#B42318", "#B54708", "#FFF6ED")]
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(str(OUTPUT), pagesize=landscape(A4))
    box(pdf, 0, 0, W, H, bg); box(pdf, 0, H-111, W, 111, navy)
    box(pdf, 42, H-40, 125, 20, blue, 10); write(pdf, "ETF CAMPUS  |  30일 챌린지", 104.5, H-34, 8, white, True, "center")
    write(pdf, "배당 ETF, 수익률과 현금흐름을 함께 보세요", 42, H-72, 22, white, True)
    write(pdf, f"국내·미국 배당형 순자산 상위 3종씩 · 커버드콜 제외 · {AS_OF_DISPLAY} 기준", 42, H-95, 10, colors.HexColor("#D9E5F5"))
    write(pdf, "배당이라는 이름보다 ‘실제로 얼마를, 몇 번 지급했는지’와 원금 변동을 먼저 확인하세요.", 42, 454, 10.7, ink, True)
    write(pdf, "TTM 분배율은 최근 12개월 실제 분배금 합계 ÷ 기준일 종가이며, 수익률은 분배금 조정 총수익률입니다.", 42, 436, 8.6, muted)

    x0, bottom, row_h, header_h = 42, 105, 47, 42
    widths = [40, 128, 50, 55, 55, 46, 46, 46, 48, 244]
    headers = ["지역", "대표 ETF", "순자산", "TTM\n분배율", "분배\n횟수", "6개월", "YTD", "1년", "1년\nMDD", "TOP 5 편입종목  |  집중도"]
    table_w, header_y = sum(widths), bottom + row_h*6
    box(pdf, x0, header_y, table_w, header_h, navy, 7)
    cursor = x0
    for label, width in zip(headers, widths):
        parts = label.split("\n"); write(pdf, parts[0], cursor+width/2, header_y+25, 7.5, white, True, "center")
        if len(parts)>1: write(pdf, parts[1], cursor+width/2, header_y+12, 7.5, white, True, "center")
        cursor += width

    for index, row in enumerate(rows):
        y = bottom + row_h*(5-index); shade = white if index % 2 == 0 else colors.HexColor("#F2F4F7")
        box(pdf, x0, y, table_w, row_h, shade); cursor=x0
        values = [row["region"], row["name"], short_aum(row["aum_krw"]), f"{float(row['ttm_distribution_yield_pct']):.2f}%",
                  f"{row['distribution_count_12m']}회", pct(row["return_6m_pct"]), pct(row["return_ytd_pct"]),
                  pct(row["return_1y_pct"]), pct(row["mdd_1y_pct"]), row["top5_holdings"]]
        for column, (value, width) in enumerate(zip(values, widths)):
            if column == 1:
                if row["ticker"] == "466940":
                    write(pdf, "TIGER 은행고배당", cursor+6, y+26, 7.6, ink, True)
                    write(pdf, f"플러스TOP10 ({row['ticker']})", cursor+6, y+11, 7.1, muted)
                else:
                    write(pdf, value, cursor+6, y+25, 7.8, ink, True); write(pdf, f"({row['ticker']})", cursor+6, y+11, 7.3, muted)
            elif column == 9:
                holdings = value.split(" | "); first = " · ".join(holdings[:3]); second = " · ".join(holdings[3:])
                write(pdf, first, cursor+7, y+26, 7.2, ink); write(pdf, f"{second}   |   {row['top5_concentration_pct']}%", cursor+7, y+12, 7.2, muted, True)
            elif column in (0,): write(pdf, value, cursor+width/2, y+18, 8.2, blue, True, "center")
            elif column == 3:
                colour = orange if float(row["ttm_distribution_yield_pct"]) == 0 else green
                write(pdf, value, cursor+width/2, y+25, 8.2, colour, True, "center")
                write(pdf, f"{int(float(row['ttm_distribution_amount_krw'])):,}원", cursor+width/2, y+11, 6.8, muted, False, "center")
            elif column == 8: write(pdf, value, cursor+width/2, y+18, 8.0, red, True, "center")
            elif column >= 5: write(pdf, value, cursor+width/2, y+18, 8.0, green if float(value[:-1]) >= 0 else red, column == 7, "center")
            else: write(pdf, value, cursor+width/2, y+18, 7.8, ink, column == 2, "center")
            cursor += width
        pdf.setStrokeColor(line); pdf.line(x0, y, x0+table_w, y)

    box(pdf, 42, 76, 758, 20, pale_orange, 6)
    write(pdf, "핵심 해석  |  RISE 대형고배당10TR은 최근 12개월 현금 분배 0회입니다. ‘배당주 투자’와 ‘현금 배당 지급’은 같은 뜻이 아닙니다.", 53, 82, 7.8, orange, True)
    holding_dates = sorted(row["holdings_date"] for row in rows)
    holding_range = holding_dates[0] if holding_dates[0] == holding_dates[-1] else f"{holding_dates[0]}~{holding_dates[-1]}"
    write(pdf, f"* MDD는 최근 1년 최대 낙폭. TOP5 기준일은 상품별 {holding_range}이며, 순자산은 {AS_OF_DISPLAY} KRX 기준입니다.", 42, 58, 8.0, muted)
    write(pdf, "자료: 운용사 공식 분배금·구성종목 공시, 6종 동일 공개 조정 시장가격. 과거 성과는 미래 수익을 보장하지 않습니다.", 42, 43, 8.0, muted)
    write(pdf, f"기준일 {AS_OF_DISPLAY}", 42, 27, 8.0, muted); write(pdf, "2 / 3", W-42, 27, 8.0, muted, True, "right")
    pdf.save(); print(OUTPUT)

if __name__ == "__main__": main()
