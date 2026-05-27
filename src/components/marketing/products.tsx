"use client";

import Link from "next/link";
import { Globe2, Repeat, Server, ArrowRight, Check } from "lucide-react";
import { motion } from "framer-motion";
import { FadeIn, StaggerChildren, StaggerItem } from "@/components/animations/fade-in";

const PRODUCTS = [
  {
    slug: "residential-static",
    icon: Globe2,
    name: "Static Residential",
    powered: "Sticky residential network",
    description: "Sticky ISP-grade IPs that stay yours for long-running sessions.",
    speed: "Up to 1 Gbps",
    pool: "5M+ IPs",
    countries: "120+",
    features: [
      "Sticky residential sessions",
      "ISP-level trust score",
      "Country & city targeting",
      "Long-lived session support"
    ],
    gradient: "from-cyan-500 to-blue-600"
  },
  {
    slug: "residential-rotating",
    icon: Repeat,
    name: "Rotating Residential",
    powered: "Global rotating network",
    description: "Massive rotating pool engineered for scraping and automation.",
    speed: "Sub-second rotation",
    pool: "40M+ IPs",
    countries: "195+",
    features: [
      "Automatic IP rotation",
      "Anti-detection optimized",
      "Scraping & automation ready",
      "Session-pinning supported"
    ],
    gradient: "from-violet-500 to-fuchsia-600"
  },
  {
    slug: "datacenter",
    icon: Server,
    name: "Datacenter",
    powered: "Dedicated datacenter network",
    description: "Dedicated datacenter IPs with ultra-low latency and unlimited scaling.",
    speed: "Up to 10 Gbps",
    pool: "Unlimited",
    countries: "60+",
    features: [
      "Dedicated IP addresses",
      "Ultra-low latency",
      "Unlimited concurrent threads",
      "Most affordable per IP"
    ],
    gradient: "from-emerald-500 to-teal-600"
  }
];

export function Products() {
  return (
    <section id="products" className="section bg-ink-50/40">
      <div className="container mx-auto">
        <FadeIn className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Products</p>
          <h2 className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight text-ink-900 text-balance">
            One platform. Every proxy type you need.
          </h2>
          <p className="mt-4 text-lg text-ink-600">
            Static, rotating, datacenter, purpose-built for your toughest data workloads.
          </p>
        </FadeIn>

        <StaggerChildren className="mt-14 grid gap-6 md:grid-cols-3">
          {PRODUCTS.map((p) => {
            const Icon = p.icon;
            return (
              <StaggerItem key={p.slug}>
                <motion.div
                  whileHover={{ y: -6 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="group relative rounded-3xl border border-ink-200 bg-white p-7 shadow-soft hover:shadow-glow transition-shadow h-full flex flex-col"
                >
                  <div
                    className={`absolute inset-x-0 top-0 h-1 rounded-t-3xl bg-gradient-to-r ${p.gradient} opacity-80`}
                  />
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${p.gradient} text-white shadow-glow`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-ink-900">{p.name}</h3>
                  <p className="mt-1 text-xs font-medium text-ink-500">{p.powered}</p>
                  <p className="mt-3 text-sm text-ink-600 leading-relaxed">{p.description}</p>

                  <ul className="mt-5 space-y-2 flex-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-ink-700">
                        <Check className="h-4 w-4 text-brand-500 mt-0.5 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={`/products/${p.slug}`}
                    className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700"
                  >
                    Explore {p.name}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </motion.div>
              </StaggerItem>
            );
          })}
        </StaggerChildren>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink-50 p-2">
      <p className="text-[10px] uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-ink-900">{value}</p>
    </div>
  );
}
