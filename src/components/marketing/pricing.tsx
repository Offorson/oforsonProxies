"use client";

import Link from "next/link";
import { Check, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";
import { PRICING_PLANS } from "@/constants/plans";
import { cn } from "@/utils/cn";
import { FadeIn } from "@/components/animations/fade-in";

export function Pricing() {
  return (
    <section id="pricing" className="section bg-ink-50/40">
      <div className="container mx-auto">
        <FadeIn className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Pricing</p>
          <h2 className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight text-ink-900">
            Pay only for what you use.
          </h2>
          <p className="mt-4 text-lg text-ink-600">
            Every order is priced live and scales with volume build your
            package in the dashboard and the price updates as you go.
          </p>
        </FadeIn>

        <div className="mt-12 grid gap-6 lg:grid-cols-4">
          {PRICING_PLANS.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              whileHover={{ y: -6 }}
              className={cn(
                "relative rounded-3xl border bg-white p-7 shadow-soft flex flex-col",
                plan.recommended
                  ? "border-brand-300 shadow-glow ring-1 ring-brand-200"
                  : "border-ink-200"
              )}
            >
              {plan.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-brand-500 to-blue-600 px-3 py-1 text-[11px] font-semibold text-white shadow-glow">
                  Most popular
                </div>
              )}
              <h3 className="text-lg font-semibold text-ink-900">{plan.name}</h3>
              <p className="mt-1 text-sm text-ink-500">{plan.tagline}</p>

              <div className="mt-6">
                {plan.price ? (
                  <p className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight text-ink-900">
                      {plan.price}
                    </span>
                    <span className="text-sm font-medium text-ink-500">
                      {plan.priceUnit}
                    </span>
                  </p>
                ) : (
                  <p className="text-2xl font-bold text-ink-900">{plan.priceNote}</p>
                )}
                <p className="mt-1 text-xs text-ink-500">{plan.priceSub}</p>
                {plan.entry && (
                  <p className="mt-3 inline-flex rounded-lg bg-ink-50 px-2.5 py-1 text-xs font-medium text-ink-700">
                    {plan.entry}
                  </p>
                )}
              </div>

              <ul className="mt-6 space-y-2.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-ink-700">
                    <Check className="h-4 w-4 text-brand-500 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={cn(
                  "mt-6 inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition",
                  plan.recommended
                    ? "bg-gradient-to-br from-brand-500 to-blue-600 text-white shadow-glow hover:brightness-110"
                    : "border border-ink-200 bg-white text-ink-800 hover:border-ink-300"
                )}
              >
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>

        <FadeIn className="mt-10">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-5 text-center sm:flex-row sm:text-left">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <TrendingDown className="h-5 w-5" />
            </span>
            <p className="text-sm text-emerald-800">
              <span className="font-semibold">Volume pricing, automatic.</span>{" "}
              The more you buy, the less you pay per unit. When you build an
              order in the dashboard, every extra IP or GB lowers your
              per-unit rate and the price updates live as your order grows.
            </p>
          </div>
        </FadeIn>

        <p className="mt-8 text-center text-sm text-ink-500">
          Have a custom or high-volume use case?{" "}
          <Link href="/contact" className="text-brand-600 font-medium">Talk to us</Link>.
        </p>
      </div>
    </section>
  );
}
