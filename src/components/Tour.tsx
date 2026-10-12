"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useT, type Key } from "@/lib/i18n";

const STEPS: [string, Key][] = [["profile", "tour1"], ["trade", "tour2"], ["tabs", "tour3"]];
export default function Tour() {
  const tr = useT(); const [i, setI] = useState(-1); const [r, setR] = useState<DOMRect | null>(null);
  useEffect(() => { try { if (!localStorage.getItem("mytrader-tour")) setI(0); } catch { /* ignore */ } }, []);
  useEffect(() => {
    if (i < 0) return;
    const place = () => setR(document.querySelector(`[data-tour="${STEPS[i][0]}"]`)?.getBoundingClientRect() ?? null);
    place(); window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [i]);
  const done = () => { try { localStorage.setItem("mytrader-tour", "1"); } catch { /* ignore */ } setI(-1); };
  if (i < 0 || !r) return null;
  const last = i === STEPS.length - 1;
  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      <motion.span className="absolute h-5 w-5 rounded-full bg-gain" style={{ top: r.top + r.height / 2 - 10, left: r.left + r.width / 2 - 10 }} animate={{ scale: [1, 2.2, 1], opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.6 }} />
      <div className="glass pointer-events-auto absolute max-w-xs p-4 text-sm" style={{ top: Math.min(r.bottom + 16, window.innerHeight - 170), left: Math.max(12, Math.min(r.left, window.innerWidth - 300)) }}>
        <p>{tr(STEPS[i][1])}</p>
        <div className="mt-3 flex items-center gap-2"><button onClick={() => (last ? done() : setI(i + 1))} className="rounded-lg bg-gain px-4 py-2 font-bold text-ink">{last ? tr("done") : tr("next")}</button><button onClick={done} className="px-3 text-steel">{tr("skip")}</button></div>
      </div>
    </div>
  );
}
