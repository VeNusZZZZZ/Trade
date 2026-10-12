import Decimal from "decimal.js";
import type { Profile, Position, Quote, TargetOrder, PerformancePoint } from "@/types/investment";
import { mockPriceOnDay, dateAgo } from "./mock";

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });
export const D = (v: Decimal.Value) => new Decimal(v);
export const uid = () => Math.random().toString(36).slice(2, 10);
// Values are stored in USD; display currency is a per-profile view setting (sample FX rates, update as needed).
export const RATES: Record<string, number> = { USD: 1, EUR: 0.92, GBP: 0.79, JPY: 155, ILS: 3.7, CAD: 1.37, AUD: 1.5, CHF: 0.88 };
let disp = "USD";
export const setDisplay = (c: string) => { disp = RATES[c] ? c : "USD"; };
export const short = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: disp, notation: "compact", maximumFractionDigits: 1 }).format(v * RATES[disp]);
export const toUsd = (n: number) => n / RATES[disp];
export const fromUsd = (n: number) => n * RATES[disp];
export const curCode = () => disp;
export const fmt = (v: Decimal.Value) => new Intl.NumberFormat("en-US", { style: "currency", currency: disp }).format(D(v).mul(RATES[disp]).toDecimalPlaces(2).toNumber());
export const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
export const today = () => new Date().toISOString().slice(0, 10);

export function buyShares(p: Profile, symbol: string, qty: Decimal, price: Decimal, note = ""): Profile | null {
  const cost = qty.mul(price).toDecimalPlaces(2);
  if (qty.lte(0) || cost.gt(p.currentCashBalance)) return null;
  const ex = p.positions.find((x) => x.symbol === symbol);
  let positions: Position[];
  if (ex) {
    const nq = D(ex.quantity).plus(qty);
    const avg = D(ex.quantity).mul(ex.avgCost).plus(cost).div(nq);
    positions = p.positions.map((x) => (x === ex ? { ...x, quantity: nq.toString(), avgCost: avg.toString() } : x));
  } else positions = [...p.positions, { symbol, quantity: qty.toString(), avgCost: price.toString() }];
  return {
    ...p, positions, currentCashBalance: D(p.currentCashBalance).minus(cost).toString(),
    transactions: [{ id: uid(), ts: Date.now(), type: "BUY", symbol, quantity: qty.toString(), price: price.toString(), amount: cost.toString(), note }, ...p.transactions],
  };
}

export function sellShares(p: Profile, symbol: string, qty: Decimal, price: Decimal, note = ""): Profile | null {
  const ex = p.positions.find((x) => x.symbol === symbol);
  if (!ex || qty.lte(0)) return null;
  const q = Decimal.min(qty, ex.quantity);
  const proceeds = q.mul(price).toDecimalPlaces(2);
  const realized = price.minus(ex.avgCost).mul(q).toDecimalPlaces(2);
  const left = D(ex.quantity).minus(q);
  const positions = left.lte(0.000001) ? p.positions.filter((x) => x !== ex) : p.positions.map((x) => (x === ex ? { ...x, quantity: left.toString() } : x));
  return {
    ...p, positions, currentCashBalance: D(p.currentCashBalance).plus(proceeds).toString(),
    transactions: [{ id: uid(), ts: Date.now(), type: "SELL", symbol, quantity: q.toString(), price: price.toString(), amount: proceeds.toString(), realized: realized.toString(), note }, ...p.transactions],
  };
}

export const triggered = (o: TargetOrder, price: number) =>
  o.kind === "LIMIT" && o.side === "BUY" ? price <= +o.triggerPrice
  : o.kind === "STOP" ? price <= +o.triggerPrice
  : price >= +o.triggerPrice; // sell limit / take-profit

export const priceOf = (prices: Record<string, Quote>, pos: Position) => prices[pos.symbol]?.price ?? +pos.avgCost;

export function portfolioValue(p: Profile, prices: Record<string, Quote>): number {
  return p.positions.reduce((s, x) => s.plus(D(x.quantity).mul(priceOf(prices, x))), D(p.currentCashBalance)).toDecimalPlaces(2).toNumber();
}
export function dayChange(p: Profile, prices: Record<string, Quote>) {
  const delta = p.positions.reduce((s, x) => { const q = prices[x.symbol]; return q ? s.plus(D(x.quantity).mul(q.price - q.prevClose)) : s; }, D(0)).toNumber();
  const base = portfolioValue(p, prices) - delta;
  return { delta, pct: base ? (delta / base) * 100 : 0 };
}
export function unrealized(p: Profile, prices: Record<string, Quote>) {
  return p.positions.reduce((s, x) => s.plus(D(priceOf(prices, x)).minus(x.avgCost).mul(x.quantity)), D(0)).toNumber();
}
export function realized(p: Profile) {
  return p.transactions.reduce((s, t) => (t.realized ? s.plus(t.realized) : s), D(0)).toNumber();
}
export function snapshot(p: Profile, prices: Record<string, Quote>): Profile {
  const pt: PerformancePoint = { date: today(), value: portfolioValue(p, prices) };
  const h = p.performanceHistory.filter((x) => x.date !== pt.date);
  return { ...p, performanceHistory: [...h, pt] };
}

/** Builds a profile whose equity curve is back-filled from mock history (days of holding). */
export function seedProfile(name: string, capital: number, mix: [string, number][], days = 252): Profile {
  let cash = D(capital);
  const positions: Position[] = mix.map(([symbol, w]) => {
    const price = mockPriceOnDay(symbol, days);
    const qty = D(capital).mul(w).div(price).toDecimalPlaces(6, Decimal.ROUND_DOWN);
    cash = cash.minus(qty.mul(price));
    return { symbol, quantity: qty.toString(), avgCost: String(price) };
  });
  const history: PerformancePoint[] = [];
  for (let d = days; d >= 0; d--) {
    const v = positions.reduce((s, x) => s.plus(D(x.quantity).mul(mockPriceOnDay(x.symbol, d))), cash);
    history.push({ date: dateAgo(d), value: v.toDecimalPlaces(2).toNumber() });
  }
  return { id: uid(), name, currency: "USD", currentCashBalance: cash.toDecimalPlaces(2).toString(), startingCapital: String(capital), createdAt: Date.now(), archived: false, positions, transactions: [], scheduledOrders: [], targetPriceOrders: [], performanceHistory: history };
}
export const benchmark = (days = 252): PerformancePoint[] =>
  Array.from({ length: days + 1 }, (_, i) => ({ date: dateAgo(days - i), value: mockPriceOnDay("SPY", days - i) }));

export function metrics(v: number[]) {
  if (v.length < 3) return null;
  const r = v.slice(1).map((x, i) => x / v[i] - 1);
  const m = r.reduce((a, b) => a + b, 0) / r.length;
  const sd = Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / (r.length - 1));
  let peak = v[0], mdd = 0;
  for (const x of v) { peak = Math.max(peak, x); mdd = Math.min(mdd, x / peak - 1); }
  return { sharpe: sd ? (m / sd) * Math.sqrt(252) : 0, vol: sd * Math.sqrt(252) * 100, mdd: mdd * 100, total: v[v.length - 1] - v[0], ret: (v[v.length - 1] / v[0] - 1) * 100 };
}
