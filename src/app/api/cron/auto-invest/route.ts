import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runDue } from "@/lib/engine";
import type { Profile } from "@/types/investment";

export const dynamic = "force-dynamic";
const DAY = 864e5;
type Bars = { date: string; close: number }[];

/** Weekday cron: runs every signed-in user's due DCA / top-up rules on the server, even when no device is open. */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "missing Supabase env" }, { status: 500 });
  const db = createClient(url, key); const { data: rows } = await db.from("user_state").select("user_id,data");
  let runs = 0;
  for (const row of rows ?? []) {
    const st = row.data as { profiles: Profile[] }; let changed = false; const profiles: Profile[] = [];
    for (const p of st.profiles ?? []) {
      if (p.archived || !p.scheduledOrders?.length) { profiles.push(p); continue; }
      const bars: Record<string, Bars> = {};
      for (const s of new Set(p.scheduledOrders.map((r) => r.symbol).filter((x): x is string => !!x))) {
        try { bars[s] = ((await (await fetch(`${req.nextUrl.origin}/api/market/historical?symbol=${s}&days=400`)).json()) as { series: Bars }).series; } catch { bars[s] = []; }
      }
      const price = (sym: string, k: number) => { const d = new Date(Date.now() - k * DAY).toISOString().slice(0, 10); let v = 0; for (const b of bars[sym] ?? []) { if (b.date <= d) v = b.close; else break; } return v; };
      const r = runDue(p, Date.now(), price); runs += r.ran;
      if (JSON.stringify(r.profile.scheduledOrders) !== JSON.stringify(p.scheduledOrders)) { changed = true; profiles.push({ ...r.profile, updatedAt: Date.now() }); } else profiles.push(p);
    }
    if (changed) await db.from("user_state").update({ data: { ...st, profiles }, updated_at: new Date().toISOString() }).eq("user_id", row.user_id);
  }
  return NextResponse.json({ ok: true, runs });
}
