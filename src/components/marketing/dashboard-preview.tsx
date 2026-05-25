"use client";

import { motion } from "framer-motion";
import { Globe2, Activity, Wifi, KeyRound, Server, BarChart3 } from "lucide-react";
import { FadeIn } from "@/components/animations/fade-in";

export function DashboardPreview() {
  return (
    <section className="section bg-white">
      <div className="container mx-auto">
        <FadeIn className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
            Dashboard
          </p>
          <h2 className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight text-ink-900 text-balance">
            A control plane built for serious data teams.
          </h2>
          <p className="mt-4 text-lg text-ink-600">
            Generate proxies, monitor sessions, track usage and rotate IPs — all in one elegant
            workspace.
          </p>
        </FadeIn>

        <FadeIn delay={0.1} className="mt-12">
          <div className="relative mx-auto max-w-6xl rounded-3xl border border-ink-200 bg-white shadow-soft overflow-hidden">
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-64 w-[700px] rounded-full bg-gradient-to-b from-brand-200/40 to-transparent blur-3xl" />

            {/* Faux app chrome */}
            <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
              <div className="ml-3 flex-1 max-w-xs rounded-md bg-ink-100 px-3 py-1 text-xs text-ink-500">
                app.oforson.dev / dashboard
              </div>
            </div>

            <div className="grid grid-cols-12 gap-0">
              {/* Sidebar */}
              <aside className="col-span-3 border-r border-ink-100 p-4 space-y-1 bg-ink-50/30">
                {[
                  { icon: BarChart3, label: "Overview", active: true },
                  { icon: Globe2, label: "Proxies" },
                  { icon: Activity, label: "Analytics" },
                  { icon: Wifi, label: "Sessions" },
                  { icon: KeyRound, label: "API Keys" },
                  { icon: Server, label: "Billing" }
                ].map(({ icon: Icon, label, active }) => (
                  <div
                    key={label}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                      active
                        ? "bg-white shadow-sm text-brand-700 font-medium"
                        : "text-ink-600"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </div>
                ))}
              </aside>

              {/* Main */}
              <div className="col-span-9 p-6 space-y-5">
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { l: "Active proxies", v: "1,284", d: "+12%" },
                    { l: "Bandwidth", v: "428 GB", d: "+4.2%" },
                    { l: "Active sessions", v: "342", d: "Live" },
                    { l: "Uptime", v: "99.99%", d: "Stable" }
                  ].map((s) => (
                    <div key={s.l} className="rounded-xl border border-ink-100 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-ink-500">{s.l}</p>
                      <p className="mt-1 text-lg font-bold text-ink-900">{s.v}</p>
                      <p className="text-[10px] text-emerald-600 mt-0.5">{s.d}</p>
                    </div>
                  ))}
                </div>

                {/* Chart */}
                <div className="rounded-xl border border-ink-100 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-ink-900">Bandwidth — last 7 days</p>
                    <span className="text-[10px] text-ink-500">428 GB used</span>
                  </div>
                  <svg viewBox="0 0 400 100" className="mt-3 w-full">
                    <defs>
                      <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <motion.path
                      initial={{ pathLength: 0 }}
                      whileInView={{ pathLength: 1 }}
                      transition={{ duration: 1.4 }}
                      viewport={{ once: true }}
                      d="M0,70 C50,60 80,40 120,45 C160,50 180,30 220,35 C260,40 290,20 330,28 C370,33 390,18 400,22"
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="2"
                    />
                    <path
                      d="M0,70 C50,60 80,40 120,45 C160,50 180,30 220,35 C260,40 290,20 330,28 C370,33 390,18 400,22 L400,100 L0,100 Z"
                      fill="url(#g1)"
                    />
                  </svg>
                </div>

                {/* Proxy generator preview */}
                <div className="rounded-xl border border-ink-100 p-4">
                  <p className="text-xs font-medium text-ink-900">Generate proxy</p>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
                    <Pill label="Type" value="Residential" />
                    <Pill label="Country" value="United States" />
                    <Pill label="Session" value="Sticky · 30m" />
                    <button className="rounded-lg bg-gradient-to-br from-brand-500 to-blue-600 px-3 py-2 text-white font-medium shadow-glow">
                      Generate
                    </button>
                  </div>
                  <div className="mt-3 rounded-lg bg-ink-900 px-3 py-2 font-mono text-[10px] text-emerald-300">
                    198.51.100.42:7777:user-session-3a91:••••••••
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink-100 bg-white px-2 py-1.5">
      <p className="text-[9px] uppercase text-ink-500">{label}</p>
      <p className="font-medium text-ink-800 truncate">{value}</p>
    </div>
  );
}
