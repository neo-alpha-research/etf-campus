"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminBriefingsList() {
  const router = useRouter();
  const [briefings, setBriefings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/market-briefings")
      .then(res => {
        if (res.status === 401) {
          router.push("/admin/login");
          throw new Error("Unauthorized");
        }
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then(data => {
        setBriefings(data.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <div className="p-8 text-center text-gray-500">로딩 중...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">마켓 브리핑 관리</h1>
        <button 
          onClick={async () => {
            await fetch("/api/admin/auth/logout", { method: "POST" });
            router.push("/admin/login");
          }}
          className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg transition"
        >
          로그아웃
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-sm">
              <th className="p-4 font-medium">기준일</th>
              <th className="p-4 font-medium">상태</th>
              <th className="p-4 font-medium">시장 온도</th>
              <th className="p-4 font-medium">작업</th>
            </tr>
          </thead>
          <tbody>
            {briefings.map(b => (
              <tr key={b.asOfDate} className="border-b border-gray-100 hover:bg-gray-50 transition">
                <td className="p-4 font-medium text-gray-900">{b.asOfDate}</td>
                <td className="p-4">
                  {b.editorial?.state === 'published' ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      발행됨 (v{b.editorial.publishedRevision})
                    </span>
                  ) : b.editorial?.state === 'draft' ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      작성 중 (v{b.editorial.currentRevision})
                    </span>
                  ) : b.editorial?.state === 'withdrawn' ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      발행 취소
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      자동 생성본 대기
                    </span>
                  )}
                </td>
                <td className="p-4 text-gray-600">{b.marketTemperature}</td>
                <td className="p-4">
                  <Link 
                    href={`/admin/market-briefings/${b.asOfDate}`}
                    className="text-emerald-600 hover:text-emerald-700 font-medium text-sm transition"
                  >
                    편집 / 상세
                  </Link>
                </td>
              </tr>
            ))}
            {briefings.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-500">데이터가 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
