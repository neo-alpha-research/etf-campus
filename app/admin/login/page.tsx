"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      if (res.ok) {
        router.push("/admin/market-briefings");
      } else {
        const data = await res.json();
        setError(data.error?.message || "로그인 실패");
      }
    } catch (err) {
      setError("오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 border border-gray-100">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-900">운영자 로그인</h1>
        
        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">아이디</label>
            <input 
              type="text" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-gray-900" 
              required 
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-gray-900" 
              required 
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-emerald-600 text-white font-medium rounded-lg p-2.5 mt-4 hover:bg-emerald-700 transition disabled:opacity-50"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}
