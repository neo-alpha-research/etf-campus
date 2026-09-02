import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DistributionHistoryCard } from "../distribution-history-card";
import type { EtfDistributionSummary } from "@/lib/domain/etf-types";

const summary: EtfDistributionSummary = {
  ticker: "458730",
  sourceStatus: "issuer_notice",
  sourceLabel: "운용사 공식 공지 기반",
  paymentCycle: "월 분배",
  ttmAmountKrw: 1260,
  ttmDividendYieldPct: 8.45,
  latest: {
    eventId: "event-4",
    sourceId: "issuer:tiger:notice:20260626:monthend",
    sourceOwner: "TIGER",
    amountKrw: 104,
    exDate: "2026-06-29",
    recordDate: "2026-06-30",
    payDate: null,
    distributionType: "ordinary_cash",
    dividendYieldPct: 0.85,
    displayStatus: "issuer_notice",
    displayLabel: "운용사 공식 공지 기반",
    updatedAt: "2026-08-15T06:19:45Z",
  },
  records: [
    {
      eventId: "event-4",
      sourceId: "issuer:tiger:notice:20260626:monthend",
      sourceOwner: "TIGER",
      amountKrw: 104,
      exDate: "2026-06-29",
      recordDate: "2026-06-30",
      payDate: null,
      distributionType: "ordinary_cash",
      dividendYieldPct: 0.85,
      displayStatus: "issuer_notice",
      displayLabel: "운용사 공식 공지 기반",
      updatedAt: "2026-08-15T06:19:45Z",
    },
    {
      eventId: "event-3",
      sourceId: "issuer:tiger:notice:20260527:monthend",
      sourceOwner: "TIGER",
      amountKrw: 103,
      exDate: "2026-05-28",
      recordDate: "2026-05-29",
      payDate: "2026-06-02",
      distributionType: "ordinary_cash",
      dividendYieldPct: 0.84,
      displayStatus: "issuer_notice",
      displayLabel: "운용사 공식 공지 기반",
      updatedAt: "2026-08-15T06:19:45Z",
    },
    {
      eventId: "event-2",
      sourceId: "issuer:tiger:notice:20260427:monthend",
      sourceOwner: "TIGER",
      amountKrw: 102,
      exDate: "2026-04-28",
      recordDate: null,
      payDate: "2026-05-04",
      distributionType: "ordinary_cash",
      dividendYieldPct: 0.83,
      displayStatus: "issuer_notice",
      displayLabel: "운용사 공식 공지 기반",
      updatedAt: "2026-08-15T06:19:45Z",
    },
    {
      eventId: "event-1",
      sourceId: "issuer:tiger:notice:20260327:monthend",
      sourceOwner: "TIGER",
      amountKrw: 101,
      exDate: "2026-03-30",
      recordDate: null,
      payDate: "2026-04-01",
      distributionType: "ordinary_cash",
      dividendYieldPct: 0.82,
      displayStatus: "issuer_notice",
      displayLabel: "운용사 공식 공지 기반",
      updatedAt: "2026-08-15T06:19:45Z",
    },
  ],
  eventCount: 4,
  updatedAt: "2026-08-15T06:19:45Z",
};

describe("DistributionHistoryCard", () => {
  it("공식 분배금과 주기 뱃지, 연환산 TTM 분배율 및 핵심 지표를 표시한다", () => {
    render(<DistributionHistoryCard summary={summary} />);

    expect(screen.getByRole("heading", { name: /분배금.*지급 현황/ })).toBeInTheDocument();
    expect(screen.getByText("🗓️ 월 분배")).toBeInTheDocument();
    expect(screen.getByText("연 8.45% (TTM)")).toBeInTheDocument();
    expect(screen.getAllByText("104원").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1,260원").length).toBeGreaterThan(0);
    expect(screen.getAllByText("지급일 확인 중").length).toBeGreaterThan(0);
    expect(screen.getByText("전체 4건 보기")).toBeInTheDocument();
  });

  it("전체 보기에서 숨겨진 과거 지급 이력을 펼친다", () => {
    render(<DistributionHistoryCard summary={summary} />);

    fireEvent.click(screen.getByText("전체 4건 보기"));
    expect(screen.getByText("101원")).toBeInTheDocument();
  });

  it("분배락일이 없는 공식 공지는 지급기준일로 표시한다", () => {
    const recordDateOnlySummary: EtfDistributionSummary = {
      ...summary,
      latest: {
        ...summary.latest!,
        exDate: null,
        recordDate: "2026-07-31",
        payDate: "2026-08-04",
      },
      records: [{
        ...summary.records[0],
        exDate: null,
        recordDate: "2026-07-31",
        payDate: "2026-08-04",
      }],
      eventCount: 1,
    };

    render(<DistributionHistoryCard summary={recordDateOnlySummary} />);

    expect(screen.getAllByText("지급기준일").length).toBeGreaterThan(0);
    expect(screen.getByText("2026.07.31")).toBeInTheDocument();
  });

  it("TR ETF인 경우 토탈리턴 자동 재투자 전용 배너를 노출한다", () => {
    render(<DistributionHistoryCard isTr={true} etfName="KODEX 200TR" />);

    expect(screen.getByText("토탈리턴 (TR)")).toBeInTheDocument();
    expect(screen.getByText("토탈리턴(TR) 자동 재투자 펀드")).toBeInTheDocument();
    expect(screen.getByText(/본 ETF는 분배금을 현금으로 지급하지 않고/)).toBeInTheDocument();
  });

  it("신규 상장 종목이면서 지급 내역이 없는 경우 신규 상장 배너를 노출한다", () => {
    render(<DistributionHistoryCard isNewListing={true} summary={null} />);

    expect(screen.getAllByText(/신규 상장/).length).toBeGreaterThan(0);
    expect(screen.getByText("신규 상장 종목")).toBeInTheDocument();
    expect(screen.getByText(/상장 초기 종목으로, 첫 분배금 지급 일정 공시를 대기 중입니다/)).toBeInTheDocument();
  });

  it("일반 무분배 종목인 경우 무분배 안내 배너를 노출한다", () => {
    render(<DistributionHistoryCard summary={null} />);

    expect(screen.getByText("최근 1년간 지급된 분배금 내역이 없습니다.")).toBeInTheDocument();
    expect(screen.getByText(/무배당 또는 자산 재투자형 상품의 경우/)).toBeInTheDocument();
  });
});
