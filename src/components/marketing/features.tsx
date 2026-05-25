"use client";

import {
  Zap,
  Globe2,
  Repeat,
  Wifi,
  BarChart3,
  KeyRound,
  ShieldCheck,
  Activity
} from "lucide-react";
import { FadeIn, StaggerChildren, StaggerItem } from "@/components/animations/fade-in";

const FEATURES = [
  { icon: Zap, title: "Scales with you", body: "Add proxies or bandwidth as your workload grows — no rate-limit surprises." },
  { icon: Globe2, title: "Global IP coverage", body: "Country and city-level targeting across a broad global IP footprint." },
  { icon: Repeat, title: "Fast rotation", body: "Sub-second IP rotation tuned for anti-detection." },
  { icon: Wifi, title: "Sticky sessions", body: "Pin a session to one IP for long-running, account-bound workflows." },
  { icon: BarChart3, title: "Real-time analytics", body: "Live dashboards for usage, errors, and country mix." },
  { icon: KeyRound, title: "API access", body: "Generate, rotate, and manage proxies programmatically." },
  { icon: ShieldCheck, title: "Secure by design", body: "Encrypted credentials, audit logging, and role-based access controls." },
  { icon: Activity, title: "High availability", body: "Resilient routing with continuous health checks." }
];

export function Features() {
  return (
    <section className="section bg-ink-50/40">
      <div className="container mx-auto">
        <FadeIn className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Features</p>
          <h2 className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight text-ink-900">
            Built for scale. Designed for clarity.
          </h2>
          <p className="mt-4 text-lg text-ink-600">
            Every primitive a high-throughput data team needs — without enterprise overhead.
          </p>
        </FadeIn>

        <StaggerChildren className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <StaggerItem key={title}>
              <div className="group rounded-2xl border border-ink-200 bg-white p-6 shadow-soft hover:shadow-glow hover:-translate-y-1 transition-all">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-blue-50 text-brand-600 group-hover:from-brand-500 group-hover:to-blue-600 group-hover:text-white transition-colors">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-base font-semibold text-ink-900">{title}</h3>
                <p className="mt-1 text-sm text-ink-600 leading-relaxed">{body}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerChildren>
      </div>
    </section>
  );
}
