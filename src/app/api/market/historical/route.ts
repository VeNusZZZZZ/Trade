import { NextRequest, NextResponse } from "next/server";
import { mockPriceOnDay, dateAgo } from "@/lib/mock";

export const dynamic = "force-dynamic";
interface Bar { date: string; close: number; div: number }
const cache = new Map<string, { t: number; body: { symbol: string; source: string; series: Bar[] } }>();
const TTL = 12 * 3_600_000; // history rarely changes; protects the free daily quota

/** Real split-adjusted closes and per-share dividends from Tiingo EOD, or sample data without a key. */
async function live(symbol: string, days: number): Promise<Bar[] | null> {
  const key = process.env.TIINGO_API_KEY; if (!key) return null;
  try {
    const r = await fetch(`https://api.tiingo.com/tiingo/daily/${symbol.replace(".", "-")}/prices?startDate=${dateAgo(days)}&endDate=${dateAgo(0)}`, { cache: "no-store", headers: { Authorization: `Token ${key}` } });
    if (!r.ok) return null;
    const rows = (await r.json()) as { date: string; close: number; divCash: number; splitFactor: number }[];
    if (!rows.length) return null;
    const out: Bar[] = []; let factor = 1; // walk backwards so earlier rows are divided by later splits
    for (let i = rows.length - 1; i >= 0; i--) {
      out.unshift({ date: rows[i].date.slice(0, 10), close: +(rows[i].close / factor).toFixed(4), div: +((rows[i].divCash || 0) / factor).toFixed(6) });
      factor *= rows[i].splitFactor || 1;
    }
    return out;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get("symbol") ?? "SPY").toUpperCase().replace(/[^A-Z.\-]/g, "").slice(0, 10);
  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get("days")) || 252, 5), 3650);
  const key = `${symbol}:${days}`; const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return NextResponse.json(hit.body);
  const real = await live(symbol, days);
  const body = { symbol, source: real ? "live" : "mock", series: real ?? Array.from({ length: days + 1 }, (_, i) => ({ date: dateAgo(days - i), close: mockPriceOnDay(symbol, days - i), div: 0 })) };
  cache.set(key, { t: Date.now(), body });
  return NextResponse.json(body, { headers: { "Cache-Control": "public, s-maxage=3600" } });
}
