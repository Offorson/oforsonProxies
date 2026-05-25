"use client";

import { Monitor, Smartphone, Tablet } from "lucide-react";
import { cn } from "@/utils/cn";

export type Viewport = "mobile" | "tablet" | "desktop";

export const VIEWPORT_WIDTH: Record<Viewport, number> = {
  mobile: 390,
  tablet: 768,
  desktop: 1280,
};

interface Props {
  value: Viewport;
  onChange: (v: Viewport) => void;
  options?: Viewport[];
  className?: string;
}

/**
 * Reusable segmented toggle for previewing UI at mobile/tablet/desktop.
 * Used by the QA sandbox today; safe to drop into marketing previews too.
 */
export function ViewportToggle({
  value,
  onChange,
  options = ["mobile", "tablet", "desktop"],
  className,
}: Props) {
  const icons: Record<Viewport, React.ReactNode> = {
    mobile: <Smartphone className="h-4 w-4" />,
    tablet: <Tablet className="h-4 w-4" />,
    desktop: <Monitor className="h-4 w-4" />,
  };

  return (
    <div
      role="tablist"
      aria-label="Viewport size"
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-ink-200 bg-white p-1 shadow-soft",
        className
      )}
    >
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors",
              active
                ? "bg-ink-900 text-white"
                : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
            )}
          >
            {icons[opt]}
            {opt}
          </button>
        );
      })}
    </div>
  );
}
