"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "./logo";
import { SidebarNav } from "./sidebar";
import type { NavItem } from "@/constants/nav";

/**
 * Mobile navigation for the dashboard / admin areas. The desktop sidebar
 * is hidden below `lg`, so on small screens this renders a hamburger
 * button in the top bar that opens a slide-in drawer with the same nav.
 *
 * The drawer is rendered through a portal into `document.body`. The top
 * bar that hosts this component uses `backdrop-blur`, and any element
 * with a `backdrop-filter` becomes the containing block for
 * `position: fixed` descendants. Left inline, the `fixed inset-0`
 * overlay would be clipped to the 64px-tall header instead of filling
 * the viewport — which collapsed the drawer down to just its header.
 * Portaling to `<body>` escapes that containing block.
 */
export function MobileSidebar({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  // Portals require the DOM — only render the drawer after mount.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll and allow Escape-to-close while the drawer is open.
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
                  transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
                  className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-xl"
                >
                  <div className="flex items-center justify-between border-b border-ink-100 px-5 py-5">
                    <Logo />
                    <button
                      onClick={() => setOpen(false)}
                      className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 transition"
                      aria-label="Close navigation menu"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <SidebarNav items={items} onNavigate={() => setOpen(false)} />
                </motion.aside>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
