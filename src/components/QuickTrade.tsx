"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue } from "framer-motion";
import { ChevronsRight, TrendingDown, TrendingUp, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { fmt } from "@/lib/finance";
import { useT } from "@/lib/i18n";

const PICKS = ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "KO", "SPY", "QQQ"];
const TRACK = 288, HANDLE = 60;

export default function QuickTrade({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: string }) {
  const s = useStore(); const tr = useT(); const x = useMotionValue(0);
  const p = s.profiles.find((q) => q.id === s.activeId)!;
  const [sym, setSym] = useState("AAPL");
  useEffect(() => { if (open && initial) setSym(initial); }, [open, initial]); const [side, setSide] = useState<"BUY" | "SELL">("BUY"); const [amt, setAmt] = useState(25);
  const buy = side === "BUY", price = s.prices[sym]?.price ?? 0, held = +(p.positions.find((q) => q.symbol === sym)?.quantity ?? 0);
  const usd = buy ? (+p.currentCashBalance * amt) / 100 : (held * price * amt) / 100;
  const go = async () => {
    const ok = buy ? s.buy(sym, usd) : s.sell(sym, (held * amt) / 100);
    animate(x, 0);
    if (ok) { (await import("canvas-confetti")).default({ particleCount: 120, spread: 80, origin: { y: 0.7 } }); onClose(); }
  };
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div className="glass w-full max-w-lg space-y-5 p-6" initial={{ y: 60, scale: 0.96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 60, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 26 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="text-xl font-extrabold">{tr("quickTrade")}</h2><button aria-label="Close" onClick={onClose} className="rounded-full p-2 hover:bg-white/10"><X size={22} /></button></div>
            <div><p className="mb-2 text-sm text-steel">{tr("pick")}</p>
              <div className="grid grid-cols-4 gap-2">{Array.from(new Set([...(initial ? [initial] : []), ...PICKS])).slice(0, 8).map((k) => <motion.button key={k} whileTap={{ scale: 0.92 }} onClick={() => setSym(k)} className={`h-16 rounded-2xl text-sm font-extrabold ${sym === k ? "bg-paper text-ink" : "bg-white/5"}`}>{k}</motion.button>)}</div></div>
            <div className="grid grid-cols-2 gap-3">
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setSide("BUY")} className={`flex h-14 items-center justify-center gap-2 rounded-2xl text-lg font-extrabold ${buy ? "bg-gain text-ink" : "bg-white/5 text-steel"}`}><TrendingUp />{tr("buy")}</motion.button>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setSide("SELL")} className={`flex h-14 items-center justify-center gap-2 rounded-2xl text-lg font-extrabold ${!buy ? "bg-loss text-ink" : "bg-white/5 text-steel"}`}><TrendingDown />{tr("sell")}</motion.button>
            </div>
            <div><p className="text-sm text-steel">{tr("howMuch")} <b className="text-paper">{amt}%</b></p>
              <input type="range" min={0} max={100} value={amt} onChange={(e) => setAmt(Number(e.target.value))} className="w-full" aria-label={tr("howMuch")} />
              <div className="mt-1 flex gap-2">{[25, 50, 75, 100].map((v) => <button key={v} onClick={() => setAmt(v)} className="flex-1 rounded-xl bg-white/5 py-2 text-sm font-bold hover:bg-white/10">{v}%</button>)}</div></div>
            <p className="text-center text-3xl font-extrabold">{fmt(usd)}<span className="block text-sm font-medium text-steel">{price ? (usd / price).toFixed(4) : "0"} {tr("shares")} · {fmt(price)}</span></p>
            <div dir="ltr" className={`relative mx-auto h-[68px] rounded-full ${buy ? "bg-gain/15" : "bg-loss/15"}`} style={{ width: TRACK }}>
              <span className="absolute inset-0 grid place-items-center ps-14 text-sm font-bold text-steel">{tr("slide")}</span>
              <motion.div drag="x" dragConstraints={{ left: 0, right: TRACK - HANDLE - 8 }} dragElastic={0} dragMomentum={false} style={{ x }} whileTap={{ scale: 1.06 }}
                onDragEnd={() => { if (x.get() > TRACK - HANDLE - 24 && usd >= 1) go(); else animate(x, 0); }}
                className={`absolute start-1 top-1 grid h-[60px] w-[60px] cursor-grab place-items-center rounded-full text-ink ${buy ? "bg-gain" : "bg-loss"}`}><ChevronsRight /></motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
