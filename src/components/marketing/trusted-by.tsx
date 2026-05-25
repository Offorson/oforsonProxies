"use client";

import { motion } from "framer-motion";

const LOGOS = [
  "Acme",
  "Stripe",
  "Linear",
  "Vercel",
  "Notion",
  "Framer",
  "Supabase",
  "Raycast",
  "OpenAI",
  "Cloudflare"
];

export function TrustedBy() {
  return (
    <section className="py-16 border-y border-ink-200 bg-white">
      <div className="container mx-auto">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-ink-500">
          Trusted by data teams at modern companies
        </p>
        <div className="mt-8 relative overflow-hidden">
          <motion.div
            className="flex gap-12 items-center"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 30, ease: "linear", repeat: Infinity }}
          >
            {[...LOGOS, ...LOGOS].map((name, i) => (
              <div
                key={i}
                className="flex-shrink-0 text-2xl font-semibold tracking-tight text-ink-400 hover:text-ink-700 transition"
              >
                {name}
              </div>
            ))}
          </motion.div>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-white to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-white to-transparent" />
        </div>
      </div>
    </section>
  );
}
