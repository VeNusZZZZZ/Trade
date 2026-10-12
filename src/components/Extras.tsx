"use client";
import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useStore } from "@/lib/store";
import { fmt, pct, portfolioValue, priceOf, D } from "@/lib/finance";
import { SECTOR, taxSim } from "@/lib/engine";

const COLORS = ["#2BFF88", "#F2B84B", "#7AA2FF", "#FF6B6B", "#B58CFF", "#7D8EA0", "#E8EEF2"];
const L = ({ t, children }: { t: string; children: React.ReactNode }) => <label className="block text-xs text-steel">{t}<div className="mt-1">{children}</div></label>;

export default function Extras() {
  const s = useStore();
  const p = s.profiles.find((x) => x.id === s.activeId)!;
  const [sub, setSub] = useState<"risk" | "tax" | "costs" | "share">("risk");
  const total = portfolioValue(p, s.prices);
  const vals = p.positions.map((x) => ({ symbol: x.symbol, sector: SECTOR[x.symbol] ?? "Other", v: +x.quantity * priceOf(s.prices, x) }));
  const bySector: Record<string, number> = { Cash: +p.currentCashBalance };
  vals.forEach((x) => (bySector[x.sector] = (bySector[x.sector] ?? 0) + x.v));
  const pie = Object.entries(bySector).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value: Math.round(value) }));
  const [thr, setThr] = useState("25"); const [shock, setShock] = useState<Record<string, number>>({});
  const impact = vals.map((x) => ({ ...x, d: (x.v * (shock[x.sector] ?? 0)) / 100 })).sort((a, b) => a.d - b.d);
  const dTotal = impact.reduce((a, b) => a + b.d, 0);
  const [tSym, setTSym] = useState(p.positions[0]?.symbol ?? "AAPL"); const [tSh, setTSh] = useState("1");
  const [method, setMethod] = useState<"FIFO" | "LIFO">("FIFO"); const [st, setSt] = useState("32"); const [lt, setLt] = useState("15");
  const tax = taxSim(p, tSym, Number(tSh) || 0, s.prices[tSym]?.price ?? 0, method, Number(st) || 0, Number(lt) || 0);
  const divs = p.transactions.filter((t) => t.type === "DIVIDEND").reduce((a, t) => a.plus(t.amount), D(0)).toNumber();
  const ret = +p.startingCapital > 0 ? (total / +p.startingCapital - 1) * 100 : 0;

  const card = () => {
    const c = document.createElement("canvas"); c.width = 1080; c.height = 600; const g = c.getContext("2d")!;
    g.fillStyle = "#0B1117"; g.fillRect(0, 0, 1080, 600); g.fillStyle = "#2BFF88"; g.fillRect(0, 0, 12, 600);
    g.fillStyle = "#7D8EA0"; g.font = "600 28px sans-serif"; g.fillText(`${p.name} on MyTrader`, 60, 80);
    g.fillStyle = "#E8EEF2"; g.font = "800 96px sans-serif"; g.fillText(fmt(total), 60, 200);
    g.fillStyle = ret >= 0 ? "#2BFF88" : "#FF6B6B"; g.font = "700 44px sans-serif"; g.fillText(`${pct(ret)} since start`, 60, 270);
    const sells = p.transactions.filter((t) => t.realized), wins = sells.filter((t) => +(t.realized ?? 0) > 0).length;
    g.fillStyle = "#7D8EA0"; g.font = "600 28px sans-serif"; g.fillText(sells.length ? `Win rate ${Math.round((wins / sells.length) * 100)}% on ${sells.length} sells` : "Top holdings", 60, 340);
    g.fillStyle = "#E8EEF2"; g.font = "600 32px sans-serif";
    [...vals].sort((a, b) => b.v - a.v).slice(0, 3).forEach((h, i) => g.fillText(`${h.symbol}   ${fmt(h.v)}`, 60, 400 + i * 52));
    const a = document.createElement("a"); a.download = `${p.name}.png`; a.href = c.toDataURL("image/png"); a.click();
  };
  const tab = (k: typeof sub, l: string) => <button onClick={() => setSub(k)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${sub === k ? "bg-white/10" : "text-steel hover:text-paper"}`}>{l}</button>;

  return (
    <div className="space-y-6">
      <nav className="flex gap-1">{tab("risk", "Risk and what-if")}{tab("tax", "Tax")}{tab("costs", "Costs and dividends")}{tab("share", "Share card")}</nav>

      {sub === "risk" && (
        <section className="glass grid gap-6 p-5 md:grid-cols-2">
          <div>
            <h2 className="font-bold">Allocation by sector</h2>
            <div className="h-56"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} stroke="none">{pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip contentStyle={{ background: "#121B24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10 }} formatter={(v: number) => fmt(v)} /></PieChart></ResponsiveContainer></div>
            <div className="flex flex-wrap gap-x-4 text-xs text-steel">{pie.map((x, i) => <span key={x.name}><span style={{ color: COLORS[i % COLORS.length] }}>●</span> {x.name} {total ? Math.round((x.value / total) * 100) : 0}%</span>)}</div>
            <div className="mt-4 max-w-[10rem]"><L t="Warn when one holding exceeds (%)"><input className="field" value={thr} onChange={(e) => setThr(e.target.value)} /></L></div>
            {vals.filter((x) => total && (x.v / total) * 100 > Number(thr)).map((x) => <p key={x.symbol} className="mt-2 rounded-lg bg-amber/10 px-3 py-2 text-sm text-amber">{x.symbol} is {Math.round((x.v / total) * 100)}% of your portfolio.</p>)}
          </div>
          <div className="space-y-3">
            <h2 className="font-bold">What if a sector moves?</h2>
            {Array.from(new Set(vals.map((x) => x.sector))).map((sec) => (
              <label key={sec} className="block text-sm">{sec}: <b>{shock[sec] ?? 0}%</b>
                <input type="range" min={-30} max={30} value={shock[sec] ?? 0} onChange={(e) => setShock({ ...shock, [sec]: Number(e.target.value) })} className="w-full accent-[#2BFF88]" /></label>
            ))}
            {vals.length === 0 && <p className="text-sm text-steel">Add holdings to test scenarios.</p>}
            <p className={`text-lg font-bold ${dTotal >= 0 ? "text-gain" : "text-loss"}`}>{fmt(dTotal)} ({pct(total ? (dTotal / total) * 100 : 0)})</p>
            {impact.filter((x) => x.d < 0).slice(0, 3).map((x) => <p key={x.symbol} className="text-sm text-steel">Most exposed: {x.symbol} {fmt(x.d)}</p>)}
          </div>
        </section>
      )}

      {sub === "tax" && (
        <section className="glass max-w-xl space-y-3 p-5">
          <h2 className="font-bold">Tax if you sold today</h2>
          <div className="grid grid-cols-2 gap-2">
            <L t="Symbol"><select className="field" value={tSym} onChange={(e) => setTSym(e.target.value)}>{p.positions.map((x) => <option key={x.symbol}>{x.symbol}</option>)}</select></L>
            <L t="Shares"><input className="field" value={tSh} onChange={(e) => setTSh(e.target.value)} /></L>
            <L t="Lot method"><select className="field" value={method} onChange={(e) => setMethod(e.target.value as "FIFO" | "LIFO")}><option>FIFO</option><option>LIFO</option></select></L>
            <div className="grid grid-cols-2 gap-2"><L t="Short-term %"><input className="field" value={st} onChange={(e) => setSt(e.target.value)} /></L><L t="Long-term %"><input className="field" value={lt} onChange={(e) => setLt(e.target.value)} /></L></div>
          </div>
          {tax ? <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-steel">Short-term gain</dt><dd className="font-bold">{fmt(tax.gainST)}</dd></div><div><dt className="text-steel">Long-term gain</dt><dd className="font-bold">{fmt(tax.gainLT)}</dd></div><div><dt className="text-steel">Estimated tax</dt><dd className="font-bold text-loss">{fmt(tax.tax)}</dd></div><div><dt className="text-steel">After-tax gain</dt><dd className="font-bold text-gain">{fmt(tax.net)}</dd></div></dl> : <p className="text-sm text-steel">Hold a position to simulate a sale.</p>}
          <p className="text-xs text-steel">Estimate only, not tax advice. Demo holdings count as bought 252 days ago.</p>
        </section>
      )}

      {sub === "costs" && (
        <section className="glass max-w-xl space-y-3 p-5">
          <h2 className="font-bold">Trading friction for {p.name}</h2>
          <div className="grid grid-cols-2 gap-2" key={p.id}>
            <L t="Slippage on market orders (%)"><input className="field" defaultValue={p.slippage ?? 0} onBlur={(e) => s.setSettings({ slippage: Math.min(2, Math.max(0, Number(e.target.value) || 0)) })} /></L>
            <L t="Commission per trade (USD)"><input className="field" defaultValue={p.fee ?? 0} onBlur={(e) => s.setSettings({ fee: Math.max(0, Number(e.target.value) || 0) })} /></L>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!p.drip} onChange={(e) => s.setSettings({ drip: e.target.checked })} className="accent-[#2BFF88]" />Reinvest dividends into more shares (DRIP)</label>
          <p className="text-sm text-steel">Dividends received: <b className="text-paper">{fmt(divs)}</b>. Payouts are quarterly and use sample yields until a data provider is connected.</p>
        </section>
      )}

      {sub === "share" && (
        <section className="glass max-w-xl space-y-3 p-5">
          <h2 className="font-bold">Share card</h2>
          <p className="text-sm text-steel">Saves a 1080 × 600 image with your value, return and top holdings.</p>
          <button onClick={card} className="rounded-lg bg-paper px-4 py-2.5 text-sm font-bold text-ink">Download image</button>
        </section>
      )}
    </div>
  );
}
