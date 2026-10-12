"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Header from "@/components/Header";
import Dashboard from "@/components/Dashboard";
import Compare from "@/components/Compare";
import Tools from "@/components/Tools";
import Extras from "@/components/Extras";
import Tour from "@/components/Tour";
import Profiles from "@/components/Profiles";
import Analytics from "@/components/Analytics";
import { useSync } from "@/lib/sync";
import { setDisplay } from "@/lib/finance";
import { useStore } from "@/lib/store";
import { useMarket } from "@/lib/useMarket";

export default function Home() {
  const [ready, setReady] = useState(false); // hydration guard: localStorage is client-only
  const [tab, setTab] = useState<"dashboard" | "profiles" | "compare" | "analytics" | "tools" | "insights">("dashboard");
  useEffect(() => {
    setReady(true);
    navigator.serviceWorker?.register("/sw.js").catch(() => {});
  }, []);
  useMarket();
  useSync();
  const lang = useStore((s) => s.lang);
  useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = lang === "he" ? "rtl" : "ltr"; }, [lang]);
  setDisplay(useStore((s) => s.profiles.find((p) => p.id === s.activeId)?.currency ?? "USD"));
  if (!ready) return <div className="min-h-screen" />;
  return (
    <main className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
      <Header tab={tab} setTab={setTab} />
      <Tour />
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 14, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} transition={{ type: "spring", stiffness: 260, damping: 28 }}>
          {tab === "dashboard" ? <Dashboard /> : tab === "compare" ? <Compare /> : tab === "tools" ? <Tools /> : tab === "profiles" ? <Profiles onOpen={() => setTab("dashboard")} /> : tab === "analytics" ? <Analytics /> : <Extras />}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
