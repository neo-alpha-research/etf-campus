"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

import { diagnoseStyle, parseStoredDiagnosis, STYLE_CHANGE_EVENT, STYLE_PROFILES, STYLE_STORAGE_KEY, type CompletedDiagnosis, type DiagnosisAnswers, type StoredDiagnosis } from "@/lib/onboarding/style-diagnosis";

const questions = [
  { key: "account", title: "ETF를 주로 어느 계좌에서 살펴보나요?", options: [["pension", "연금계좌"], ["general", "일반계좌"], ["both", "둘 다"]] },
  { key: "marketMove", title: "시장이 크게 움직인 날, 가장 먼저 확인하고 싶은 것은?", options: [["volatility", "얼마나 흔들렸는지"], ["balance", "자산군별 차이"], ["context", "움직인 이유와 맥락"], ["data", "관련 수치와 데이터"], ["rule", "평소 세운 기준이 유지되는지"]] },
  { key: "preference", title: "ETF를 살펴볼 때 어떤 설명이 가장 마음에 놓이나요?", options: [["stability", "변동과 위험이 잘 설명된 정보"], ["allocation", "여러 자산의 역할이 정리된 정보"], ["breadth", "국내외 시장을 넓게 볼 수 있는 정보"], ["criteria", "수치와 비교 기준이 명확한 정보"]] },
  { key: "experience", title: "ETF 수치와 용어를 마주치면 나는…", options: [["basic", "기본 설명부터 필요하다"], ["key-points", "핵심 항목 몇 개면 충분하다"], ["compare", "직접 비교하며 이해하는 편이다"], ["advanced", "이미 익숙하고 세부 기준을 본다"]] },
  { key: "campusRoom", title: "ETF캠퍼스에서 첫 번째로 들어가 보고 싶은 공간은?", options: [["foundation", "안전 원칙을 배우는 기초 강의실"], ["studio", "자산 배분을 그려보는 설계실"], ["exploration", "여러 시장을 둘러보는 탐험관"], ["lab", "숫자와 기준을 보는 데이터 연구실"]] },
] as const;

type Screen = "welcome" | "questions" | "result";

