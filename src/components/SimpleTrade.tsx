"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { CATALOG } from "@/lib/catalog";
import { fmt, pct } from "@/lib/finance";
import { Logo } from "./ui";

export default function SimpleTrade({ onPick }: { onPick: (s: string) => void }) {
  const { prices, lang } = useStore(); const tr = useT(); const [q, setQ] = useState("");
  const list = Object.entries(CATALOG).filter(([sym, c]) => `${sym} ${c.name}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <section className="glass p-4 sm:p-6">
      <div className="relative mb-4"><Search size={18} className="pointer-events-none absolute start-3 top-3.5 text-steel" /><input className="field ps-10" placeholder={tr("search")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {list.map(([sym, c]) => {
          const qt = prices[sym]; const ch = qt ? (qt.price / qt.prevClose - 1) * 100 : 0;
          return (
            <motion.button key={sym} whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }} onClick={() => onPick(sym)} className="rounded-2xl bg-white/5 p-4 text-start hover:bg-white/10">
              <Logo domain={c.domain} name={c.name} />
              <p className="mt-3 font-bold">{c.name}</p>
              <p className="mt-1 min-h-[2.5rem] text-xs text-steel">{lang === "he" ? c.he : c.en}</p>
              <div className="mt-2 flex items-center justify-between gap-1"><span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-extrabold">{sym}</span><span className={`text-xs font-bold ${ch >= 0 ? "text-gain" : "text-loss"}`}>{qt ? `${fmt(qt.price)} ${pct(ch)}` : "…"}</span></div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
