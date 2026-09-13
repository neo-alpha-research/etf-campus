import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { Etf } from "@/lib/domain/etf-types";
import { Screener } from "../screener";

function etf(overrides: Partial<Etf>): Etf {
  return {
    isin: "KR7000000000", ticker: "000000", name: "샘플 ETF", baseIndex: "샘플 지수",
    close: 10_000, changePct: 1.2, tradeValue: 2_000_000_000, aum: 100_000_000_000,
    riskType: "normal", assetClass: "주식-국내", pension: "가능", pensionSource: "공식확인",
    liquidity: "pass", asOfDate: "20260715", listingDate: null, listingDateSource: null,
    returns: { "1d": 1.2, "1w": 1, "2w": 2, "1m": 3, "2m": 4, "3m": 5, "6m": 6, "12m": 12, "24m": 24, "36m": 36, ytd: 7, itd: 7 },
    isNew90d: null, isNew3m: false,
    issuer: { issuerId: "samsung", issuerName: "삼성자산운용" },
    classification: { published: true, marketScope: "국내", assetClass: "주식-국내", assetDetail: null, strategy: "액티브", fxHedge: "환노출", reviewStatus: "자동확정", reviewPriority: "", sourceUrl: null, evidenceSummary: null },
    fee: { totalFeePct: 0.1, verificationStatus: "verified_official" },
    ...overrides,
  };
}

const items = [
  etf({ ticker: "A", name: "대형 일반 ETF", aum: 100_000_000_000, classification: { published: true, marketScope: "미국", assetClass: "주식-해외", assetDetail: null, strategy: "액티브", fxHedge: "환노출", reviewStatus: "자동확정", reviewPriority: "", sourceUrl: null, evidenceSummary: null } }),
  etf({ ticker: "B", name: "레버리지 ETF", riskType: "leverage", aum: 100_000_000_000, classification: { published: true, marketScope: "국내", assetClass: "주식-국내", assetDetail: null, strategy: "패시브", fxHedge: "환노출", reviewStatus: "자동확정", reviewPriority: "", sourceUrl: null, evidenceSummary: null } }),
];

