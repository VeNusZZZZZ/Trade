import Decimal from "decimal.js";
import type { Profile, ScheduledOrder, Quote } from "@/types/investment";
import { D, uid, buyShares, sellShares, portfolioValue } from "./finance";
import { mockPriceOnDay, dateAgo } from "./mock";

const DAY = 86_400_000;

/** Catch-up: replays every missed DCA / top-up since lastRunTimestamp, oldest first, at that day's close. */
export function runDue(p: Profile, now = Date.now(), priceFn: (s: string, k: number) => number = mockPriceOnDay): { profile: Profile; ran: number } {
  let cur = p, ran = 0;
  const rules = p.scheduledOrders.map((r): ScheduledOrder => {
    const days = Math.floor((now - r.lastRunTimestamp) / DAY);
    for (let k = days - 1; k >= 0; k--) {
      const dt = new Date(now - k * DAY);
      const hit = r.frequency === "WEEKLY" ? dt.getUTCDay() === r.day : dt.getUTCDate() === r.day;
      if (!hit) continue;
      if (r.kind === "TOPUP") {
        cur = { ...cur, currentCashBalance: D(cur.currentCashBalance).plus(r.amount).toString(), transactions: [{ id: uid(), ts: dt.getTime(), type: "DEPOSIT", amount: r.amount, note: "Scheduled top-up" }, ...cur.transactions] };
      } else if (r.symbol) {
        const px = D(priceFn(r.symbol, k)); if (px.lte(0)) continue;
        const n = buyShares(cur, r.symbol, D(r.amount).div(px).toDecimalPlaces(6, Decimal.ROUND_DOWN), px, "Scheduled DCA");
        if (!n) continue; cur = n;
      }
      ran++;
    }
    return days > 0 ? { ...r, lastRunTimestamp: r.lastRunTimestamp + days * DAY } : r;
  });
  return { profile: { ...cur, scheduledOrders: rules }, ran };
}

/** Time machine: buys at the historical price and layers the position onto the equity curve. */
export function injectHistorical(p: Profile, symbol: string, daysAgo: number, usd: number): Profile | null {
  const px = D(mockPriceOnDay(symbol, daysAgo));
  const qty = D(usd).div(px).toDecimalPlaces(6, Decimal.ROUND_DOWN);
  const start = dateAgo(daysAgo);
  const b = buyShares({ ...p, currentCashBalance: D(p.currentCashBalance).plus(usd).toString() }, symbol, qty, px, `Backtest from ${start}`);
  if (!b) return null;
  const performanceHistory = p.performanceHistory.map((pt) =>
    pt.date < start ? pt : { ...pt, value: +(pt.value + qty.toNumber() * mockPriceOnDay(symbol, Math.floor((Date.now() - Date.parse(pt.date)) / DAY))).toFixed(2) });
  return { ...b, startingCapital: D(p.startingCapital).plus(usd).toString(), performanceHistory };
}

export interface RebalanceOrder { symbol: string; side: "BUY" | "SELL"; usd: number }
export function planRebalance(p: Profile, prices: Record<string, Quote>, targets: Record<string, number>): RebalanceOrder[] {
  const total = portfolioValue(p, prices);
  const syms = Array.from(new Set([...Object.keys(targets), ...p.positions.map((x) => x.symbol)]));
  return syms.map((symbol) => {
    const pos = p.positions.find((x) => x.symbol === symbol);
    const cur = pos ? +pos.quantity * (prices[symbol]?.price ?? 0) : 0;
    const diff = total * ((targets[symbol] ?? 0) / 100) - cur;
    return { symbol, side: diff >= 0 ? ("BUY" as const) : ("SELL" as const), usd: Math.abs(diff) };
  }).filter((o) => o.usd >= 1 && prices[o.symbol]);
}
export function applyRebalance(p: Profile, prices: Record<string, Quote>, orders: RebalanceOrder[]): Profile {
  let cur = p;
  for (const o of [...orders.filter((x) => x.side === "SELL"), ...orders.filter((x) => x.side === "BUY")]) {
    const px = D(prices[o.symbol].price); const qty = D(o.usd).div(px).toDecimalPlaces(6, Decimal.ROUND_DOWN);
    const n = o.side === "SELL" ? sellShares(cur, o.symbol, qty, px, "Rebalance") : buyShares(cur, o.symbol, qty, px, "Rebalance");
    if (n) cur = n;
  }
  return cur;
}

