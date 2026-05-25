"use client";

import { Search, ShoppingCart, BarChart3, Megaphone, Bot, Briefcase, Shield, Database } from "lucide-react";
import { FadeIn, StaggerChildren, StaggerItem } from "@/components/animations/fade-in";

const CASES = [
  { icon: Search, title: "Web scraping", body: "Bypass rate limits and geo-blocks at scale.", color: "from-cyan-500 to-blue-600" },
  { icon: ShoppingCart, title: "Sneaker bots", body: "Run high-volume drops without IP burnout.", color: "from-rose-500 to-orange-500" },
  { icon: BarChart3, title: "SEO monitoring", body: "Track SERPs from any location in real time.", color: "from-violet-500 to-fuchsia-600" },
  { icon: Megaphone, title: "Ad verification", body: "Audit ads served in every geography you ship.", color: "from-emerald-500 to-teal-600" },
  { icon: Bot, title: "Social automation", body: "Manage hundreds of accounts safely.", color: "from-amber-500 to-orange-500" },
  { icon: Briefcase, title: "Market research", body: "Pull pricing and reviews at competitor scale.", color: "from-blue-500 to-indigo-600" },
  { icon: Shield, title: "Cybersecurity testing", body: "Red-team safely from rotating residential IPs.", color: "from-slate-500 to-ink-700" },
  { icon: Database, title: "Data aggregation", body: "Feed pipelines with clean, geo-tagged datasets.", color: "from-pink-500 to-rose-600" }
];

export function UseCases() {
  return (
    <section className="section bg-white">
      <div className="container mx-auto">
        <FadeIn className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Use cases</p>
          <h2 className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight text-ink-900">
            Trusted across data-driven workflows.
          </h2>
        </FadeIn>

        <StaggerChildren className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {CASES.map(({ icon: Icon, title, body, color }) => (
            <StaggerItem key={title}>
              <div className="group relative overflow-hidden rounded-2xl border border-ink-200 bg-white p-6 shadow-soft hover:-translate-y-1 transition-all">
                <div
                  className={`absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br ${color} opacity-10 blur-2xl group-hover:opacity-20 transition`}
                />
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${color} text-white shadow-soft`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-semibold text-ink-900">{title}</h3>
                <p className="mt-1 text-sm text-ink-600 leading-relaxed">{body}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerChildren>
      </div>
    </section>
  );
}
