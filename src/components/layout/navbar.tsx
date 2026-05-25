"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "./logo";
import { MARKETING_NAV } from "@/constants/nav";
import { cn } from "@/utils/cn";

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const hasDarkHero = pathname === "/";

  useEffect(() => {
    const threshold = hasDarkHero ? window.innerHeight - 64 : 12;
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [hasDarkHero]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  const isOverDark = hasDarkHero && !scrolled && !open;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-all duration-300",
        isOverDark
          ? "bg-transparent"
          : "border-b border-black bg-white shadow-sm"
      )}
    >
      <nav className="container mx-auto flex h-16 items-center justify-between px-6">
        <Logo dark={isOverDark} />

        <ul className="hidden md:flex items-center gap-1">
          {MARKETING_NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "px-3 py-2 rounded-lg text-sm font-medium transition",
                  isOverDark
                    ? "text-white/85 hover:text-white hover:bg-white/10"
                    : "text-black hover:text-black hover:bg-ink-100"
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden md:flex items-center gap-2">
          <Link
            href="/login"
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition",
              isOverDark
                ? "text-white/85 hover:text-white hover:bg-white/10"
                : "text-black hover:text-black hover:bg-ink-100"
            )}
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition shadow-lg",
              isOverDark
                ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400 shadow-cyan-500/25"
                : "btn-primary"
            )}
          >
            Get started
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Mobile actions: a visible Log in button + the menu toggle */}
        <div className="flex items-center gap-1 md:hidden">
          <Link
            href="/login"
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-semibold transition",
              isOverDark
                ? "text-white/90 hover:bg-white/10"
                : "text-black hover:bg-ink-100"
            )}
          >
            Log in
          </Link>
          <button
            onClick={() => setOpen((o) => !o)}
            className={cn(
              "relative z-50 rounded-lg p-2 transition",
              isOverDark
                ? "text-white hover:bg-white/10"
                : "text-black hover:bg-ink-100"
            )}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            <AnimatePresence mode="wait" initial={false}>
              {open ? (
                <motion.span
                  key="close-icon"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="block"
                >
                  <X className="h-5 w-5" />
                </motion.span>
              ) : (
                <motion.span
                  key="menu-icon"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="block"
                >
                  <Menu className="h-5 w-5" />
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="md:hidden fixed inset-0 top-16 z-30 bg-white px-6 py-6 flex flex-col gap-2 overflow-y-auto"
          >
            {MARKETING_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl px-4 py-3 text-base font-medium text-black hover:bg-ink-100 transition"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-4 flex flex-col gap-3">
              <Link
                href="/login"
                className="w-full rounded-xl border border-ink-200 px-5 py-3 text-center text-sm font-semibold text-black hover:bg-ink-100 transition"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="btn-primary w-full justify-center py-3 text-sm"
              >
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