/** 1,000 geometric-Brownian-motion paths, monthly steps; returns 10th/50th/90th percentile per month. */
export function monteCarlo(value: number, annVol: number, years: number, drift = 0.07, n = 1000) {
  const months = Math.round(years * 12), dt = 1 / 12;
  const paths = Array.from({ length: n }, () => {
    let v = value; const out = [v];
    for (let m = 0; m < months; m++) {
      const z = Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
      v *= Math.exp((drift - 0.5 * annVol ** 2) * dt + annVol * Math.sqrt(dt) * z); out.push(v);
    }
    return out;
  });
  return Array.from({ length: months + 1 }, (_, m) => {
    const col = paths.map((p) => p[m]).sort((a, b) => a - b); const q = (f: number) => Math.round(col[Math.floor(f * (n - 1))]);
    return { month: m, p10: q(0.1), p50: q(0.5), p90: q(0.9) };
  });
}

export const SECTOR: Record<string, string> = { AAPL: "Tech", MSFT: "Tech", NVDA: "Tech", GOOGL: "Communication", TSLA: "Consumer", AMZN: "Consumer", KO: "Staples", PG: "Staples", JNJ: "Health", SPY: "Index fund", VOO: "Index fund", QQQ: "Index fund" };
const YIELD: Record<string, number> = { KO: 0.03, JNJ: 0.03, PG: 0.024, AAPL: 0.005, MSFT: 0.008, SPY: 0.013, VOO: 0.013, QQQ: 0.006 };

/** Mock quarterly dividends (15th of Mar/Jun/Sep/Dec). Reinvests into fractional shares when profile.drip is on. */
export function applyDividends(p: Profile, now = Date.now()): { profile: Profile; count: number } {
  const from = p.lastDivTs ?? p.createdAt, days = Math.floor((now - from) / DAY);
  let cur = p, count = 0;
  for (let k = days - 1; k >= 0; k--) {
    const dt = new Date(now - k * DAY);
    if (dt.getUTCDate() !== 15 || dt.getUTCMonth() % 3 !== 2) continue;
    for (const x of p.positions) {
      const y = YIELD[x.symbol]; if (!y) continue;
      const px = D(mockPriceOnDay(x.symbol, k)), cash = D(x.quantity).mul(px).mul(y).div(4).toDecimalPlaces(2);
      if (cash.lte(0)) continue;
      cur = { ...cur, currentCashBalance: D(cur.currentCashBalance).plus(cash).toString(), transactions: [{ id: uid(), ts: dt.getTime(), type: "DIVIDEND", symbol: x.symbol, amount: cash.toString(), note: "Dividend" }, ...cur.transactions] };
      if (cur.drip) { const n = buyShares(cur, x.symbol, cash.div(px).toDecimalPlaces(6, Decimal.ROUND_DOWN), px, "DRIP"); if (n) cur = n; }
      count++;
    }
  }
  return { profile: { ...cur, lastDivTs: days > 0 ? from + days * DAY : from }, count };
}

/** Estimated tax if you sold `shares` today, consuming lots FIFO or LIFO; lots held over 365 days get the long-term rate. */
export function taxSim(p: Profile, symbol: string, shares: number, price: number, method: "FIFO" | "LIFO", st: number, lt: number) {
  const pos = p.positions.find((x) => x.symbol === symbol); if (!pos) return null;
  let lots: { qty: number; price: number; ts: number }[] = [];
  for (const t of [...p.transactions].reverse()) {
    if (t.symbol !== symbol) continue;
    if (t.type === "BUY") lots.push({ qty: +(t.quantity ?? 0), price: +(t.price ?? 0), ts: t.ts });
    else if (t.type === "SELL") { let q = +(t.quantity ?? 0); while (q > 1e-9 && lots.length) { const l = lots[0], u = Math.min(l.qty, q); l.qty -= u; q -= u; if (l.qty <= 1e-9) lots.shift(); } }
  }
  const known = lots.reduce((s, l) => s + l.qty, 0);
  if (+pos.quantity - known > 1e-6) lots.unshift({ qty: +pos.quantity - known, price: +pos.avgCost, ts: p.createdAt - 252 * DAY });
  if (method === "LIFO") lots = lots.reverse();
  let left = Math.min(shares, +pos.quantity), gainST = 0, gainLT = 0;
  for (const l of lots) { if (left <= 0) break; const u = Math.min(l.qty, left); left -= u; const g = (price - l.price) * u; if (Date.now() - l.ts > 365 * DAY) gainLT += g; else gainST += g; }
  const tax = (Math.max(0, gainST) * st + Math.max(0, gainLT) * lt) / 100;
  return { gainST, gainLT, tax, net: gainST + gainLT - tax };
}

