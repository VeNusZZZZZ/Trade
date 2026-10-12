import { NextRequest, NextResponse } from "next/server";
import { mockQuote } from "@/lib/mock";
import type { Quote } from "@/types/investment";

export const dynamic = "force-dynamic";
const TTL = 120_000;
const cache = new Map<string, { t: number; q: Quote }>(); // per instance; shared by all visitors on it

/** One batched Tiingo IEX call for every stale symbol (free tier allows ~50 requests/hour). */
async function live(symbols: string[]): Promise<Map<string, Quote>> {
  const out = new Map<string, Quote>(); const key = process.env.TIINGO_API_KEY;
  if (!key || !symbols.length) return out;
  try {
    const r = await fetch(`https://api.tiingo.com/iex/?tickers=${symbols.join(",")}`, { cache: "no-store", headers: { Authorization: `Token ${key}` } });
    if (!r.ok) return out;
    for (const x of (await r.json()) as { ticker: string; last?: number; tngoLast?: number; prevClose?: number }[]) {
      const price = x.last ?? x.tngoLast; const symbol = x.ticker.toUpperCase();
      if (price) out.set(symbol, { symbol, price, prevClose: x.prevClose ?? price, ts: Date.now(), source: "live" });
    }
  } catch { /* fall back to mock below */ }
  return out;
}

export async function GET(req: NextRequest) {
  const symbols = (req.nextUrl.searchParams.get("symbols") ?? "").split(",").map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z.\-]{1,10}$/.test(s)).slice(0, 40);
  const stale = symbols.filter((s) => { const h = cache.get(s); return !h || Date.now() - h.t >= TTL; });
  const fresh = await live(stale);
  for (const s of stale) cache.set(s, { t: Date.now(), q: fresh.get(s) ?? mockQuote(s) }); // cache misses too, so a rate limit isn't hammered
  return NextResponse.json({ quotes: symbols.map((s) => cache.get(s)!.q) }, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } });
}
