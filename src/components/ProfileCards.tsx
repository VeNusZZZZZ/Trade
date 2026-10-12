"use client";
import { motion } from "framer-motion";
import { TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useStore } from "@/lib/store";
import { fmt, pct, portfolioValue } from "@/lib/finance";
import { useT } from "@/lib/i18n";
import { Rolling } from "./ui";

export default function ProfileCards() {
  const { profiles, activeId, setActive, prices } = useStore(); const tr = useT();
  return (
    <div data-tour="profile" className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
      {profiles.filter((p) => !p.archived).map((p) => {
        const ret = +p.startingCapital > 0 ? (portfolioValue(p, prices) / +p.startingCapital - 1) * 100 : 0, up = ret >= 0;
        return (
          <motion.button key={p.id} onClick={() => setActive(p.id)} whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }}
            className={`glass min-w-[220px] shrink-0 p-4 text-start transition-shadow hover:shadow-[0_12px_40px_rgba(43,255,136,.14)] ${p.id === activeId ? "!border-gain/60" : ""}`}>
            <div className="flex items-center justify-between"><span className="flex items-center gap-2 font-bold"><Wallet size={18} />{p.name}</span>{up ? <TrendingUp size={18} className="text-gain" /> : <TrendingDown size={18} className="text-loss" />}</div>
            <p className="mt-3 text-xs text-steel">{tr("cash")}</p>
            <p className="text-2xl font-extrabold"><Rolling value={+p.currentCashBalance} format={fmt} /></p>
            <p className={`mt-1 text-sm font-bold ${up ? "text-gain" : "text-loss"}`}>{pct(ret)}</p>
          </motion.button>
        );
      })}
    </div>
  );
}
