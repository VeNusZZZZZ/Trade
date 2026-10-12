"use client";
import { useState } from "react";
import { UserRound, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

export default function AccountButton() {
  const { userId, userEmail } = useStore(); const tr = useT();
  const [open, setOpen] = useState(false); const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [msg, setMsg] = useState("");
  const go = async (up: boolean) => {
    if (!supabase) return; setMsg("");
    const r = up ? await supabase.auth.signUp({ email, password: pw }) : await supabase.auth.signInWithPassword({ email, password: pw });
    if (r.error) setMsg(r.error.message); else if (r.data.session) setOpen(false); else setMsg("Check your email to confirm your account, then sign in.");
  };
  return (
    <>
      <button aria-label={tr("account")} title={tr("account")} onClick={() => setOpen(true)} className={`rounded-lg p-2 hover:bg-white/10 ${userId ? "text-gain" : "text-steel hover:text-paper"}`}><UserRound size={18} /></button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="glass w-full max-w-sm space-y-3 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">{tr("account")}</h2><button aria-label={tr("close")} onClick={() => setOpen(false)}><X size={20} /></button></div>
            {!supabase ? <p className="text-sm text-steel">{tr("syncOff")}</p> : userId ? (
              <><p className="font-semibold">{userEmail}</p><p className="text-sm text-gain">{tr("syncOn")}</p><button onClick={() => supabase!.auth.signOut()} className="w-full rounded-xl bg-white/10 py-2.5 font-bold">{tr("signOut")}</button></>
            ) : (
              <>
                <input className="field" type="email" autoComplete="email" placeholder={tr("email")} value={email} onChange={(e) => setEmail(e.target.value)} />
                <input className="field" type="password" autoComplete="current-password" placeholder={tr("password")} value={pw} onChange={(e) => setPw(e.target.value)} />
                {msg && <p className="text-sm text-amber">{msg}</p>}
                <div className="grid grid-cols-2 gap-2"><button onClick={() => go(false)} className="rounded-xl bg-paper py-2.5 font-bold text-ink">{tr("signIn")}</button><button onClick={() => go(true)} className="rounded-xl bg-white/10 py-2.5 font-bold">{tr("signUp")}</button></div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
