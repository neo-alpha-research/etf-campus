"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { Check, ExternalLink, Sparkles, Clock, ArrowRight, RotateCcw } from "lucide-react";

import { Tickery } from "@/components/brand/tickery";
import {
  AXIS_DEFINITIONS,
  DIAGNOSIS_QUESTIONS,
  diagnoseStyle,
  generateClientUUID,
  getAxisScores,
  getOppositeStyle,
  parseStoredDiagnosis,
  prescribeBooks,
  PRESCRIPTION_BOOK_METADATA,
  PRESCRIPTION_QUESTIONS,
  STYLE_CHANGE_EVENT,
  STYLE_PROFILES,
  STYLE_STORAGE_KEY,
  STYLE_STORAGE_KEY_V3,
  type CompletedDiagnosis,
  type DiagnosisAnswers,
  type NeedId,
  type PrescriptionAnswers,
  type PrescriptionQuestionId,
  type ScaleAnswer,
  type StoredDiagnosis,
  type StyleId,
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

type Screen = "welcome" | "questions" | "prescription" | "result";

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

// Background fire-and-forget stats submission
function recordDiagnosisStats(completed: CompletedDiagnosis) {
  if (typeof window === "undefined") return;
  try {
    const todayKST = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const body = {
      resultId: completed.resultId,
      styleId: completed.style,
      bookSlug: completed.prescription?.primaryBookSlug ?? "index-asset-allocation",
      axisScores: completed.axisScores,
      needScores: completed.prescription?.needScores ?? { signal: 0, map: 0, income: 0 },
      completedDate: todayKST,
    };

    fetch("/api/style/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {
      // fire and forget, ignore failure
    });
  } catch {
    // ignore
  }
}

