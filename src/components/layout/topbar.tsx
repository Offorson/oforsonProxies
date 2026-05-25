"use client";

import { Search, ChevronDown, LogOut, Settings, User } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NotificationsDropdown } from "./notifications-dropdown";
import { MobileSidebar } from "./mobile-sidebar";
import type { NavItem } from "@/constants/nav";

export function TopBar({
  user,
  navItems,
}: {
  user?: { name: string; email: string; avatar?: string };
  navItems?: NavItem[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const initial = (user?.name || user?.email || "U").charAt(0).toUpperCase();

  // Close the account menu on click/tap outside, or on Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/80 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-2 px-4 sm:px-6">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          {navItems && <MobileSidebar items={navItems} />}
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
            <input
              placeholder="Search proxies, sessions, docs…"
              className="w-full rounded-xl border border-ink-200 bg-ink-50/60 pl-10 pr-3 py-2 text-sm focus:bg-white focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <NotificationsDropdown />

          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white py-1 pl-1 pr-3 hover:border-ink-300 transition"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-blue-600 text-xs font-bold text-white">
                {initial}
              </span>
              <span className="hidden sm:flex flex-col items-start leading-tight">
                <span className="text-sm font-medium text-ink-900">{user?.name || "Account"}</span>
                <span className="text-[11px] text-ink-500">{user?.email || ""}</span>
              </span>
              <ChevronDown className="h-4 w-4 text-ink-500" />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="absolute right-0 mt-2 w-56 rounded-2xl border border-ink-200 bg-white shadow-soft p-1"
                >
                  {[
                    { label: "Profile", icon: User, href: "/dashboard/settings" },
                    { label: "Settings", icon: Settings, href: "/dashboard/settings" }
                  ].map(({ label, icon: Icon, href }) => (
                    <a
                      key={label}
                      href={href}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-700 hover:bg-ink-100"
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </a>
                  ))}
                  <div className="my-1 h-px bg-ink-100" />
                  <a
                    href="/api/auth/signout"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </a>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
