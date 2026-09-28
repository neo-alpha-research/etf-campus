import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { SelfCheckChecklist } from "../self-check-checklist";
import { SELF_CHECK_ITEMS } from "../self-check-types";

describe("SelfCheckChecklist - 10-Question Self-Check Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("1. 초기 상태: 10개 문항이 모두 미응답 상태이며 데이터 보호 안내가 표시된다", () => {
    render(<SelfCheckChecklist />);

    // Heading
    expect(
      screen.getByRole("heading", { name: "10문항 자가 점검 체크리스트" })
    ).toBeInTheDocument();

    // 10 items rendered
    expect(screen.getByText("문항 1 · 비용 공시")).toBeInTheDocument();
    expect(screen.getByText("문항 10 · 인출 및 과세")).toBeInTheDocument();

    // In-memory notice
    expect(screen.getByText(/데이터 보호 안내/)).toBeInTheDocument();
    expect(
      screen.getByText(
        /본 자가 점검 결과는 브라우저 메모리에만 임시 유지되며, 서버로 전송되지 않습니다/
      )
    ).toBeInTheDocument();

    // State counts
    expect(screen.getByText("10개")).toBeInTheDocument(); // 미응답 10개
    expect(screen.getAllByText("0개")).toHaveLength(3); // 확인함, 추가 확인 필요, 해당 없음

    // No score, no risk rating, no recommendation (Capital Market Act compliance)
    expect(screen.queryByText(/투자 역량 점수/)).not.toBeInTheDocument();
    expect(screen.queryByText(/위험등급/)).not.toBeInTheDocument();
    expect(screen.queryByText(/추천 상품/)).not.toBeInTheDocument();
  });

  it("2. 선택 변경: 옵션 클릭 시 라디오 선택 및 상태별 카운트가 정상 반영된다", () => {
    render(<SelfCheckChecklist />);

    // Item 1: '확인함' 클릭
    const item1Confirmed = screen.getByRole("radio", {
      name: "문항 1번 확인함",
    });
    fireEvent.click(item1Confirmed);
    expect(item1Confirmed).toBeChecked();

    // Item 2: '추가 확인 필요' 클릭
    const item2NeedsReview = screen.getByRole("radio", {
      name: "문항 2번 추가 확인 필요",
    });
    fireEvent.click(item2NeedsReview);
    expect(item2NeedsReview).toBeChecked();

    // Item 3: '해당 없음' 클릭
    const item3NotApp = screen.getByRole("radio", {
      name: "문항 3번 해당 없음",
    });
    fireEvent.click(item3NotApp);
    expect(item3NotApp).toBeChecked();

    // Counts check: 미응답 7개, 확인함 1개, 추가 확인 필요 1개, 해당 없음 1개
    expect(screen.getByText("7개")).toBeInTheDocument();
    expect(screen.getAllByText("1개")).toHaveLength(3);

    // Item 2 should appear in "추가 확인이 필요한 항목" list
    expect(
      screen.getByText(/추가 확인이 필요한 항목 \(1건\)/)
    ).toBeInTheDocument();
    expect(
      screen.getByText((content) =>
        content.includes("[문항 2]") && content.includes(SELF_CHECK_ITEMS[1].prompt)
      )
    ).toBeInTheDocument();
  });

  it("3. 개별 선택 해제 및 전체 초기화 시 포커스 복원 위치 단언", () => {
    vi.useFakeTimers();
    render(<SelfCheckChecklist />);

    const item1Confirmed = screen.getByRole("radio", {
      name: "문항 1번 확인함",
    });
    fireEvent.click(item1Confirmed);
    expect(item1Confirmed).toBeChecked();
    expect(screen.getByText("9개")).toBeInTheDocument(); // 미응답 9개

    // Dedicated deselect button appears with min 44px touch target
    const item1ResetBtn = screen.getByRole("button", {
      name: "문항 1번 선택 초기화",
    });
    expect(item1ResetBtn).toBeInTheDocument();
    expect(item1ResetBtn.className).toContain("min-h-[44px]");

    // Click item deselect button
    fireEvent.click(item1ResetBtn);
    vi.runAllTimers();

    expect(item1Confirmed).not.toBeChecked();
    expect(screen.getByText("10개")).toBeInTheDocument(); // 미응답 10개

    // Assert focus position restored to the question container
    const item1Container = screen
      .getByText("문항 1 · 비용 공시")
      .closest('[role="listitem"]');
    expect(document.activeElement).toBe(item1Container);

    // Select items 1 and 2, then test '전체 초기화'
    fireEvent.click(
      screen.getByRole("radio", { name: "문항 1번 확인함" })
    );
    fireEvent.click(
      screen.getByRole("radio", { name: "문항 2번 추가 확인 필요" })
    );
    expect(screen.getByText("8개")).toBeInTheDocument();

    const resetAllBtn = screen.getByRole("button", { name: "전체 초기화" });
    fireEvent.click(resetAllBtn);
    vi.runAllTimers();

    // Assert all state reset
    expect(screen.getByText("10개")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "전체 초기화" })
    ).not.toBeInTheDocument();

    // Assert focus shifted to the checklist heading so keyboard context is not lost
    const heading = screen.getByRole("heading", {
      name: "10문항 자가 점검 체크리스트",
    });
    expect(document.activeElement).toBe(heading);
  });

  it("4. 회귀 검증: 전 문항 해당 없음 선택 시 집계 및 추가 확인 필요 없음 안내", () => {
    render(<SelfCheckChecklist />);

    SELF_CHECK_ITEMS.forEach((item) => {
      const btn = screen.getByRole("radio", {
        name: `문항 ${item.id}번 해당 없음`,
      });
      fireEvent.click(btn);
    });

    expect(screen.getAllByText("0개")).toHaveLength(3); // 미응답, 확인함, 추가 확인 필요 모두 0개
    expect(screen.getByText("10개")).toBeInTheDocument(); // 해당 없음 10개
    expect(
      screen.getByText(/✓ '추가 확인 필요'로 선택된 항목이 없습니다/)
    ).toBeInTheDocument();
  });

  it("5. 출처 링크 vs 텍스트 안내 구분: 개별 증권사 수수료(문항 3)는 비링크 텍스트 안내, 공인 기관은 외부 링크", () => {
    render(<SelfCheckChecklist />);

    // Item 3 (individual broker fees) has no universal URL -> text guidance without <a> tag
    const item3Guidance = screen.getByText(SELF_CHECK_ITEMS[2].sourceLabel);
    expect(item3Guidance.closest("a")).toBeNull();
    expect(item3Guidance.tagName).toBe("SPAN");

    // Item 1 (KOFIA DIS) has official external link
    const item1Link = screen.getByText(SELF_CHECK_ITEMS[0].sourceLabel);
    expect(item1Link.closest("a")).toHaveAttribute(
      "href",
      "https://dis.kofia.or.kr"
    );
    expect(item1Link.closest("a")).toHaveAttribute("target", "_blank");
    expect(item1Link.closest("a")).toHaveAttribute(
      "rel",
      "noopener noreferrer"
    );
  });

  it("6. 접근성 및 터치 영역: 10개 radiogroup, 30개 native radio, 44px 최소 터치 영역", () => {
    const { container } = render(<SelfCheckChecklist />);

    const radioGroups = screen.getAllByRole("radiogroup");
    expect(radioGroups).toHaveLength(10);

    const allRadios = screen.getAllByRole("radio");
    expect(allRadios).toHaveLength(30);

    // Each radio label has min-h-[44px] touch target and min-w-[90px]
    const radioLabels = container.querySelectorAll("fieldset label");
    expect(radioLabels).toHaveLength(30);
    radioLabels.forEach((label) => {
      expect(label.className).toContain("min-h-[44px]");
      expect(label.className).toContain("min-w-[90px]");
      expect(label.className).toContain("peer-focus-visible:ring-2");
    });
  });

  it("7. 제로 텔레메트리 및 URL 격리 보장: 상태 변경 시 fetch·sendBeacon·스토리지·URL 쿼리 변경 없음", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    // Ensure navigator.sendBeacon exists and spy on it
    if (!navigator.sendBeacon) {
      navigator.sendBeacon = vi.fn().mockReturnValue(true);
    }
    const sendBeaconSpy = vi.spyOn(navigator, "sendBeacon");

    const initialUrl = window.location.href;

    render(<SelfCheckChecklist />);

    const item1 = screen.getByRole("radio", { name: "문항 1번 확인함" });
    fireEvent.click(item1);

    const item2 = screen.getByRole("radio", {
      name: "문항 2번 추가 확인 필요",
    });
    fireEvent.click(item2);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(sendBeaconSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(window.location.href).toBe(initialUrl);
  });

  it("8. 키보드 조작: 실제 방향키(ArrowRight/ArrowLeft) 및 Space 키 입력으로 옵션 전환 및 선택 검증", () => {
    render(<SelfCheckChecklist />);

    // 1) Focus Item 1 '확인함'
    const item1Confirmed = screen.getByRole("radio", {
      name: "문항 1번 확인함",
    });
    item1Confirmed.focus();
    expect(document.activeElement).toBe(item1Confirmed);

    // 2) ArrowRight -> moves selection and focus to '추가 확인 필요'
    fireEvent.keyDown(item1Confirmed, { key: "ArrowRight" });
    const item1NeedsReview = screen.getByRole("radio", {
      name: "문항 1번 추가 확인 필요",
    });
    expect(item1NeedsReview).toBeChecked();
    expect(document.activeElement).toBe(item1NeedsReview);

    // 3) ArrowLeft -> moves selection and focus back to '확인함'
    fireEvent.keyDown(item1NeedsReview, { key: "ArrowLeft" });
    expect(item1Confirmed).toBeChecked();
    expect(document.activeElement).toBe(item1Confirmed);

    // 4) Space key on unchecked radio -> triggers selection
    const item2NeedsReview = screen.getByRole("radio", {
      name: "문항 2번 추가 확인 필요",
    });
    item2NeedsReview.focus();
    expect(item2NeedsReview).not.toBeChecked();

    fireEvent.keyDown(item2NeedsReview, { key: " " });
    expect(item2NeedsReview).toBeChecked();
  });
});
