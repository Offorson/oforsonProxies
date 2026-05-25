"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ChevronRight,
  RefreshCw,
  Repeat,
  Rocket,
  X,
} from "lucide-react";

/** The add-ons that have an in-app explainer. */
export type AddonFaqId = "recurring" | "manual" | "high-priority";

interface FaqEntry {
  id: AddonFaqId;
  title: string;
  /** One-line summary shown in the overview list. */
  summary: string;
  icon: ReactNode;
  /** The full explanation, split into labelled sections. */
  body: { heading: string; text: string }[];
}

/**
 * Plain-language explanations for every add-on. This is the single source
 * of content for the in-app add-on guide — the info icons on the checkout
 * panel open straight to the matching entry.
 */
export const ADDON_FAQ: FaqEntry[] = [
  {
    id: "recurring",
    title: "Recurring Replacements",
    summary: "Automatically swap your whole proxy list on a fixed schedule.",
    icon: <RefreshCw className="h-4 w-4" />,
    body: [
      {
        heading: "What it does",
        text: "Recurring Replacements refresh every proxy on your plan on a schedule you choose — monthly, weekly, daily, hourly, or a custom interval. Each refresh retires your current IPs and issues a fresh set, so you are never working from a stale list.",
      },
      {
        heading: "When to use it",
        text: "Ideal if your targets gradually block IPs over time, or if you simply want a clean set of proxies at the start of every cycle without lifting a finger. The shorter the interval, the fresher your pool — and the higher the add-on cost.",
      },
      {
        heading: "Choosing a frequency",
        text: "Pick one of the presets, or choose Custom to set any interval down to the minute. \"No Refreshes\" turns the schedule off entirely — you can still swap proxies yourself with Manual Replacements.",
      },
      {
        heading: "How it is billed",
        text: "The cost is quoted live from our upstream network and is already folded into the price you see. Faster schedules cost more because they cycle through more IPs.",
      },
    ],
  },
  {
    id: "manual",
    title: "Manual Replacements",
    summary: "A pool of on-demand proxy swaps you trigger yourself.",
    icon: <Repeat className="h-4 w-4" />,
    body: [
      {
        heading: "What it does",
        text: "Manual Replacements give you a set number of one-off proxy swaps. When a specific proxy stops working — blocked, slow, or flagged — you replace just that IP from your dashboard, leaving the rest of your list untouched.",
      },
      {
        heading: "When to use it",
        text: "Best when only a handful of proxies go bad and you want precise control over which IPs change and when, rather than refreshing the whole list. You can also use them to move individual proxies to a different country, ASN, or IP range.",
      },
      {
        heading: "Choosing an amount",
        text: "Pick how many replacements to keep on hand — 10, 50, up to 5,000, or a custom count. Unused replacements stay available for the life of your plan.",
      },
      {
        heading: "How it is billed",
        text: "Each replacement in your pool is priced live from our upstream network and is rolled into the total shown at checkout.",
      },
    ],
  },
  {
    id: "high-priority",
    title: "High-priority network",
    summary: "Route your traffic over the premium low-latency backbone.",
    icon: <Rocket className="h-4 w-4" />,
    body: [
      {
        heading: "What it does",
        text: "High-priority network upgrades every proxy on your plan to our premium routing tier. Traffic takes faster, less-congested paths for lower latency and steadier throughput.",
      },
      {
        heading: "When to use it",
        text: "Worth it for latency-sensitive work — real-time scraping, checkout automation, ad verification — or any time consistent speed matters more than squeezing the price.",
      },
      {
        heading: "How it is billed",
        text: "A flat upgrade applied across your whole plan. The live cost is folded into the price shown at checkout.",
      },
    ],
  },
];

/**
 * A slide-over panel that explains the checkout add-ons without navigating
 * away from the billing page. It renders into a portal and never unmounts
 * the checkout panel, so whatever the customer was configuring is kept
 * exactly as it was. On mobile it becomes a full-screen sheet.
 *
 *   • Overview  — the list of every add-on topic.
 *   • Article   — one topic, opened directly from an info icon.
 *
 * Back returns from an article to the overview; the close (X) button
 * dismisses the panel entirely and reveals the billing page untouched.
 */
export function AddonInfoPanel({
  open,
  focusId,
  onClose,
}: {
  open: boolean;
  focusId: AddonFaqId | null;
  onClose: () => void;
}) {
  const [viewId, setViewId] = useState<AddonFaqId | null>(focusId);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Each time the panel opens, jump to whichever topic was requested.
  useEffect(() => {
    if (open) setViewId(focusId);
  }, [open, focusId]);

  // Lock background scroll and wire up Escape-to-close while open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  const entry = viewId
    ? ADDON_FAQ.find((e) => e.id === viewId) ?? null
    : null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex">
          {/* Backdrop — billing page stays mounted and visible behind it. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel — full-screen sheet on mobile, right drawer on desktop. */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative ml-auto flex h-full w-full flex-col bg-white shadow-2xl sm:max-w-md"
            role="dialog"
            aria-modal="true"
            aria-label="Add-on guide"
          >
            {/* Header — back (article only) on the left, close on the right. */}
            <div className="flex items-center justify-between gap-2 border-b border-ink-100 px-4 py-3.5">
              {entry ? (
                <button
                  type="button"
                  onClick={() => setViewId(null)}
                  className="-ml-1.5 flex items-center gap-1 rounded-lg px-1.5 py-1 text-sm font-medium text-ink-600 transition hover:bg-ink-100"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              ) : (
                <span className="text-sm font-semibold text-ink-900">
                  Add-on guide
                </span>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close add-on guide"
                className="rounded-lg p-2 text-ink-500 transition hover:bg-ink-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              {entry ? (
                <article>
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      {entry.icon}
                    </span>
                    <h2 className="text-lg font-semibold text-ink-900">
                      {entry.title}
                    </h2>
                  </div>
                  <p className="mt-2 text-sm text-ink-500">{entry.summary}</p>
                  <div className="mt-5 space-y-5">
                    {entry.body.map((section) => (
                      <div key={section.heading}>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-600">
                          {section.heading}
                        </h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-ink-700">
                          {section.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              ) : (
                <div>
                  <p className="text-sm text-ink-500">
                    Every optional extra you can add to a plan, explained.
                    Pick a topic to read more.
                  </p>
                  <ul className="mt-4 space-y-2.5">
                    {ADDON_FAQ.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setViewId(item.id)}
                          className="flex w-full items-center gap-3 rounded-xl border border-ink-200 p-3.5 text-left transition hover:border-ink-300 hover:bg-ink-50/60"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                            {item.icon}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-ink-900">
                              {item.title}
                            </span>
                            <span className="block text-xs leading-snug text-ink-500">
                              {item.summary}
                            </span>
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-ink-400" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
