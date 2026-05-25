"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Globe2, Activity, Wifi, Zap } from "lucide-react";
import { WorldMap } from "./world-map";
import { cn } from "@/utils/cn";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Full-bleed animated world map */}
      <WorldMap />

      {/* Gradient vignettes so text stays readable */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#060e1a] to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#060e1a] to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-[#060e1a]/30 pointer-events-none" />

      {/* Main hero content */}
      <div className="relative z-10 w-full container mx-auto px-6 pt-24 pb-32">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85 }}
          className="max-w-4xl mx-auto text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 backdrop-blur-sm px-4 py-1.5 text-xs font-medium text-cyan-300 shadow-lg">
            <Sparkles className="h-3.5 w-3.5" />
            Residential, ISP & datacenter proxies — one dashboard
          </div>

          <h1 className="mt-6 text-balance text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.05]">
            Global{" "}
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Residential & Datacenter
            </span>
            <br className="hidden sm:block" /> Proxies
          </h1>

          <p className="mt-6 max-w-2xl mx-auto text-balance text-lg text-slate-300 leading-relaxed">
            Fast, scalable, and reliable proxy infrastructure for scraping, automation,
            verification, anonymous browsing, and enterprise data collection.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 h-12 px-7 text-base font-semibold rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white transition-colors shadow-lg shadow-cyan-500/25"
            >
              Get started <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center h-12 px-7 text-base font-semibold rounded-xl border border-white/20 bg-white/5 backdrop-blur text-white hover:bg-white/10 transition-colors"
            >
              View pricing
            </Link>
          </div>

          <div className="mt-6 flex items-center justify-center gap-6 text-xs text-slate-400">
            <span>No credit card required</span>
            <span>•</span>
            <span>Cancel anytime</span>
            <span>•</span>
            <span>Set up in minutes</span>
          </div>
        </motion.div>
      </div>

      {/*
        ---------------------------------------------------------------
        HIDDEN: floating live-metric cards + status pill.
        These show placeholder statistics (active IP counts, uptime,
        bandwidth/s). Restore by un-commenting the block below once the
        figures are backed by real network telemetry.
        ---------------------------------------------------------------
      */}
      {/*
      <FloatingCard
        className="hidden lg:flex absolute left-8 xl:left-16 top-1/2 -translate-y-12 animate-float"
        icon={<Globe2 className="h-4 w-4 text-cyan-400" />}
        label="Active IPs"
        value="45.2M"
        delta="+2.4%"
      />
      <FloatingCard
        className="hidden lg:flex absolute right-8 xl:right-16 top-1/2 -translate-y-24 animate-float [animation-delay:1s]"
        icon={<Activity className="h-4 w-4 text-emerald-400" />}
        label="Network uptime"
        value="99.99%"
        delta="Stable"
      />
      <FloatingCard
        className="hidden lg:flex absolute left-8 xl:left-16 top-1/2 translate-y-16 animate-float [animation-delay:2s]"
        icon={<Wifi className="h-4 w-4 text-blue-400" />}
        label="Countries"
        value="195+"
        delta="Global"
      />
      <FloatingCard
        className="hidden lg:flex absolute right-8 xl:right-16 top-1/2 translate-y-8 animate-float [animation-delay:1.5s]"
        icon={<Zap className="h-4 w-4 text-amber-400" />}
        label="Bandwidth/s"
        value="3.4 TB"
        delta="+12%"
      />

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md px-5 py-2 text-xs text-slate-300 whitespace-nowrap">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        All systems operational &mdash; last checked 30s ago
      </div>
      */}
    </section>
  );
}

interface FloatingCardProps {
  className?: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  delta: string;
}

/**
 * Floating live-metric card used in the hero. Currently unused — the hero's
 * metric cards are hidden until the figures are backed by real telemetry.
 * Kept so the cards can be restored by un-commenting the block above.
 */
// eslint-disable-next-line no-unused-vars
function FloatingCard({ className, icon, label, value, delta }: FloatingCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl px-4 py-3 shadow-2xl",
        className
      )}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">{label}</p>
        <p className="text-sm font-bold text-white">{value}</p>
        <p className="text-[10px] text-emerald-400">{delta}</p>
      </div>
    </div>
  );
}
