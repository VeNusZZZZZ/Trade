"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { toUsd } from "@/lib/finance";

export default function Welcome() {
  const s = useStore(); const tr = useT(); const [amt, setAmt] = useState("10000");
  const p = s.profiles.find((x) => x.id === s.activeId)!;
  if (+p.currentCashBalance > 0 || p.positions.length || p.transactions.length) return null;
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass space-y-4 p-6 text-center">
      <h2 className="text-2xl font-extrabold">{tr("welcome")}</h2><p className="text-steel">{tr("welcomeSub")}</p>
      <div className="mx-auto flex max-w-xs gap-2">{[["ILS", "₪"], ["USD", "$"]].map(([c, sym]) => <button key={c} onClick={() => s.setCurrency(c)} className={`flex-1 rounded-2xl py-3 text-xl font-extrabold ${p.currency === c ? "bg-paper text-ink" : "bg-white/5"}`}>{sym} {c}</button>)}</div>
      <div className="mx-auto flex max-w-xs gap-2"><input className="field" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} /><button onClick={() => Number(amt) > 0 && s.adjustCash(toUsd(Number(amt)))} className="rounded-xl bg-gain px-6 font-extrabold text-ink">{tr("start")}</button></div>
    </motion.section>
  );
}
