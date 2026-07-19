import Link from "next/link";
export default function NotFound() { return <main className="page-shell flex-1 py-20"><p className="eyebrow">404</p><h1 className="mt-3 text-3xl font-extrabold">페이지를 찾을 수 없습니다</h1><Link className="mt-8 inline-block font-bold text-brand-700" href="/">대시보드로 돌아가기</Link></main>; }

