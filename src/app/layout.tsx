import type { Metadata } from "next";
import { Heebo, Inter } from "next/font/google";
import "./globals.css";
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const heebo = Heebo({ subsets: ["hebrew", "latin"], variable: "--font-heebo", display: "swap" });
export const metadata: Metadata = { title: "MyTrader: investment simulator", manifest: "/manifest.webmanifest", themeColor: "#0B1117", description: "Practice investing and backtest strategies with simulated money." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en" className={`${inter.variable} ${heebo.variable}`} suppressHydrationWarning><body>{children}</body></html>);
}
