"use client";
import { useEffect, useState } from "react";
import { animate, useMotionValue } from "framer-motion";

/** Number that ticks smoothly to its new value instead of snapping. */
export function Rolling({ value, format }: { value: number; format: (n: number) => string }) {
  const mv = useMotionValue(value); const [txt, setTxt] = useState(format(value));
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.8, ease: "easeOut" }); const u = mv.on("change", (v) => setTxt(format(v)));
    return () => { c.stop(); u(); };
  }, [value, mv, format]);
  return <span>{txt}</span>;
}
export const Skeleton = ({ className = "" }: { className?: string }) => <div aria-hidden className={`skeleton ${className}`} />;

export function Logo({ domain, name }: { domain: string; name: string }) {
  const [bad, setBad] = useState(false);
  if (bad) return <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/10 text-lg font-extrabold">{name[0]}</div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`} alt={name} width={48} height={48} loading="lazy" onError={() => setBad(true)} className="h-12 w-12 rounded-xl bg-white object-contain p-1.5" />;
}
