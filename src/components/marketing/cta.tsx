"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FadeIn } from "@/components/animations/fade-in";

export function CTA() {
  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto">
        <FadeIn>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink-900 via-ink-900 to-brand-800 px-8 py-16 text-center shadow-soft">
            <div className="absolute inset-0 bg-grid-light opacity-10" />
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-[600px] rounded-full bg-brand-400/30 blur-3xl" />
            <div className="relative">
              <h2 className="text-balance text-4xl sm:text-5xl font-bold tracking-tight text-white">
                Ready to power your data stack?
              </h2>
              <p className="mt-4 max-w-xl mx-auto text-lg text-ink-300">
                Start with 1 GB free. Scale into millions of requests when you're ready.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-ink-900 shadow-soft hover:bg-ink-100 transition"
                >
                  Get started free
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur hover:bg-white/20 transition"
                >
                  Talk to sales
                </Link>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
