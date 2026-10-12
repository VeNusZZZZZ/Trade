// Deterministic mock market: same inputs always give the same prices, on server and client.
export const BASE: Record<string, number> = {
  AAPL: 190, MSFT: 410, NVDA: 880, GOOGL: 150, AMZN: 180, TSLA: 200, META: 500, NFLX: 650, AMD: 160, INTC: 30, DIS: 105, NKE: 90, SBUX: 95,
  MCD: 290, KO: 60, PEP: 170, PG: 160, JNJ: 155, JPM: 200, V: 275, WMT: 65, XOM: 115, BA: 180, PYPL: 65, SPY: 520, VOO: 480, QQQ: 440,
};
export const UNIVERSE = Object.keys(BASE);
const hash = (s: string) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const DAY = 86_400_000;
function curve(symbol: string, day: number): number {
  const seed = hash(symbol); const t = day - 20_000;
  return (BASE[symbol] ?? 100) * Math.exp(0.0003 * t + 0.08 * Math.sin(t / 37 + (seed % 7)) + 0.04 * Math.sin(t / 11 + (seed % 5)) + 0.015 * Math.sin(t * 1.7 + (seed % 3)));
}
export function mockPriceOnDay(symbol: string, daysAgo: number): number {
  return Math.round(curve(symbol, Math.floor(Date.now() / DAY) - daysAgo) * 100) / 100;
}
export function mockQuote(symbol: string) {
  const bucket = Math.floor(Date.now() / 300_000);
  const intraday = 1 + 0.002 * Math.sin(bucket * 1.3 + (hash(symbol) % 11));
  return { symbol, price: Math.round(mockPriceOnDay(symbol, 0) * intraday * 100) / 100, prevClose: mockPriceOnDay(symbol, 1), ts: Date.now(), source: "mock" as const };
}
export const dateAgo = (d: number) => new Date(Date.now() - d * DAY).toISOString().slice(0, 10);
