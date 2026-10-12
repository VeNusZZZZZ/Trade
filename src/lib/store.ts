"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import Decimal from "decimal.js";
import type { Profile, Quote, Notice, TargetOrder } from "@/types/investment";
import { runDue, applyDividends, applyRealDividends, injectFromSeries, applyRebalance, type RebalanceOrder, type Bar } from "./engine";
import { dateAgo } from "./mock";
import type { ScheduledOrder } from "@/types/investment";
import { D, uid, fmt, buyShares, sellShares, triggered, snapshot, seedProfile } from "./finance";

interface S {
  profiles: Profile[]; activeId: string; prices: Record<string, Quote>; notices: Notice[]; lang: "en" | "he"; fxAt: number; userId: string | null; userEmail: string; deletedIds: string[];
  setActive: (id: string) => void;
  createProfile: (name: string, capital: number) => void;
  cloneProfile: () => void;
  renameProfile: (name: string) => void;
  archiveProfile: () => void;
  resetProfile: () => void;
  adjustCash: (amount: number) => void;
  buy: (symbol: string, usd: number) => boolean;
  sell: (symbol: string, shares: number) => boolean;
  addOrder: (o: Omit<TargetOrder, "id" | "status" | "createdAt">) => void;
  cancelOrder: (id: string) => void;
  setPrices: (q: Quote[]) => void;
  dismiss: (id: string) => void;
  setLang: (l: "en" | "he") => void;
  setUser: (id: string | null, email?: string) => void;
  deleteProfile: (id: string) => void;
  restoreProfile: (id: string) => void;
  replaceProfile: (p: Profile) => void;
  settleDividends: (live: boolean, bars: Record<string, Bar[]>) => void;
  setCurrency: (c: string) => void;
  setSettings: (s: Partial<Pick<Profile, "drip" | "slippage" | "fee">>) => void;
  addSchedule: (r: Omit<ScheduledOrder, "id">) => void;
  removeSchedule: (id: string) => void;
  reconcile: () => void;
  inject: (symbol: string, daysAgo: number, usd: number) => Promise<void>;
  rebalance: (orders: RebalanceOrder[]) => void;
}

const seeds = [{ ...seedProfile("My first profile", 0, []), performanceHistory: [] as Profile["performanceHistory"] }];
const note = (text: string, tone: Notice["tone"]): Notice => ({ id: uid(), text, tone });

