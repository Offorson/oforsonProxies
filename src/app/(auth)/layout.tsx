import Link from "next/link";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/layout/logo";

const features = [
  "Residential, ISP & datacenter proxies in one dashboard",
  "Global country coverage",
  "Zero-log policy — your traffic stays private",
  "Fast, stable connections",
  "Instant provisioning — no waiting period",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ───────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-12 py-10 relative overflow-hidden shrink-0">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-brand-500/10 blur-3xl" />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl" />
        </div>

        {/* Top */}
        <div className="relative z-10 flex flex-col items-start gap-7">
          <Logo dark />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-white/25 hover:bg-white/10 hover:text-white transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
          </Link>
        </div>

        {/* Middle */}
        <div className="relative z-10">
          <h2 className="text-3xl font-bold text-white leading-tight mb-3">
            The proxy infrastructure<br />built for scale.
          </h2>
          <p className="text-slate-400 text-base mb-8">
            Built for developers, scrapers, and data teams that need proxies
            they can rely on.
          </p>
          <ul className="space-y-3">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-3 text-slate-300 text-sm">
                <CheckCircle2 className="h-4 w-4 text-brand-400 mt-0.5 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/*
          HIDDEN: placeholder review badges (Trustpilot / G2 / Capterra) with
          fabricated rating counts. Restore by un-commenting this block once
          real third-party reviews exist.

        <div className="relative z-10 flex gap-6">
          {[
            { label: "Trustpilot", stars: 5, count: "2.4k" },
            { label: "G2", stars: 5, count: "890" },
            { label: "Capterra", stars: 5, count: "430" },
          ].map(({ label, count }) => (
            <div key={label} className="text-center">
              <p className="text-xs text-slate-500 mb-0.5">{label}</p>
              <div className="flex gap-0.5 justify-center mb-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} className="h-3 w-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-xs text-slate-400">{count} reviews</p>
            </div>
          ))}
        </div>
        */}
      </div>

      {/* ── Right panel ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-white min-h-screen">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8">
          <Logo />
        </div>
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}
