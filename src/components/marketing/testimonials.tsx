"use client";

import { Star } from "lucide-react";
import { motion } from "framer-motion";
import { FadeIn } from "@/components/animations/fade-in";

const REVIEWS = [
  {
    quote:
      "We moved 100% of our scraping pipeline to Oforson. Rotation is faster, success rate is up 38%, and our infra spend dropped.",
    name: "Sarah Chen",
    role: "Head of Data, Lumen Analytics",
    avatar: "SC"
  },
  {
    quote:
      "The dashboard is hands down the cleanest in the proxy space. Bandwidth alerts and per-country breakdowns saved us a week of internal tooling.",
    name: "Marcus Holt",
    role: "Engineering Lead, Replyform",
    avatar: "MH"
  },
  {
    quote:
      "Sticky sessions just work. We run long-lived sessions for verification flows and have never had a fingerprint flag.",
    name: "Anika Patel",
    role: "CTO, Northbeam",
    avatar: "AP"
  },
  {
    quote:
      "Best price-to-performance we tested across 9 vendors. Their support actually understands networking.",
    name: "Diego Romero",
    role: "Founder, Quanta Labs",
    avatar: "DR"
  },
  {
    quote:
      "Onboarded in 11 minutes. Live in production the same day. Their API is what every proxy company should ship.",
    name: "Yuki Tanaka",
    role: "Staff Engineer, Sage AI",
    avatar: "YT"
  },
  {
    quote:
      "Audit logs and seat-level controls were the unlock for our compliance team. Worth it on those alone.",
    name: "Eve Adler",
    role: "VP Security, Halo Trust",
    avatar: "EA"
  }
];

export function Testimonials() {
  return (
    <section className="section bg-white">
      <div className="container mx-auto">
        <FadeIn className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
            Testimonials
          </p>
          <h2 className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight text-ink-900">
            Loved by teams shipping the modern web.
          </h2>
        </FadeIn>

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {REVIEWS.map((r, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="rounded-2xl border border-ink-200 bg-white p-6 shadow-soft"
            >
              <div className="flex items-center gap-0.5 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <p className="mt-4 text-sm text-ink-800 leading-relaxed">"{r.quote}"</p>
              <div className="mt-5 flex items-center gap-3 border-t border-ink-100 pt-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-blue-600 text-sm font-bold text-white">
                  {r.avatar}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink-900">{r.name}</p>
                  <p className="text-xs text-ink-500">{r.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