export const useStore = create<S>()(
  persist(
    (set, get) => {
      const active = () => get().profiles.find((p) => p.id === get().activeId)!;
      const put = (p: Profile) => set((s) => ({ profiles: s.profiles.map((x) => (x.id === p.id ? { ...p, updatedAt: Date.now() } : x)) }));
      const fee = (r: Profile): Profile => ({ ...r, currentCashBalance: Decimal.max(0, D(r.currentCashBalance).minus(r.fee ?? 0)).toString() });
      const say = (n: Notice) => set((s) => ({ notices: [...s.notices, n] }));
      return {
        profiles: seeds, activeId: seeds[0].id, prices: {}, notices: [], lang: "en", fxAt: 0, userId: null, userEmail: "", deletedIds: [],
        setActive: (id) => set({ activeId: id }),
        createProfile: (name, capital) => {
          const p: Profile = { ...seedProfile(name, capital, []), performanceHistory: [] };
          set((s) => ({ profiles: [...s.profiles, snapshot(p, s.prices)], activeId: p.id }));
        },
        cloneProfile: () => {
          const p = active(); const c: Profile = { ...structuredClone(p), id: uid(), name: `${p.name} copy`, createdAt: Date.now() };
          set((s) => ({ profiles: [...s.profiles, c], activeId: c.id }));
        },
        renameProfile: (name) => put({ ...active(), name: name.trim() || active().name }),
        archiveProfile: () => {
          const rest = get().profiles.filter((p) => !p.archived && p.id !== get().activeId);
          if (!rest.length) return say(note("Keep at least one active profile.", "bad"));
          put({ ...active(), archived: true }); set({ activeId: rest[0].id });
        },
        resetProfile: () => {
          const p = active();
          put(snapshot({ ...p, positions: [], transactions: [], targetPriceOrders: [], currentCashBalance: p.startingCapital, performanceHistory: [] }, get().prices));
        },
        adjustCash: (amount) => {
          const p = active(); const next = D(p.currentCashBalance).plus(amount);
          if (next.lt(0)) return say(note("Not enough cash to withdraw that amount.", "bad"));
          put(snapshot({ ...p, currentCashBalance: next.toString(), startingCapital: Decimal.max(0, D(p.startingCapital).plus(amount)).toString(), transactions: [{ id: uid(), ts: Date.now(), type: amount >= 0 ? "DEPOSIT" : "WITHDRAW", amount: String(Math.abs(amount)) }, ...p.transactions] }, get().prices));
        },
        buy: (symbol, usd) => {
          const q = get().prices[symbol]; if (!q) { say(note("Waiting for a price. Try again in a moment.", "info")); return false; }
          const qty = D(usd).div(q.price).toDecimalPlaces(6, Decimal.ROUND_DOWN);
          const pf = active(); const r = buyShares(pf, symbol, qty, D(q.price).mul(1 + (pf.slippage ?? 0) / 100));
          if (!r) { say(note(`Not enough cash to buy ${fmt(usd)} of ${symbol}.`, "bad")); return false; }
          put(snapshot(fee(r), get().prices)); say(note(`Bought ${qty.toString()} ${symbol} at ${fmt(q.price)}.`, "good")); return true;
        },
        sell: (symbol, shares) => {
          const q = get().prices[symbol]; if (!q) return false;
          const pf = active(); const r = sellShares(pf, symbol, D(shares), D(q.price).mul(1 - (pf.slippage ?? 0) / 100));
          if (!r) { say(note(`You don't hold any ${symbol}.`, "bad")); return false; }
          put(snapshot(fee(r), get().prices)); say(note(`Sold ${symbol} at ${fmt(q.price)}.`, "good")); return true;
        },
        addOrder: (o) => {
          const p = active();
          put({ ...p, targetPriceOrders: [{ ...o, id: uid(), status: "ACTIVE", createdAt: Date.now() }, ...p.targetPriceOrders] });
          say(note(`${o.kind.replace("_", " ").toLowerCase()} order queued for ${o.symbol}.`, "info"));
        },
        cancelOrder: (id) => { const p = active(); put({ ...p, targetPriceOrders: p.targetPriceOrders.map((o) => (o.id === id ? { ...o, status: "CANCELLED" } : o)) }); },
        setPrices: (quotes) => {
          const prices = { ...get().prices }; quotes.forEach((q) => (prices[q.symbol] = q));
          const fresh: Notice[] = [];
          const profiles = get().profiles.map((p) => {
            if (p.archived) return p;
            let cur = p;
            const orders = p.targetPriceOrders.map((o): TargetOrder => {
              const q = prices[o.symbol];
              if (o.status !== "ACTIVE" || !q || !triggered(o, q.price)) return o;
              const label = `${o.kind.replace("_", " ").toLowerCase()} order`;
              const next = o.side === "BUY" ? buyShares(cur, o.symbol, D(o.quantity), D(q.price), label) : sellShares(cur, o.symbol, D(o.quantity), D(q.price), label);
              if (!next) return o;
              cur = next; fresh.push(note(`${p.name}: ${label} filled, ${o.side.toLowerCase()} ${o.symbol} at ${fmt(q.price)}.`, "good"));
              return { ...o, status: "FILLED" };
            });
            return snapshot({ ...cur, targetPriceOrders: orders }, prices);
          });
          set((s) => ({ prices, profiles, notices: [...s.notices, ...fresh] }));
        },
        dismiss: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
        setCurrency: (c) => put({ ...active(), currency: c }),
        setLang: (l) => set({ lang: l }),
        setUser: (id, email = "") => set({ userId: id, userEmail: email }),
        deleteProfile: (id) => set((s) => { const rest = s.profiles.filter((p) => p.id !== id); if (!rest.length) return s; return { profiles: rest, deletedIds: [...s.deletedIds, id], activeId: s.activeId === id ? (rest.find((p) => !p.archived) ?? rest[0]).id : s.activeId }; }),
        restoreProfile: (id) => set((s) => ({ profiles: s.profiles.map((p) => (p.id === id ? { ...p, archived: false, updatedAt: Date.now() } : p)) })),
        replaceProfile: (np) => put(np),
        settleDividends: (live, bars) => {
          let n = 0;
          const profiles = get().profiles.map((p) => { if (p.archived) return p; const r = live ? applyRealDividends(p, bars) : applyDividends(p); n += r.count; const sp = snapshot(r.profile, get().prices); return r.count ? { ...sp, updatedAt: Date.now() } : sp; });
          set({ profiles }); if (n) say(note(`Credited ${n} dividend payment${n > 1 ? "s" : ""}.`, "good"));
        },
        setSettings: (st) => put({ ...active(), ...st }),
        addSchedule: (r) => { const p = active(); put({ ...p, scheduledOrders: [...p.scheduledOrders, { ...r, id: uid() }] }); },
        removeSchedule: (id) => { const p = active(); put({ ...p, scheduledOrders: p.scheduledOrders.filter((r) => r.id !== id) }); },
        reconcile: () => {
          let total = 0;
          const profiles = get().profiles.map((p) => { if (p.archived) return p; const { profile, ran } = runDue(p); total += ran; return ran ? { ...snapshot(profile, get().prices), updatedAt: Date.now() } : profile; });
          set({ profiles }); if (total) say(note(`Caught up ${total} scheduled transaction${total > 1 ? "s" : ""}.`, "info"));
        },
        inject: async (symbol, daysAgo, usd) => {
          try {
            const j = (await (await fetch(`/api/market/historical?symbol=${symbol}&days=${daysAgo + 7}`)).json()) as { source: string; series: Bar[] };
            const r = injectFromSeries(active(), symbol, dateAgo(daysAgo), usd, j.series);
            if (!r) return say(note("No price data for that date. Pick a trading day.", "bad"));
            put(snapshot(r, get().prices)); say(note(`Added ${fmt(usd)} of ${symbol} from ${dateAgo(daysAgo)} using ${j.source === "live" ? "real" : "sample"} prices.`, "good"));
          } catch { say(note("Could not load price history. Try again.", "bad")); }
        },
        rebalance: (orders) => { put(snapshot(applyRebalance(active(), get().prices, orders), get().prices)); say(note("Rebalanced to your targets.", "good")); },
      };
    },
    { name: "mytrader-v2", storage: createJSONStorage(() => localStorage), partialize: (s) => ({ profiles: s.profiles, activeId: s.activeId, lang: s.lang, deletedIds: s.deletedIds }) }
  )
);
