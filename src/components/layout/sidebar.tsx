"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Globe2,
  Activity,
  Wifi,
  KeyRound,
  CreditCard,
  Settings,
  Users,
  Boxes,
  TrendingUp,
  ScrollText,
  LifeBuoy,
  HeartPulse,
  Megaphone,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "./logo";
import { cn } from "@/utils/cn";
import type { NavIconKey, NavItem } from "@/constants/nav";

const ICONS: Record<NavIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  globe: Globe2,
  activity: Activity,
  wifi: Wifi,
  key: KeyRound,
  "credit-card": CreditCard,
  settings: Settings,
  users: Users,
  boxes: Boxes,
  "trending-up": TrendingUp,
  scroll: ScrollText,
  lifebuoy: LifeBuoy,
  "heart-pulse": HeartPulse,
  megaphone: Megaphone,
  shield: Shield,
};

export function SidebarNav({
  items,
  onNavigate,
}: {
  items: NavItem[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active =
          pathname === item.href ||
          (item.href !== "/dashboard" &&
            item.href !== "/admin" &&
            pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              active
                ? "bg-gradient-to-r from-brand-50 to-blue-50 text-brand-700 shadow-sm"
                : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
            )}
          >
            {Icon && (
              <Icon className={cn("h-4 w-4", active && "text-brand-600")} />
            )}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({
  items,
  footer,
}: {
  items: NavItem[];
  footer?: React.ReactNode;
}) {
  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-ink-200 bg-white">
      <div className="flex h-16 items-center border-b border-ink-100 px-5">
        <Logo />
      </div>
      <SidebarNav items={items} />
      {footer && (
        <div className="border-t border-ink-100 p-3">{footer}</div>
      )}
    </aside>
  );
}
