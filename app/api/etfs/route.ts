import { NextResponse } from "next/server";
import { loadEtfs } from "@/lib/data/etf-repository";

export const dynamic = "force-static";

export async function GET() {
  const etfs = loadEtfs();
  return NextResponse.json(etfs);
}
