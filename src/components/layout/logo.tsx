import Link from "next/link";
import { cn } from "@/utils/cn";

interface LogoProps {
  dark?: boolean;
  className?: string;
}

export function Logo({ dark = false, className }: LogoProps) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-1 group",
        className
      )}
    >
      {/* Icon */}
      <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-brand-500 text-white text-sm font-black shrink-0">
        OP
      </div>

      {/* Wordmark */}
      <span className={cn(
        "text-lg tracking-tight",
        dark
          ? "text-white group-hover:opacity-90 transition"
          : "text-slate-900 group-hover:opacity-80 transition"
      )}>
        <span className="font-medium">Oforson</span>
        <span className={cn(
          "font-black",
          dark ? "text-cyan-400" : "text-brand-500"
        )}>Proxies</span>
      </span>
    </Link>
  );
}
