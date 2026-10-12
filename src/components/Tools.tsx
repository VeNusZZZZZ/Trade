"use client";
import { useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useStore } from "@/lib/store";
import { UNIVERSE, mockPriceOnDay, dateAgo } from "@/lib/mock";
import { fmt, portfolioValue, metrics, toUsd, curCode, short } from "@/lib/finance";
import { planRebalance, monteCarlo } from "@/lib/engine";

type Sub = "auto" | "time" | "rebalance" | "monte";
const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const Label = ({ t, children }: { t: string; children: React.ReactNode }) => <label className="block text-xs text-steel">{t}<div className="mt-1">{children}</div></label>;
const Btn = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => <button onClick={onClick} className="rounded-lg bg-paper px-4 py-2.5 text-sm font-bold text-ink transition-transform hover:-translate-y-0.5">{children}</button>;

export default function Tools() {
  const s = useStore();
  const p = s.profiles.find((x) => x.id === s.activeId)!;
  const [sub, setSub] = useState<Sub>("auto");
  // automation
  const [kind, setKind] = useState<"DCA" | "TOPUP">("DCA"); const [sym, setSym] = useState("AAPL"); const [amt, setAmt] = useState("100");
  const [freq, setFreq] = useState<"WEEKLY" | "MONTHLY">("MONTHLY"); const [day, setDay] = useState("1"); const [back, setBack] = useState("90");
  // time machine
  const [tmSym, setTmSym] = useState("TSLA"); const [tmDate, setTmDate] = useState(dateAgo(365)); const [tmUsd, setTmUsd] = useState("5000");
  const daysAgo = Math.max(1, Math.floor((Date.now() - Date.parse(tmDate)) / 864e5));
  // rebalance
  const total = portfolioValue(p, s.prices);
  const curW = (u: string) => { const x = p.positions.find((q) => q.symbol === u); return x && total ? Math.round(((+x.quantity * (s.prices[u]?.price ?? 0)) / total) * 100) : 0; };
  const [tg, setTg] = useState<Record<string, string>>({});
  const targets = Object.fromEntries(UNIVERSE.map((u) => [u, Number(tg[u] ?? curW(u)) || 0]));
  const sum = Object.values(targets).reduce((a, b) => a + b, 0);
  const orders = planRebalance(p, s.prices, targets);
  // monte carlo
  const [years, setYears] = useState(1); const [mc, setMc] = useState<ReturnType<typeof monteCarlo>>([]);
  const vol = metrics(p.performanceHistory.map((x) => x.value))?.vol ?? 18;

  const addRule = () => {
    const a = Number(amt), d = Number(day); if (!(a > 0) || Number.isNaN(d)) return;
    s.addSchedule({ kind, symbol: kind === "DCA" ? sym : undefined, amount: String(toUsd(a)), frequency: freq, day: freq === "WEEKLY" ? Math.min(6, Math.max(0, d)) : Math.min(28, Math.max(1, d)), lastRunTimestamp: Date.now() - (Number(back) || 0) * 864e5 });
    s.reconcile();
  };
  const sb = (k: Sub, l: string) => <button onClick={() => setSub(k)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${sub === k ? "bg-white/10" : "text-steel hover:text-paper"}`}>{l}</button>;

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-1">{sb("auto", "Automation")}{sb("time", "Time machine")}{sb("rebalance", "Rebalance")}{sb("monte", "Monte Carlo")}</nav>

      {sub === "auto" && (
        <section className="glass grid gap-6 p-5 md:grid-cols-2">
          <div className="space-y-3">
            <h2 className="font-bold">Recurring rule for {p.name}</h2>
            <Label t="Type"><select className="field" value={kind} onChange={(e) => setKind(e.target.value as "DCA" | "TOPUP")}><option value="DCA">Invest a fixed amount (DCA)</option><option value="TOPUP">Add cash</option></select></Label>
            {kind === "DCA" && <Label t="Symbol"><select className="field" value={sym} onChange={(e) => setSym(e.target.value)}>{UNIVERSE.map((u) => <option key={u}>{u}</option>)}</select></Label>}
            <Label t={`Amount (${curCode()})`}><input className="field" value={amt} onChange={(e) => setAmt(e.target.value)} /></Label>
            <div className="grid grid-cols-2 gap-2">
              <Label t="Repeats"><select className="field" value={freq} onChange={(e) => { setFreq(e.target.value as "WEEKLY" | "MONTHLY"); setDay(e.target.value === "WEEKLY" ? "1" : "1"); }}><option value="MONTHLY">Monthly</option><option value="WEEKLY">Weekly</option></select></Label>
              <Label t={freq === "WEEKLY" ? "Weekday (0 = Sunday)" : "Day of month (1-28)"}><input className="field" value={day} onChange={(e) => setDay(e.target.value)} /></Label>
            </div>
            <Label t="Start: days ago (negative = in the future)"><input className="field" value={back} onChange={(e) => setBack(e.target.value)} /></Label>
            <Btn onClick={addRule}>Add rule and run catch-up</Btn>
            <p className="text-xs text-steel">Signed in with cloud sync? Rules also run on the server every weekday, even when the app is closed.</p>
          </div>
          <div className="space-y-2">
            <h2 className="font-bold">Active rules</h2>
            {p.scheduledOrders.length === 0 && <p className="text-sm text-steel">No rules yet. Missed runs are replayed at historical prices whenever you open the app.</p>}
            {p.scheduledOrders.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
                <span>{r.kind === "DCA" ? `Invest ${fmt(r.amount)} in ${r.symbol}` : `Add ${fmt(r.amount)} cash`} <span className="text-steel">{r.frequency === "WEEKLY" ? `every ${WD[r.day]}` : `on day ${r.day} monthly`}</span></span>
                <button className="text-xs text-amber hover:underline" onClick={() => s.removeSchedule(r.id)}>Remove</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {sub === "time" && (
        <section className="glass max-w-xl space-y-3 p-5">
          <h2 className="font-bold">What if you had invested back then?</h2>
          <Label t="Symbol"><select className="field" value={tmSym} onChange={(e) => setTmSym(e.target.value)}>{UNIVERSE.map((u) => <option key={u}>{u}</option>)}</select></Label>
          <Label t="Date"><input type="date" className="field" value={tmDate} max={dateAgo(1)} onChange={(e) => setTmDate(e.target.value)} /></Label>
          <Label t={`Amount (${curCode()})`}><input className="field" value={tmUsd} onChange={(e) => setTmUsd(e.target.value)} /></Label>
          <p className="text-sm text-steel">Latest price {fmt(s.prices[tmSym]?.price ?? mockPriceOnDay(tmSym, 0))}</p>
          <Btn onClick={() => Number(tmUsd) > 0 && s.inject(tmSym, daysAgo, toUsd(Number(tmUsd)))}>Add to {p.name}</Btn>
          <p className="text-xs text-steel">Your equity curve is rebuilt from that date. With a Tiingo key this uses real split-adjusted closes and the dividends paid since that date. Without one it uses sample data.</p>
        </section>
      )}

      {sub === "rebalance" && (
        <section className="glass grid gap-6 p-5 md:grid-cols-2">
          <div>
            <h2 className="mb-3 font-bold">Target allocation (%)</h2>
            <div className="grid grid-cols-3 gap-2">{UNIVERSE.map((u) => <Label key={u} t={u}><input className="field" inputMode="decimal" value={tg[u] ?? String(curW(u))} onChange={(e) => setTg({ ...tg, [u]: e.target.value })} /></Label>)}</div>
            <p className={`mt-3 text-sm ${sum > 100 ? "text-loss" : "text-steel"}`}>{sum}% allocated · {Math.max(0, 100 - sum)}% cash</p>
          </div>
          <div className="space-y-2">
            <h2 className="font-bold">Orders needed</h2>
            {orders.length === 0 && <p className="text-sm text-steel">Already on target.</p>}
            {orders.map((o) => <div key={o.symbol} className="flex justify-between rounded-lg bg-white/5 px-3 py-2 text-sm"><b>{o.side === "BUY" ? "Buy" : "Sell"} {o.symbol}</b><span className={o.side === "BUY" ? "text-gain" : "text-loss"}>{fmt(o.usd)}</span></div>)}
            <Btn onClick={() => sum <= 100 && s.rebalance(orders)}>Rebalance now</Btn>
          </div>
        </section>
      )}

      {sub === "monte" && (
        <section className="glass space-y-4 p-5">
          <div className="flex flex-wrap items-end gap-3">
            <Label t="Horizon"><select className="field" value={years} onChange={(e) => setYears(Number(e.target.value))}><option value={0.5}>6 months</option><option value={1}>1 year</option><option value={5}>5 years</option></select></Label>
            <Btn onClick={() => setMc(monteCarlo(total, vol / 100, years))}>Run 1,000 simulations</Btn>
            <span className="pb-2 text-xs text-steel">Uses {vol.toFixed(1)}% annual volatility from this profile and a 7% expected return.</span>
          </div>
          {mc.length > 0 && (<>
            <div className="h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={mc}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "#7D8EA0", fontSize: 11 }} tickFormatter={(m: number) => `${m}m`} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#7D8EA0", fontSize: 11 }} domain={["auto", "auto"]} tickFormatter={(v: number) => short(v)} width={64} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#121B24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10 }} formatter={(v: number) => fmt(v)} /><Legend />
              <Line dataKey="p90" name="Optimistic (90th)" stroke="#2BFF88" dot={false} /><Line dataKey="p50" name="Median" stroke="#E8EEF2" dot={false} /><Line dataKey="p10" name="Pessimistic (10th)" stroke="#FF6B6B" dot={false} />
            </LineChart></ResponsiveContainer></div>
            <p className="text-sm text-steel">After {years < 1 ? "6 months" : `${years} year${years > 1 ? "s" : ""}`}: {fmt(mc[mc.length - 1].p10)} to {fmt(mc[mc.length - 1].p90)}, median {fmt(mc[mc.length - 1].p50)}.</p>
          </>)}
        </section>
      )}
    </div>
  );
}
