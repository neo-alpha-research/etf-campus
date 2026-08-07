import Link from "next/link";

import { Tickery } from "@/components/brand/tickery";

export default function NotFound() {
  return <main className="page-shell flex flex-1 flex-col items-center py-16 text-center sm:py-20"><Tickery className="h-52 w-52" pose="wayfinding" priority sizes="208px" /><p className="eyebrow mt-2">404</p><h1 className="mt-3 text-3xl font-extrabold">페이지를 찾을 수 없습니다</h1><p className="mt-3 text-sm text-muted">티커리도 길을 다시 확인하고 있어요.</p><Link className="mt-8 inline-flex min-h-11 items-center rounded-xl bg-brand-700 px-5 font-bold text-white" href="/">메인 화면으로 돌아가기</Link></main>;
}
