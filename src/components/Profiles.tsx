"use client";
import { Archive, Copy, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { RATES, fmt, pct, portfolioValue, setDisplay } from "@/lib/finance";
import type { Profile } from "@/types/investment";

export default function Profiles({ onOpen }: { onOpen: () => void }) {
  const s = useStore(); const tr = useT();
  const act = s.profiles.find((p) => p.id === s.activeId)!;
  const money = (p: Profile, v: number) => { setDisplay(p.currency); const t = fmt(v); setDisplay(act.currency); return t; };
  const add = () => { const name = window.prompt(tr("newProfile")); if (!name) return; const code = (window.prompt("USD / ILS", "ILS") ?? "USD").toUpperCase(); s.createProfile(name, 0); s.setCurrency(RATES[code] ? code : "USD"); };
  const ico = "rounded-lg p-2 text-steel hover:bg-white/10 hover:text-paper";
  const card = (p: Profile, archived: boolean) => {
    const v = portfolioValue(p, s.prices), ret = +p.startingCapital > 0 ? (v / +p.startingCapital - 1) * 100 : 0;
    return (
      <div key={p.id} className={`glass space-y-3 p-4 ${p.id === s.activeId ? "!border-gain/60" : ""}`}>
        <div className="flex items-center justify-between"><b className="text-lg">{p.name}</b><span className={`text-sm font-bold ${ret >= 0 ? "text-gain" : "text-loss"}`}>{pct(ret)}</span></div>
        <p className="text-2xl font-extrabold">{money(p, v)}</p>
        <p className="text-xs text-steel">{tr("cash")} {money(p, +p.currentCashBalance)} · {p.positions.length} {tr("holdings")}</p>
        <div className="flex flex-wrap items-center gap-1">
          {!archived && <button onClick={() => { s.setActive(p.id); onOpen(); }} className="rounded-lg bg-paper px-3 py-2 text-sm font-bold text-ink">{tr("open")}</button>}
          {!archived && <select aria-label="Currency" className="field !w-auto !py-1.5" value={p.currency} onChange={(e) => { s.setActive(p.id); s.setCurrency(e.target.value); }}>{Object.keys(RATES).map((c) => <option key={c}>{c}</option>)}</select>}
          {!archived && <button title={tr("rename")} aria-label={tr("rename")} className={ico} onClick={() => { const n = window.prompt(tr("rename"), p.name); if (n) { s.setActive(p.id); s.renameProfile(n); } }}><Pencil size={18} /></button>}
          {!archived && <button title={tr("clone")} aria-label={tr("clone")} className={ico} onClick={() => { s.setActive(p.id); s.cloneProfile(); }}><Copy size={18} /></button>}
          {!archived && <button title={tr("archive")} aria-label={tr("archive")} className={ico} onClick={() => { s.setActive(p.id); s.archiveProfile(); }}><Archive size={18} /></button>}
          {archived && <button title={tr("restore")} aria-label={tr("restore")} className={ico} onClick={() => s.restoreProfile(p.id)}><RotateCcw size={18} /></button>}
          <button title={tr("del")} aria-label={tr("del")} className={`${ico} hover:!text-loss`} onClick={() => window.confirm(`${tr("del")} "${p.name}"?`) && s.deleteProfile(p.id)}><Trash2 size={18} /></button>
        </div>
      </div>
    );
  };
  const live = s.profiles.filter((p) => !p.archived), old = s.profiles.filter((p) => p.archived);
  const out = (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><h2 className="text-xl font-extrabold">{tr("profiles")}</h2><button onClick={add} className="flex items-center gap-2 rounded-full bg-gain px-5 py-2.5 font-extrabold text-ink"><Plus size={18} />{tr("newProfile")}</button></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{live.map((p) => card(p, false))}</div>
      {old.length > 0 && <><h3 className="font-bold text-steel">{tr("archived")}</h3><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{old.map((p) => card(p, true))}</div></>}
    </div>
  );
  setDisplay(act.currency);
  return out;
}
