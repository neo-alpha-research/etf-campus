"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";

import { Tickery } from "@/components/brand/tickery";
import {
  AXIS_DEFINITIONS,
  DIAGNOSIS_QUESTIONS,
  diagnoseStyle,
  getAxisScores,
  parseStoredDiagnosis,
  STYLE_CHANGE_EVENT,
  STYLE_PROFILES,
  STYLE_STORAGE_KEY,
  type CompletedDiagnosis,
  type DiagnosisAnswers,
  type ScaleAnswer,
  type StoredDiagnosis,
} from "@/lib/onboarding/style-diagnosis";

const SCALE_TICKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

function getPositionLabel(value: ScaleAnswer): string {
  if (value <= 2) return "A에 매우 가까움";
  if (value <= 4) return "A에 가까움";
  if (value === 5) return "A에 조금 가까움";
  if (value === 6) return "B에 조금 가까움";
  if (value <= 8) return "B에 가까움";
  return "B에 매우 가까움";
}

type Screen = "welcome" | "questions" | "result";

function AxisResult({ axis, score }: { axis: (typeof AXIS_DEFINITIONS)[number]; score: number }) {
  const position = Math.round(((score + 1) / 2) * 100);
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-extrabold text-strong">{axis.name}</p>
        <p className="text-[11px] font-bold text-muted">{score <= 0 ? axis.lowLabel : axis.highLabel} 쪽</p>
      </div>
      <div
        aria-label={`${axis.name}: ${axis.lowLabel}에서 ${axis.highLabel} 사이 ${position}%`}
        className="relative mt-2 h-2 rounded-full bg-neutral-200"
        role="img"
      >
        <span className="absolute inset-y-0 left-1/2 w-px bg-neutral-400" />
        <span
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-brand-700 shadow-sm"
          style={{ left: `${position}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] font-semibold text-muted">
        <span>{axis.lowLabel}</span>
        <span>{axis.highLabel}</span>
      </div>
    </div>
  );
}

export function StyleOnboarding() {
  const [openIntent, setOpenIntent] = useState<boolean | null>(null);
  const [screen, setScreen] = useState<Screen>("welcome");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<DiagnosisAnswers>>({});
  const rawStored = useSyncExternalStore(
    (notify) => {
      window.addEventListener(STYLE_CHANGE_EVENT, notify);
      window.addEventListener("storage", notify);
      return () => {
        window.removeEventListener(STYLE_CHANGE_EVENT, notify);
        window.removeEventListener("storage", notify);
      };
    },
    () => localStorage.getItem(STYLE_STORAGE_KEY),
    () => "__server__",
  );
  const stored = parseStoredDiagnosis(rawStored);
  const open = openIntent ?? false;

  useEffect(() => {
    if (openIntent === null && rawStored !== "__server__") {
      setOpenIntent(stored === null);
    }
  }, [openIntent, rawStored, stored]);

  useEffect(() => {
    const onChange = (event: Event) => {
      const latest = parseStoredDiagnosis(localStorage.getItem(STYLE_STORAGE_KEY));
      if ((event as CustomEvent).detail?.open) {
        setScreen(latest?.status === "completed" ? "result" : "welcome");
        setOpenIntent(true);
      }
    };
    window.addEventListener(STYLE_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(STYLE_CHANGE_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenIntent(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const skip = () => {
    const value: StoredDiagnosis = { version: 3, status: "skipped", skippedAt: new Date().toISOString() };
    localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(value));
    setOpenIntent(false);
    window.dispatchEvent(new Event(STYLE_CHANGE_EVENT));
  };

  const begin = () => {
    setAnswers({});
    setStep(0);
    setScreen("questions");
  };

  const question = DIAGNOSIS_QUESTIONS[step];
  const selected = question ? answers[question.id] : undefined;

  const next = () => {
    if (selected === undefined) return;
    if (step < DIAGNOSIS_QUESTIONS.length - 1) {
      setStep((current) => current + 1);
      return;
    }

    const completedAnswers = answers as DiagnosisAnswers;
    const value: CompletedDiagnosis = {
      version: 3,
      status: "completed",
      answers: completedAnswers,
      style: diagnoseStyle(completedAnswers),
      axisScores: getAxisScores(completedAnswers),
      completedAt: new Date().toISOString(),
    };
    localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(value));
    setOpenIntent(true);
    setScreen("result");
    window.dispatchEvent(new Event(STYLE_CHANGE_EVENT));
  };

  if (!open) return null;

  const completed = stored?.status === "completed" ? stored : null;
  const profile = completed ? STYLE_PROFILES[completed.style] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-900/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" role="presentation">
      <section
        aria-label="ETF 투자 스타일 점검"
        aria-modal="true"
        className={`w-full rounded-t-3xl bg-surface p-5 shadow-2xl sm:max-w-2xl sm:rounded-3xl sm:p-7 ${
          screen === "welcome" ? "overflow-hidden" : "max-h-[94vh] overflow-y-auto"
        }`}
        role="dialog"
      >
        <div className="flex items-center justify-between gap-4">
          <p className="eyebrow">ETF CAMPUS STYLE CHECK</p>
          <button
            aria-label="닫기"
            className="grid size-10 place-items-center rounded-full text-xl text-muted hover:bg-neutral-100"
            onClick={() => setOpenIntent(false)}
            type="button"
          >
            ×
          </button>
        </div>

        {screen === "welcome" ? (
          <div className="pb-2 pt-1 text-center">
            <Tickery className="mx-auto h-20 w-20" pose="welcome" priority sizes="80px" />
            <p className="mt-2 text-sm font-extrabold text-brand-700">약 2분 · 10문항 · 정답 없음</p>
            <h2 className="mt-1.5 text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">나의 ETF 투자 스타일 점검</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted sm:text-base">
              ETF를 고르고 운용할 때 내가 어떤 기준을 먼저 보는지 확인해 보세요. 답변을 마치면 투자 습관과 닮은 동물 유형으로 알기 쉽게 풀어드립니다.
            </p>
            <div className="mx-auto mt-4 grid max-w-lg grid-cols-3 gap-2" aria-label="투자 스타일 점검 영역">
              {["위험 대응", "정보 탐색", "운용 습관"].map((label) => (
                <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-2 py-2.5 text-xs font-extrabold text-neutral-700" key={label}>
                  {label}
                </div>
              ))}
            </div>
            <button
              className="mt-5 w-full rounded-xl bg-brand-700 px-5 py-3.5 font-extrabold text-white shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-brand-800"
              onClick={begin}
              type="button"
            >
              투자 스타일 점검 시작
            </button>
            <p className="mt-2 text-xs text-muted">로그인 없이 · 응답은 이 기기에만 저장</p>
            <button className="mt-1 min-h-9 text-sm font-bold text-muted underline-offset-4 hover:underline" onClick={skip} type="button">
              건너뛰기
            </button>
          </div>
        ) : null}

        {screen === "questions" && question ? (
          <div className="pb-3 pt-4">
            <div className="flex items-center justify-between text-xs font-bold text-muted">
              <span>{step + 1} / {DIAGNOSIS_QUESTIONS.length}</span>
              <button className="min-h-9 underline-offset-4 hover:underline" onClick={skip} type="button">건너뛰기</button>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-brand-600 transition-[width] motion-reduce:transition-none"
                style={{ width: `${((step + 1) / DIAGNOSIS_QUESTIONS.length) * 100}%` }}
              />
            </div>

            <p className="mt-6 text-xs font-extrabold tracking-[0.08em] text-brand-700">{question.scene}</p>
            <h2 className="mt-2 text-2xl font-extrabold leading-9 tracking-[-0.03em]">{question.title}</h2>
            <p className="mt-2 text-sm text-muted">A와 B 사이에서 지금의 나와 가까운 위치를 눌러 보세요. 손잡이를 끌어도 됩니다.</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {([
                { key: "A", option: question.left, value: 1 as ScaleAnswer },
                { key: "B", option: question.right, value: 10 as ScaleAnswer },
              ] as const).map(({ key, option, value }) => (
                <button
                  aria-label={`${key}. ${option.label}`}
                  aria-pressed={selected === value}
                  className={`min-h-28 rounded-2xl border p-4 text-left transition-all ${
                    selected === value
                      ? "border-brand-600 bg-brand-50 text-brand-900 shadow-sm ring-1 ring-brand-200"
                      : "border-line hover:border-brand-300 hover:bg-neutral-50"
                  }`}
                  key={key}
                  onClick={() => setAnswers((current) => ({ ...current, [question.id]: value }))}
                  type="button"
                >
                  <span className="flex items-center gap-2">
                    <span className="grid size-7 place-items-center rounded-full bg-brand-700 text-xs font-black text-white">{key}</span>
                    <span aria-hidden="true" className="text-2xl">{option.emoji}</span>
                  </span>
                  <span className="mt-3 block text-sm font-extrabold">{option.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted">{option.detail}</span>
                </button>
              ))}
            </div>

            <div className="mt-5 rounded-2xl bg-neutral-50 px-4 py-4 sm:px-5">
              <div className="flex items-center justify-between gap-3 text-xs font-extrabold">
                <span className="text-brand-800">A 쪽 · 1</span>
                <span className={`rounded-full px-3 py-1.5 ${selected === undefined ? "bg-neutral-200 text-muted" : "bg-brand-700 text-white"}`}>
                  {selected === undefined ? "위치를 선택해 주세요" : `${selected} · ${getPositionLabel(selected)}`}
                </span>
                <span className="text-brand-800">10 · B 쪽</span>
              </div>
              <input
                aria-label="A와 B 사이의 위치"
                aria-valuetext={selected === undefined ? "아직 선택하지 않음" : `${selected}, ${getPositionLabel(selected)}`}
                className="etf-style-slider mt-3"
                max="10"
                min="1"
                onChange={(event) => setAnswers((current) => ({
                  ...current,
                  [question.id]: Math.round(Number(event.target.value)) as ScaleAnswer,
                }))}
                step="0.5"
                style={{ "--slider-position": `${(((selected ?? 5.5) - 1) / 9) * 100}%` } as CSSProperties}
                type="range"
                value={selected ?? 5.5}
              />
              <div className="grid grid-cols-10" aria-label="1부터 10까지 위치 눈금">
                {SCALE_TICKS.map((value) => (
                  <button
                    aria-label={`${value} 위치 선택`}
                    className={`min-h-9 text-xs font-bold transition-colors ${
                      selected === value ? "text-brand-800" : "text-neutral-500 hover:text-brand-700"
                    }`}
                    key={value}
                    onClick={() => setAnswers((current) => ({ ...current, [question.id]: value }))}
                    type="button"
                  >
                    {value}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-center text-[11px] font-semibold text-muted">숫자는 우열이나 투자 점수가 아니라 두 문장 사이의 위치입니다.</p>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                className="rounded-xl border border-line px-5 py-3 text-sm font-bold disabled:opacity-40"
                disabled={step === 0}
                onClick={() => setStep((current) => current - 1)}
                type="button"
              >
                이전
              </button>
              <button
                className="flex-1 rounded-xl bg-brand-700 px-5 py-3 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40"
                disabled={selected === undefined}
                onClick={next}
                type="button"
              >
                {step === DIAGNOSIS_QUESTIONS.length - 1 ? "내 동물 확인" : "다음 질문"}
              </button>
            </div>
          </div>
        ) : null}

        {screen === "result" && completed && profile ? (
          <div className="pb-3 pt-4">
            <div className="rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 via-surface to-neutral-50 p-5 text-center sm:p-7">
              <div className="mx-auto grid size-24 place-items-center rounded-full border-4 border-surface bg-brand-100 text-6xl shadow-sm" aria-hidden="true">
                {profile.emoji}
              </div>
              <p className="mt-4 text-xs font-extrabold tracking-[0.08em] text-brand-700">나의 ETF 투자 스타일</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">{profile.name}</h2>
              <p className="mt-2 text-sm font-bold text-brand-800">{profile.tagline}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {profile.traits.map((trait) => (
                  <span className="rounded-full border border-brand-200 bg-surface px-3 py-1.5 text-xs font-bold text-brand-800" key={trait}>{trait}</span>
                ))}
              </div>
            </div>

            <p className="mt-5 leading-7 text-muted">{profile.summary}</p>

            <div className="mt-5 rounded-2xl border border-line p-4 sm:p-5">
              <p className="text-sm font-extrabold text-strong">5가지 탐색 축</p>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                {AXIS_DEFINITIONS.map((axis) => (
                  <AxisResult axis={axis} key={axis.id} score={completed.axisScores[axis.id]} />
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-neutral-50 p-4">
                <p className="text-xs font-extrabold text-muted">내가 잘 발견하는 것</p>
                <ul className="mt-2 space-y-2 text-sm font-semibold">
                  {profile.strengths.map((value) => <li key={value}>✓ {value}</li>)}
                </ul>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-extrabold text-amber-800">한 번 더 확인할 점</p>
                <p className="mt-2 text-sm leading-6 text-strong">{profile.habit}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <Link
                className="rounded-xl bg-brand-700 px-5 py-3 text-center text-sm font-extrabold text-white"
                href="/quick?mode=pension"
                onClick={() => setOpenIntent(false)}
              >
                연금 계좌에서 ETF 찾기
              </Link>
              <Link
                className="rounded-xl border border-brand-300 bg-brand-50 px-5 py-3 text-center text-sm font-extrabold text-brand-800"
                href="/quick?mode=general"
                onClick={() => setOpenIntent(false)}
              >
                일반 계좌에서 ETF 찾기
              </Link>
              <Link
                className="rounded-xl border border-line px-5 py-3 text-center text-sm font-extrabold text-neutral-700 sm:col-span-2"
                href={`/guides?style=${completed.style}`}
                onClick={() => setOpenIntent(false)}
              >
                내 스타일 가이드 보기
              </Link>
            </div>

            <p className="mt-5 text-xs leading-5 text-muted">
              이 결과는 ETF 정보 탐색 습관을 돌아보기 위한 교육용 콘텐츠이며, 금융회사의 투자성향 진단·투자 적합성 평가·종목 추천이 아닙니다.
            </p>
            <div className="mt-4 flex justify-between">
              <button className="min-h-10 text-sm font-bold text-muted" onClick={begin} type="button">다시 진단</button>
              <button className="min-h-10 text-sm font-bold text-brand-700" onClick={() => setOpenIntent(false)} type="button">결과 닫기</button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
