"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { FadeIn } from "@/components/animations/fade-in";

const FAQS = [
  {
    q: "What's the difference between static and rotating residential?",
    a: "Static (ISP) residential IPs stay assigned to you for the duration of your subscription, great for account-bound workflows. Rotating residential pulls a fresh IP from a large residential pool on each request, optimal for scraping at scale."
  },
  {
    q: "How is billing calculated?",
    a: "Datacenter and Static ISP proxies are billed per IP; Rotating Residential is billed by bandwidth (GB). Every order is priced live as you configure it, and you can adjust or cancel anytime."
  },
  {
    q: "Do you offer a free option?",
    a: "A free starter tier is on the way. New accounts will be able to claim a small allocation of datacenter proxies to test the platform. No credit card required."
  },
  {
    q: "Can I target specific countries?",
    a: "Yes. Choose a country when you configure a proxy in the dashboard, or add a country modifier to your session string."
  },
  {
    q: "What integrations do you support?",
    a: "Proxies work with any HTTP/HTTPS client or scraper using standard host:port:username:password credentials. A REST API is available for generating and managing proxies programmatically."
  },
  {
    q: "How do you handle data protection?",
    a: "We follow GDPR-aligned data practices and do not log the contents of proxied traffic. You can request data export or deletion at any time, and we can provide a signed DPA on request. We are not currently SOC 2 certified."
  }
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="section bg-ink-50/40">
      <div className="container mx-auto">
        <FadeIn className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">FAQ</p>
          <h2 className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight text-ink-900">
            Questions, answered.
          </h2>
        </FadeIn>

        <div className="mt-12 mx-auto max-w-3xl divide-y divide-ink-200 rounded-2xl border border-ink-200 bg-white shadow-soft">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={i}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                >
                  <span className="text-base font-medium text-ink-900">{item.q}</span>
                  <Plus
                    className={`h-4 w-4 text-ink-500 transition-transform ${isOpen ? "rotate-45 text-brand-600" : ""}`}
                  />
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-5 text-sm text-ink-600 leading-relaxed">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
