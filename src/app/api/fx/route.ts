import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
let cache: { t: number; rates: Record<string, number> } | null = null;
// Free ECB reference rates via Frankfurter (no key). Cached 6 hours.
export async function GET() {
  if (!cache || Date.now() - cache.t > 6 * 3_600_000) {
    for (const url of ["https://api.frankfurter.dev/v1/latest?base=USD", "https://api.frankfurter.app/latest?from=USD"]) {
      try { const r = await fetch(url, { cache: "no-store" }); if (r.ok) { cache = { t: Date.now(), rates: { USD: 1, ...((await r.json()) as { rates: Record<string, number> }).rates } }; break; } } catch { /* try next */ }
    }
  }
  return NextResponse.json({ rates: cache?.rates ?? {} }, { headers: { "Cache-Control": "public, s-maxage=21600" } });
}
