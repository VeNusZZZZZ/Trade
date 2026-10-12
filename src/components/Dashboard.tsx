"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Area, AreaChart, ReferenceLine, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useStore } from "@/lib/store";
import { Zap } from "lucide-react";
import ProfileCards from "./ProfileCards";
import QuickTrade from "./QuickTrade";
import { Rolling, Skeleton } from "./ui";
import { useT } from "@/lib/i18n";
import SimpleTrade from "./SimpleTrade";
import ChartModal from "./ChartModal";
import Welcome from "./Welcome";
import { UNIVERSE, dateAgo } from "@/lib/mock";
import { D, short, toUsd, fromUsd, curCode, fmt, pct, portfolioValue, dayChange, unrealized, realized, priceOf } from "@/lib/finance";
import type { OrderKind } from "@/types/investment";

const FOMC = ["2025-10-29", "2025-12-10", "2026-01-28", "2026-03-18", "2026-04-29", "2026-06-17", "2026-07-29", "2026-09-16"]; // Fed rate-decision dates
const tone = (n: number) => (n >= 0 ? "text-gain" : "text-loss");

export default function Dashboard() {
  const s = useStore();
  const tr = useT();
  const p = s.profiles.find((x) => x.id === s.activeId)!;
  const total = portfolioValue(p, s.prices), day = dayChange(p, s.prices), unr = unrealized(p, s.prices), rea = realized(p);
  const ret = (total / +p.startingCapital - 1) * 100;
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [type, setType] = useState<"MARKET" | OrderKind>("MARKET");
  const [symbol, setSymbol] = useState("AAPL");
  const [amount, setAmount] = useState("500");
  const [trigger, setTrigger] = useState("");
  const [cash, setCash] = useState("1000");
  const px = s.prices[symbol]?.price;
  const [q, setQ] = useState(false); const [mode, setMode] = useState<"simple" | "advanced">("simple"); const [chart, setChart] = useState<string | null>(null); const [qSym, setQSym] = useState("AAPL"); const loading = Object.keys(s.prices).length === 0; const fired = useRef({ id: "", m: 0 });
  useEffect(() => {
    const m = ret >= 10 ? 10 : ret >= 5 ? 5 : 0; if (loading) return;
    if (fired.current.id !== p.id) { fired.current = { id: p.id, m }; return; }
    if (m > fired.current.m) { fired.current.m = m; import("canvas-confetti").then((c) => c.default({ particleCount: 90, spread: 70, origin: { y: 0.3 } })); }
  }, [ret, loading, p.id]);

  const submit = () => {
    const n = Number(amount); if (!(n > 0)) return;
    if (type === "MARKET") return side === "BUY" ? s.buy(symbol, toUsd(n)) : s.sell(symbol, n);
    const t = toUsd(Number(trigger)); if (!(t > 0)) return;
    const quantity = side === "BUY" ? D(toUsd(n)).div(t).toDecimalPlaces(6, 1).toString() : String(n);
    s.addOrder({ symbol, side, kind: type, quantity, triggerPrice: String(t) });
  };

  return (
    <div className="space-y-6">
    <ProfileCards />
    <QuickTrade open={q} initial={qSym} onClose={() => setQ(false)} />
    <ChartModal symbol={chart} onClose={() => setChart(null)} onTrade={() => { if (chart) setQSym(chart); setChart(null); setQ(true); }} />
    <Welcome />
    <div className="flex w-fit gap-1 rounded-xl bg-white/5 p-1">{(["simple", "advanced"] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={`rounded-lg px-4 py-2 text-sm font-bold ${mode === m ? "bg-paper text-ink" : "text-steel"}`}>{tr(m)}</button>)}</div>
    {mode === "simple" && <SimpleTrade onPick={setChart} />}
    <motion.button data-tour="trade" whileTap={{ scale: 0.94 }} onClick={() => setQ(true)} className="fixed inset-x-0 bottom-6 z-20 mx-auto flex w-fit items-center gap-2 rounded-full bg-gain px-7 py-4 text-lg font-extrabold text-ink shadow-[0_8px_40px_rgba(43,255,136,.35)]"><Zap size={22} />{tr("quickTrade")}</motion.button>
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <section className="glass p-6">
          <p className="text-sm text-steel">{p.name} · {tr("totalValue")}</p>
          {loading ? <Skeleton className="mt-2 h-12 w-64" /> : <p className="mt-1 text-5xl font-extrabold tracking-tight"><Rolling value={total} format={fmt} /></p>}
          <p className={`mt-2 text-sm font-semibold ${tone(day.delta)}`}>{day.delta >= 0 ? "+" : ""}{fmt(day.delta)} ({pct(day.pct)}) {tr("today")}</p>
          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            {[[tr("cash"), fmt(p.currentCashBalance), ""], [tr("totalReturn"), pct(ret), tone(ret)], [tr("unrealized"), fmt(unr), tone(unr)], [tr("realized"), fmt(rea), tone(rea)]].map(([k, v, c]) => (
              <div key={k}><dt className="text-steel">{k}</dt><dd className={`mt-0.5 text-lg font-bold ${c}`}>{v}</dd></div>
            ))}
          </dl>
        </section>

        <section className="glass p-4 sm:p-6">
          <h2 className="mb-3 font-bold">{tr("portfolio")}</h2>
          <div className="relative h-64">{loading && <Skeleton className="absolute inset-0 z-10" />}
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={p.performanceHistory}>
                <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2BFF88" stopOpacity={0.35} /><stop offset="100%" stopColor="#2BFF88" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#7D8EA0", fontSize: 11 }} minTickGap={50} tickLine={false} axisLine={false} />
                <YAxis domain={["auto", "auto"]} tick={{ fill: "#7D8EA0", fontSize: 11 }} tickFormatter={(v: number) => short(v)} width={64} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#121B24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10 }} formatter={(v: number) => [fmt(v), "Value"]} />
                {FOMC.map((f) => <ReferenceLine key={f} x={f} stroke="#F2B84B" strokeDasharray="3 3" label={{ value: "Fed", fill: "#F2B84B", fontSize: 10, position: "top" }} />)}
                <Area type="monotone" dataKey="value" stroke="#2BFF88" strokeWidth={2} fill="url(#g)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="glass overflow-x-auto p-4 sm:p-6">
          <h2 className="mb-3 font-bold">{tr("holdings")}</h2>
          {p.positions.length === 0 ? <p className="text-sm text-steel">No holdings yet. Place a buy order to get started.</p> : (
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-start text-steel"><tr><th className="pb-2 font-medium">Symbol</th><th className="font-medium">Shares</th><th className="font-medium">Avg cost</th><th className="font-medium">Price</th><th className="text-end font-medium">Gain / loss</th></tr></thead>
              <tbody>
                {p.positions.map((x) => { const pr = priceOf(s.prices, x); const g = (pr - +x.avgCost) * +x.quantity; return (
                  <motion.tr layout key={x.symbol} whileHover={{ backgroundColor: "rgba(255,255,255,0.03)" }} className="border-t border-white/5">
                    <td className="py-2.5 font-bold">{x.symbol}</td><td>{(+x.quantity).toFixed(4)}</td><td>{fmt(x.avgCost)}</td><td>{fmt(pr)}</td>
                    <td className={`text-end font-semibold ${tone(g)}`}>{fmt(g)} ({pct((pr / +x.avgCost - 1) * 100)})</td>
                  </motion.tr>); })}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <aside className="space-y-6">
        <section className={`glass space-y-3 p-5 ${mode === "simple" ? "hidden" : ""}`}>
          <h2 className="font-bold">{tr("trade")}</h2>
          <div className="grid grid-cols-2 gap-2">
            {(["BUY", "SELL"] as const).map((v) => <button key={v} onClick={() => setSide(v)} className={`rounded-lg py-2 text-sm font-bold ${side === v ? (v === "BUY" ? "bg-gain text-ink" : "bg-loss text-ink") : "bg-white/5 text-steel"}`}>{tr(v === "BUY" ? "buy" : "sell")}</button>)}
          </div>
          <select className="field" aria-label="Symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)}>{UNIVERSE.map((u) => <option key={u}>{u}</option>)}</select>
          <div className="flex items-center justify-between text-xs text-steel"><span>{tr("marketPrice")} {px ? fmt(px) : "…"}</span><button onClick={() => setChart(symbol)} className="font-bold text-gain">{tr("chart")}</button></div>
          <select className="field" aria-label="Order type" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="MARKET">Market order</option><option value="LIMIT">Limit order</option><option value="STOP">Stop-loss</option><option value="TAKE_PROFIT">Take-profit</option>
          </select>
          <label className="block text-xs text-steel">{side === "BUY" ? `${tr("amount")} (${curCode()})` : tr("shares")}<input className="field mt-1" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          {type !== "MARKET" && <label className="block text-xs text-steel">Trigger price<input className="field mt-1" inputMode="decimal" value={trigger} onChange={(e) => setTrigger(e.target.value)} placeholder={px ? fromUsd(px).toFixed(2) : ""} /></label>}
          <button onClick={submit} className="w-full rounded-lg bg-paper py-2.5 text-sm font-bold text-ink transition-transform hover:-translate-y-0.5 active:translate-y-0">
            {type === "MARKET" ? tr(side === "BUY" ? "buyNow" : "sellNow") : tr("queue")}
          </button>
        </section>

        <section className="glass space-y-2 p-5">
          <h2 className="font-bold">{tr("pending")}</h2>
          {p.targetPriceOrders.filter((o) => o.status === "ACTIVE").length === 0 && <p className="text-sm text-steel">None. Limit, stop and take-profit orders fill automatically when the price is hit.</p>}
          {p.targetPriceOrders.filter((o) => o.status === "ACTIVE").map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
              <span><b>{o.side === "BUY" ? "Buy" : "Sell"} {o.symbol}</b> <span className="text-steel">{o.kind.replace("_", " ").toLowerCase()} at {fmt(o.triggerPrice)}</span></span>
              <button onClick={() => s.cancelOrder(o.id)} className="text-xs text-amber hover:underline">Cancel</button>
            </div>
          ))}
        </section>

        <section className="glass space-y-3 p-5">
          <h2 className="font-bold">{tr("cash")}</h2>
          <input className="field" aria-label="Cash amount" inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} />
          <div className="grid grid-cols-3 gap-2 text-sm font-semibold">
            <button onClick={() => Number(cash) > 0 && s.adjustCash(toUsd(Number(cash)))} className="rounded-lg bg-white/5 py-2 hover:bg-white/10">{tr("deposit")}</button>
            <button onClick={() => Number(cash) > 0 && s.adjustCash(-toUsd(Number(cash)))} className="rounded-lg bg-white/5 py-2 hover:bg-white/10">{tr("withdraw")}</button>
            <button onClick={() => window.confirm("Reset this profile to its starting capital? Holdings and history are cleared.") && s.resetProfile()} className="rounded-lg bg-white/5 py-2 text-loss hover:bg-white/10">{tr("reset")}</button>
          </div>
        </section>
      </aside>
    </div>
    </div>
  );
}
