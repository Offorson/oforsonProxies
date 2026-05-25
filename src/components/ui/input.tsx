import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, icon, rightElement, id, ...props }, ref) => (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-ink-800">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">{icon}</span>
        )}
        <input
          id={id}
          ref={ref}
          className={cn(
            "w-full rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-400",
            "focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition",
            icon && "pl-10",
            rightElement && "pr-10",
            error && "border-rose-400 focus:ring-rose-500/10 focus:border-rose-500",
            className
          )}
          {...props}
        />
        {rightElement && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400">
            {rightElement}
          </span>
        )}
      </div>
      {hint && !error && (
        <p className="text-xs text-ink-400">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-rose-500">{error}</p>
      )}
    </div>
  )
);

Input.displayName = "Input";
