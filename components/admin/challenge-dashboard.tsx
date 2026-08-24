"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { communityFetch } from "@/lib/community/browser-client";

type DashboardRow = {
  participant_id: string;
  cohort_id: string;
  cohort_title: string;
  public_nickname: string;
  participant_status: string;
  payment_status: string;
  milestone_10: boolean;
  milestone_20: boolean;
  milestone_30: boolean;
  approved_days: number;
  total_judged_days: number;
};

export default function ChallengeDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const res = await communityFetch("/admin/challenges/dashboard");
      if (res.status === 401 || res.status === 403) {
        router.push("/admin/login");
        return;
      }
      if (!res.ok) throw new Error("failed to fetch dashboard");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    setTimeout(() => {
      loadData();
    }, 0);
  }, [loadData]);

  const handleOverride = async (participantId: string, cohortId: string, dayNumber: number, newStatus: string) => {
    try {
      const res = await communityFetch("/admin/challenges/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participant_id: participantId, cohort_id: cohortId, day_number: dayNumber, status: newStatus })
      });
      if (res.ok) {
        alert("상태가 변경되었습니다.");
        loadData();
      } else {
        alert("상태 변경 실패");
      }
    } catch (error) {
      alert("네트워크 오류");
    }
  };

  if (loading) return <div className="p-8">로딩 중...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">챌린지 현황 관리</h1>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-700">
              <th className="p-4">기수</th>
              <th className="p-4">닉네임</th>
              <th className="p-4">참가/결제 상태</th>
              <th className="p-4">인정 / 전체판정 (일)</th>
              <th className="p-4">마일스톤 (10/20/30)</th>
              <th className="p-4">수동 개입</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((row) => (
              <tr key={row.participant_id} className="hover:bg-gray-50 transition text-sm">
                <td className="p-4">{row.cohort_title}</td>
                <td className="p-4 font-medium text-gray-900">{row.public_nickname}</td>
                <td className="p-4">
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mr-2">
                    {row.participant_status}
                  </span>
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                    {row.payment_status}
                  </span>
                </td>
                <td className="p-4 font-mono text-gray-600">
                  {row.approved_days} / {row.total_judged_days}
                </td>
                <td className="p-4">
                  {row.milestone_10 ? '✅' : '❌'}{row.milestone_20 ? '✅' : '❌'}{row.milestone_30 ? '✅' : '❌'}
                </td>
                <td className="p-4">
                  <button onClick={() => {
                    const d = prompt("변경할 Day 숫자를 입력하세요");
                    if (!d) return;
                    const day = parseInt(d, 10);
                    if (isNaN(day)) return;
                    handleOverride(row.participant_id, row.cohort_id, day, "appeal_approved");
                  }} className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded border border-indigo-200 hover:bg-indigo-100">
                    소명 승인
                  </button>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">데이터가 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
