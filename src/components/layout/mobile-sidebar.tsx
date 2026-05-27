"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "./logo";
import { SidebarNav } from "./sidebar";
import type { NavItem } from "@/constants/nav";

export function MobileSidebar({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden -ml-1 rounded-lg p-2 text-ink-700 hover:bg-ink-100 transition"
        aria-label="Open navigation menu"
        aria-expanded={open}
      >
        <Menu className="h-5 w-5" />
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <div className="lg:hidden fixed inset-0 z-50">
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setOpen(false)}
                  className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm"
                />
                {/* Drawer */}
                <motion.aside
                  initial={{ x: "-100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "-100%" }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl flex flex-col"
                >
                  <div className="flex items-center justify-between px-4 py-4 border-b border-ink-100">
                    <Logo />
                    <button
                      onClick={() => setOpen(false)}
                      className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 transition"
                      aria-label="Close menu"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto py-4 px-3">
                    <SidebarNav items={items} />
                  </div>
                </motion.aside>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
