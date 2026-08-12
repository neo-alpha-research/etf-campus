"""Render lead-magnet page 1 from validated long-term ETF total-return data."""
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
METRICS = ROOT / "data" / "lead_magnet" / "generated" / AS_OF / "page1_performance_metrics.csv"
OUTPUT = Path(os.environ.get("LEAD_MAGNET_OUTPUT_DIR", ROOT / "output" / "pdf")) / "etf-campus-lead-magnet-page-1.pdf"
W, H = landscape(A4)

def box(pdf, x, y, w, h, colour, r=0):
    pdf.setFillColor(colour); pdf.setStrokeColor(colour)
    if r:
        pdf.roundRect(x, y, w, h, r, fill=1, stroke=0)
    else:
        pdf.rect(x, y, w, h, fill=1, stroke=0)

def write(pdf, value, x, y, size, colour, bold=False, align="left"):
    pdf.setFillColor(colour); pdf.setFont("MalgunBold" if bold else "Malgun", size)
    {"left": pdf.drawString, "center": pdf.drawCentredString, "right": pdf.drawRightString}[align](x, y, value)

def lines(pdf, values, x, y, size, leading, colour, bold=False):
    for i, value in enumerate(values): write(pdf, value, x, y-i*leading, size, colour, bold)

def pct(value): return f"{float(value):+.1f}%"
def aum(value): return f"{float(value)/1_0000_0000_0000:.1f}조"

def main():
    pdfmetrics.registerFont(TTFont("Malgun", r"C:\Windows\Fonts\malgun.ttf"))
    pdfmetrics.registerFont(TTFont("MalgunBold", r"C:\Windows\Fonts\malgunbd.ttf"))
    with METRICS.open(encoding="utf-8-sig", newline="") as stream: metrics = {r["ticker"]: r for r in csv.DictReader(stream)}
    rows = [
        ("국내 코어", "코스피200", "069500", "KODEX 200", 22779356208586, "원화 자산"),
        ("미국 코어", "S&P500", "360750", "TIGER 미국S&P500", 20617130247754, "환노출"),
        ("미국 성장", "나스닥100", "133690", "TIGER 미국나스닥100", 11585192564403, "환노출"),
    ]
    navy, blue, ink, muted, line, bg, white = [colors.HexColor(x) for x in ("#102A43", "#175CD3", "#1D2939", "#667085", "#D0D5DD", "#F8FAFC", "#FFFFFF")]
    green, pale, pale_blue, pale_orange = [colors.HexColor(x) for x in ("#067647", "#ECFDF3", "#EFF8FF", "#FFF6ED")]
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(str(OUTPUT), pagesize=landscape(A4))
    box(pdf, 0, 0, W, H, bg); box(pdf, 0, H-111, W, 111, navy)
    box(pdf, 42, H-40, 125, 20, blue, 10); write(pdf, "ETF CAMPUS  |  30일 챌린지", 104.5, H-34, 8, white, True, "center")
    write(pdf, "장기 적립형 지수 ETF, 무엇을 비교해야 할까?", 42, H-72, 22, white, True)
    write(pdf, f"순자산 1위 대표 ETF 3종 · {AS_OF_DISPLAY} 기준 · 국내 상장 ETF", 42, H-95, 10, colors.HexColor("#D9E5F5"))
    write(pdf, "수익률이 높았던 ETF가 아니라, 나의 적립 기간에 맞는 지수인지부터 확인하세요.", 42, 454, 10.8, ink, True)
    write(pdf, "모든 수익률은 원화 시장가격 기준의 분배금 재투자 총수익률입니다.", 42, 436, 8.8, muted)
    x, y, table_w = 42, 262, 758
    widths = [75, 94, 147, 63, 63, 63, 72, 72, 65, 44]
    headers = ["역할", "추종 지수", "대표 ETF", "순자산", "6개월", "YTD", "1년", "2년\n연환산", "3년\n연환산", "1년\nMDD"]
    header_h, row_h = 42, 39
    box(pdf, x, y+3*row_h, table_w, header_h, navy, 7)
    cursor = x
    for label, width in zip(headers, widths):
        parts = label.split("\n")
        write(pdf, parts[0], cursor+width/2, y+3*row_h+24, 7.7, white, True, "center")
        if len(parts)==2: write(pdf, parts[1], cursor+width/2, y+3*row_h+12, 7.7, white, True, "center")
        cursor += width
    for idx, (role, index_name, ticker, name, assets, fx) in enumerate(rows):
        metric = metrics[ticker]; yy = y+(2-idx)*row_h; shade = white if idx % 2 == 0 else colors.HexColor("#F2F4F7")
        box(pdf, x, yy, table_w, row_h, shade); cursor=x
        values = [role, index_name, f"{name}\n({ticker})", aum(assets), pct(metric["return_6m_pct"]), pct(metric["return_ytd_pct"]), pct(metric["return_1y_pct"]), pct(metric["return_2y_pct"]), pct(metric["return_3y_pct"]), pct(metric["mdd_1y_pct"])]
        for col, (value, width) in enumerate(zip(values, widths)):
            if col == 2:
                first, second = value.split("\n"); write(pdf, first, cursor+7, yy+21, 8.5, ink, True); write(pdf, second, cursor+7, yy+9, 7.4, muted)
            elif col in (0,1): write(pdf, value, cursor+7, yy+14, 8.3, ink, col==0)
            else:
                colour = colors.HexColor("#B42318") if col == 9 else (green if value.startswith("+") else ink)
                write(pdf, value, cursor+width/2, yy+14, 8.5, colour, col in (3,7,8,9), "center")
            cursor += width
        pdf.setStrokeColor(line); pdf.line(x, yy, x+table_w, yy)
    write(pdf, "* 2년·3년은 연환산, MDD는 최근 1년 동안의 최대 낙폭입니다. 순자산은 같은 지수군 내 현재 순자산 1위 ETF를 선정했습니다.", x, 243, 7.5, muted)
    cards = [
        ("01  코스피200", ["국내 주식 비중의 기준점", "국내 경기·원화 자산과 함께 움직임"], pale_blue),
        ("02  S&P500", ["미국 대형주에 폭넓게 분산", "환율 변동도 원화 수익률에 반영"], pale),
        ("03  나스닥100", ["성장주 비중이 높아 변동성도 큼", "높은 과거 수익률만으로 비중 결정 금지"], pale_orange),
    ]
    for i, (title, body, colour) in enumerate(cards):
        cx=42+i*258; box(pdf,cx,122,242,91,colour,10); write(pdf,title,cx+15,185,10,blue if i<2 else colors.HexColor("#B54708"),True); lines(pdf,body,cx+15,163,8.3,13,ink)
    pdf.setStrokeColor(line); pdf.line(42,83,W-42,83)
    write(pdf, "이번 판에서는 동일 기준의 실부담비용·추적오차율 원자료가 확정되기 전까지 해당 수치를 표기하지 않았습니다. 총보수로 대체하지 않습니다.", 42, 63, 7.5, muted)
    write(pdf, "자료: KRX 순자산 원자료, 삼성자산운용·미래에셋자산운용 공개 가격·분배금 데이터. 과거 성과는 미래 수익을 보장하지 않습니다.", 42, 48, 7.5, muted)
    write(pdf, "1 / 3", W-42, 31, 7.5, muted, True, "right"); write(pdf, f"기준일 {AS_OF_DISPLAY}", 42, 31, 7.2, muted)
    pdf.save(); print(OUTPUT)

if __name__ == "__main__": main()
