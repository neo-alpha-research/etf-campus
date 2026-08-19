import path from "node:path";
import { NextResponse } from "next/server";
import { loadOfficialEtfFeeIndex } from "@/lib/data/etf-fee-registry";

export const dynamic = "force-static";

export async function GET() {
  const fees = Array.from(
    loadOfficialEtfFeeIndex(path.join(process.cwd(), "data")).entries(),
  ).map(([ticker, fee]) => ({ ticker, ...fee }));

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    total: fees.length,
    items: fees,
  });
}
