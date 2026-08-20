import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "운영자 콘솔 | ETF Campus",
  robots: {
    index: false,
    follow: false
  }
};
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {children}
    </div>
  );
}