export interface Bar { date: string; close: number; div: number }
/** Time machine on real (or sample) bars: buys at the first close on/after `start`, credits every dividend since, and layers value onto the equity curve. */
export function injectFromSeries(p: Profile, symbol: string, start: string, usd: number, series: Bar[]): Profile | null {
  const bars = series.filter((b) => b.date >= start); if (!bars.length) return null;
  const px = D(bars[0].close), qty = D(usd).div(px).toDecimalPlaces(6, Decimal.ROUND_DOWN);
  const first = buyShares({ ...p, currentCashBalance: D(p.currentCashBalance).plus(usd).toString() }, symbol, qty, px, `Backtest from ${bars[0].date}`);
  if (!first) return null;
  let cur: Profile = first;
  let held = qty, cash = D(0); const value: { date: string; v: number }[] = [];
  for (const b of bars) {
    if (b.div > 0) {
      const amt = held.mul(b.div).toDecimalPlaces(2);
      cur = { ...cur, currentCashBalance: D(cur.currentCashBalance).plus(amt).toString(), transactions: [{ id: uid(), ts: Date.parse(b.date), type: "DIVIDEND", symbol, amount: amt.toString(), note: "Dividend" }, ...cur.transactions] };
      const dq = amt.div(b.close).toDecimalPlaces(6, Decimal.ROUND_DOWN), n = p.drip ? buyShares(cur, symbol, dq, D(b.close), "DRIP") : null;
      if (n) { cur = n; held = held.plus(dq); } else cash = cash.plus(amt);
    }
    value.push({ date: b.date, v: held.mul(b.close).plus(cash).toNumber() });
  }
  const hist = [...p.performanceHistory].sort((a, b) => a.date.localeCompare(b.date));
  const baseAt = (d: string) => { let v: number | undefined; for (const h of hist) if (h.date <= d) v = h.value; return v ?? hist[0]?.value ?? +p.currentCashBalance; };
  const performanceHistory = [...hist.filter((h) => h.date < bars[0].date), ...bars.map((b, i) => ({ date: b.date, value: +(baseAt(b.date) + value[i].v).toFixed(2) }))];
  return { ...cur, lastDivTs: Date.now(), startingCapital: D(p.startingCapital).plus(usd).toString(), performanceHistory };
}

/** Rebuilds a demo profile on real history: buys the mix at the first close, then values it daily. */
export function seedFromBars(p: Profile, mix: [string, number][], bars: Record<string, Bar[]>): Profile {
  let cash = D(p.startingCapital);
  const positions = mix.map(([symbol, w]) => {
    const px = D(bars[symbol][0].close), qty = D(p.startingCapital).mul(w).div(px).toDecimalPlaces(6, Decimal.ROUND_DOWN);
    cash = cash.minus(qty.mul(px)); return { symbol, quantity: qty.toString(), avgCost: px.toString() };
  });
  const performanceHistory = bars[mix[0][0]].map((b, i) => ({ date: b.date, value: positions.reduce((s, x) => s.plus(D(x.quantity).mul(bars[x.symbol][Math.min(i, bars[x.symbol].length - 1)].close)), cash).toDecimalPlaces(2).toNumber() }));
  return { ...p, positions, currentCashBalance: cash.toDecimalPlaces(2).toString(), performanceHistory, demoLive: true, lastDivTs: Date.now() };
}

/** Credits real per-share dividends paid since the last check (reinvests when DRIP is on). */
export function applyRealDividends(p: Profile, bars: Record<string, Bar[]>): { profile: Profile; count: number } {
  const from = p.lastDivTs ?? p.createdAt; let cur = p, count = 0;
  const events = p.positions.flatMap((x) => (bars[x.symbol] ?? []).filter((b) => b.div > 0 && Date.parse(b.date) > from).map((b) => ({ symbol: x.symbol, b }))).sort((a, c) => a.b.date.localeCompare(c.b.date));
  for (const { symbol, b } of events) {
    const held = cur.positions.find((q) => q.symbol === symbol); if (!held) continue;
    const amt = D(held.quantity).mul(b.div).toDecimalPlaces(2); if (amt.lte(0)) continue;
    cur = { ...cur, currentCashBalance: D(cur.currentCashBalance).plus(amt).toString(), transactions: [{ id: uid(), ts: Date.parse(b.date), type: "DIVIDEND", symbol, amount: amt.toString(), note: "Dividend" }, ...cur.transactions] };
    if (cur.drip) { const n = buyShares(cur, symbol, amt.div(b.close).toDecimalPlaces(6, Decimal.ROUND_DOWN), D(b.close), "DRIP"); if (n) cur = n; }
    count++;
  }
  return { profile: { ...cur, lastDivTs: Date.now() }, count };
}
