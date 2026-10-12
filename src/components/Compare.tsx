"use client";
import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useStore } from "@/lib/store";
import { benchmark, metrics, fmt, pct } from "@/lib/finance";

const COLORS = ["#2BFF88", "#F2B84B", "#7AA2FF", "#FF6B6B", "#7D8EA0"];

export default function Compare() {
  const { profiles, prices } = useStore();
  const list = profiles.filter((p) => !p.archived);
  const [sel, setSel] = useState<string[]>(list.slice(0, 2).map((p) => p.id));
  const toggle = (id: string) => setSel((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length < 4 ? [...c, id] : c));

  const series = useMemo(() => {
    const chosen = list.filter((p) => sel.includes(p.id)).map((p) => ({ name: p.name, pts: p.performanceHistory, p }));
    return [...chosen, { name: "SPY buy & hold", pts: benchmark(), p: null }];
  }, [list, sel]);

  const data = useMemo(() => {
    const dates = Array.from(new Set(series.flatMap((s) => s.pts.map((x) => x.date)))).sort();
    return dates.map((date) => {
      const row: Record<string, number | string> = { date };
      series.forEach((s) => { const base = s.pts[0]?.value; const pt = s.pts.find((x) => x.date === date); if (pt && base) row[s.name] = +((pt.value / base - 1) * 100).toFixed(2); });
      return row;
    });
  }, [series]);

  return (
    <div className="space-y-6">
      <section className="glass flex flex-wrap items-center gap-2 p-4">
        <span className="me-2 text-sm text-steel">Compare up to 4 profiles</span>
        {list.map((p) => <button key={p.id} onClick={() => toggle(p.id)} aria-pressed={sel.includes(p.id)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${sel.includes(p.id) ? "bg-paper text-ink" : "bg-white/5 text-steel hover:text-paper"}`}>{p.name}</button>)}
      </section>

      <section className="glass p-4 sm:p-6">
        <h2 className="mb-3 font-bold">Return since start (%)</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#7D8EA0", fontSize: 11 }} minTickGap={50} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#7D8EA0", fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} width={48} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#121B24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10 }} formatter={(v: number) => `${v}%`} />
              <Legend />
              {series.map((s, i) => <Line key={s.name} dataKey={s.name} stroke={COLORS[i % COLORS.length]} strokeWidth={s.p ? 2 : 1.5} strokeDasharray={s.p ? undefined : "5 4"} dot={false} connectNulls />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="glass overflow-x-auto p-4 sm:p-6">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-start text-steel"><tr><th className="pb-2 font-medium">Strategy</th><th className="font-medium">Return</th><th className="font-medium">Net profit</th><th className="font-medium">Sharpe</th><th className="font-medium">Volatility</th><th className="font-medium">Max drawdown</th><th className="font-medium">Win / loss</th><th className="font-medium">Best / worst</th></tr></thead>
          <tbody>
            {series.map((s, i) => {
              const m = metrics(s.pts.map((x) => x.value));
              const sells = s.p?.transactions.filter((t) => t.realized) ?? [];
              const wins = sells.filter((t) => +(t.realized ?? 0) > 0).length;
              const ranked = (s.p?.positions ?? []).map((x) => ({ sym: x.symbol, g: ((prices[x.symbol]?.price ?? +x.avgCost) / +x.avgCost - 1) * 100 })).sort((a, b) => b.g - a.g);
              return (
                <tr key={s.name} className="border-t border-white/5">
                  <td className="py-2.5 font-bold" style={{ color: COLORS[i % COLORS.length] }}>{s.name}</td>
                  <td>{m ? pct(m.ret) : "–"}</td><td>{m ? fmt(m.total) : "–"}</td><td>{m ? m.sharpe.toFixed(2) : "–"}</td>
                  <td>{m ? `${m.vol.toFixed(1)}%` : "–"}</td><td>{m ? `${m.mdd.toFixed(1)}%` : "–"}</td>
                  <td>{s.p ? (sells.length ? `${wins} / ${sells.length - wins}` : "No sells yet") : "–"}</td>
                  <td>{ranked.length ? `${ranked[0].sym} / ${ranked[ranked.length - 1].sym}` : "–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
