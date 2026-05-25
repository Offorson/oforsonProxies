"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/cn";

const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-4 focus:ring-brand-500/20",
  {
    variants: {
      variant: {
        primary:
          "text-white bg-gradient-to-br from-brand-500 to-blue-600 shadow-glow hover:brightness-110 active:scale-[0.98]",
        secondary:
          "text-ink-900 bg-ink-100 hover:bg-ink-200 active:scale-[0.98]",
        outline:
          "text-ink-800 border border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50",
        ghost: "text-ink-700 hover:bg-ink-100",
        danger:
          "text-white bg-gradient-to-br from-rose-500 to-red-600 hover:brightness-110",
        glass: "glass text-ink-900 hover:bg-white/80"
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-10 px-5 text-sm",
        lg: "h-12 px-6 text-base",
        xl: "h-14 px-8 text-lg"
      }
    },
    defaultVariants: { variant: "primary", size: "md" }
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonStyles> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, ...props }, ref) => (
    <button ref={ref} className={cn(buttonStyles({ variant, size }), className)} {...props}>
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  )
);
Button.displayName = "Button";
