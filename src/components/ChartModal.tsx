"use client";
import { AnimatePresence, motion } from "framer-motion";
import { X, Zap } from "lucide-react";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { CATALOG } from "@/lib/catalog";

export default function ChartModal({ symbol, onClose, onTrade }: { symbol: string | null; onClose: () => void; onTrade: () => void }) {
  const lang = useStore((s) => s.lang); const tr = useT();
  const src = symbol ? `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(symbol)}&interval=D&theme=dark&style=1&locale=${lang === "he" ? "he_IL" : "en"}&hidesidetoolbar=1&withdateranges=1&saveimage=0` : "";
  return (
    <AnimatePresence>
      {symbol && (
        <motion.div className="fixed inset-0 z-50 flex flex-col bg-ink/95 p-3 backdrop-blur sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="flex items-center gap-3">
            <div className="flex-1"><p className="text-lg font-extrabold">{CATALOG[symbol]?.name ?? symbol} <span className="text-steel">{symbol}</span></p></div>
            <button onClick={onTrade} className="flex items-center gap-2 rounded-full bg-gain px-5 py-2.5 font-extrabold text-ink"><Zap size={18} />{tr("trade")}</button>
            <button aria-label={tr("close")} title={tr("close")} onClick={onClose} className="rounded-full bg-white/10 p-3"><X size={20} /></button>
          </div>
          <iframe title={`${symbol} chart`} src={src} className="mt-3 w-full flex-1 rounded-2xl border border-white/10" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