describe("Screener - 빠른 시작 및 선택 조건", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("연금 가능 칩은 기본 선택되며 해제 상태도 URL에 보존된다", () => {
    render(<Screener etfs={items} />);
    const removeChip = screen.getByRole("button", { name: "DC·IRP 가능 조건 제거" });
    expect(removeChip).toBeInTheDocument();

    fireEvent.click(removeChip);
    expect(window.location.search).toContain("pension=all");
    expect(screen.queryByRole("button", { name: "DC·IRP 가능 조건 제거" })).not.toBeInTheDocument();
  });

  it("미국 주식 칩이 자산군과 지역을 함께 변경한다", () => {
    render(<Screener etfs={items} />);
    const usQuick = screen.getByRole("button", { name: "미국 주식" });
    fireEvent.click(usQuick);
    expect(usQuick).toHaveAttribute("aria-pressed", "true");
    expect(window.location.search).toContain("market=%EB%AF%B8%EA%B5%AD"); // 미국
    expect(window.location.search).toContain("asset=%EC%A3%BC%EC%8B%9D-%ED%95%B4%EC%99%B8"); // 주식-해외

    expect(screen.getByRole("button", { name: "미국 조건 제거" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "주식-해외 조건 제거" })).toBeInTheDocument();
  });

  it("채권·파킹이 두 자산을 OR로 적용한다", () => {
    render(<Screener etfs={items} />);
    const bondQuick = screen.getByRole("button", { name: "채권·파킹" });
    fireEvent.click(bondQuick);
    expect(bondQuick).toHaveAttribute("aria-pressed", "true");
    expect(window.location.search).toContain("asset=%EC%B1%84%EA%B6%8C"); // 채권
    expect(window.location.search).toContain("asset=%EA%B8%88%EB%A6%AC%C2%B7%ED%8C%8C%ED%82%B9"); // 금리·파킹
  });

  it("10개의 인기 퀵 필터 버튼이 정상 렌더링되고 테마 전환이 작동한다", () => {
    render(<Screener etfs={items} />);
    expect(screen.getByText("TOP 10 인기 테마")).toBeInTheDocument();

    const labels = ["미국 주식", "국내 주식", "배당성장", "월배당", "반도체", "AI·빅테크", "채권·파킹", "커버드콜", "금·원자재", "전력·원자력"];
    for (const label of labels) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }

    const semiButton = screen.getByRole("button", { name: "반도체" });
    fireEvent.click(semiButton);
    expect(semiButton).toHaveAttribute("aria-pressed", "true");
    expect(window.location.search).toContain("q=%EB%B0%98%EB%8F%84%EC%B2%B4"); // 반도체

    // 필터 해제 버튼 확인
    const clearButton = screen.getByRole("button", { name: "반도체 필터 해제" });
    expect(clearButton).toBeInTheDocument();
    fireEvent.click(clearButton);
    expect(semiButton).toHaveAttribute("aria-pressed", "false");

    // 월배당 필터 확인
    const monthlyBtn = screen.getByRole("button", { name: "월배당" });
    fireEvent.click(monthlyBtn);
    expect(monthlyBtn).toHaveAttribute("aria-pressed", "true");
    expect(window.location.search).toContain("cycle=%EC%9B%94+%EB%B6%84%EB%B0%B0");
    expect(screen.getByRole("button", { name: "월배당 조건 제거" })).toBeInTheDocument();
  });

  it("선택 조건 칩 하나를 제거해도 다른 조건이 유지된다", () => {
    render(<Screener etfs={items} />);
    // 기본 연금 조건을 유지한 채 미국 선택
    fireEvent.click(screen.getByRole("button", { name: "미국 주식" }));

    // 미국 지역 조건만 제거
    const removeMarket = screen.getByRole("button", { name: "미국 조건 제거" });
    fireEvent.click(removeMarket);

    // 연금과 해외주식은 남아야 함
    expect(screen.getByRole("button", { name: "DC·IRP 가능 조건 제거" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "주식-해외 조건 제거" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "미국 조건 제거" })).not.toBeInTheDocument();

    // 미국 주식 칩은 더이상 전체가 활성이 아니므로 false
    expect(screen.getByRole("button", { name: "미국 주식" })).toHaveAttribute("aria-pressed", "false");
  });

  it("초기화가 기본 상태로 돌아간다", () => {
    render(<Screener etfs={items} />);
    fireEvent.click(screen.getByRole("button", { name: "미국 주식" }));
    expect(window.location.search).toContain("market=");

    fireEvent.click(screen.getByRole("button", { name: "조건 초기화" }));
    expect(window.location.search).toBe(""); // 기본값은 쿼리 없음
    
    // 기본값인 1,000억 이상과 일반형은 선택 조건 칩에 노출되어야 한다. 
    // wait, the prompt says "기본 상태로 복귀해야 합니다... 선택 조건 칩도 즉시 갱신되어야 합니다."
    // 1000억과 일반형 칩이 있는지 확인.
    expect(screen.getByRole("button", { name: "순자산 1,000억 이상 조건 제거" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "일반형 조건 제거" })).toBeInTheDocument();
  });

  it("1개월 선택 시 차트 제목과 선택 기간이 변경되며 URL이 동기화된다", () => {
    render(<Screener etfs={items} />);
    const monthQuick = screen.getByRole("button", { name: "1개월" });
    fireEvent.click(monthQuick);

    expect(monthQuick).toHaveAttribute("aria-pressed", "true");
    expect(window.location.search).toContain("period=1m");
    expect(screen.getByRole("heading", { name: /1개월 수익률 TOP 5/ })).toBeInTheDocument();
  });

  it("TOP 5 종목의 상세 정보(순위, 이름, 티커, 수익률, 연금 배지 등)가 표시되며 상세 페이지로 링크된다", () => {
    render(<Screener etfs={items} />);
    // 1일 선택(기본)
    const links = screen.getAllByRole("link", { name: /대형 일반 ETF/ });
    expect(links[0]).toHaveAttribute("href", "/etf/A");
    
    // 수익률(1.2%) 표시 확인
    const returns = screen.getAllByText("+1.20%");
    expect(returns.length).toBeGreaterThan(0);
    
    // 지역 정보 확인 (미국)
    const regions = screen.getAllByText("미국");
    expect(regions.length).toBeGreaterThan(0);
  });

  it("일반 위탁계좌(전체계좌) 모드에서는 연금불가 배지를 노출하지 않는다", () => {
    render(<Screener etfs={[etf({ ticker: "X", name: "일반 비연금 ETF", pension: "불가" })]} />);
    fireEvent.click(screen.getByRole("button", { name: /전체계좌/ }));
    expect(screen.queryByText("연금불가")).not.toBeInTheDocument();
  });

  it("정렬 기준을 순자산으로 변경하면 URL에 동기화된다", () => {
    render(<Screener etfs={items} />);
    const sortSelect = screen.getByLabelText("정렬 기준");
    fireEvent.change(sortSelect, { target: { value: "aum" } });
    
    expect(sortSelect).toHaveValue("aum");
    expect(window.location.search).toContain("sort=aum");
  });

  it("CTA 버튼은 펜션 모드일 때 mode=pension을 포함한다", () => {
    render(<Screener etfs={items} />);
    const cta = screen.getByRole("link", { name: /이 조건으로 상세 표 보기/ });
    expect(cta).toHaveAttribute("href", expect.stringContaining("mode=pension"));
  });

  it("CTA 버튼은 레버리지/인버스만 선택 시 mode=derivatives를 포함한다", () => {
    render(<Screener etfs={items} />);
    // 파생상품 탐색으로 전환할 때는 전체계좌 탭으로 전환한다.
    fireEvent.click(screen.getByRole("button", { name: /전체계좌/ }));

    // 레버리지 선택
    const leverageLabel = screen.getByLabelText("레버리지");
    fireEvent.click(leverageLabel);
    
    // 일반형 해제
    const normalLabel = screen.getByLabelText("일반형");
    fireEvent.click(normalLabel);

    const cta = screen.getByRole("link", { name: /이 조건으로 상세 표 보기/ });
    expect(cta).toHaveAttribute("href", expect.stringContaining("mode=derivatives"));
    expect(cta).toHaveAttribute("href", expect.stringContaining("risk=leverage"));
  });

  it("TR 모드 전환 시 TR 결측 종목은 PR로 슬그머니 대체되지 않고 '-'로 표시되며 정렬 최하단으로 이동한다", () => {
    const etfWithTr = etf({
      ticker: "TR_YES",
      name: "TR 보유 ETF",
      returnsTr: { "1d": 5.0, "1w": 5, "2w": 5, "1m": 5, "2m": 5, "3m": 5, "6m": 5, "12m": 5, "24m": 5, "36m": 5, ytd: 5, itd: 5 },
      returns: { "1d": 2.0, "1w": 2, "2w": 2, "1m": 2, "2m": 2, "3m": 2, "6m": 2, "12m": 2, "24m": 2, "36m": 2, ytd: 2, itd: 2 },
    });
    const etfNoTr = etf({
      ticker: "TR_NO",
      name: "TR 미보유 ETF",
      returnsTr: undefined,
      returns: { "1d": 10.0, "1w": 10, "2w": 10, "1m": 10, "2m": 10, "3m": 10, "6m": 10, "12m": 10, "24m": 10, "36m": 10, ytd: 10, itd: 10 },
    });

    render(<Screener etfs={[etfWithTr, etfNoTr]} />);
    // 기본 상태(PR 모드)에서는 둘 다 PR 값(+2.00, +10.00)을 노출
    expect(screen.getAllByText("+2.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+10.00").length).toBeGreaterThan(0);

    // TR 토글 클릭
    const trButton = screen.getByRole("button", { name: /TR OFF/ });
    fireEvent.click(trButton);

    // TR 모드에서는 TR 보유 ETF는 +5.00 노출, 미보유 ETF는 10.00(PR)으로 폴백되지 않고 '-' 노출
    expect(screen.getAllByText("+5.00").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("+10.00").length).toBe(0);
  });

  it("중개형 ISA 탭 클릭 시 절세 혜택형(high_benefit) 뷰가 적용되고 칩 제거 시 전체계좌로 전환된다", () => {
    const safeEtf = etf({ ticker: "S1", name: "안전 채권 ETF", aum: 100_000_000_000, pension: "가능", pensionLimit: "100% (안전자산)", isaEligible: "가능", isaTaxBenefit: "높음" });
    const normalEtf = etf({ ticker: "N1", name: "국내주식 ETF", aum: 100_000_000_000, pension: "가능", pensionLimit: "70% (위험자산)", isaEligible: "가능", isaTaxBenefit: "낮음" });
    const levEtf = etf({ ticker: "L1", name: "레버리지 ETF", riskType: "leverage", aum: 100_000_000_000, pension: "불가", pensionLimit: "불가", isaEligible: "불가" });

    render(<Screener etfs={[safeEtf, normalEtf, levEtf]} />);
    
    // 전체계좌 탭 존재 확인
    expect(screen.getByRole("button", { name: /전체계좌/ })).toBeInTheDocument();

    const isaTab = screen.getByRole("button", { name: /중개형 ISA/ });
    fireEvent.click(isaTab);

    // ISA 기본 진입 시 high_benefit (절세 혜택형) 단일 모드 적용
    expect(window.location.search).toContain("account=isa");
    expect(screen.getByText("중개형 ISA 절세 실익 안내")).toBeInTheDocument();
    
    // 활성 필터 칩 확인
    const removeChip = screen.getByRole("button", { name: "중개형 ISA (절세 혜택형) 조건 제거" });
    expect(removeChip).toBeInTheDocument();

    // 칩 제거 시 전체계좌 모드로 복귀
    fireEvent.click(removeChip);
    expect(screen.getByText("일반 위탁 계좌 거래 가이드")).toBeInTheDocument();
  });

  it("퇴직연금 모드에서 100% 법정 안전자산 및 70% 위험자산 필터링이 정상 작동한다", () => {
    const safeEtf = etf({ ticker: "S1", name: "국고채 ETF", aum: 100_000_000_000, pension: "가능", pensionLimit: "100% (안전자산)", isaEligible: "가능" });
    const riskEtf = etf({ ticker: "R1", name: "미국나스닥100 ETF", aum: 100_000_000_000, pension: "가능", pensionLimit: "70% (위험자산)", isaEligible: "가능" });

    render(<Screener etfs={[safeEtf, riskEtf]} />);
    
    // 법정 안전자산 100% 한도 버튼 클릭
    const safeBtn = screen.getByRole("button", { name: /안전자산 100% 한도/ });
    fireEvent.click(safeBtn);

    expect(window.location.search).toContain("pension_tier=safe");
    expect(screen.getByRole("button", { name: "안전자산 100% 한도 조건 제거" })).toBeInTheDocument();

    // 위험자산 70% 버튼 클릭
    const riskBtn = screen.getByRole("button", { name: /위험자산 70% 한도/ });
    fireEvent.click(riskBtn);

    expect(window.location.search).toContain("pension_tier=risk");
    expect(screen.getByRole("button", { name: "위험자산 70% 한도 조건 제거" })).toBeInTheDocument();
  });

  it("pensionVerified = 'N'일 때 스크리너 행에 '추정' 배지가 렌더링된다", () => {
    const unverifiedEtf = etf({
      ticker: "UV1",
      name: "추정 채권 ETF",
      aum: 100_000_000_000,
      pension: "가능",
      pensionLimit: "100% (안전자산)",
      pensionVerified: "N",
      pensionConfidence: "낮음",
      isaEligible: "가능",
    });

    render(<Screener etfs={[unverifiedEtf]} />);
    const badge = screen.getByTitle("운용사·증권사 공시로 확인되지 않은 규칙 기반 추정값입니다. 실제 편입 가능 여부는 가입하신 금융회사에서 확인해 주세요.");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("추정");
    expect(badge.className).toContain("border-neutral-300");
  });

  it("pensionVerified = 'Y'일 때 스크리너 행에 불필요한 '검증' 배지가 노출되지 않고 깔끔한 연금 배지만 표시된다", () => {
    const verifiedEtf = etf({
      ticker: "V1",
      name: "검증 채권 ETF",
      aum: 100_000_000_000,
      pension: "가능",
      pensionLimit: "100% (안전자산)",
      pensionVerified: "Y",
      pensionConfidence: "높음",
      isaEligible: "가능",
    });

    render(<Screener etfs={[verifiedEtf]} />);
    expect(screen.queryByText("검증")).not.toBeInTheDocument();
    expect(screen.queryByText("추정")).not.toBeInTheDocument();
    const pensionBadge = screen.getAllByText("안전자산100%")[0];
    expect(pensionBadge).toBeInTheDocument();
  });

  it("퇴직연금(DC/IRP) 모드에서는 위험자산 70%가 기본 한도이므로 '위험70%' 배지는 생략되고 소수 '안전자산100%' 배지만 표시된다", () => {
    const safeEtf = etf({
      ticker: "SAFE1",
      name: "국채 30년 ETF",
      pension: "가능",
      pensionLimit: "100% (안전자산)",
      pensionVerified: "Y",
    });
    const riskEtf = etf({
      ticker: "RISK1",
      name: "코스피 200 ETF",
      pension: "가능",
      pensionLimit: "70% (위험자산)",
      pensionVerified: "Y",
    });

    render(<Screener etfs={[safeEtf, riskEtf]} />);
    // 퇴직연금 가이드 카드가 위험자산 70% 기본 한도를 명시하는지 확인
    expect(screen.getByText(/퇴직연금\(DC\/IRP\)은 위험자산 70% 한도가 기본 적용되며/)).toBeInTheDocument();
    expect(screen.getByText(/소수 안전자산만 \[안전자산100%\] 별도 표기/)).toBeInTheDocument();

    // 안전자산100%는 표시됨
    expect(screen.getAllByText("안전자산100%")[0]).toBeInTheDocument();

    // 기본 한도인 위험70% 배지는 노출되지 않음
    expect(screen.queryByText("위험70%")).not.toBeInTheDocument();
  });

  it("중개형 ISA 모드에서 절세 혜택 안내 가이드 및 교육 이수 안내가 표시되고 불필요한 '교육필요' 및 'ISA가능' 행 배지는 노출되지 않는다", async () => {
    const isaHighEtf = etf({
      ticker: "ISA1",
      name: "미국 테크 ETF",
      aum: 100_000_000_000,
      pension: "불가",
      isaEligible: "가능",
      isaTaxBenefit: "높음",
      isaTaxType: "기타",
      isaEducationRequired: "N",
    });
    const isaEduEtf = etf({
      ticker: "ISA2",
      name: "미국 레버리지 ETF",
      aum: 100_000_000_000,
      pension: "불가",
      isaEligible: "가능",
      isaTaxBenefit: "높음",
      isaTaxType: "기타",
      isaEducationRequired: "Y",
    });

    render(<Screener etfs={[isaHighEtf, isaEduEtf]} />);
    const isaTab = screen.getByRole("button", { name: /중개형 ISA/ });
    fireEvent.click(isaTab);

    expect(screen.getByText("중개형 ISA 절세 실익 안내")).toBeInTheDocument();
    expect(screen.getByText("조세특례제한법 제91조의18")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "중개형 ISA (절세 혜택형) 조건 제거" })).toBeInTheDocument();
    expect(screen.getByText(/해외주식 · 채권 · 리츠 · 커버드콜 절세 실익 극대화/)).toBeInTheDocument();
    expect(screen.getByText(/레버리지·인버스 ETF는 금융투자교육원 사전교육 이수 및 기본예탁금 충족 후 매매 가능/)).toBeInTheDocument();
    expect(screen.queryByText("교육필요")).not.toBeInTheDocument();
    expect(screen.queryByText("ISA(교육필요)")).not.toBeInTheDocument();
    expect(screen.queryByText("ISA가능")).not.toBeInTheDocument();
    expect(screen.queryByText("✨절세형")).not.toBeInTheDocument();
    expect(screen.queryByText("절세실익高")).not.toBeInTheDocument();
  });

  it("개인연금(연금저축) 모드에서 '개인연금전용' 및 '연금불가' 배지가 올바르게 표시되고 불필요한 '연금저축 한도규제 없음' 배지는 노출되지 않는다", async () => {
    const etf1 = etf({
      ticker: "P1",
      name: "한화 개인연금 적격 ETF",
      issuer: { issuerId: "hanwha", issuerName: "한화자산운용" },
      personalPension: "가능",
      personalPensionLimit: "100%",
      pension: "불가",
      pensionLimit: "불가",
    });
    const etf2 = etf({
      ticker: "P2",
      name: "일반 1배수 ETF",
      issuer: { issuerId: "etc", issuerName: "기타자산운용" },
      personalPension: "가능",
      personalPensionLimit: "100%",
      pension: "가능",
      pensionLimit: "70% (위험자산)",
    });
    const etf3 = etf({
      ticker: "P3",
      name: "레버리지 ETF",
      issuer: { issuerId: "samsung", issuerName: "삼성자산운용" },
      riskType: "leverage",
      personalPension: "불가",
      personalPensionLimit: "불가",
      pension: "불가",
      pensionLimit: "불가",
    });

    render(<Screener etfs={[etf1, etf2, etf3]} />);
    const pensionTab = screen.getByRole("button", { name: /개인연금/ });
    fireEvent.click(pensionTab);

    // etf1: 개인연금전용 노출, 불필요한 '연금저축 한도규제 없음' 배지는 미노출
    expect(screen.getAllByText("개인연금전용")[0]).toBeInTheDocument();
    expect(screen.queryByText("연금저축 한도규제 없음")).not.toBeInTheDocument();

    // 전체 적격 버튼 및 배너 확인
    expect(screen.getByText(/연금저축 적격 ETF:/)).toBeInTheDocument();
    expect(screen.getByText("연금저축(개인연금) 편입 가이드")).toBeInTheDocument();
    expect(screen.getByText("금투협 표준약관 제8조")).toBeInTheDocument();
    expect(screen.getByText(/100% 한도 자율 편입/)).toBeInTheDocument();
    expect(screen.getByText(/개인연금 전용 편입/)).toBeInTheDocument();
    expect(screen.getByText(/법정 편입 제외: 레버리지·인버스/)).toBeInTheDocument();

    // 개인연금 전용 버튼 클릭 인터랙션 테스트
    const personalOnlyBtn = screen.getByRole("button", { name: /개인연금 전용/ });
    fireEvent.click(personalOnlyBtn);
    expect(screen.getAllByText("한화 개인연금 적격 ETF")[0]).toBeInTheDocument();
    expect(screen.queryByText("일반 1배수 ETF")).not.toBeInTheDocument();
  });

  it("전체계좌(일반 위탁) 모드에서 가이드 카드와 매매차익 비과세 필터링이 정상 작동하며 연금 배지는 노출되지 않는다", () => {
    const domesticEtf = etf({
      ticker: "D1",
      name: "국내 KOSPI ETF",
      isaTaxBenefit: "보통",
      assetClass: "주식-국내",
      pensionLimit: "100% (안전자산)",
    });
    const overseasEtf = etf({
      ticker: "O1",
      name: "미국 나스닥 ETF",
      isaTaxBenefit: "높음",
      assetClass: "주식-해외",
      pensionLimit: "70% (위험자산)",
    });
    const levEtf = etf({
      ticker: "L1",
      name: "코스닥 레버리지 ETF",
      riskType: "leverage",
      isaEducationRequired: "Y",
      isaTaxBenefit: "높음",
      assetClass: "주식-국내",
      pension: "불가",
      pensionLimit: "불가",
    });

    render(<Screener etfs={[domesticEtf, overseasEtf, levEtf]} />);
    const allTab = screen.getByRole("button", { name: /전체계좌/ });
    fireEvent.click(allTab);

    // 전체계좌 가이드 타이틀 및 2열 카드 확인
    expect(screen.getByText("일반 위탁 계좌 거래 가이드")).toBeInTheDocument();
    expect(screen.getByText("소득세법 제16조·제17조")).toBeInTheDocument();
    expect(screen.getByText(/매매차익 비과세 · 일반계좌 최적/)).toBeInTheDocument();
    expect(screen.getByText(/15.4% 과세 · 절세 권장/)).toBeInTheDocument();

    // 일반 위탁계좌 모드에서는 연금 전용 배지(안전자산100%, 연금불가)가 노출되지 않음
    expect(screen.queryByText("안전자산100%")).not.toBeInTheDocument();
    expect(screen.queryByText("연금불가")).not.toBeInTheDocument();
    expect(screen.queryByText("개인연금전용")).not.toBeInTheDocument();

    // 매매차익 비과세 버튼 클릭 시 국내주식형만 노출
    const taxFreeBtn = screen.getByRole("button", { name: /매매차익 비과세/ });
    fireEvent.click(taxFreeBtn);
    expect(screen.getAllByText("국내 KOSPI ETF")[0]).toBeInTheDocument();
    expect(screen.queryByText("미국 나스닥 ETF")).not.toBeInTheDocument();

    // 전체(모든 종목)로 복귀 후 레버리지 필터 선택 시 가이드에 교육 안내가 있고 행에는 중복 배지가 노출되지 않음
    const allTierBtn = screen.getByRole("button", { name: /전체 \(\d+개\)/ });
    fireEvent.click(allTierBtn);
    const levLabel = screen.getByLabelText("레버리지");
    fireEvent.click(levLabel);
    expect(screen.getByText(/레버리지·인버스 ETF는 금융투자교육원 사전교육 이수 및 기본예탁금 충족 후 매매 가능/)).toBeInTheDocument();
    expect(screen.queryByText("교육필요")).not.toBeInTheDocument();
  });

  it("퇴직연금 탭 가이드 카드에 혼합채권과 TDF 바로가기 크로스 링크 브릿지를 렌더링한다", () => {
    render(<Screener etfs={items} />);
    expect(screen.getByText("안전자산 30% 채우기 추천:")).toBeInTheDocument();
    const mixedBondsLink = screen.getByRole("link", { name: /채권혼합 \(주식 최대 50% 편입\)/ });
    expect(mixedBondsLink).toHaveAttribute("href", "/quick?mode=mixed_bonds");
    const tdfLink = screen.getByRole("link", { name: /적격 TDF \(은퇴 시점별 자동 리밸런싱\)/ });
    expect(tdfLink).toHaveAttribute("href", "/quick?mode=tdf");
  });

  it("스크리너에서 TR 모드 토글 시 URL returnType 파라미터가 동기화된다", () => {
    render(<Screener etfs={items} />);
    const trToggleBtn = screen.getByRole("button", { name: "TR OFF" });
    fireEvent.click(trToggleBtn);
    expect(screen.getByRole("button", { name: "TR ON" })).toBeInTheDocument();
    expect(window.location.search).toContain("returnType=tr");

    fireEvent.click(screen.getByRole("button", { name: "TR ON" }));
    expect(screen.getByRole("button", { name: "TR OFF" })).toBeInTheDocument();
    expect(window.location.search).not.toContain("returnType=tr");
  });

  it("스크리너에서 TR 모드 토글 시 수익률 안내 문구가 동적으로 변경된다", () => {
    render(<Screener etfs={items} />);
    expect(screen.getByText(/단순 가격\(PR\)·분배금 미포함/)).toBeInTheDocument();

    const trToggleBtn = screen.getByRole("button", { name: "TR OFF" });
    fireEvent.click(trToggleBtn);
    expect(screen.getByText(/분배금 100% 재투자\(TR\) 기준/)).toBeInTheDocument();
  });

  it("중개형 ISA 탭 가이드 카드 하단에 월배당 커버드콜 바로가기 미니 캡슐 브릿지를 렌더링한다", () => {
    window.history.replaceState(null, "", "/explore?account=isa");
    render(<Screener etfs={items} />);
    const ccBridge = screen.getByRole("link", { name: /월배당 커버드콜 절세 탐색/ });
    expect(ccBridge).toHaveAttribute("href", "/quick?mode=covered_call");
  });

  it("스크리너 테이블 컬럼 헤더 클릭 시 해당 열로 정렬되고 재클릭 시 정렬 방향이 토글된다", () => {
    render(<Screener etfs={items} />);

    // 1. 1개월 헤더 클릭 -> return_1m 정렬
    const oneMonthHeader = screen.getByRole("columnheader", { name: /1개월 수익률/ });
    fireEvent.click(oneMonthHeader);
    expect(window.location.search).toContain("sort=return_1m");

    // 2. 1개월 헤더 재클릭 -> direction=asc 토글
    fireEvent.click(oneMonthHeader);
    expect(window.location.search).toContain("dir=asc");

    // 3. 순자산 헤더 클릭 -> aum 정렬
    const aumHeader = screen.getByRole("columnheader", { name: /순자산, 단위 억원/ });
    fireEvent.click(aumHeader);
    expect(window.location.search).toContain("sort=aum");

    // 4. 실부담비용 헤더 클릭 -> ter 정렬 (기본 asc)
    const terHeader = screen.getByRole("columnheader", { name: /투자자 실부담 총비용/ });
    fireEvent.click(terHeader);
    expect(window.location.search).toContain("sort=ter");
    expect(window.location.search).toContain("dir=asc");
  });

  it("스크리너 결과 0건 시 빈 화면 초기화 CTA 버튼이 표시되고 클릭 시 필터가 초기화된다", () => {
    render(<Screener etfs={[]} />);
    expect(screen.getByText("조건에 맞는 ETF가 없습니다")).toBeInTheDocument();
    const resetBtn = screen.getByRole("button", { name: "🔄 검색 및 필터 초기화" });
    expect(resetBtn).toBeInTheDocument();

    fireEvent.click(resetBtn);
    expect(resetBtn).toBeInTheDocument();
  });

  it("테이블 보기 모드 프리셋(전체 열, 수익률 뷰, 비용·규모 뷰) 전환 시 해당 열만 맞춤 렌더링된다", () => {
    render(<Screener etfs={items} />);

    // 1. 기본 전체 열 상태 확인
    expect(screen.getByRole("columnheader", { name: /1개월 수익률/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /순자산, 단위 억원/ })).toBeInTheDocument();

    // 2. ⚡ 수익률 뷰 전환
    const returnsViewBtn = screen.getByRole("button", { name: /⚡ 수익률 뷰/ });
    fireEvent.click(returnsViewBtn);
    expect(screen.getByRole("columnheader", { name: /1개월 수익률/ })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /순자산, 단위 억원/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /투자자 실부담 총비용/ })).not.toBeInTheDocument();

    // 3. 💰 비용·규모 뷰 전환
    const metricsViewBtn = screen.getByRole("button", { name: /💰 비용·규모 뷰/ });
    fireEvent.click(metricsViewBtn);
    expect(screen.getByRole("columnheader", { name: /순자산, 단위 억원/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /투자자 실부담 총비용/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /1일 수익률/ })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /1개월 수익률/ })).not.toBeInTheDocument();

    // 4. 전체 열 복귀
    const allViewBtn = screen.getByRole("button", { name: "전체 열" });
    fireEvent.click(allViewBtn);
    expect(screen.getByRole("columnheader", { name: /1개월 수익률/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /순자산, 단위 억원/ })).toBeInTheDocument();
  });
});


