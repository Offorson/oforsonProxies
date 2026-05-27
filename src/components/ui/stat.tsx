import { cn } from "@/utils/cn";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

interface StatProps {
  label: string;
  value: string | number;
  delta?: number;
  hint?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function Stat({ label, value, delta, hint, icon, className }: StatProps) {
  return (
    <div className={cn("rounded-2xl border border-ink-200 bg-white p-3.5 sm:p-5 shadow-soft", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm text-ink-500 truncate">{label}</p>
          <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold tracking-tight text-ink-900 truncate">{value}</p>
        </div>
        {icon && (
          <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-blue-50 text-brand-600 shrink-0">
            {icon}
          </div>
        )}
      </div>
      {(delta !== undefined || hint) && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {delta !== undefined && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-medium",
                delta >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              )}
            >
              {delta >= 0 ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
          {hint && <span className="text-ink-500">{hint}</span>}
        </div>
      )}
    </div>
  );
}
