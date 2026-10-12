"use client";
import { useEffect } from "react";
import { useStore } from "./store";
import { UNIVERSE } from "./mock";
import { RATES } from "./finance";
import { seedFromBars, type Bar } from "./engine";
import type { Quote } from "@/types/investment";

const DAY = 864e5;
const isOpen = () => { const n = new Date(); const d = n.getUTCDay(); const m = n.getUTCHours() * 60 + n.getUTCMinutes(); return d > 0 && d < 6 && m >= 810 && m <= 1230; };
const bars = async (sym: string, days: number): Promise<Bar[]> => { try { return ((await (await fetch(`/api/market/historical?symbol=${sym}&days=${days}`)).json()) as { series: Bar[] }).series; } catch { return []; } };

/** Runs once after the first quotes: rebuild demos on real history, then credit dividends (real if live, sample otherwise). */
async function settle(live: boolean) {
  const st = useStore.getState();
  if (!live) return st.settleDividends(false, {});
  for (const p of st.profiles.filter((x) => x.demo && !x.demoLive)) {
    const mix = p.demo!; const b: Record<string, Bar[]> = {};
    for (const [sym] of mix) b[sym] = await bars(sym, 252);
    if (mix.every(([sym]) => b[sym].length > 10)) st.replaceProfile(seedFromBars(p, mix, b));
  }
  const profs = useStore.getState().profiles.filter((x) => !x.archived);
  const syms = Array.from(new Set(profs.flatMap((x) => x.positions.map((q) => q.symbol))));
  const oldest = Math.min(Date.now(), ...profs.map((x) => x.lastDivTs ?? x.createdAt));
  const days = Math.min(3650, Math.max(5, Math.ceil((Date.now() - oldest) / DAY) + 2)); const b: Record<string, Bar[]> = {};
  for (const s of syms) b[s] = await bars(s, days);
  useStore.getState().settleDividends(true, b);
}

export function useMarket() {
  const setPrices = useStore((s) => s.setPrices);
  const held = useStore((s) => s.profiles.flatMap((p) => p.positions.map((x) => x.symbol)).join(","));
  useEffect(() => {
    fetch("/api/fx").then((r) => r.json()).then((j: { rates: Record<string, number> }) => {
      for (const k of Object.keys(RATES)) if (j.rates[k]) RATES[k] = j.rates[k];
      useStore.setState({ fxAt: Date.now() });
    }).catch(() => {});
  }, []);
  useEffect(() => {
    const symbols = Array.from(new Set([...UNIVERSE, ...held.split(",").filter(Boolean)])); let first = true;
    const tick = async () => {
      if (!first && !isOpen()) return; const wasFirst = first; first = false;
      try { const q = ((await (await fetch(`/api/market/quote?symbols=${symbols.join(",")}`)).json()) as { quotes: Quote[] }).quotes; setPrices(q); if (wasFirst) await settle(q.some((x) => x.source === "live")); } catch { /* keep last prices */ }
    };
    tick(); const id = setInterval(tick, 180_000); return () => clearInterval(id);
  }, [held, setPrices]);
}