export function StyleOnboarding() {
  const [openIntent, setOpenIntent] = useState<boolean | null>(null);
  const [screen, setScreen] = useState<Screen>("welcome");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<DiagnosisAnswers>>({});
  const [pStep, setPStep] = useState(0);
  const [pAnswers, setPAnswers] = useState<Partial<PrescriptionAnswers>>({});
  
  // Stats and Newsletter
  const [rarityShare, setRarityShare] = useState<number | null>(null);
  const [totalStatsCount, setTotalStatsCount] = useState<number>(0);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterAgreed, setNewsletterAgreed] = useState(true);
  const [newsletterSubmitting, setNewsletterSubmitting] = useState(false);
  const [newsletterSuccess, setNewsletterSuccess] = useState(false);
  const [newsletterError, setNewsletterError] = useState<string | null>(null);

  const rawStored = useSyncExternalStore(
    (notify) => {
      window.addEventListener(STYLE_CHANGE_EVENT, notify);
      window.addEventListener("storage", notify);
      return () => {
        window.removeEventListener(STYLE_CHANGE_EVENT, notify);
        window.removeEventListener("storage", notify);
      };
    },
    () => localStorage.getItem(STYLE_STORAGE_KEY) || localStorage.getItem(STYLE_STORAGE_KEY_V3),
    () => "__server__",
  );
  const stored = parseStoredDiagnosis(rawStored);
  const open = openIntent === true;

  useEffect(() => {
    const onChange = (event: Event) => {
      const latest = parseStoredDiagnosis(
        localStorage.getItem(STYLE_STORAGE_KEY) || localStorage.getItem(STYLE_STORAGE_KEY_V3),
      );
      if ((event as CustomEvent).detail?.open) {
        setScreen(latest?.status === "completed" ? "result" : "welcome");
        setOpenIntent(true);
      }
    };
    window.addEventListener(STYLE_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(STYLE_CHANGE_EVENT, onChange);
  }, []);

  const currentStyle = stored?.status === "completed" ? stored.style : null;

  // Fetch stats for rarity calculation
  useEffect(() => {
    if (!currentStyle) return;
    let isMounted = true;
    fetch("/api/style/stats")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data) return;
        setTotalStatsCount(data.total ?? 0);
        const match = data.styles?.find((s: { styleId: StyleId; share: number }) => s.styleId === currentStyle);
        if (match && typeof match.share === "number") {
          setRarityShare(match.share);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [currentStyle]);

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
    const value: StoredDiagnosis = { version: 4, status: "skipped", skippedAt: new Date().toISOString() };
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

  const nextQuestion = () => {
    if (selected === undefined) return;
    if (step < DIAGNOSIS_QUESTIONS.length - 1) {
      setStep((current) => current + 1);
      return;
    }

    const completedAnswers = answers as DiagnosisAnswers;
    const style = diagnoseStyle(completedAnswers);
    const value: CompletedDiagnosis = {
      version: 4,
      status: "completed",
      resultId: generateClientUUID(),
      answers: completedAnswers,
      style,
      axisScores: getAxisScores(completedAnswers),
      prescription: undefined,
      completedAt: new Date().toISOString(),
    };
    localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(value));
    setOpenIntent(true);
    setScreen("result");
    window.dispatchEvent(new Event(STYLE_CHANGE_EVENT));
    recordDiagnosisStats(value);
  };

  // Prescription Step Logic
  const pQuestion = PRESCRIPTION_QUESTIONS[pStep];
  const pSelected = pQuestion ? pAnswers[pQuestion.id] : undefined;

  const nextPrescription = () => {
    if (!pSelected) return;
    if (pStep < PRESCRIPTION_QUESTIONS.length - 1) {
      setPStep((cur) => cur + 1);
      return;
    }

    // Complete prescription
    const completedPAnswers = pAnswers as Record<PrescriptionQuestionId, NeedId>;
    const prescriptionResult = prescribeBooks(completedPAnswers);
    if (!prescriptionResult || stored?.status !== "completed") return;

    const updated: CompletedDiagnosis = {
      ...stored,
      version: 4,
      prescription: prescriptionResult,
    };
    localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(updated));
    setScreen("result");
    window.dispatchEvent(new Event(STYLE_CHANGE_EVENT));
    recordDiagnosisStats(updated);
  };

  const handleSubscribeNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail || !newsletterAgreed) return;
    setNewsletterSubmitting(true);
    setNewsletterError(null);

    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newsletterEmail, agreeRequired: newsletterAgreed }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNewsletterSuccess(true);
      } else {
        setNewsletterError(data.error?.message || "신청 처리 중 오류가 발생했습니다.");
      }
    } catch {
      setNewsletterError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setNewsletterSubmitting(false);
    }
  };

  if (!open) return null;

  const completed = stored?.status === "completed" ? stored : null;
  const profile = completed ? STYLE_PROFILES[completed.style] : null;
  const oppositeStyleId = completed ? getOppositeStyle(completed.style) : null;
  const oppositeProfile = oppositeStyleId ? STYLE_PROFILES[oppositeStyleId] : null;
  const primaryBook = completed?.prescription ? PRESCRIPTION_BOOK_METADATA[completed.prescription.primaryBookSlug] : null;

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

        {/* 1. Welcome Screen */}
        {screen === "welcome" ? (
          <div className="pb-2 pt-1 text-center">
            <Tickery className="mx-auto h-20 w-20" pose="welcome" priority sizes="80px" />
            <p className="mt-2 text-sm font-extrabold text-brand-700">약 3분 · 13문항 (10문항 + 처방 3문항) · 정답 없음</p>
            <h2 className="mt-1.5 text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">나의 ETF 투자 스타일 점검</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted sm:text-base">
              ETF를 고르고 운용할 때 내가 어떤 기준을 먼저 보는지 확인해 보세요. 10가지 동물 유형과 함께, 내 계좌의 결손을 채워줄 3편 시리즈 시작점을 처방해 드립니다.
            </p>
            <div className="mx-auto mt-4 grid max-w-lg grid-cols-3 gap-2" aria-label="투자 스타일 점검 영역">
              {["위험 대응", "정보 탐색", "도서 처방"].map((label) => (
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
            <p className="mt-2 text-xs text-muted">로그인 없이 · 응답은 이 기기 및 익명 통계로만 저장</p>
            <button className="mt-1 min-h-9 text-sm font-bold text-muted underline-offset-4 hover:underline" onClick={skip} type="button">
              건너뛰기
            </button>
          </div>
        ) : null}

        {/* 2. Questions Screen (10 Questions) */}
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
                onClick={nextQuestion}
                type="button"
              >
                {step === DIAGNOSIS_QUESTIONS.length - 1 ? "내 동물 확인" : "다음 질문"}
              </button>
            </div>
          </div>
        ) : null}

        {/* 3. Prescription Screen (3 Questions) */}
        {screen === "prescription" && pQuestion ? (
          <div className="pb-3 pt-4">
            <div className="flex items-center justify-between text-xs font-bold text-muted">
              <span>처방 문항 {pStep + 1} / {PRESCRIPTION_QUESTIONS.length}</span>
              <button className="min-h-9 underline-offset-4 hover:underline" onClick={() => setScreen("result")} type="button">나중에 하기</button>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-brand-600 transition-[width] motion-reduce:transition-none"
                style={{ width: `${((pStep + 1) / PRESCRIPTION_QUESTIONS.length) * 100}%` }}
              />
            </div>

            <p className="mt-6 text-xs font-extrabold tracking-[0.08em] text-brand-700">{pQuestion.scene}</p>
            <h2 className="mt-2 text-2xl font-extrabold leading-9 tracking-[-0.03em]">{pQuestion.title}</h2>
            <p className="mt-2 text-sm text-muted">내 계좌의 현실과 가장 가까운 선택지 1개를 골라주세요.</p>

            <div className="mt-5 space-y-3">
              {pQuestion.options.map((option, idx) => {
                const optLetter = String.fromCharCode(65 + idx);
                const isCurrentSelected = pSelected === option.need;
                return (
                  <button
                    aria-label={`${optLetter}. ${option.label}`}
                    aria-pressed={isCurrentSelected}
                    className={`flex w-full min-h-[56px] items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
                      isCurrentSelected
                        ? "border-brand-600 bg-brand-50 text-brand-900 shadow-sm ring-1 ring-brand-300"
                        : "border-line hover:border-brand-300 hover:bg-neutral-50"
                    }`}
                    key={option.need}
                    onClick={() => setPAnswers((cur) => ({ ...cur, [pQuestion.id]: option.need }))}
                    type="button"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-700 text-xs font-black text-white">
                      {optLetter}
                    </span>
                    <div className="flex-1">
                      <span className="block text-sm font-extrabold text-strong">{option.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-muted">{option.detail}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex gap-2">
              <button
                className="rounded-xl border border-line px-5 py-3 text-sm font-bold disabled:opacity-40"
                disabled={pStep === 0}
                onClick={() => setPStep((cur) => cur - 1)}
                type="button"
              >
                이전
              </button>
              <button
                className="flex-1 rounded-xl bg-brand-700 px-5 py-3 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!pSelected}
                onClick={nextPrescription}
                type="button"
              >
                {pStep === PRESCRIPTION_QUESTIONS.length - 1 ? "처방 도서 확인" : "다음 처방 질문"}
              </button>
            </div>
          </div>
        ) : null}

        {/* 4. Result Screen (Animal + Prescription) */}
        {screen === "result" && completed && profile ? (
          <div className="pb-3 pt-4">
            {/* Top Animal Identity Card */}
            <div className="rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 via-surface to-neutral-50 p-5 text-center sm:p-7">
              <div className="mx-auto grid size-24 place-items-center rounded-full border-4 border-surface bg-brand-100 text-6xl shadow-sm" aria-hidden="true">
                {profile.emoji}
              </div>

              {/* Rarity Badge */}
              <div className="mt-4 flex justify-center">
                {rarityShare !== null && totalStatsCount >= 300 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white/80 px-3 py-1 text-xs font-extrabold text-brand-800 shadow-xs">
                    <Sparkles className="h-3.5 w-3.5 text-brand-600" />
                    이 유형은 최근 참여자 100명 중 {Math.max(1, Math.round(rarityShare * 100))}명
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white/80 px-3 py-1 text-xs font-bold text-muted shadow-xs">
                    통계 집계 중
                  </span>
                )}
              </div>

              <p className="mt-3 text-xs font-extrabold tracking-[0.08em] text-brand-700">나의 ETF 투자 스타일</p>
              <h2 className="mt-1.5 text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">{profile.name}</h2>
              <p className="mt-2 text-sm font-bold text-brand-800">{profile.tagline}</p>

              {/* Punchline Highlight Block */}
              <div className="mx-auto mt-4 max-w-md rounded-2xl border border-brand-200/80 bg-surface/90 px-4 py-3 shadow-xs">
                <p className="text-xs font-semibold text-brand-900 sm:text-sm">
                  &ldquo;{profile.punchline}&rdquo;
                </p>
              </div>

              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {profile.traits.map((trait) => (
                  <span className="rounded-full border border-brand-200 bg-surface px-3 py-1.5 text-xs font-bold text-brand-800" key={trait}>{trait}</span>
                ))}
              </div>
            </div>

            <p className="mt-5 leading-7 text-muted">{profile.summary}</p>

            {/* 5 Axes */}
            <div className="mt-5 rounded-2xl border border-line p-4 sm:p-5">
              <p className="text-sm font-extrabold text-strong">5가지 탐색 축</p>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                {AXIS_DEFINITIONS.map((axis) => (
                  <AxisResult axis={axis} key={axis.id} score={completed.axisScores[axis.id]} />
                ))}
              </div>
            </div>

            {/* Strengths & Habit */}
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

            {/* Opposite Style Card (대비 유형) */}
            {oppositeProfile ? (
              <div className="mt-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-extrabold text-brand-700">나와 가장 다르게 보는 유형</p>
                  <span className="text-[11px] font-bold text-muted">탐색 벡터 최대 거리</span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <span className="grid size-12 place-items-center rounded-2xl bg-neutral-100 text-2xl" aria-hidden="true">
                    {oppositeProfile.emoji}
                  </span>
                  <div>
                    <h3 className="text-base font-extrabold text-strong">{oppositeProfile.name}</h3>
                    <p className="text-xs text-muted">&ldquo;{oppositeProfile.punchline}&rdquo;</p>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-5 text-neutral-600">
                  정보를 정반대 축에서 탐색하므로, 동료나 파트너와 함께 의논할 때 사각지대를 보완해 줍니다.
                </p>
              </div>
            ) : null}

            {/* 2nd Tier: Prescription Section */}
            <div className="mt-6">
              {!completed.prescription ? (
                <div className="rounded-3xl border-2 border-brand-300 bg-brand-50/70 p-5 text-center sm:p-6">
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-3 py-1 text-xs font-extrabold text-brand-800">
                    <Sparkles className="h-3.5 w-3.5" /> 마무리 3문항 처방
                  </span>
                  <h3 className="mt-2 text-xl font-extrabold text-brand-950 sm:text-2xl">
                    내 계좌에 비어 있는 도서 1권 찾기
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-xs sm:text-sm leading-relaxed text-brand-900/80">
                    동물 유형으로 정보 습관을 확인했다면, 이제 내 퇴직연금 계좌에서 어떤 도서(신호·지도·현금흐름)가 시작점이 될지 3문항으로 처방해 드립니다.
                  </p>
                  <button
                    className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-700 px-6 py-2.5 text-sm font-extrabold text-white shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-brand-800"
                    onClick={() => {
                      setPStep(0);
                      setPAnswers({});
                      setScreen("prescription");
                    }}
                    type="button"
                  >
                    <span>처방 3문항 시작하기 (약 1분)</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ) : primaryBook ? (
                <div className="rounded-3xl border-2 border-brand-400 bg-surface p-5 shadow-sm sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-brand-700 px-2.5 py-0.5 text-xs font-extrabold text-white">
                        처방 결과
                      </span>
                      <span className="text-xs font-extrabold text-strong">
                        나의 퇴직연금 ETF 시작 도서
                      </span>
                    </div>
                    <button
                      className="inline-flex items-center gap-1 text-xs font-bold text-muted hover:text-brand-700"
                      onClick={() => {
                        setPStep(0);
                        setPAnswers({});
                        setScreen("prescription");
                      }}
                      type="button"
                    >
                      <RotateCcw className="h-3 w-3" /> 처방 다시 받기
                    </button>
                  </div>

                  {/* Primary Book Card */}
                  <div className="mt-4 rounded-2xl bg-brand-50/50 p-4 border border-brand-200">
                    <div className="flex items-center gap-2">
                      <span className="chip text-[11px] font-extrabold">시작점 1권</span>
                      <span className="text-xs font-bold text-brand-800">{primaryBook.topic}</span>
                    </div>
                    <h4 className="mt-2 text-lg font-extrabold text-strong sm:text-xl">
                      {primaryBook.title}
                    </h4>
                    <p className="mt-2 text-xs sm:text-sm leading-relaxed text-neutral-600">
                      {primaryBook.summary}
                    </p>

                    {/* CTA Branch based on frontmatter status */}
                    <div className="mt-4 pt-3 border-t border-brand-200/60">
                      {primaryBook.status === "published" && primaryBook.affiliateUrl ? (
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <a
                              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-xs sm:text-sm font-extrabold text-white shadow-xs transition-colors hover:bg-brand-800"
                              href={primaryBook.affiliateUrl}
                              rel="sponsored nofollow noopener"
                              target="_blank"
                              aria-label="크티(CTEE) 공식 스토어에서 전자책 소장하기 (새 창 열림)"
                            >
                              <span>크티(CTEE)에서 전자책 소장하기</span>
                              <ExternalLink className="h-4 w-4" />
                            </a>
                            <Link
                              className="inline-flex min-h-[44px] items-center text-xs font-bold text-brand-800 underline-offset-4 hover:underline"
                              href={`/books/${primaryBook.slug}`}
                              onClick={() => setOpenIntent(false)}
                            >
                              도서 상세 및 목차 보기 →
                            </Link>
                          </div>
                          <p className="mt-2 text-[11px] text-neutral-500">
                            * 광고 · 제휴 링크 (결제 및 다운로드는 크티 스토어에서 처리됩니다)
                          </p>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                            <Clock className="h-3.5 w-3.5" />
                            <span>출간 준비 중 (원고 완성 및 검수 완료)</span>
                          </div>
                          <p className="mt-1 text-xs text-neutral-600">
                            출간 즉시 알림을 받고 30일 목차를 미리 확인해 보세요.
                          </p>

                          {newsletterSuccess ? (
                            <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-extrabold text-emerald-800 border border-emerald-200">
                              <Check className="h-4 w-4 text-emerald-600" />
                              출간 알림 신청이 완료되었습니다!
                            </div>
                          ) : (
                            <form className="mt-3 space-y-2" onSubmit={handleSubscribeNewsletter}>
                              <div className="flex gap-2">
                                <input
                                  className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-xs placeholder:text-muted focus:border-brand-500 focus:outline-none"
                                  disabled={newsletterSubmitting}
                                  onChange={(e) => setNewsletterEmail(e.target.value)}
                                  placeholder="알림 받을 이메일 주소"
                                  required
                                  type="email"
                                  value={newsletterEmail}
                                />
                                <button
                                  className="rounded-xl bg-brand-700 px-4 py-2 text-xs font-extrabold text-white disabled:opacity-50"
                                  disabled={newsletterSubmitting}
                                  type="submit"
                                >
                                  {newsletterSubmitting ? "신청 중..." : "출간 알림"}
                                </button>
                              </div>
                              <label className="flex items-center gap-2 text-[11px] text-muted">
                                <input
                                  checked={newsletterAgreed}
                                  disabled={newsletterSubmitting}
                                  onChange={(e) => setNewsletterAgreed(e.target.checked)}
                                  required
                                  type="checkbox"
                                />
                                <span>이용약관 및 개인정보 처리방침 동의 (필수)</span>
                              </label>
                              {newsletterError ? (
                                <p className="text-[11px] font-bold text-rose-600">{newsletterError}</p>
                              ) : null}
                            </form>
                          )}

                          <div className="mt-3">
                            <Link
                              className="inline-flex min-h-[36px] items-center text-xs font-bold text-brand-800 underline-offset-4 hover:underline"
                              href={`/books/${primaryBook.slug}`}
                              onClick={() => setOpenIntent(false)}
                            >
                              30일 목차 미리보기 →
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Reading Order List */}
                  <div className="mt-4 rounded-2xl bg-neutral-50 p-4 border border-line">
                    <p className="text-xs font-extrabold text-strong">추천 읽는 순서 (3편 시리즈 전체)</p>
                    <div className="mt-3 space-y-2">
                      {completed.prescription.order.map((slug, idx) => {
                        const bookMeta = PRESCRIPTION_BOOK_METADATA[slug];
                        if (!bookMeta) return null;
                        return (
                          <div
                            className="flex items-center justify-between rounded-xl bg-white p-2.5 border border-neutral-200 text-xs"
                            key={slug}
                          >
                            <div className="flex items-center gap-2">
                              <span className="grid size-5 place-items-center rounded-full bg-brand-100 text-[10px] font-black text-brand-800">
                                {idx + 1}
                              </span>
                              <span className="font-extrabold text-strong">{bookMeta.title}</span>
                            </div>
                            <span className="text-[11px] font-semibold text-muted">
                              {bookMeta.status === "published" ? "출간됨" : "출간 준비 중"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-3 text-[11px] leading-relaxed text-muted border-t border-neutral-200/60 pt-2">
                      💡 ②편(지수·자산배분)은 계좌 전체의 목표 비율과 허용 밴드를 세우는 상위 규정서이므로, 고민의 크기가 같을 때는 계좌의 지도를 먼저 그리는 것을 권장합니다.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Quick Action Links */}
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
                href={`/style/${completed.style}`}
                onClick={() => setOpenIntent(false)}
              >
                내 동물 유형({profile.name}) 전용 페이지 보기
              </Link>
            </div>

            {/* Educational Disclaimer */}
            <p className="mt-5 text-xs leading-5 text-muted">
              이 결과는 ETF 정보 탐색 습관을 돌아보기 위한 교육용 콘텐츠이며, 금융회사의 투자성향 진단·투자 적합성 평가·종목 추천이 아닙니다. 응답 통계는 익명 UUID 기반으로 안전하게 처리되며 개인 식별 정보는 수집하지 않습니다.
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
