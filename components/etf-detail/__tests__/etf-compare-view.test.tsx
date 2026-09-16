import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EtfCompareView } from "../etf-compare-view";
import type { Etf } from "@/lib/domain/etf-types";

describe("EtfCompareView selectionReasons", () => {
  const mainEtf: Partial<Etf> = {
    ticker: "000001",
    name: "메인 ETF",
    asOfDate: "20260715",
    returns: { "1d": 0, "1w": 0, "2w": 0, "1m": 0, "2m": 0, "3m": 0, "6m": 0, "12m": 0, "24m": 0, "36m": 0, ytd: 0, itd: 0 },
  };
  const peerEtf: Partial<Etf> = {
    ticker: "000002",
    name: "비교 피어 ETF",
    asOfDate: "20260715",
    returns: { "1d": 0, "1w": 0, "2w": 0, "1m": 0, "2m": 0, "3m": 0, "6m": 0, "12m": 0, "24m": 0, "36m": 0, ytd: 0, itd: 0 },
  };

  it("peer-readonly 모드에서 주의(Caution) 배지만 렌더링되고 중복 태그는 생략되어 헤더가 깔끔하게 유지된다", () => {
    const selectionReasons = new Map([
      ["000002", ["같은 반도체 비교그룹", "동일 액티브형 구조", "환헤지/환노출 불일치"]],
    ]);

    render(
      <EtfCompareView
        mainEtf={mainEtf as Etf}
        basket={[peerEtf as Etf]}
        mode="peer-readonly"
        selectionReasons={selectionReasons}
      />
    );

    // Caution badge should render with warning style
    const fxBadge = screen.getByText(/환헤지\/환노출 불일치/);
    expect(fxBadge).toBeDefined();
    expect(fxBadge.className).toContain("border-amber-300");
    expect(fxBadge.className).toContain("text-amber-900");

    // Redundant non-caution tags should be hidden to keep header clean
    expect(screen.queryByText("같은 반도체 비교그룹")).toBeNull();
    expect(screen.queryByText("동일 액티브형 구조")).toBeNull();
  });

  it("비교 종목 간 스마트 장점 칩(최저 보수, 거래대금 1위 등)이 정상 렌더링된다", () => {
    const etfA: Partial<Etf> = {
      ticker: "000001",
      name: "보수 저렴 ETF",
      fee: {
        totalFeePct: 0.05,
        terPct: 0.05,
        otherCostPct: 0.02,
        tradingCostPct: 0.01,
        effectiveDate: null,
        verifiedAt: null,
        verificationStatus: "verified_official",
        primarySourceType: null,
        primarySourceUrl: null,
        dartReceiptNo: null,
        secondarySourceUrl: null,
        sourceNote: null,
      },
      tradeValue: 10000000,
      aum: 50000000,
      asOfDate: "20260715",
      returns: { "1d": 0, "1w": 0, "2w": 0, "1m": 0, "2m": 0, "3m": 0, "6m": 0, "12m": 15.2, "24m": 0, "36m": 0, ytd: 0, itd: 0 },
    };
    const etfB: Partial<Etf> = {
      ticker: "000002",
      name: "유동성 풍부 ETF",
      fee: {
        totalFeePct: 0.35,
        terPct: 0.35,
        otherCostPct: 0.05,
        tradingCostPct: 0.02,
        effectiveDate: null,
        verifiedAt: null,
        verificationStatus: "verified_official",
        primarySourceType: null,
        primarySourceUrl: null,
        dartReceiptNo: null,
        secondarySourceUrl: null,
        sourceNote: null,
      },
      tradeValue: 90000000,
      aum: 200000000,
      asOfDate: "20260715",
      returns: { "1d": 0, "1w": 0, "2w": 0, "1m": 0, "2m": 0, "3m": 0, "6m": 0, "12m": 5.0, "24m": 0, "36m": 0, ytd: 0, itd: 0 },
    };

    render(
      <EtfCompareView
        mainEtf={etfA as Etf}
        basket={[etfB as Etf]}
        mode="peer-readonly"
      />
    );

    // Badges are now consistently placed in each data row (순자산, 거래대금, 실부담비용, 수익률) and snapshot cards
    const rowBadges = screen.getAllByTestId("smart-advantage-badge");
    expect(rowBadges.length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("1위").length).toBeGreaterThan(0);
    expect(screen.getAllByText("최저").length).toBeGreaterThan(0);
  });

  it("TR 모드 전환 시 TR 결측 종목은 PR로 폴백되지 않고 '-'로 노출되며 [1위] 뱃지를 부당하게 획득하지 않는다", () => {
    const etfWithTr: Partial<Etf> = {
      ticker: "000001",
      name: "TR 보유 ETF",
      returnsTr: { "1d": 0, "1w": 0, "2w": 0, "1m": 0, "2m": 0, "3m": 0, "6m": 0, "12m": 10.0, "24m": 0, "36m": 0, ytd: 0, itd: 0 },
      returns: { "1d": 0, "1w": 0, "2w": 0, "1m": 0, "2m": 0, "3m": 0, "6m": 0, "12m": 4.0, "24m": 0, "36m": 0, ytd: 0, itd: 0 },
      asOfDate: "20260715",
    };
    const etfNoTr: Partial<Etf> = {
      ticker: "000002",
      name: "TR 미보유 ETF",
      returnsTr: undefined,
      returns: { "1d": 0, "1w": 0, "2w": 0, "1m": 0, "2m": 0, "3m": 0, "6m": 0, "12m": 20.0, "24m": 0, "36m": 0, ytd: 0, itd: 0 },
      asOfDate: "20260715",
    };

    render(
      <EtfCompareView
        mainEtf={etfWithTr as Etf}
        basket={[etfNoTr as Etf]}
      />
    );

    // Click TR switch
    const trSwitch = screen.getByRole("switch");
    fireEvent.click(trSwitch);

    // In TR mode, etfWithTr shows +10.00%, etfNoTr shows '-' and does not show +20.00%
    expect(screen.getAllByText("+10.00%").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("+20.00%")).toBeNull();
  });

  it("상위에서 isTrMode와 onToggleTr를 제어(Controlled)할 때 정상 동작하고 토글 콜백이 호출된다", () => {
    let toggled = false;
    const etfA: Partial<Etf> = {
      ticker: "000001",
      name: "ETF A",
      returnsTr: { "1d": 0, "1w": 0, "2w": 0, "1m": 0, "2m": 0, "3m": 0, "6m": 0, "12m": 12.5, "24m": 0, "36m": 0, ytd: 0, itd: 0 },
      returns: { "1d": 0, "1w": 0, "2w": 0, "1m": 0, "2m": 0, "3m": 0, "6m": 0, "12m": 5.0, "24m": 0, "36m": 0, ytd: 0, itd: 0 },
      asOfDate: "20260715",
    };

    render(
      <EtfCompareView
        basket={[etfA as Etf]}
        isTrMode={true}
        onToggleTr={() => { toggled = true; }}
      />
    );

    // Should display TR value directly
    expect(screen.getByText("+12.50%")).toBeInTheDocument();

    const trSwitch = screen.getByRole("switch");
    fireEvent.click(trSwitch);
    expect(toggled).toBe(true);
  });

  it("수익률 헤더의 세부+ 버튼을 누르면 12개 전체 기간으로 확장되고 핵심만으로 축소된다", () => {
    const etfA: Partial<Etf> = {
      ticker: "000001",
      name: "ETF A",
      returns: { "1d": 1.1, "1w": 2.2, "2w": 3.3, "1m": 4.4, "2m": 5.5, "3m": 6.6, "6m": 7.7, "12m": 8.8, "24m": 9.9, "36m": 10.0, ytd: 11.1, itd: 12.2 },
      asOfDate: "20260715",
    };

    render(<EtfCompareView basket={[etfA as Etf]} />);

    // Initially 1w (1주) is not in core periods
    expect(screen.queryByText("1주")).toBeNull();

    // Click quick toggle button '세부+'
    const quickToggleBtn = screen.getByTitle("1일~3년 전체 12개 기간 펼치기");
    fireEvent.click(quickToggleBtn);

    // Now 1w (1주) should be visible
    expect(screen.getByText("1주")).toBeInTheDocument();

    // Click again to collapse
    const collapseBtn = screen.getByTitle("핵심 5개 기간(1m~1y)만 보기");
    fireEvent.click(collapseBtn);
    expect(screen.queryByText("1주")).toBeNull();
  });

  it("모든 종목의 해당 기간 수익률이 음수일 경우에도 상대 비교 최고 성과(하락 방어 1위) 종목에 1위 뱃지가 표시된다", () => {
    const etfA: Partial<Etf> = {
      ticker: "000001",
      name: "ETF A",
      returns: { "1d": 0, "1w": 0, "2w": 0, "1m": -5.0, "2m": 0, "3m": 0, "6m": 0, "12m": 0, "24m": 0, "36m": 0, ytd: 0, itd: 0 },
      asOfDate: "20260715",
    };
    const etfB: Partial<Etf> = {
      ticker: "000002",
      name: "ETF B",
      returns: { "1d": 0, "1w": 0, "2w": 0, "1m": -10.0, "2m": 0, "3m": 0, "6m": 0, "12m": 0, "24m": 0, "36m": 0, ytd: 0, itd: 0 },
      asOfDate: "20260715",
    };

    render(<EtfCompareView basket={[etfA as Etf, etfB as Etf]} />);

    // etfA (-5.0%) has better performance than etfB (-10.0%), so 1위 badge should appear
    expect(screen.getByText("1위")).toBeInTheDocument();
  });

  it("테이블 하단에 금융투자협회 공시 기준 및 거래소 종가 기준 각주가 단정하게 노출된다", () => {
    const etfA: Partial<Etf> = {
      ticker: "000001",
      name: "ETF A",
      asOfDate: "2026-03-06",
      returns: { "1d": 0, "1w": 0, "2w": 0, "1m": 0, "2m": 0, "3m": 0, "6m": 0, "12m": 0, "24m": 0, "36m": 0, ytd: 0, itd: 0 },
    };

    render(<EtfCompareView basket={[etfA as Etf]} />);

    expect(screen.getByText(/금융투자협회 최근 공시 기준/)).toBeInTheDocument();
    expect(screen.getByText(/2026.03.06 기준/)).toBeInTheDocument();
  });

  it("5종목 한눈에 뷰 탭을 누르면 전치 테이블 모드로 전환되고 5개 종목이 행 단위로 노출된다", () => {
    const etfList: Partial<Etf>[] = [
      { ticker: "000001", name: "ETF 1", returns: { "12m": 10.0 }, asOfDate: "2026-03-06" },
      { ticker: "000002", name: "ETF 2", returns: { "12m": 12.0 }, asOfDate: "2026-03-06" },
      { ticker: "000003", name: "ETF 3", returns: { "12m": 15.0 }, asOfDate: "2026-03-06" },
      { ticker: "000004", name: "ETF 4", returns: { "12m": 8.0 }, asOfDate: "2026-03-06" },
      { ticker: "000005", name: "ETF 5", returns: { "12m": 5.0 }, asOfDate: "2026-03-06" },
    ];

    render(<EtfCompareView basket={etfList as Etf[]} />);

    // Click '5종목 한눈에 뷰' tab
    const summaryTabBtn = screen.getByText(/5종목 한눈에 뷰/);
    fireEvent.click(summaryTabBtn);

    // All 5 ETFs should be rendered in the transposed view
    expect(screen.getByText("ETF 1")).toBeInTheDocument();
    expect(screen.getByText("ETF 2")).toBeInTheDocument();
    expect(screen.getByText("ETF 3")).toBeInTheDocument();
    expect(screen.getByText("ETF 4")).toBeInTheDocument();
    expect(screen.getByText("ETF 5")).toBeInTheDocument();

    // Summary table headers
    expect(screen.getByText("ETF 종목")).toBeInTheDocument();
    expect(screen.getByText("순자산/연금")).toBeInTheDocument();

    // Option A Desktop Executive Table headers
    expect(screen.getByRole("columnheader", { name: "1개월" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "3개월" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "6개월" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "1년" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "일 거래대금" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "괴리율" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "퇴직연금" })).toBeInTheDocument();
  });

  it("3종목 이상 비교 시 '추천' 배지는 sm:hidden 클래스가 적용되어 모바일에서만 노출된다", () => {
    const etfList: Partial<Etf>[] = [
      { ticker: "000001", name: "ETF 1", returns: { "12m": 10.0 } },
      { ticker: "000002", name: "ETF 2", returns: { "12m": 12.0 } },
      { ticker: "000003", name: "ETF 3", returns: { "12m": 15.0 } },
    ];

    render(<EtfCompareView basket={etfList as Etf[]} />);

    const badge = screen.getByText("추천");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("sm:hidden");
  });

  it("5종목 한눈에 뷰에서 괴리율이 비정상 고평가일 때 주의 배지가 표시된다", () => {
    const etfList: Partial<Etf>[] = [
      {
        ticker: "000001",
        name: "정상 ETF",
        disparity: 0.1,
        classification: { marketScope: "국내", assetClass: "주식-국내", published: true, assetDetail: null, strategy: null, fxHedge: null, reviewStatus: "", reviewPriority: "", sourceUrl: null, evidenceSummary: null },
      },
      {
        ticker: "000002",
        name: "고평가 ETF",
        disparity: 0.8,
        classification: { marketScope: "국내", assetClass: "주식-국내", published: true, assetDetail: null, strategy: null, fxHedge: null, reviewStatus: "", reviewPriority: "", sourceUrl: null, evidenceSummary: null },
      },
    ];

    render(<EtfCompareView basket={etfList as Etf[]} />);

    // Click '5종목 한눈에 뷰' tab
    const summaryTabBtn = screen.getByText(/5종목 한눈에 뷰/);
    fireEvent.click(summaryTabBtn);

    expect(screen.getByText("+0.10%")).toBeInTheDocument();
    expect(screen.getByText("+0.80%")).toBeInTheDocument();
    expect(screen.getByText("⚠️ 주의")).toBeInTheDocument();
  });

  it("지표 안내 ⓘ 버튼을 누르면 모바일 모달이 열리고 닫기 버튼으로 닫힌다", () => {
    const etfA: Partial<Etf> = {
      ticker: "000001",
      name: "ETF A",
      asOfDate: "2026-03-06",
      returns: { "12m": 10.0 },
    };

    render(<EtfCompareView basket={[etfA as Etf]} />);

    // Click AUM info button
    const aumBtn = screen.getByLabelText("순자산 (AUM) 안내 보기");
    fireEvent.click(aumBtn);

    // Modal should be opened
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("ETF가 실제로 운용하는 전체 자산의 총 규모입니다.")).toBeInTheDocument();

    // Close button
    const closeBtn = within(dialog).getByLabelText("닫기");
    fireEvent.click(closeBtn);

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("1개 종목 선택 시 비교 유도 플레이스홀더 슬롯(+ 비교할 ETF 추가하기)이 렌더링되고 50% 균등 배분된다", () => {
    const etfA: Partial<Etf> = {
      ticker: "000001",
      name: "단일 종목 ETF",
      asOfDate: "2026-03-06",
      returns: { "12m": 10.0 },
    };

    const { container } = render(<EtfCompareView basket={[etfA as Etf]} />);

    // Check placeholder header button
    expect(screen.getByText("비교할 ETF 추가하기")).toBeInTheDocument();
    
    // Check colgroup percentages (2 header cols [구분, 비교항목] + 2 cols of 50%)
    const cols = container.querySelectorAll("colgroup col");
    expect(cols.length).toBe(4); // 2 header cols + 1 etf col + 1 placeholder col
    expect(cols[2].getAttribute("style")).toContain("50%");
    expect(cols[3].getAttribute("style")).toContain("50%");
  });

  it("peer-readonly 모드에서는 단일 종목이어도 비교 유도 플레이스홀더 슬롯이 렌더링되지 않는다", () => {
    const etfA: Partial<Etf> = {
      ticker: "000001",
      name: "단일 종목 ETF",
      asOfDate: "2026-03-06",
      returns: { "12m": 10.0 },
    };

    render(<EtfCompareView basket={[etfA as Etf]} mode="peer-readonly" />);

    expect(screen.queryByText("비교할 ETF 추가하기")).toBeNull();
  });

  it("5개 종목 선택 시 각 열이 정확히 20%로 균등 분할되고 플레이스홀더가 없다", () => {
    const etfList: Partial<Etf>[] = [1, 2, 3, 4, 5].map((i) => ({
      ticker: `00000${i}`,
      name: `ETF ${i}`,
      asOfDate: "2026-03-06",
      returns: { "12m": i * 2 },
    }));

    const { container } = render(<EtfCompareView basket={etfList as Etf[]} />);

    expect(screen.queryByText("비교할 ETF 추가하기")).toBeNull();

    const cols = container.querySelectorAll("colgroup col");
    expect(cols.length).toBe(7); // 2 header cols + 5 etf cols
    for (let i = 2; i <= 6; i++) {
      expect(cols[i].getAttribute("style")).toContain("20%");
    }
  });

  it("헤더 카드 내에 절세 계좌(퇴직연금, ISA) 적격성 칩이 렌더링되고 본문 별도 행은 제거된다", () => {
    const etfA: Partial<Etf> = {
      ticker: "000001",
      name: "테스트 ETF",
      pensionLimit: "70% (위험자산)",
      pension: "가능",
      riskType: "general",
      asOfDate: "2026-03-06",
      returns: { "12m": 5.0 },
    };

    render(<EtfCompareView basket={[etfA as Etf]} />);

    // Header chips must be rendered
    const pensionChip = screen.getByTestId("pension-account-chip");
    expect(pensionChip).toBeInTheDocument();
    expect(pensionChip.textContent).toContain("연금 70%");

    const isaChip = screen.getByTestId("isa-account-chip");
    expect(isaChip).toBeInTheDocument();
    expect(isaChip.textContent).toContain("ISA 가능");

    // Separate rows in tbody should NOT exist
    expect(screen.queryByText("퇴직연금 한도")).toBeNull();
    expect(screen.queryByText("중개형 ISA")).toBeNull();
  });

  it("6대 카테고리 섹션 헤더(규모 및 유동성, 기간별 성과, 배당 및 분배금, 총비용 및 보수, 운용 품질 및 정밀도, 상품 프로필 및 구조)가 정상 렌더링된다", () => {
    const etfA: Partial<Etf> = {
      ticker: "000001",
      name: "테스트 ETF A",
      asOfDate: "2026-03-06",
      returns: { "12m": 10.0 },
    };

    render(<EtfCompareView basket={[etfA as Etf]} />);

    expect(screen.getByText("규모 및 유동성")).toBeInTheDocument();
    expect(screen.getByText("기간별 성과")).toBeInTheDocument();
    expect(screen.getByText("배당 및 분배금")).toBeInTheDocument();
    expect(screen.getByText("총비용 및 보수")).toBeInTheDocument();
    expect(screen.getByText("운용 품질 및 정밀도")).toBeInTheDocument();
    expect(screen.getByText("상품 프로필 및 구조")).toBeInTheDocument();
  });

  it("비교군 2개 이상일 때 핵심 지표 1위 스냅샷 배너가 렌더링되고 신규 항목(연간 분배율, 분배 주기, 기본보수, 운용사, 상장일, 환헤지)이 표시된다", () => {
    const etfA: Partial<Etf> = {
      ticker: "000001",
      name: "월배당 배당주 ETF",
      distributionYield: 6.45,
      distributionCycle: "월배당",
      fee: {
        totalFeePct: 0.15,
        terPct: 0.15,
        otherCostPct: 0.02,
        tradingCostPct: 0.01,
        effectiveDate: null,
        verifiedAt: null,
        verificationStatus: "verified_official",
        primarySourceType: null,
        primarySourceUrl: null,
        dartReceiptNo: null,
        secondarySourceUrl: null,
        sourceNote: null,
      },
      issuer: { issuerId: "1", issuerName: "미래에셋자산운용", brand: "TIGER", issuerStatus: "verified_official", issuerSourceUrl: null, issuerVerifiedAt: null },
      listingDate: "20220615",
      classification: { marketScope: "미국", assetClass: "주식-해외", published: true, assetDetail: null, strategy: "커버드콜", fxHedge: "헤지", reviewStatus: "", reviewPriority: "", sourceUrl: null, evidenceSummary: null },
      aum: 500000000,
      tradeValue: 20000000,
      asOfDate: "2026-03-06",
      returns: { "12m": 8.5 },
    };

    const etfB: Partial<Etf> = {
      ticker: "000002",
      name: "성장 테마 ETF",
      distributionYield: 0.8,
      distributionCycle: "분기 분배",
      fee: {
        totalFeePct: 0.45,
        terPct: 0.45,
        otherCostPct: 0.05,
        tradingCostPct: 0.02,
        effectiveDate: null,
        verifiedAt: null,
        verificationStatus: "verified_official",
        primarySourceType: null,
        primarySourceUrl: null,
        dartReceiptNo: null,
        secondarySourceUrl: null,
        sourceNote: null,
      },
      issuer: { issuerId: "2", issuerName: "삼성자산운용", brand: "KODEX", issuerStatus: "verified_official", issuerSourceUrl: null, issuerVerifiedAt: null },
      listingDate: "20200110",
      classification: { marketScope: "국내", assetClass: "주식-국내", published: true, assetDetail: null, strategy: "패시브", fxHedge: null, reviewStatus: "", reviewPriority: "", sourceUrl: null, evidenceSummary: null },
      aum: 200000000,
      tradeValue: 10000000,
      asOfDate: "2026-03-06",
      returns: { "12m": 15.0 },
    };

    render(<EtfCompareView basket={[etfA as Etf, etfB as Etf]} />);

    // 1위 스냅샷 배너 타이틀
    expect(screen.getByText("비교군 핵심 지표 1위 스냅샷")).toBeInTheDocument();

    // 분배금 항목
    expect(screen.getByText("연 6.45%")).toBeInTheDocument();
    expect(screen.getByText("🗓️ 월배당")).toBeInTheDocument();

    // 기본 보수 항목
    expect(screen.getAllByText("0.15%").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("0.45%").length).toBeGreaterThanOrEqual(1);

    // 운용사 항목
    expect(screen.getByText("미래에셋자산운용")).toBeInTheDocument();
    expect(screen.getByText("삼성자산운용")).toBeInTheDocument();

    // 상장일 항목
    expect(screen.getByText("2022.06.15")).toBeInTheDocument();
    expect(screen.getByText("2020.01.10")).toBeInTheDocument();

    // 환헤지 항목
    expect(screen.getByText("환헤지 (H)")).toBeInTheDocument();
    expect(screen.getByText("해당없음 (원화)")).toBeInTheDocument();
  });
});


