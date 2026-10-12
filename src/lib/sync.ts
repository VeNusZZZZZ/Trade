"use client";
import { useEffect } from "react";
import { useStore } from "./store";
import { supabase } from "./supabase";
import type { Profile } from "@/types/investment";

interface Snap { profiles: Profile[]; deletedIds: string[] }
const sig = (profiles: Profile[], del: string[]) => profiles.map((p) => `${p.id}:${p.updatedAt ?? 0}`).sort().join() + "|" + [...del].sort().join();
const pristine = (p: Profile) => !p.updatedAt && !p.transactions.length && !p.positions.length && +p.currentCashBalance === 0;

/** Per-profile merge: the newest edit of each profile wins, deletions propagate, and an untouched default profile never pollutes an existing account. */
export function mergeState(local: Snap, remote: Snap): Snap {
  const del = Array.from(new Set([...local.deletedIds, ...(remote.deletedIds ?? [])]));
  const mine = remote.profiles?.length ? local.profiles.filter((p) => !pristine(p)) : local.profiles;
  const map = new Map<string, Profile>();
  for (const p of [...(remote.profiles ?? []), ...mine]) {
    if (del.includes(p.id)) continue;
    const o = map.get(p.id); if (!o || (p.updatedAt ?? 0) >= (o.updatedAt ?? 0)) map.set(p.id, p);
  }
  return { profiles: Array.from(map.values()), deletedIds: del };
}

/** Sign-in state + cross-device sync. Price refreshes never trigger a push, so a stale device can't overwrite fresh edits. */
export function useSync() {
  const user = useStore((s) => s.userId); const setUser = useStore((s) => s.setUser);
  useEffect(() => {
    if (!supabase) { useStore.getState().reconcile(); return; }
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user.id ?? null, data.session?.user.email ?? ""); if (!data.session) useStore.getState().reconcile(); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user.id ?? null, s?.user.email ?? ""));
    return () => sub.subscription.unsubscribe();
  }, [setUser]);
  useEffect(() => {
    if (!supabase || !user) return;
    const db = supabase; let applying = false, lastSig = "", timer: ReturnType<typeof setTimeout>;
    const syncNow = async () => {
      const st = useStore.getState();
      const { data, error } = await db.from("user_state").select("data").eq("user_id", user).maybeSingle();
      if (error) return; // never overwrite the cloud copy after a failed read
      const remote = (data?.data ?? { profiles: [], deletedIds: [] }) as Snap;
      const m = mergeState({ profiles: st.profiles, deletedIds: st.deletedIds }, remote);
      const ms = sig(m.profiles, m.deletedIds);
      if (m.profiles.length && ms !== sig(st.profiles, st.deletedIds)) {
        applying = true;
        useStore.setState({ profiles: m.profiles, deletedIds: m.deletedIds, activeId: m.profiles.some((p) => p.id === st.activeId) ? st.activeId : (m.profiles.find((p) => !p.archived) ?? m.profiles[0]).id });
        applying = false;
      }
      if (ms !== sig(remote.profiles ?? [], remote.deletedIds ?? [])) await db.from("user_state").upsert({ user_id: user, data: m, updated_at: new Date().toISOString() });
      lastSig = ms;
    };
    syncNow().then(() => useStore.getState().reconcile());
    const unsub = useStore.subscribe((s) => { if (applying || sig(s.profiles, s.deletedIds) === lastSig) return; clearTimeout(timer); timer = setTimeout(syncNow, 1200); });
    const vis = () => { if (document.visibilityState === "visible") syncNow(); };
    const poll = setInterval(syncNow, 15_000); document.addEventListener("visibilitychange", vis);
    return () => { unsub(); clearInterval(poll); clearTimeout(timer); document.removeEventListener("visibilitychange", vis); };
  }, [user]);
}
