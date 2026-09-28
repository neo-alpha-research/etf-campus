"use client";

import { useRef, useState } from "react";
import {
  CheckItemStatus,
  SelectableStatus,
  SELF_CHECK_ITEMS,
  SelfCheckItem,
} from "./self-check-types";

const OPTIONS: { value: SelectableStatus; label: string; activeClass: string }[] = [
  {
    value: "confirmed",
    label: "확인함",
    activeClass: "peer-checked:bg-emerald-600 peer-checked:text-white peer-checked:border-emerald-600 peer-checked:shadow-xs",
  },
  {
    value: "needs_review",
    label: "추가 확인 필요",
    activeClass: "peer-checked:bg-amber-600 peer-checked:text-white peer-checked:border-amber-600 peer-checked:shadow-xs",
  },
  {
    value: "not_applicable",
    label: "해당 없음",
    activeClass: "peer-checked:bg-neutral-600 peer-checked:text-white peer-checked:border-neutral-600 peer-checked:shadow-xs",
  },
];

export function SelfCheckChecklist() {
  const [answers, setAnswers] = useState<Partial<Record<number, SelectableStatus>>>({});
  const questionRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  const handleSelect = (id: number, value: SelectableStatus) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const handleResetItem = (id: number) => {
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    // Retain keyboard focus on the question container so the user does not lose context
    setTimeout(() => {
      const container = questionRefs.current[id];
      if (container) {
        container.focus();
      }
    }, 0);
  };

  const handleResetAll = () => {
    setAnswers({});

    // Restore focus to the checklist heading so keyboard users do not lose their place when the button unmounts
    setTimeout(() => {
      if (headingRef.current) {
        headingRef.current.focus();
      }
    }, 0);
  };

  const handleRadioKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    itemId: number,
    currentIndex: number
  ) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % OPTIONS.length;
      const nextOpt = OPTIONS[nextIndex];
      handleSelect(itemId, nextOpt.value);
      const nextInput = document.getElementById(`opt-${itemId}-${nextOpt.value}`);
      if (nextInput) {
        nextInput.focus();
      }
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + OPTIONS.length) % OPTIONS.length;
      const prevOpt = OPTIONS[prevIndex];
      handleSelect(itemId, prevOpt.value);
      const prevInput = document.getElementById(`opt-${itemId}-${prevOpt.value}`);
      if (prevInput) {
        prevInput.focus();
      }
    } else if (e.key === " ") {
      e.preventDefault();
      const currentOpt = OPTIONS[currentIndex];
      handleSelect(itemId, currentOpt.value);
    }
  };

  // State counts
  const totalCount = SELF_CHECK_ITEMS.length;
  const answeredCount = Object.keys(answers).length;
  const unansweredCount = totalCount - answeredCount;

  let confirmedCount = 0;
  let needsReviewCount = 0;
  let notApplicableCount = 0;

  for (const status of Object.values(answers)) {
    if (status === "confirmed") confirmedCount++;
    else if (status === "needs_review") needsReviewCount++;
    else if (status === "not_applicable") notApplicableCount++;
  }

  // Items needing further review
  const itemsNeedingReview: SelfCheckItem[] = SELF_CHECK_ITEMS.filter(
    (item) => answers[item.id] === "needs_review"
  );

  return (
    <section
      aria-labelledby="self-check-heading"
      className="mt-8 rounded-2xl border border-line bg-surface p-4 sm:p-6 lg:p-8"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="self-check-heading"
            ref={headingRef}
            tabIndex={-1}
            className="text-xl font-extrabold tracking-[-0.03em] text-strong sm:text-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg"
          >
            10문항 자가 점검 체크리스트
          </h2>
          <p className="mt-1 text-xs text-neutral-600 sm:text-sm">
            각 항목에 대해 본인이 직접 확인했는지 체크해 보세요. Tab 및 방향키로 조작할 수 있습니다.
          </p>
        </div>
        {answeredCount > 0 && (
          <button
            type="button"
            onClick={handleResetAll}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-700 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            전체 초기화
          </button>
        )}
      </div>

      {/* Notice regarding In-Memory state */}
      <div className="mt-4 rounded-xl border border-blue-200/80 bg-blue-50/60 p-3.5 text-xs leading-relaxed text-blue-900">
        <span className="font-bold">🔒 데이터 보호 안내:</span> 본 자가 점검 결과는 브라우저 메모리에만 임시 유지되며, 서버로 전송되지 않습니다. 페이지를 새로고침하면 선택 내용이 초기화됩니다.
      </div>

      {/* Checklist items list */}
      <div className="mt-6 space-y-5" role="list">
        {SELF_CHECK_ITEMS.map((item) => {
          const currentStatus: CheckItemStatus = answers[item.id] ?? "unanswered";
          const isAnswered = currentStatus !== "unanswered";

          return (
            <div
              key={item.id}
              role="listitem"
              tabIndex={-1}
              ref={(el) => {
                questionRefs.current[item.id] = el;
              }}
              className="rounded-xl border border-line/80 bg-neutral-50/50 p-4 transition-colors hover:border-line focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center rounded-md bg-neutral-200/70 px-2 py-0.5 text-xs font-extrabold text-neutral-700">
                  문항 {item.id} · {item.category}
                </span>
                {isAnswered && (
                  <button
                    type="button"
                    onClick={() => handleResetItem(item.id)}
                    aria-label={`문항 ${item.id}번 선택 초기화`}
                    className="inline-flex min-h-[44px] items-center justify-center px-2 py-1 text-xs font-semibold text-neutral-600 underline underline-offset-2 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg"
                  >
                    선택 해제
                  </button>
                )}
              </div>

              {/* Question prompt */}
              <p
                id={`question-prompt-${item.id}`}
                className="mt-2 text-sm font-bold leading-6 text-strong sm:text-base"
              >
                {item.prompt}
              </p>

              {/* Verification route guidance */}
              <div className="mt-2 text-xs text-neutral-600">
                <span className="font-semibold text-neutral-700">확인 경로: </span>
                {item.sourceUrl ? (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    {item.sourceLabel}
                  </a>
                ) : (
                  <span className="font-medium text-neutral-700">
                    {item.sourceLabel}
                  </span>
                )}
              </div>

              {/* Native Radio Group with Semantic Accessibility */}
              <fieldset
                role="radiogroup"
                className="mt-3.5 flex flex-wrap gap-2"
                aria-labelledby={`question-prompt-${item.id}`}
              >
                <legend className="sr-only">
                  문항 {item.id}번 확인 상태 선택
                </legend>
                {OPTIONS.map((opt, optIndex) => {
                  const inputId = `opt-${item.id}-${opt.value}`;
                  const isChecked = currentStatus === opt.value;

                  return (
                    <div key={opt.value} className="flex-1 sm:flex-initial">
                      <input
                        type="radio"
                        id={inputId}
                        name={`question-${item.id}`}
                        value={opt.value}
                        checked={isChecked}
                        aria-label={`문항 ${item.id}번 ${opt.label}`}
                        onChange={() => handleSelect(item.id, opt.value)}
                        onKeyDown={(e) => handleRadioKeyDown(e, item.id, optIndex)}
                        className="sr-only peer"
                      />
                      <label
                        htmlFor={inputId}
                        className={`inline-flex min-h-[44px] min-w-[90px] w-full items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 transition-all cursor-pointer select-none hover:border-neutral-300 hover:bg-neutral-50 sm:w-auto sm:px-4 ${opt.activeClass} peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2`}
                      >
                        {opt.label}
                      </label>
                    </div>
                  );
                })}
              </fieldset>
            </div>
          );
        })}
      </div>

      {/* Summary / Result View */}
      <div
        className="mt-8 rounded-2xl border border-line bg-neutral-50/80 p-5 sm:p-6"
        aria-labelledby="summary-heading"
      >
        <h3
          id="summary-heading"
          className="text-base font-extrabold text-strong sm:text-lg"
        >
          점검 현황 집계
        </h3>
        <p className="mt-1 text-xs text-neutral-600 sm:text-sm">
          본 집계는 자가 점검 확인 수량만을 보여주며, 투자 점수나 추천을 산출하지 않습니다.
        </p>

        {/* State counts grid */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <div className="rounded-xl border border-line bg-white p-3 text-center">
            <span className="block text-xs font-medium text-neutral-600">미응답</span>
            <span className="mt-1 block text-lg font-black text-neutral-700 sm:text-xl">
              {unansweredCount}개
            </span>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-center">
            <span className="block text-xs font-medium text-emerald-800">확인함</span>
            <span className="mt-1 block text-lg font-black text-emerald-700 sm:text-xl">
              {confirmedCount}개
            </span>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-center">
            <span className="block text-xs font-medium text-amber-800">추가 확인 필요</span>
            <span className="mt-1 block text-lg font-black text-amber-700 sm:text-xl">
              {needsReviewCount}개
            </span>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-3 text-center">
            <span className="block text-xs font-medium text-neutral-600">해당 없음</span>
            <span className="mt-1 block text-lg font-black text-neutral-700 sm:text-xl">
              {notApplicableCount}개
            </span>
          </div>
        </div>

        {/* List of items needing review */}
        {needsReviewCount > 0 ? (
          <div className="mt-6 rounded-xl border border-amber-200/90 bg-amber-50/60 p-4">
            <h4 className="text-xs font-extrabold text-amber-900 sm:text-sm">
              📋 추가 확인이 필요한 항목 ({itemsNeedingReview.length}건)
            </h4>
            <ul className="mt-3 space-y-2.5 text-xs text-amber-950 sm:text-sm">
              {itemsNeedingReview.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg bg-white/80 p-2.5 border border-amber-200/60"
                >
                  <div className="font-bold">
                    [문항 {item.id}] {item.prompt}
                  </div>
                  <div className="mt-1 text-xs text-neutral-600">
                    {item.sourceUrl ? (
                      <>
                        공식 확인 링크:{" "}
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                        >
                          {item.sourceLabel}
                        </a>
                      </>
                    ) : (
                      <>
                        확인 안내:{" "}
                        <span className="font-semibold text-neutral-700">
                          {item.sourceLabel}
                        </span>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : answeredCount > 0 && needsReviewCount === 0 ? (
          <div className="mt-5 rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3.5 text-xs font-semibold text-emerald-900 sm:text-sm">
            ✓ &apos;추가 확인 필요&apos;로 선택된 항목이 없습니다.
          </div>
        ) : null}
      </div>
    </section>
  );
}
