"use client";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useStore } from "@/lib/store";
import { fmt, metrics, pct, portfolioValue, priceOf } from "@/lib/finance";

const COLORS = ["#2BFF88", "#F2B84B", "#7AA2FF", "#FF7A7A", "#B58CFF", "#7D8EA0", "#E8EEF2", "#4FD1C5"];
const tip = { background: "#121B24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10 };

export default function Analytics() {
  const s = useStore(); const he = s.lang === "he"; const L = (e: string, h: string) => (he ? h : e);
  const p = s.profiles.find((x) => x.id === s.activeId)!;
  const total = portfolioValue(p, s.prices), cash = +p.currentCashBalance;
  const rows = p.positions.map((x) => { const v = +x.quantity * priceOf(s.prices, x), cost = +x.quantity * +x.avgCost; return { symbol: x.symbol, v, gain: v - cost, ret: cost ? (v / cost - 1) * 100 : 0 }; });
  const invested = rows.reduce((a, r) => a + r.v, 0);
  const pie = [...rows.map((r) => ({ name: r.symbol, value: Math.round(r.v) })), ...(cash > 0 ? [{ name: L("Cash", "מזומן"), value: Math.round(cash) }] : [])].filter((x) => x.value > 0);
  const ranked = [...rows].sort((a, b) => b.ret - a.ret);
  const hist = p.performanceHistory.map((h) => h.value), m = metrics(hist);
  const daily = hist.slice(1).map((v, i) => (hist[i] ? (v / hist[i] - 1) * 100 : 0));
  const ret = +p.startingCapital > 0 ? (total / +p.startingCapital - 1) * 100 : 0;
  const div = rows.length ? Math.round((1 - rows.reduce((a, r) => a + (invested ? (r.v / invested) ** 2 : 0), 0)) * 100) : 0;
  const sells = p.transactions.filter((t) => t.realized), wins = sells.filter((t) => +(t.realized ?? 0) > 0), losses = sells.length - wins.length;
  const avg = (a: typeof sells) => (a.length ? a.reduce((x, t) => x + +(t.realized ?? 0), 0) / a.length : 0);
  const divs = p.transactions.filter((t) => t.type === "DIVIDEND").reduce((a, t) => a + +t.amount, 0);
  const byMonth = new Map<string, number[]>(); p.performanceHistory.forEach((h) => byMonth.set(h.date.slice(0, 7), [...(byMonth.get(h.date.slice(0, 7)) ?? []), h.value]));
  const monthly = Array.from(byMonth).map(([k, v]) => ({ m: k, r: v[0] ? +((v[v.length - 1] / v[0] - 1) * 100).toFixed(2) : 0 }));
  const Stat = ({ l, v, c = "" }: { l: string; v: string; c?: string }) => <div className="glass p-4"><p className="text-xs text-steel">{l}</p><p className={`mt-1 text-xl font-extrabold ${c}`}>{v}</p></div>;
  const tone = (n: number) => (n >= 0 ? "text-gain" : "text-loss");
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat l={L("Total value", "שווי כולל")} v={fmt(total)} /><Stat l={L("Invested", "מושקע")} v={fmt(invested)} /><Stat l={L("Cash share", "אחוז מזומן")} v={`${total ? Math.round((cash / total) * 100) : 0}%`} /><Stat l={L("Total return", "תשואה כוללת")} v={pct(ret)} c={tone(ret)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass p-5"><h2 className="font-bold">{L("Share of portfolio by symbol", "חלק כל סימול בתיק")}</h2>
          {pie.length ? <><div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pie} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} stroke="none">{pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip contentStyle={tip} formatter={(v: number) => fmt(v)} /></PieChart></ResponsiveContainer></div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-steel">{pie.map((x, i) => <span key={x.name}><span style={{ color: COLORS[i % COLORS.length] }}>●</span> {x.name} {total ? ((x.value / total) * 100).toFixed(1) : 0}%</span>)}</div></> : <p className="mt-3 text-sm text-steel">{L("Nothing to show yet. Add cash or buy a stock.", "אין עדיין מה להציג. הוסף מזומן או קנה מניה.")}</p>}</section>
        <section className="glass p-5"><h2 className="font-bold">{L("Best and worst holdings", "המניות הטובות והחלשות")}</h2>
          <div className="mt-3 space-y-2">{[...ranked.slice(0, 3), ...ranked.slice(-2).filter((r) => !ranked.slice(0, 3).includes(r))].map((r) => <div key={r.symbol} className="flex justify-between rounded-lg bg-white/5 px-3 py-2 text-sm"><b>{r.symbol}</b><span className={tone(r.ret)}>{fmt(r.gain)} ({pct(r.ret)})</span></div>)}{!rows.length && <p className="text-sm text-steel">–</p>}</div></section>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat l={L("Sharpe ratio", "יחס שארפ")} v={m ? m.sharpe.toFixed(2) : "–"} /><Stat l={L("Volatility (yearly)", "תנודתיות שנתית")} v={m ? `${m.vol.toFixed(1)}%` : "–"} /><Stat l={L("Max drawdown", "ירידה מקסימלית")} v={m ? `${m.mdd.toFixed(1)}%` : "–"} c="text-loss" /><Stat l={L("Diversification score", "ציון פיזור")} v={`${div}/100`} />
        <Stat l={L("Best day", "היום הטוב ביותר")} v={daily.length ? pct(Math.max(...daily)) : "–"} c="text-gain" /><Stat l={L("Worst day", "היום הגרוע ביותר")} v={daily.length ? pct(Math.min(...daily)) : "–"} c="text-loss" /><Stat l={L("Win rate", "אחוז הצלחה")} v={sells.length ? `${Math.round((wins.length / sells.length) * 100)}% (${wins.length}/${losses})` : "–"} /><Stat l={L("Dividends received", "דיבידנדים שהתקבלו")} v={fmt(divs)} c="text-gain" />
        <Stat l={L("Avg win", "רווח ממוצע")} v={sells.length ? fmt(avg(wins)) : "–"} c="text-gain" /><Stat l={L("Avg loss", "הפסד ממוצע")} v={losses ? fmt(avg(sells.filter((t) => +(t.realized ?? 0) <= 0))) : "–"} c="text-loss" /><Stat l={L("Trades made", "עסקאות")} v={String(p.transactions.filter((t) => t.type === "BUY" || t.type === "SELL").length)} /><Stat l={L("Holdings", "אחזקות")} v={String(rows.length)} />
      </div>
      <section className="glass p-5"><h2 className="mb-3 font-bold">{L("Monthly return (%)", "תשואה חודשית (%)")}</h2>
        <div className="h-56" dir="ltr"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthly}><CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} /><XAxis dataKey="m" tick={{ fill: "#7D8EA0", fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis tick={{ fill: "#7D8EA0", fontSize: 11 }} width={40} tickLine={false} axisLine={false} /><Tooltip contentStyle={tip} formatter={(v: number) => `${v}%`} /><Bar dataKey="r" radius={[6, 6, 0, 0]}>{monthly.map((x, i) => <Cell key={i} fill={x.r >= 0 ? "#2BFF88" : "#FF7A7A"} />)}</Bar></BarChart></ResponsiveContainer></div></section>
    </div>
  );
}
