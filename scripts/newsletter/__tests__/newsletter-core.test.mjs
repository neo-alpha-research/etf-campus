import { describe, expect, it } from "vitest";

import {
  buildNewsletterModel,
  buildSnapshot,
  rankUniverse,
  renderNewsletterHtml,
} from "../newsletter-core.mjs";

function rows() {
  const masterRows = [
    { ticker: "000001", name: "일반 A", aum: "200000000000", asset_class: "주식-국내", risk_type: "normal", bas_dt: "20260721", listing_date: "20260701" },
    { ticker: "000002", name: "연금 B", aum: "150000000000", asset_class: "채권", risk_type: "normal", bas_dt: "20260721", listing_date: "" },
    { ticker: "000003", name: "레버리지 C", aum: "120000000000", asset_class: "주식-국내", risk_type: "leverage", bas_dt: "20260721", listing_date: "" },
    { ticker: "000004", name: "소형 D", aum: "90000000000", asset_class: "주식-해외", risk_type: "normal", bas_dt: "20260721", listing_date: "" },
    { ticker: "000005", name: "결측 E", aum: "300000000000", asset_class: "주식-해외", risk_type: "normal", bas_dt: "20260721", listing_date: "" },
  ];
  const returnRows = [
    { ticker: "000001", r_1w: "3.2", r_itd: "3.2", new_90d: "Y" },
    { ticker: "000002", r_1w: "5.1", r_itd: "", new_90d: "N" },
    { ticker: "000003", r_1w: "8.4", r_itd: "", new_90d: "N" },
    { ticker: "000004", r_1w: "12.0", r_itd: "", new_90d: "N" },
    { ticker: "000005", r_1w: "", r_itd: "", new_90d: "N" },
  ];
  const pensionRows = [
    { ticker: "000001", final_pension: "불가" },
    { ticker: "000002", final_pension: "가능" },
    { ticker: "000003", final_pension: "불가" },
    { ticker: "000004", final_pension: "가능" },
    { ticker: "000005", final_pension: "가능" },
  ];
  return { masterRows, returnRows, pensionRows };
}

describe("주간 뉴스레터 스냅숏", () => {
  it("1,000억원·수익률 결측·계좌 조건을 적용한다", () => {
    const snapshot = buildSnapshot({ ...rows(), snapshotDate: "2026-07-24" });
    expect(rankUniverse(snapshot, "general").map((item) => item.ticker)).toEqual(["000002", "000001"]);
    expect(rankUniverse(snapshot, "pension").map((item) => item.ticker)).toEqual(["000002"]);
    expect(rankUniverse(snapshot, "leveraged").map((item) => item.ticker)).toEqual(["000003"]);
  });

  it("이전 스냅숏과 순위 및 연금 판정 변화를 비교한다", () => {
    const current = buildSnapshot({ ...rows(), snapshotDate: "2026-07-24" });
    const previousRows = rows();
    previousRows.returnRows[0].r_1w = "7.0";
    previousRows.returnRows[1].r_1w = "2.0";
    previousRows.pensionRows[0].final_pension = "가능";
    const previous = buildSnapshot({ ...previousRows, snapshotDate: "2026-07-17" });
    const model = buildNewsletterModel(current, previous);

    expect(model.rankings.general.items[0]).toMatchObject({ ticker: "000002", rankChange: 1 });
    expect(model.pensionChanges).toEqual([
      { ticker: "000001", name: "일반 A", before: "가능", after: "불가" },
    ]);
  });

  it("HTML에 필수 고지와 최신 상장 항목을 넣는다", () => {
    const snapshot = buildSnapshot({ ...rows(), snapshotDate: "2026-07-24" });
    const html = renderNewsletterHtml(buildNewsletterModel(snapshot));

    expect(html).toContain("과거 수익률은 미래 수익을 보장하지 않으며 추천이 아닙니다");
    expect(html).toContain("가격 기준·분배금 미포함");
    expect(html).toContain("본 서비스는 투자 권유·종목 추천을 제공하지 않으며");
    expect(html).toContain("일반 A");
    expect(html).toContain("mode=derivatives");
    expect(html).not.toContain("mode=leveraged");
  });
});
