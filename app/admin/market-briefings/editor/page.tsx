"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function EditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const asOfDate = searchParams.get('date');

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "",
    oneLineText: "",
    marketTemperatureCommentary: "",
    summaryMarkdown: "",
    newsletterCtaTitle: "",
    newsletterCtaBody: "",
    newsletterCtaUrl: "",
    disclosureText: "",
    changeSummary: ""
  });

  useEffect(() => {
    if (!asOfDate) {
      setError("?짜가 지?되지 ?았?니??");
      setLoading(false);
      return;
    }

    fetch(`/api/admin/market-briefings/${asOfDate}`)
      .then(res => {
        if (res.status === 401) router.push("/admin/login");
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then(json => {
        setData(json);
        if (json.currentRevision) {
          setForm({
            title: json.currentRevision.title || "",
            oneLineText: json.currentRevision.oneLineText || "",
            marketTemperatureCommentary: json.currentRevision.marketTemperatureCommentary || "",
            summaryMarkdown: json.currentRevision.summaryMarkdown || "",
            newsletterCtaTitle: json.currentRevision.newsletterCtaTitle || "",
            newsletterCtaBody: json.currentRevision.newsletterCtaBody || "",
            newsletterCtaUrl: json.currentRevision.newsletterCtaUrl || "",
            disclosureText: json.currentRevision.disclosureText || "",
            changeSummary: ""
          });
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [asOfDate, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/market-briefings/${asOfDate}/revisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          baseMetricsHash: data.document.baseMetricsHash,
          baseSourceVersion: data.sourceVersion,
          expectedRevisionNo: data.document.currentRevisionNo
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error?.message || "????패");
      
      alert(`??되?습?다. ??리비?? v${result.revisionNo}`);
      window.location.reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!confirm("?재 리비?을 발행?시겠습?까?")) return;
    try {
      const res = await fetch(`/api/admin/market-briefings/${asOfDate}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedRevisionNo: data.document.currentRevisionNo
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error?.message || "발행 ?패");
      alert("발행?었?니??");
      window.location.reload();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleWithdraw = async () => {
    if (!confirm("?말 발행??취소?시겠습?까? 공개 ?면?서 ?려갑니??")) return;
    try {
      const res = await fetch(`/api/admin/market-briefings/${asOfDate}/withdraw`, { method: "POST" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error?.message || "취소 ?패");
      alert("발행??취소?었?니??");
      window.location.reload();
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading) return <div className="p-8 text-center">로딩 ?..</div>;
  if (!data) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="max-w-7xl mx-auto p-6 flex flex-col lg:flex-row gap-6">
      {/* Left Panel: Metrics (Readonly) */}
      <div className="w-full lg:w-1/3 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="mb-4">
          <Link href="/admin/market-briefings" className="text-sm text-gray-500 hover:text-gray-800">
            &larr; 목록?로
          </Link>
        </div>
        <h2 className="text-xl font-bold mb-4">기? ?이??<span className="text-sm font-normal text-gray-500 ml-2">{asOfDate}</span></h2>
        
        <div className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
            <div className="text-xs text-gray-500 mb-1">?태</div>
            <div className="font-semibold text-emerald-700">
              {data.document.state} (v{data.document.currentRevisionNo})
            </div>
          </div>
          
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
            <div className="text-xs text-gray-500 mb-1">KOSPI / KOSDAQ</div>
            <div className="font-mono text-sm">
              {data.metrics.market_indices?.[0]?.close} ({data.metrics.market_indices?.[0]?.change_pct}%) / 
              {data.metrics.market_indices?.[1]?.close} ({data.metrics.market_indices?.[1]?.change_pct}%)
            </div>
          </div>
          
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
            <div className="text-xs text-gray-500 mb-1">?장 ?도 (기계 ?정)</div>
            <div className="font-medium text-gray-800">{data.currentRevision?.marketTemperatureCommentary || "N/A"}</div>
          </div>

          <div className="mt-8 pt-4 border-t border-gray-200">
            {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
            
            <div className="flex flex-col gap-2">
              <button 
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 rounded-lg font-medium transition disabled:opacity-50"
              >
                {saving ? "????.." : "초안 ???(??리비??"}
              </button>
              
              <button 
                type="button"
                onClick={handlePublish}
                disabled={saving || data.document.state === 'published'}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-lg font-medium transition disabled:opacity-50"
              >
                발행?기
              </button>

              {data.document.state === 'published' && (
                <button 
                  type="button"
                  onClick={handleWithdraw}
                  disabled={saving}
                  className="w-full bg-red-100 hover:bg-red-200 text-red-700 p-2.5 rounded-lg font-medium transition disabled:opacity-50"
                >
                  발행 취소
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel: Editor */}
      <div className="w-full lg:w-2/3 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold mb-6">편집</h2>
        <form className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">제목 (10~100자)</label>
            <input 
              type="text" 
              value={form.title} 
              onChange={e => setForm({...form, title: e.target.value})} 
              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-emerald-500 outline-none" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">?늘?????(20~180??</label>
            <input 
              type="text" 
              value={form.oneLineText} 
              onChange={e => setForm({...form, oneLineText: e.target.value})} 
              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-emerald-500 outline-none" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">?장 ?도 ?설 (40~500??</label>
            <textarea 
              value={form.marketTemperatureCommentary} 
              onChange={e => setForm({...form, marketTemperatureCommentary: e.target.value})} 
              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-emerald-500 outline-none h-24" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">본문 Markdown</label>
            <textarea 
              value={form.summaryMarkdown} 
              onChange={e => setForm({...form, summaryMarkdown: e.target.value})} 
              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-emerald-500 outline-none h-48 font-mono text-sm" 
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CTA ?목</label>
              <input 
                type="text" 
                value={form.newsletterCtaTitle} 
                onChange={e => setForm({...form, newsletterCtaTitle: e.target.value})} 
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-emerald-500 outline-none" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CTA URL</label>
              <input 
                type="text" 
                value={form.newsletterCtaUrl} 
                onChange={e => setForm({...form, newsletterCtaUrl: e.target.value})} 
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-emerald-500 outline-none" 
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">변??유 (??????수, 8~240??</label>
            <input 
              type="text" 
              value={form.changeSummary} 
              onChange={e => setForm({...form, changeSummary: e.target.value})} 
              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-emerald-500 outline-none bg-blue-50" 
              placeholder="무엇??변경했?? ?약?주?요."
            />
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminBriefingEditor() {
  return (
    <Suspense fallback={<div className="p-8 text-center">로딩 ?..</div>}>
      <EditorContent />
    </Suspense>
  );
}
