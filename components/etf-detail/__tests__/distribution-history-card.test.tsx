import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DistributionHistoryCard } from "../distribution-history-card";
import type { EtfDistributionSummary } from "@/lib/domain/etf-types";

const summary: EtfDistributionSummary = {
  ticker: "458730",
  sourceStatus: "issuer_notice",
  sourceLabel: "운용사 공식 공지 기반",
  latest: {
    eventId: "event-4",
    sourceId: "issuer:tiger:notice:20260626:monthend",
    sourceOwner: "TIGER",
    amountKrw: 104,
    exDate: "2026-06-29",
    recordDate: "2026-06-30",
    payDate: null,
    distributionType: "ordinary_cash",
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
      displayStatus: "issuer_notice",
      displayLabel: "운용사 공식 공지 기반",
      updatedAt: "2026-08-15T06:19:45Z",
    },
  ],
  eventCount: 4,
  updatedAt: "2026-08-15T06:19:45Z",
};

describe("DistributionHistoryCard", () => {
  it("운용사 공식 공지 기반의 최근 분배금과 지급일 확인 상태를 표시한다", () => {
    render(<DistributionHistoryCard summary={summary} />);

    expect(screen.getByRole("heading", { name: "분배금 지급 이력" })).toBeInTheDocument();
    expect(screen.getAllByText("운용사 공식 공지 기반").length).toBeGreaterThan(0);
    expect(screen.getAllByText("104원").length).toBeGreaterThan(0);
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
        ...summary.latest,
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
    expect(screen.queryByText("분배락일")).not.toBeInTheDocument();
  });
});
