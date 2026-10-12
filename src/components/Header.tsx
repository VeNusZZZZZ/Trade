"use client";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, Archive, Plus, X, LayoutDashboard, BarChart3, Users, GitCompare, Wrench, ShieldAlert, Languages } from "lucide-react";
import { useT } from "@/lib/i18n";
import AccountButton from "./AccountButton";
const ICONS = { dashboard: LayoutDashboard, profiles: Users, analytics: BarChart3, compare: GitCompare, tools: Wrench, insights: ShieldAlert };
import { useStore } from "@/lib/store";
import { RATES } from "@/lib/finance";

type Tab = "dashboard" | "profiles" | "compare" | "analytics" | "tools" | "insights";
export default function Header({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const { lang, setLang, profiles, prices, activeId, setCurrency, setActive, createProfile, cloneProfile, archiveProfile, notices, dismiss } = useStore();
  const tr = useT();
  const list = profiles.filter((p) => !p.archived);
  const live = Object.values(prices).some((q) => q.source === "live");
  useEffect(() => { const t = notices.map((n) => setTimeout(() => dismiss(n.id), 5000)); return () => t.forEach(clearTimeout); }, [notices, dismiss]);
  const add = () => { const name = window.prompt(tr("newProfile")); if (!name) return; const code = (window.prompt("USD / ILS", "ILS") ?? "USD").toUpperCase(); createProfile(name, 0); setCurrency(RATES[code] ? code : "USD"); };
  const tabBtn = (t: Tab, label: string) => (
    <button aria-label={label} title={label} onClick={() => setTab(t)} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${tab === t ? "bg-white/10 text-paper" : "text-steel hover:text-paper"}`}>{(() => { const I = ICONS[t]; return <I size={18} />; })()}<span className="hidden sm:inline">{label}</span></button>
  );
  return (
    <header className="sticky top-0 z-20 -mx-4 mb-6 flex flex-wrap items-center gap-3 border-b border-white/5 bg-ink/80 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      <span className="me-2 text-lg font-extrabold tracking-tight">{lang === "he" ? "הטרייד שלי" : "MyTrader"}</span>
      <nav data-tour="tabs" className="flex gap-1">{tabBtn("dashboard", tr("dashboard"))}{tabBtn("profiles", tr("profiles"))}{tabBtn("compare", tr("compare"))}{tabBtn("analytics", tr("analytics"))}{tabBtn("tools", tr("tools"))}{tabBtn("insights", tr("insights"))}</nav>
      <div className="ms-auto flex items-center gap-2">
        <AccountButton />
        <button aria-label="Language" onClick={() => setLang(lang === "en" ? "he" : "en")} className="flex items-center gap-1 rounded-lg p-2 text-sm font-semibold text-steel hover:bg-white/10 hover:text-paper"><Languages size={18} />{lang === "en" ? "עב" : "EN"}</button>
        <span className="text-xs text-steel">{live ? "Live prices" : "Sample prices"}</span>
        <select aria-label="Display currency" className="field !w-auto" value={profiles.find((p) => p.id === activeId)?.currency ?? "USD"} onChange={(e) => setCurrency(e.target.value)}>{Object.keys(RATES).map((c) => <option key={c}>{c}</option>)}</select>
        <select aria-label="Active profile" className="field !w-auto" value={activeId} onChange={(e) => setActive(e.target.value)}>
          {list.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button aria-label="New profile" title="New profile" onClick={add} className="rounded-lg p-2 text-steel hover:bg-white/10 hover:text-paper"><Plus size={18} /></button>
        <button aria-label="Clone profile" title="Clone profile" onClick={cloneProfile} className="rounded-lg p-2 text-steel hover:bg-white/10 hover:text-paper"><Copy size={18} /></button>
        <button aria-label="Archive profile" title="Archive profile" onClick={archiveProfile} className="rounded-lg p-2 text-steel hover:bg-white/10 hover:text-paper"><Archive size={18} /></button>
      </div>
      <div className="pointer-events-none fixed bottom-4 end-4 z-30 flex w-80 max-w-[90vw] flex-col gap-2" aria-live="polite">
        <AnimatePresence>
          {notices.map((n) => (
            <motion.div key={n.id} layout initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}
              className={`glass pointer-events-auto flex items-start gap-2 p-3 text-sm ${n.tone === "good" ? "border-s-4 !border-s-gain" : n.tone === "bad" ? "border-s-4 !border-s-loss" : "border-s-4 !border-s-amber"}`}>
              <span className="flex-1">{n.text}</span>
              <button aria-label="Dismiss" onClick={() => dismiss(n.id)}><X size={14} /></button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </header>
  );
}