export function StyleOnboarding() {
  const [openIntent, setOpenIntent] = useState<boolean | null>(null);
  const [screen, setScreen] = useState<Screen>("welcome");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<DiagnosisAnswers>>({});
  const rawStored = useSyncExternalStore(
    (notify) => { window.addEventListener(STYLE_CHANGE_EVENT, notify); window.addEventListener("storage", notify); return () => { window.removeEventListener(STYLE_CHANGE_EVENT, notify); window.removeEventListener("storage", notify); }; },
    () => localStorage.getItem(STYLE_STORAGE_KEY),
    () => "__server__",
  );
  const stored = parseStoredDiagnosis(rawStored);
  const open = openIntent ?? rawStored === null;

  useEffect(() => {
    const onChange = (event: Event) => {
      const latest = parseStoredDiagnosis(localStorage.getItem(STYLE_STORAGE_KEY));
      if ((event as CustomEvent).detail?.open) { setScreen(latest?.status === "completed" ? "result" : "welcome"); setOpenIntent(true); }
    };
    window.addEventListener(STYLE_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(STYLE_CHANGE_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpenIntent(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", closeOnEscape); };
  }, [open]);

  const skip = () => {
    const value: StoredDiagnosis = { version: 1, status: "skipped", skippedAt: new Date().toISOString() };
    localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(value)); setOpenIntent(false);
    window.dispatchEvent(new Event(STYLE_CHANGE_EVENT));
  };
  const begin = () => { setAnswers({}); setStep(0); setScreen("questions"); };
  const question = questions[step];
  const selected = question ? answers[question.key] : undefined;
  const next = () => {
    if (!selected) return;
    if (step < questions.length - 1) { setStep(step + 1); return; }
    const completedAnswers = answers as DiagnosisAnswers;
    const value: CompletedDiagnosis = { version: 1, status: "completed", answers: completedAnswers, style: diagnoseStyle(completedAnswers), completedAt: new Date().toISOString() };
    localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(value)); setOpenIntent(true); setScreen("result");
    window.dispatchEvent(new Event(STYLE_CHANGE_EVENT));
  };

  if (!open) return null;
  const completed = stored?.status === "completed" ? stored : null;
  const profile = completed ? STYLE_PROFILES[completed.style] : null;
  const screenerHref = completed?.answers.account === "pension" ? "/screener?pension=eligible" : "/screener";

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-900/50 p-0 sm:items-center sm:p-5" role="presentation">
    <section aria-label="ETF 탐색 스타일 진단" aria-modal="true" className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-8" role="dialog">
      <div className="flex items-center justify-between gap-4"><p className="eyebrow">ETF Campus Style</p><button aria-label="닫기" className="rounded-full p-2 text-xl text-muted hover:bg-neutral-100" onClick={() => setOpenIntent(false)} type="button">×</button></div>
      {screen === "welcome" ? <div className="py-8 text-center"><p className="text-sm font-bold text-brand-700">30초 · 5문항 · 로그인 없음</p><h2 className="mt-3 text-3xl font-extrabold tracking-[-0.04em]">나에게 편한 ETF 탐색법은?</h2><p className="mt-4 text-sm leading-6 text-muted">투자 적합성을 판정하지 않고, 어떤 기준부터 배우면 편한지 안내합니다. 응답은 이 기기에만 저장됩니다.</p><button className="mt-8 w-full rounded-xl bg-brand-700 px-5 py-3.5 font-extrabold text-white" onClick={begin} type="button">시작하기</button><button className="mt-3 text-sm font-bold text-muted" onClick={skip} type="button">건너뛰기</button></div> : null}
      {screen === "questions" && question ? <div className="py-5"><div className="flex items-center justify-between text-xs font-bold text-muted"><span>{step + 1} / {questions.length}</span><button onClick={skip} type="button">건너뛰기</button></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-brand-600 transition-[width] motion-reduce:transition-none" style={{ width: `${((step + 1) / questions.length) * 100}%` }} /></div><h2 className="mt-7 text-2xl font-extrabold leading-9">{question.title}</h2><div className="mt-5 grid gap-2">{question.options.map(([value, label]) => <button aria-pressed={selected === value} className={`rounded-xl border p-4 text-left text-sm font-bold transition-colors ${selected === value ? "border-brand-600 bg-brand-50 text-brand-900" : "border-line hover:border-brand-300"}`} key={value} onClick={() => setAnswers({ ...answers, [question.key]: value })} type="button">{label}</button>)}</div><div className="mt-6 flex gap-2"><button className="rounded-xl border border-line px-5 py-3 text-sm font-bold disabled:opacity-40" disabled={step === 0} onClick={() => setStep(step - 1)} type="button">이전</button><button className="flex-1 rounded-xl bg-brand-700 px-5 py-3 text-sm font-extrabold text-white disabled:opacity-40" disabled={!selected} onClick={next} type="button">다음</button></div></div> : null}
      {screen === "result" && completed && profile ? <div className="py-5"><p className="text-sm font-bold text-brand-700">나의 ETF 탐색 스타일</p><h2 className="mt-2 text-3xl font-extrabold tracking-[-0.04em]">{profile.name}</h2><p className="mt-4 leading-7 text-muted">{profile.summary}</p><div className="mt-5 rounded-2xl bg-neutral-50 p-4"><p className="text-xs font-extrabold text-muted">기억할 점</p><p className="mt-2 text-sm leading-6 text-strong">{profile.habit}</p></div><div className="mt-6 grid gap-2"><Link className="rounded-xl bg-brand-700 px-5 py-3 text-center text-sm font-extrabold text-white" href={`/guides?style=${completed.style}`}>내 스타일 가이드 보기</Link><Link className="rounded-xl border border-brand-200 bg-brand-50 px-5 py-3 text-center text-sm font-extrabold text-brand-800" href={screenerHref}>내 계좌 조건으로 스크리너 열기</Link><Link className="rounded-xl border border-line px-5 py-3 text-center text-sm font-bold text-strong" href="/briefing">최신 브리핑 읽기</Link></div><p className="mt-5 text-xs leading-5 text-muted">이 결과는 정보 탐색 방식을 돕기 위한 교육용 안내이며, 투자 적합성 평가나 종목 추천이 아닙니다.</p><div className="mt-5 flex justify-between"><button className="text-sm font-bold text-muted" onClick={begin} type="button">다시 진단</button><button className="text-sm font-bold text-brand-700" onClick={() => setOpenIntent(false)} type="button">결과 닫기</button></div></div> : null}
    </section>
  </div>;
}
